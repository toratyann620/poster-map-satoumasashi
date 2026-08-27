import { useState, useEffect, useMemo } from 'react';
import { MapWrapper } from './components/Map';
import { PinBottomSheet } from './components/PinBottomSheet';
import { SearchBar } from './components/SearchBar';
import { CsvActions } from './components/CsvActions';
import { Login } from './components/Login';
import { useSession } from './hooks/useSession';
import { scopedPinTypes } from './lib/groups';
import { useAppVersionGate } from './hooks/useAppVersionGate';
import { UpdatePrompt } from './components/UpdatePrompt';
import { AdminPanel } from './components/AdminPanel';
import { PosterCountWidget } from './components/PosterCountWidget';
import { NotificationPanel } from './components/NotificationPanel';
import { usePosterData } from './hooks/usePosterData';
import { useActivityLogs } from './hooks/useActivityLogs';
import { cityFromGeocoderResult, cityFromAddress } from './lib/city';
import { watchPosition, getCurrentPosition } from './lib/geolocation';
import type { PosterPin } from './types';
import { Plus, LogOut, Shield, Map as MapIcon, MapPin, X, Settings } from 'lucide-react';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { usePinTypes } from './hooks/usePinTypes';

function App() {
  // 認証・ユーザー情報・所属グループの解決はセッション層に集約している。
  // グループが決まるまでポスターの取得クエリを投げられないため（条件の無いクエリは
  // Firestore に拒否される）、個々のフックが独自に認証を待つ形はやめている。
  const session = useSession();
  const user = session.user;
  const authChecking = !session.ready;
  const versionGate = useAppVersionGate();

  const {
    filteredPosters,
    filter,
    setFilter,
    addPoster,
    updatePoster,
    deletePoster,
    setPosters,
    posters,
    userRole
  } = usePosterData();

  const { logs: activityLogs } = useActivityLogs(300);
  const { pinTypes } = usePinTypes();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPoster, setSelectedPoster] = useState<Partial<PosterPin> | null>(null);
  const [initialViewMode, setInitialViewMode] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'admin'>('map');
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | null>(null);
  const [fitBounds, setFitBounds] = useState<{ southwest: { lat: number, lng: number }, northeast: { lat: number, lng: number } } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  // 住所修正に伴い位置を再設定したピン（マーカーのドロップインエフェクト用、一時的に保持）
  const [justDroppedPinId, setJustDroppedPinId] = useState<string | null>(null);
  // 撤去ピンの表示設定（localStorageで端末ごとに持続）
  const [showRemovedPins, setShowRemovedPins] = useState<boolean>(
    () => localStorage.getItem('showRemovedPins') === 'true'
  );
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);

  // 入力欄に出す種類は、所属事務所が扱えるものだけに絞る。
  // 担当外の種別を選べてしまうと、保存の瞬間にルール側で拒否されて
  // 「入力したのに保存できない」状態になるため。
  // 地図のマーカー色には全種別のリストを使う（色の対応表として参照するだけのため）。
  const selectablePinTypes = useMemo(
    () => scopedPinTypes(session.group, pinTypes),
    [session.group, pinTypes],
  );

  // 全ポスターから使用されているユニークなタグ一覧を生成（早期リターン前に宣言する必要あり）
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posters.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [posters]);

  // 撤去ピンの表示制御を加味したポスターリスト（早期リターン前に宣言する必要あり）
  const displayPosters = useMemo(() => {
    return filteredPosters.filter(p => {
      if (p.removed) {
        return showRemovedPins;
      }
      return true;
    });
  }, [filteredPosters, showRemovedPins]);

  // 選択中のポスターの最新データをリアルタイム同期しているリストから取得（早期リターン前に宣言）
  const activePoster = useMemo(() => {
    if (!selectedPoster || !selectedPoster.id) return selectedPoster;
    return posters.find(p => p.id === selectedPoster.id) || selectedPoster;
  }, [selectedPoster, posters]);


  // 初回ロード時に現在地を取得して地図をジャンプさせ、以降は watchPosition で
  // 移動中も現在地ドットをリアルタイムに追従させる（地図の中心・ズームは初回ジャンプ時と
  // 現在地ボタン押下時のみ更新し、移動のたびに地図が勝手に再センタリングされないようにする）
  useEffect(() => {
    let hasCenteredOnce = false;
    // ネイティブでは OS の権限要求を挟む必要があるため、共通ラッパー経由で購読する
    const stop = watchPosition(
      (pos) => {
        setCurrentLocation(pos);
        if (!hasCenteredOnce) {
          hasCenteredOnce = true;
          setMapCenter(pos);
        }
      },
      (reason) => {
        // 起動時は黙って諦める（現在地ボタンを押したときに改めて案内する）
        console.warn('現在地を取得できません:', reason);
      },
    );
    return stop;
  }, []);

  const locateMe = async () => {
    const pos = await getCurrentPosition();
    if (!pos) {
      alert('現在地を取得できませんでした。\n端末の設定でこのアプリに位置情報の利用を許可してください。');
      return;
    }
    setCurrentLocation(pos);
    setMapCenter(pos);
  };

  // ---- ピン移動モード ----
  const [isRelocating, setIsRelocating] = useState(false);
  const [relocatingPin, setRelocatingPin] = useState<PosterPin | null>(null);

  // ---- ナビゲーションモード（単一ピンへの経路案内） ----
  const [navigationTarget, setNavigationTarget] = useState<PosterPin | null>(null);
  const [navigationMode, setNavigationMode] = useState<'DRIVING' | 'WALKING' | 'BICYCLING'>('DRIVING');

  const handleStartNavigation = (poster: PosterPin) => {
    setIsSheetOpen(false);
    setSelectedPoster(null);
    setNavigationTarget(poster);
  };

  const handleEndNavigation = () => {
    setNavigationTarget(null);
  };

  const handlePinLongPress = (poster: PosterPin) => {
    // BottomSheetが開いていたら閉じる
    setIsSheetOpen(false);
    setSelectedPoster(null);
    setIsRelocating(true);
    setRelocatingPin(poster);
  };

  const cancelRelocation = () => {
    setIsRelocating(false);
    setRelocatingPin(null);
  };

  const handlePlaceSelect = (lat: number, lng: number, name?: string, address?: string, url?: string) => {
    setMapCenter({ lat, lng });

    // 検索した場所の名前と住所情報を保持して、仮ピン（赤い跳ねるピン）を表示
    const formattedAddress = address ? address.replace(/^日本、/, '') : '';
    const mapsUrl = url || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    setSelectedPoster({
      lat,
      lng,
      type: '佐藤まさし',
      status: ['仮ピン'],
      address: formattedAddress,
      name: name || '選択された場所',
      googleMapsUrl: mapsUrl
    } as any);
    
    setInitialViewMode(false);
    setIsSheetOpen(false);
  };

  const handleImportSuccess = (imported: PosterPin[]) => {
    setFilter({ keyword: '', types: [], status: [], tags: [] });
    if (imported.length === 0) return;

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    imported.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    const latBuffer = 0.005;
    const lngBuffer = 0.005;
    setFitBounds({
      southwest: { lat: minLat - latBuffer, lng: minLng - lngBuffer },
      northeast: { lat: maxLat + latBuffer, lng: maxLng + lngBuffer }
    });
  };

  const handleMapClick = (lat: number, lng: number) => {
    // ナビゲーション中は地図タップでの新規ピン作成等を無効化する
    if (navigationTarget) return;

    // 移動モード中: 座標を確定
    if (isRelocating && relocatingPin) {
      if (relocatingPin.id === 'temp-marker-id') {
        // 仮ピンの移動: selectedPoster の緯度経度を更新して移動モードを抜ける
        setSelectedPoster(prev => prev ? { ...prev, lat, lng } : null);
        cancelRelocation();
        return;
      } else if (relocatingPin.id) {
        // 既存のピンの移動: Firestoreのアップデート
        updatePoster(relocatingPin.id, { lat, lng });
        cancelRelocation();
        return;
      }
    }

    // すでに仮ピンが立っている状態で、別のマップ領域をクリックした場合は、新規作成をキャンセルして仮ピンを消去
    if (selectedPoster && !selectedPoster.id) {
      setSelectedPoster(null);
      setIsSheetOpen(false);
      return;
    }

    // 通常モード: 新規ピン追加フォームを開く
    if (window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        let addressStr = '';
        let cityStr = '';
        if (status === 'OK' && results && results[0]) {
          addressStr = results[0].formatted_address.replace(/^日本、/, '').split(' ').pop() || '';
          // 市区町村はグループ権限の判定に使うため、住所文字列ではなく
          // ジオコーディングの構造化データ（locality）から確定させる
          cityStr = cityFromGeocoderResult(results[0]);
        }
        setSelectedPoster({ lat, lng, address: addressStr, city: cityStr, type: '佐藤まさし' });
        setInitialViewMode(false);
        setIsSheetOpen(true);
      });
    } else {
      setSelectedPoster({ lat, lng, type: '佐藤まさし' });
      setInitialViewMode(false);
      setIsSheetOpen(true);
    }
  };

  const handleMarkerClick = (poster: PosterPin) => {
    // ナビゲーション中は他のピンのタップを無効化する
    if (navigationTarget) return;

    setSelectedPoster(poster);
    
    // 仮ピン（保存前の検索ピン）がクリックされた場合
    const isTemp = poster.id === 'temp-marker-id' || (Array.isArray(poster.status) && poster.status.includes('仮ピン'));
    
    if (isTemp) {
      setInitialViewMode(false); // 新規登録（編集）モード
      
      // 住所が未取得の場合はこのタイミングで逆ジオコーディングをかける
      if (window.google && !poster.address) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: poster.lat, lng: poster.lng } }, (results, status) => {
          let addressStr = '';
          let cityStr = '';
          if (status === 'OK' && results && results[0]) {
            addressStr = results[0].formatted_address.replace(/^日本、/, '').split(' ').pop() || '';
            cityStr = cityFromGeocoderResult(results[0]);
          }
          setSelectedPoster(prev => ({ ...prev, address: addressStr, city: cityStr }));
          setIsSheetOpen(true);
        });
      } else {
        setIsSheetOpen(true);
      }
    } else {
      // 既存のピン：閲覧モードで開く
      setInitialViewMode(true);
      setIsSheetOpen(true);
    }
  };

  const handleSave = (posterData: Partial<PosterPin>, recalcLatLng?: boolean) => {
    const isExisting = !!posterData.id;

    // 新規ピン(住所のみ入力・座標未確定)、または既存ピンで「緯度経度も修正する」が
    // チェックされている場合のみ、住所から緯度経度を自動判定する
    const shouldGeocode = window.google && !!posterData.address && (
      (!isExisting && !posterData.lat) ||
      (isExisting && recalcLatLng)
    );

    if (shouldGeocode) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: posterData.address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          posterData.lat = results[0].geometry.location.lat();
          posterData.lng = results[0].geometry.location.lng();
          posterData.city = cityFromGeocoderResult(results[0]) || cityFromAddress(posterData.address);
          finishSave(posterData, isExisting);
        } else {
          if (isExisting) {
            // 既存ピン: ジオコーディングに失敗した場合は位置を変更しない
            alert('入力された住所から位置情報を取得できませんでした。ピンの位置は変更されません。');
          } else {
            posterData.lat = 35.4385;
            posterData.lng = 139.3620;
          }
          finishSave(posterData, false);
        }
      });
    } else {
      finishSave(posterData, false);
    }
  };

  const finishSave = (posterData: Partial<PosterPin>, didReposition: boolean) => {
    if (posterData.id) {
      updatePoster(posterData.id, posterData);
      if (didReposition && posterData.lat && posterData.lng) {
        // 位置が変わったことをわかりやすくするため、新しい位置へ画面を遷移させ、
        // ピンが新しく立つドロップインエフェクトを実行する
        setMapCenter({ lat: posterData.lat, lng: posterData.lng });
        setJustDroppedPinId(posterData.id);
        setTimeout(() => setJustDroppedPinId(null), 1600);
      }
    } else {
      if (!posterData.lat || !posterData.lng) {
        posterData.lat = 35.4385;
        posterData.lng = 139.3620;
      }
      addPoster(posterData as any);
    }
    setIsSheetOpen(false);
    setTimeout(() => {
      setSelectedPoster(null);
    }, 300);
  };

  const handleDelete = (id: string) => {
    const targetPoster = posters.find(p => p.id === id);
    if (window.confirm('本当にこのポスター情報を削除しますか？')) {
      deletePoster(id, targetPoster?.address);
      setIsSheetOpen(false);
      setTimeout(() => {
        setSelectedPoster(null);
      }, 300);
    }
  };

  // 撤去フラグを立てる（データを消さずに撤去済みにする）
  const handleRemove = (idOrAction: string) => {
    const isRestore = idOrAction.endsWith(':restore');
    const id = isRestore ? idOrAction.replace(':restore', '') : idOrAction;
    if (isRestore) {
      updatePoster(id, { removed: false });
    } else {
      if (window.confirm('このポスターを「撤去」しますか？\nデータは残りますがマップから非表示になります。')) {
        updatePoster(id, { removed: true });
        setIsSheetOpen(false);
        setTimeout(() => setSelectedPoster(null), 300);
      }
    }
  };

  const handleToggleShowRemoved = (val: boolean) => {
    setShowRemovedPins(val);
    localStorage.setItem('showRemovedPins', String(val));
  };

  if (authChecking) {
    return <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
    </div>;
  }

  if (!user) {
    return <Login />;
  }

  // アプリのバージョンが下限を割っている場合は利用を止める。
  // 古いクライアントが混ざると、権限判定に必要なフィールドを欠いたまま
  // 書き込まれるなどの不整合が起きるため。
  if (versionGate.blocked) {
    return (
      <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950 px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">アプリの更新が必要です</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {versionGate.message || 'ご利用を続けるには、最新版へ更新してください。'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-6 tabular-nums">
            現在のバージョン {versionGate.currentVersion} ／ 必要なバージョン {versionGate.minimumVersion} 以上
          </p>
          {versionGate.storeUrl && (
            <a href={versionGate.storeUrl} target="_blank" rel="noreferrer"
              className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
              更新する
            </a>
          )}
        </div>
      </div>
    );
  }

  // ログインはできたが、アカウントにグループが割り当てられていない場合。
  // この状態ではセキュリティルール側で全データが拒否されるため、
  // 「地図が真っ白で理由が分からない」状態にせず、原因を明示する。
  if (session.problem) {
    const detail = session.problem === 'no-user-doc'
      ? 'このアカウントはまだ利用が承認されていません。'
      : 'このアカウントにはグループ（事務所）が割り当てられていません。';
    return (
      <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950 px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">ご利用いただけません</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {detail}<br />管理者にお問い合わせください。
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">{session.user?.email}</p>
          <button
            onClick={() => signOut(auth)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    if (window.confirm('ログアウトしますか？')) {
      signOut(auth);
    }
  };

  const handleCancelTempPin = () => {
    setSelectedPoster(null);
    setIsSheetOpen(false);
  };

  return (
    <div className="h-dvh w-screen bg-gray-100 dark:bg-zinc-950 overflow-hidden relative">
      {/* 最新版でない場合のお知らせ。閉じられるので操作は妨げない
          （利用を止めるのは下限を割ったときだけ） */}
      <UpdatePrompt gate={versionGate} />

      {currentView === 'admin' && userRole === 'admin' ? (
        <AdminPanel
          onClose={() => setCurrentView('map')}
          showRemovedPins={showRemovedPins}
          onToggleShowRemoved={handleToggleShowRemoved}
          pinTypes={pinTypes}
        />
      ) : (
        <>
          {/* Map Area */}
          <MapWrapper
            posters={displayPosters}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            onPinLongPress={handlePinLongPress}
            onCancelTempPin={handleCancelTempPin}
            relocatingPoster={relocatingPin}
            selectedPoster={selectedPoster}
            centerLocation={mapCenter}
            fitBounds={fitBounds}
            currentLocation={currentLocation}
            pinTypes={pinTypes}
            onLocateMe={locateMe}
            justDroppedPinId={justDroppedPinId}
            navigationTarget={navigationTarget}
            navigationMode={navigationMode}
            onChangeNavigationMode={setNavigationMode}
            onExitNavigation={handleEndNavigation}
          />

          {/* ======  移動モード用UI  ====== */}
          {isRelocating && (
            <>
              {/* 白い半透明オーバーレイ（Z-indexを落としてマップ内のピンより下にする） */}
              <div
                className="absolute inset-0 z-[10] bg-white/40"
                style={{ pointerEvents: 'none' }}
              />

              {/* 上部案内バナー */}
              <div className="absolute top-safe-4 left-1/2 -translate-x-1/2 z-30 px-5 py-3 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4 shrink-0" />
                移動先の場所をタップしてください
              </div>

              {/* キャンセルボタン */}
              <div className="absolute bottom-safe-6 left-1/2 -translate-x-1/2 z-30">
                <button
                  onClick={cancelRelocation}
                  className="flex items-center gap-2 px-6 py-3.5 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-full shadow-xl border border-gray-200 dark:border-zinc-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                  移動をキャンセル
                </button>
              </div>
            </>
          )}

          {/* Floating UI Elements（移動モード・ナビゲーション中は非表示） */}
          {!isRelocating && !navigationTarget && (
            <>
              <SearchBar filter={filter} setFilter={setFilter} onPlaceSelect={handlePlaceSelect} allTags={allTags} pinTypes={selectablePinTypes} />

              {/* Floating Buttons: Expandable Menu with Gear Icon */}
              <div className="absolute bottom-safe-6 left-4 z-10 flex flex-col gap-3 items-center">
                {/* 展開されたメニューアイテム */}
                <div className={`flex gap-4 items-end transition-all duration-300 origin-bottom ${
                  isMenuExpanded 
                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto mb-1' 
                    : 'opacity-0 translate-y-4 scale-75 pointer-events-none h-0 overflow-hidden mb-0'
                }`}>
                  {/* 1列目: アプリ機能 */}
                  <div className="flex flex-col gap-3 items-center">
                    {/* Add New Button (FAB) */}
                    <button
                      onClick={() => {
                        setSelectedPoster({ type: '佐藤まさし' });
                        setInitialViewMode(false);
                        setIsSheetOpen(true);
                        setIsMenuExpanded(false);
                      }}
                      className="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
                      title="新規追加"
                    >
                      <Plus className="w-7 h-7" />
                    </button>

                    {/* Notification Bell */}
                    <NotificationPanel userId={user?.uid ?? null} posters={posters} />

                    {userRole === 'admin' && (
                      <button
                        onClick={() => {
                          setCurrentView(currentView === 'map' ? 'admin' : 'map');
                          setIsMenuExpanded(false);
                        }}
                        className={`${currentView === 'admin' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300'} p-3.5 rounded-full shadow-lg hover:bg-opacity-90 transition-colors flex items-center justify-center`}
                        title={currentView === 'map' ? "管理パネルへ" : "マップへ戻る"}
                      >
                        {currentView === 'map' ? <Shield className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuExpanded(false);
                      }}
                      className="bg-white dark:bg-zinc-800 p-3.5 rounded-full shadow-lg hover:bg-gray-50 flex items-center justify-center transition-colors"
                      title="ログアウト"
                    >
                      <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>

                  {/* 2列目: CSV機能 (管理者のみ) */}
                  {userRole === 'admin' && currentView === 'map' && (
                    <CsvActions posters={posters} setPosters={setPosters} onImportSuccess={handleImportSuccess} />
                  )}
                </div>

                {/* メニュー展開トリガー（歯車ボタン） */}
                <button
                  onClick={() => setIsMenuExpanded(!isMenuExpanded)}
                  className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-all ${
                    isMenuExpanded 
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border border-zinc-700 dark:border-zinc-300 rotate-90' 
                      : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                  title={isMenuExpanded ? "メニューを閉じる" : "メニューを開く"}
                >
                  {isMenuExpanded ? <X className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
                </button>
              </div>

              {/* ポスター枚数ウィジェット（全ユーザー） */}
              <PosterCountWidget posters={posters} activityLogs={activityLogs} />
            </>
          )}

          {/* Slide-up Bottom Sheet */}
          <PinBottomSheet
            isOpen={isSheetOpen && currentView === 'map' && !isRelocating && !navigationTarget}
            onClose={() => setIsSheetOpen(false)}
            poster={activePoster}
            initialViewMode={initialViewMode}
            allTags={allTags}
            pinTypes={selectablePinTypes}
            onSave={handleSave}
            onDelete={handleDelete}
            onRemove={handleRemove}
            onStartNavigation={handleStartNavigation}
          />
        </>
      )}
    </div>
  );
}

export default App;
