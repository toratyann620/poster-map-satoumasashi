import { useState, useEffect, useMemo } from 'react';
import { MapWrapper } from './components/Map';
import { PinBottomSheet } from './components/PinBottomSheet';
import { SearchBar } from './components/SearchBar';
import { CsvActions } from './components/CsvActions';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { PosterCountWidget } from './components/PosterCountWidget';
import { usePosterData } from './hooks/usePosterData';
import { useActivityLogs } from './hooks/useActivityLogs';
import type { PosterPin } from './types';
import { Plus, LogOut, Shield, Map as MapIcon, MapPin, X, Navigation } from 'lucide-react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function App() {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

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

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPoster, setSelectedPoster] = useState<Partial<PosterPin> | null>(null);
  const [initialViewMode, setInitialViewMode] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'admin'>('map');
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | null>(null);
  const [fitBounds, setFitBounds] = useState<{ southwest: { lat: number, lng: number }, northeast: { lat: number, lng: number } } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);

  // 初回ロード時に現在地を取得してジャンプする
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCurrentLocation(pos);
          setMapCenter(pos);
        },
        () => {
          console.warn('Geolocation permission denied or failed on load.');
        }
      );
    }
  }, []);

  const locateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCurrentLocation(pos);
          setMapCenter(pos);
        },
        () => {
          alert('現在地の取得に失敗しました。端末の位置情報設定などを確認してください。');
        }
      );
    } else {
      alert('現在地機能はお使いのブラウザでサポートされていません。');
    }
  };

  // ---- ピン移動モード ----
  const [isRelocating, setIsRelocating] = useState(false);
  const [relocatingPin, setRelocatingPin] = useState<PosterPin | null>(null);

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
        if (status === 'OK' && results && results[0]) {
          addressStr = results[0].formatted_address.replace(/^日本、/, '').split(' ').pop() || '';
        }
        setSelectedPoster({ lat, lng, address: addressStr, type: '佐藤まさし' });
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
          if (status === 'OK' && results && results[0]) {
            addressStr = results[0].formatted_address.replace(/^日本、/, '').split(' ').pop() || '';
          }
          setSelectedPoster(prev => ({ ...prev, address: addressStr }));
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

  const handleSave = (posterData: Partial<PosterPin>) => {
    if (!posterData.id && !posterData.lat && posterData.address && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: posterData.address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          posterData.lat = results[0].geometry.location.lat();
          posterData.lng = results[0].geometry.location.lng();
        } else {
          posterData.lat = 35.4385;
          posterData.lng = 139.3620;
        }
        finishSave(posterData);
      });
    } else {
      finishSave(posterData);
    }
  };

  const finishSave = (posterData: Partial<PosterPin>) => {
    if (posterData.id) {
      updatePoster(posterData.id, posterData);
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

  if (authChecking) {
    return <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
    </div>;
  }

  if (!user) {
    return <Login />;
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

  // 全ポスターから使用されているユニークなタグ一覧を生成
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posters.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [posters]);

  return (
    <div className="h-dvh w-screen bg-gray-100 dark:bg-zinc-950 overflow-hidden relative">
      {currentView === 'admin' && userRole === 'admin' ? (
        <AdminPanel onClose={() => setCurrentView('map')} />
      ) : (
        <>
          {/* Map Area */}
          <MapWrapper
            posters={filteredPosters}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            onPinLongPress={handlePinLongPress}
            onCancelTempPin={handleCancelTempPin}
            relocatingPoster={relocatingPin}
            selectedPoster={selectedPoster}
            centerLocation={mapCenter}
            fitBounds={fitBounds}
            currentLocation={currentLocation}
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
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-3 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4 shrink-0" />
                移動先の場所をタップしてください
              </div>

              {/* キャンセルボタン */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
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

          {/* Floating UI Elements（移動モード中は非表示） */}
          {!isRelocating && (
            <>
              <SearchBar filter={filter} setFilter={setFilter} onPlaceSelect={handlePlaceSelect} allTags={allTags} />

              {/* Floating Buttons: Add New, Admin Toggle & Logout */}
              <div className="absolute bottom-6 left-4 z-10 flex flex-col gap-3">
                {/* Add New Button (FAB) */}
                <button
                  onClick={() => {
                    setSelectedPoster({ type: '佐藤まさし' });
                    setInitialViewMode(false);
                    setIsSheetOpen(true);
                  }}
                  className="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
                  title="新規追加"
                >
                  <Plus className="w-7 h-7" />
                </button>

                {/* Current Location Button */}
                <button
                  onClick={locateMe}
                  className="bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
                  title="現在地へ移動"
                >
                  <Navigation className="w-6 h-6" />
                </button>

                {userRole === 'admin' && (
                  <button
                    onClick={() => setCurrentView(currentView === 'map' ? 'admin' : 'map')}
                    className={`${currentView === 'admin' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300'} p-3.5 rounded-full shadow-lg hover:bg-opacity-90 transition-colors flex items-center justify-center`}
                    title={currentView === 'map' ? "管理パネルへ" : "マップへ戻る"}
                  >
                    {currentView === 'map' ? <Shield className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-white dark:bg-zinc-800 p-3.5 rounded-full shadow-lg hover:bg-gray-50 flex items-center transition-colors"
                  title="ログアウト"
                >
                  <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>

              {userRole === 'admin' && currentView === 'map' && (
                <CsvActions posters={posters} setPosters={setPosters} onImportSuccess={handleImportSuccess} />
              )}

              {/* ポスター枚数ウィジェット（全ユーザー） */}
              <PosterCountWidget posters={posters} activityLogs={activityLogs} />
            </>
          )}

          {/* Slide-up Bottom Sheet */}
          <PinBottomSheet
            isOpen={isSheetOpen && currentView === 'map' && !isRelocating}
            onClose={() => setIsSheetOpen(false)}
            poster={selectedPoster}
            initialViewMode={initialViewMode}
            allTags={allTags}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  );
}

export default App;
