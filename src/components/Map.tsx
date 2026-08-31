/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { AGGREGATE_ZOOM, aggregateByTown, type TownAggregate } from '../lib/townAggregation';
import { Navigation, Car, Footprints, Bike, X } from 'lucide-react';
import type { PosterPin } from '../types';
import { PERSON_COLORS } from '../types';

// APIキー・Map IDは環境変数からのみ読み込む。
// ネイティブアプリではバンドルが端末上に配布され、直書きした値は抽出可能なうえ、
// 差し替えにストアの再配信が必要になるため、フォールバック値は持たせない。
// 未設定の場合は静かに別のキーへ切り替わるのではなく、明示的にエラーを表示する。
const MAP_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '';

type NavigationMode = 'DRIVING' | 'WALKING' | 'BICYCLING';

interface MapComponentProps {
    posters: PosterPin[];
    onMapClick: (lat: number, lng: number) => void;
    onMarkerClick: (poster: PosterPin) => void;
    onPinLongPress?: (poster: PosterPin) => void;
    onCancelTempPin?: () => void;
    relocatingPoster?: PosterPin | null;
    selectedPoster?: PosterPin | Partial<PosterPin> | null;
    centerLocation?: { lat: number, lng: number } | null;
    fitBounds?: { southwest: { lat: number, lng: number }, northeast: { lat: number, lng: number } } | null;
    currentLocation?: { lat: number, lng: number } | null;
    pinTypes?: { name: string, color: string }[];
    onLocateMe?: () => void;
    justDroppedPinId?: string | null;
    navigationTarget?: PosterPin | null;
    navigationMode?: NavigationMode;
    onChangeNavigationMode?: (mode: NavigationMode) => void;
    onExitNavigation?: () => void;
}

// 2地点間の直線距離（メートル）を算出する（ナビ中の再ルート判定に使用）
function haversineDistanceMeters(a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
    const R = 6371000;
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// ナビ案内文からHTMLタグを除去する
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '');

const render = (status: Status): React.ReactElement => {
    if (status === Status.LOADING) return <div className="p-4 text-center">Loading Map...</div>;
    if (status === Status.FAILURE) return <div className="p-4 text-center text-red-500">Error loading maps component</div>;
    return <></>;
};

/**
 * カスタムDOMマーカー要素を生成する関数
 * - type でベースカラーを決定
 * - status で透明度・アニメーション・バッジを重ね掛け
 * - isFloating = true の場合は浮いた大きいデザイン
 */
function buildDomMarker(poster: PosterPin, isFloating: boolean, colorsMap?: Record<string, string>): HTMLElement {
    const statuses: string[] = Array.isArray(poster.status) ? poster.status : (poster.status ? [poster.status] : []);
    const isTemp = poster.id === 'temp-marker-id' || statuses.includes('仮ピン');
    const hexColor = isTemp ? '#EA4335' : (colorsMap?.[poster.type] || PERSON_COLORS[poster.type as keyof typeof PERSON_COLORS] || '#6B7280');

    const isUninstalled = statuses.includes('未設置');
    const isReplacement = statuses.includes('張替え予定');
    const isInstalled = statuses.includes('設置済');
    const isGreeted = statuses.includes('挨拶済');
    const isNeedsRepair = statuses.includes('要修理');

    // コンテナ
    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        opacity: ${poster.removed ? '0.6' : (isUninstalled ? '0.5' : '1')};
        transform: ${isFloating ? 'scale(1.4) translateY(-8px)' : 'scale(1)'};
        transition: transform 0.2s;
        filter: ${poster.removed ? 'grayscale(80%)' : ''} ${isFloating ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))'};
    `;

    if (isTemp) {
        // 仮ピンの場合は、Tailwindのanimate-bounceを追加してピョコピョコ弾むアニメーションを適用
        container.classList.add('animate-bounce');
    }

    // ピン本体（ドロップ形状）
    const pinSize = isFloating ? 44 : 32;
    const pin = document.createElement('div');
    pin.style.cssText = `
        width: ${pinSize}px;
        height: ${pinSize}px;
        border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
        background-color: ${hexColor};
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: ${isFloating ? '0 8px 20px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.25)'};
        border: 2.5px solid rgba(255,255,255,0.6);
    `;

    // 種類の頭文字（仮ピンの場合は "+"）
    const initials = isTemp ? '+' : (poster.type ? poster.type.charAt(0) : '?');
    const label = document.createElement('span');
    label.textContent = initials;
    label.style.cssText = `
        color: white;
        font-weight: 700;
        font-size: ${isFloating ? '16px' : '12px'};
        font-family: -apple-system, sans-serif;
        line-height: 1;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        user-select: none;
    `;
    pin.appendChild(label);

    // ピンの三角形（先端）
    const tip = document.createElement('div');
    tip.style.cssText = `
        width: 0; height: 0;
        border-left: ${isFloating ? '7px' : '5px'} solid transparent;
        border-right: ${isFloating ? '7px' : '5px'} solid transparent;
        border-top: ${isFloating ? '10px' : '8px'} solid ${hexColor};
        margin-top: -1px;
    `;

    // バッジエリア（ピンの右下外側）
    if (isInstalled || isGreeted || isReplacement || isNeedsRepair) {
        const badges = document.createElement('div');
        badges.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: -8px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;

        if (isReplacement) {
            const b = document.createElement('div');
            b.textContent = '⚠️';
            b.style.cssText = `
                width: 16px; height: 16px;
                display: flex; align-items: center; justify-content: center;
                font-size: 14px;
            `;
            badges.appendChild(b);
        }

        if (isInstalled) {
            const b = document.createElement('div');
            b.textContent = '✓';
            b.style.cssText = `
                width: 16px; height: 16px;
                background: #22c55e;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 9px; color: white; font-weight: 700;
                border: 1.5px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            `;
            badges.appendChild(b);
        }

        if (isGreeted) {
            const b = document.createElement('div');
            b.textContent = '🤝';
            b.style.cssText = `
                width: 16px; height: 16px;
                background: #f97316;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 9px;
                border: 1.5px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            `;
            badges.appendChild(b);
        }

        if (isNeedsRepair) {
            const b = document.createElement('div');
            b.textContent = '🚨';
            b.style.cssText = `
                width: 16px; height: 16px;
                display: flex; align-items: center; justify-content: center;
                font-size: 14px;
            `;
            badges.appendChild(b);
        }

        pin.style.position = 'relative';
        pin.appendChild(badges);
    }

    if (isNeedsRepair) {
        const pulseRing = document.createElement('div');
        pulseRing.className = 'animate-ping absolute rounded-full border-4 border-red-500';
        pulseRing.style.cssText = `
            top: 0px; left: 0px;
            width: ${pinSize}px; height: ${pinSize}px;
            pointer-events: none;
            opacity: 0.75;
        `;
        pin.appendChild(pulseRing);
    }

    container.appendChild(pin);
    container.appendChild(tip);

    return container;
}

/**
 * 町域ごとの集計ピン。件数を数字で描く。
 *
 * 形は個別ピンと同じしずく型にして、中央の白丸に件数を入れる。
 * 色は件数で変えない（種類の色分けと取り違えるため）。
 *
 * 桁数でフォントサイズを落として白丸からはみ出さないようにする。
 * SVG をそのまま DOM に置くので、拡大してもぼやけない
 * （deck.gl のように一度ラスタライズする描画方式では、実寸の2倍で
 *   書き出す必要があるが、ここではその手当ては要らない）。
 */
// 個別ピン（32px の丸）より一回り大きい程度に留める。
// 大きすぎると町域が密集した地域でピンどうしが重なる。
const AGGREGATE_PIN_HEIGHT = 40;

function buildAggregateMarkerEl(town: TownAggregate): HTMLElement {
    const count = town.count;
    const fontSize = count < 100 ? 11 : count < 1000 ? 9 : 8;
    const width = Math.round(AGGREGATE_PIN_HEIGHT * (40 / 56));

    const el = document.createElement('div');
    el.style.cssText = `cursor: pointer; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));`;
    el.title = `${town.town}（${count}件）`;
    el.innerHTML = `
        <svg width="${width}" height="${AGGREGATE_PIN_HEIGHT}" viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 0C9 0 0 8.7 0 19.4c0 12.6 12.4 24.2 18.6 35.8a1.6 1.6 0 0 0 2.8 0C27.6 43.6 40 32 40 19.4 40 8.7 31 0 20 0z"
                  fill="#4f46e5" stroke="#ffffff" stroke-width="2"/>
            <circle cx="20" cy="18" r="9" fill="#ffffff"/>
            <text x="20" y="21" text-anchor="middle" font-size="${fontSize}" font-weight="700"
                  font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#4f46e5">${count}</text>
        </svg>`;
    return el;
}

const MapInner: React.FC<MapComponentProps> = ({
    posters,
    onMapClick,
    onMarkerClick,
    onPinLongPress,
    onCancelTempPin,
    relocatingPoster,
    selectedPoster,
    centerLocation,
    fitBounds,
    currentLocation,
    pinTypes = [],
    onLocateMe,
    justDroppedPinId,
    navigationTarget,
    navigationMode = 'DRIVING',
    onChangeNavigationMode,
    onExitNavigation
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const [heading, setHeading] = useState(0);
    const markersRef = useRef<any[]>([]);
    // ポスターピン用: id -> {marker, signature} で保持し、内容が変わったピンだけ作り直す（差分更新）
    const posterMarkersRef = useRef<Map<string, { marker: any, signature: string }>>(new Map());
    // 集計ピン（町域ごと）。ズームで表示が切り替わるたびに作り直す。
    // 破棄のために map を差し替えるだけなので、その一点だけ型を持たせる
    const aggregateMarkersRef = useRef<{ map: google.maps.Map | null }[]>([]);
    // 現在のズーム。AGGREGATE_ZOOM 未満なら集計ピン、以上なら個別ピンを描く
    const [zoom, setZoom] = useState<number>(14);
    // 完全に同一座標のピンが重なっている場合の「展開表示」対象グループ（緯度経度キー）。null = どれも展開していない
    const [spreadGroupKey, setSpreadGroupKey] = useState<string | null>(null);
    const overlapMarkersRef = useRef<any[]>([]);

    const colorsMap = React.useMemo(() => {
        const m: Record<string, string> = {};
        pinTypes.forEach(pt => {
            m[pt.name] = pt.color;
        });
        return m;
    }, [pinTypes]);

    // Stale closure回避: 常に最新のコールバックをリスナーから参照する
    const onMapClickRef = useRef(onMapClick);
    const onMarkerClickRef = useRef(onMarkerClick);
    const onPinLongPressRef = useRef(onPinLongPress);
    const onCancelTempPinRef = useRef(onCancelTempPin);
    const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

    useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
    useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
    useEffect(() => { onPinLongPressRef.current = onPinLongPress; }, [onPinLongPress]);
    useEffect(() => { onCancelTempPinRef.current = onCancelTempPin; }, [onCancelTempPin]);

    useEffect(() => {
        if (ref.current && !map) {
            const initialCenter = { lat: 35.43464926509994, lng: 139.3606671837154 };
            const newMap = new window.google.maps.Map(ref.current, {
                center: initialCenter,
                zoom: 14,
                disableDefaultUI: true,
                zoomControl: true,
                rotateControl: true,
                tiltControl: true,
                gestureHandling: 'greedy',
                isFractionalZoomEnabled: true,
                mapId: MAP_ID, // AdvancedMarkerElement に必須（環境変数 VITE_GOOGLE_MAPS_MAP_ID）
                renderingType: google.maps.RenderingType.VECTOR, // 明示的にベクトル(WebGL)モードを指定して回転を可能にする
            } as any);

            (window as any).map = newMap; // デバッグ用にグローバル露出

            newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
                if (e.latLng) {
                    // ref 経由で常に最新の関数を呼ぶ
                    onMapClickRef.current(e.latLng.lat(), e.latLng.lng());
                }
            });

            setMap(newMap);
        }
    }, [map]);

    // 地図の回転を検知する
    useEffect(() => {
        if (!map) return;
        const listener = map.addListener('heading_changed', () => {
            setHeading(map.getHeading() || 0);
        });
        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [map]);

    // ズーム操作をしたら、重なりピンの展開表示を自動的に閉じる
    useEffect(() => {
        if (!map) return;
        const listener = map.addListener('zoom_changed', () => {
            setSpreadGroupKey(null);
            setZoom(map.getZoom() ?? 14);
        });
        setZoom(map.getZoom() ?? 14);
        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [map]);

    // モバイル端末での2本指の回転ジェスチャ（ねじり）と拡大縮小（ピンチ）を実装する
    useEffect(() => {
        if (!map || !ref.current) return;

        let touchStartAngle = 0;
        let touchStartDist = 0;
        let initialHeading = 0;
        let initialZoom = 14;
        let isRotating = false;

        const getAngle = (t1: Touch, t2: Touch) => {
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            return Math.atan2(dy, dx) * (180 / Math.PI); // ラジアンから度に変換
        };

        const getDistance = (t1: Touch, t2: Touch) => {
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                isRotating = true;
                touchStartAngle = getAngle(e.touches[0], e.touches[1]);
                touchStartDist = getDistance(e.touches[0], e.touches[1]);
                initialHeading = map.getHeading() || 0;
                initialZoom = map.getZoom() || 14;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (isRotating && e.touches.length === 2) {
                // デフォルトのスクロールやブラウザの拡大縮小を防ぐ
                e.preventDefault();

                // 1. 回転
                const currentAngle = getAngle(e.touches[0], e.touches[1]);
                const deltaAngle = currentAngle - touchStartAngle;
                let newHeading = (initialHeading - deltaAngle) % 360;
                if (newHeading < 0) newHeading += 360;
                map.setHeading(newHeading);

                // 2. ズーム
                const currentDist = getDistance(e.touches[0], e.touches[1]);
                if (touchStartDist > 0) {
                    const ratio = currentDist / touchStartDist;
                    const zoomChange = Math.log2(ratio);
                    const newZoom = Math.max(0, Math.min(21, initialZoom + zoomChange));
                    map.setZoom(newZoom);
                }
            }
        };

        const handleTouchEnd = () => {
            isRotating = false;
        };

        const mapEl = ref.current;
        mapEl.addEventListener('touchstart', handleTouchStart, { passive: false });
        mapEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        mapEl.addEventListener('touchend', handleTouchEnd);
        mapEl.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            mapEl.removeEventListener('touchstart', handleTouchStart);
            mapEl.removeEventListener('touchmove', handleTouchMove);
            mapEl.removeEventListener('touchend', handleTouchEnd);
            mapEl.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [map]);

    const handleResetHeading = () => {
        if (map) {
            map.setHeading(0);
            map.setTilt(0);
        }
    };

    // Pan to searched location
    useEffect(() => {
        if (map && centerLocation) {
            map.panTo(centerLocation);
            map.setZoom(16);
        }
    }, [map, centerLocation]);

    // Fit Bounds
    useEffect(() => {
        if (map && fitBounds) {
            const bounds = new window.google.maps.LatLngBounds(fitBounds.southwest, fitBounds.northeast);
            map.fitBounds(bounds);
        }
    }, [map, fitBounds]);

    // Sync Markers (AdvancedMarkerElement)
    // ポスター件数が多くなっても軽快に動作するよう、以下の2点を行う:
    // 1. 内容が変わっていないピンは作り直さず、差分（追加・変更・削除）だけ処理する
    // 2. ポスターのピンを描く。広い縮尺（AGGREGATE_ZOOM 未満）では町域ごとの
    //    集計ピンへまとめ、寄せると個別のピンに切り替わる
    useEffect(() => {
        if (!map) return;

        // AdvancedMarkerElement が利用可能かチェック
        const AdvancedMarkerElement =
            (window.google.maps as any).marker?.AdvancedMarkerElement;

        if (!AdvancedMarkerElement) {
            console.warn('AdvancedMarkerElement not available. Check mapId and library versions.');
            return;
        }

        // ポスター1件用のマーカーを生成し、長押し・タップのイベントを付与する共通処理
        // （通常表示・重なり展開表示の両方から利用する）
        const createPosterMarker = (poster: PosterPin, opts: { isFloating: boolean, isDropped: boolean, extraClass?: string, zIndex?: number }) => {
            const domEl = buildDomMarker(poster, opts.isFloating, colorsMap);
            if (opts.isDropped) domEl.classList.add('pin-drop-animate');
            if (opts.extraClass) domEl.classList.add(opts.extraClass);

            const marker = new AdvancedMarkerElement({
                position: { lat: poster.lat, lng: poster.lng },
                title: poster.address || poster.memo || '',
                content: domEl,
                zIndex: opts.zIndex ?? (opts.isFloating ? 1000 : undefined),
            });

            // --- 2秒長押しで onPinLongPress 発火 ---
            let longPressTimer: ReturnType<typeof setTimeout> | null = null;

            const startLongPress = () => {
                domEl.classList.add('longpress-scaling');
                longPressTimer = setTimeout(() => {
                    if (onPinLongPressRef.current) onPinLongPressRef.current(poster);
                }, 2000);
            };

            const cancelLongPress = () => {
                domEl.classList.remove('longpress-scaling');
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };

            domEl.addEventListener('mousedown', startLongPress);
            domEl.addEventListener('touchstart', startLongPress, { passive: true });
            domEl.addEventListener('mouseup', cancelLongPress);
            domEl.addEventListener('touchend', cancelLongPress);

            // AdvancedMarkerElement は 'gmp-click' を使用（'click'は非推奨）
            marker.element?.addEventListener('gmp-click', () => {
                cancelLongPress();
                if (!relocatingPoster) {
                    onMarkerClickRef.current(poster);
                }
            });
            // フォールバック（古い環境）
            marker.addListener('click', () => {
                cancelLongPress();
                if (!relocatingPoster) {
                    onMarkerClickRef.current(poster);
                }
            });

            return { marker, domEl };
        };

        // 完全に同一座標（小数点6桁=約10cm精度で丸め）のポスターをグループ化する。
        // これらはズームインしても画面上で永遠に重なったままになるため、通常のクラスタリングとは別に
        // 「重なりマーカー（タップで展開）」として特別扱いする。
        const groupKeyOf = (p: PosterPin) => `${p.lat.toFixed(6)}_${p.lng.toFixed(6)}`;
        const groupedByPosition = new Map<string, PosterPin[]>();
        posters.forEach(p => {
            const key = groupKeyOf(p);
            if (!groupedByPosition.has(key)) groupedByPosition.set(key, []);
            groupedByPosition.get(key)!.push(p);
        });

        const overlapGroupKeys = new Set<string>();
        groupedByPosition.forEach((group, key) => {
            if (group.length > 1) overlapGroupKeys.add(key);
        });

        // 表示中の展開グループが、データ更新で解消された（1件になった等）場合は自動的に閉じる
        if (spreadGroupKey && !overlapGroupKeys.has(spreadGroupKey)) {
            setSpreadGroupKey(null);
        }

        // 広い縮尺では町域ごとの集計ピンにまとめる。ただし選択中・移動中のピンだけは
        // 個別に描き続ける。これが無いと、ピンを選んだまま地図を引いた瞬間に対象を見失う。
        const isAggregate = zoom < AGGREGATE_ZOOM;
        const keepIndividually = new Set<string>();
        if (selectedPoster?.id) keepIndividually.add(selectedPoster.id);
        if (relocatingPoster?.id) keepIndividually.add(relocatingPoster.id);

        const singlePosters = posters.filter(p =>
            !overlapGroupKeys.has(groupKeyOf(p))
            && (!isAggregate || keepIndividually.has(p.id)));

        const nextIds = new Set(singlePosters.map(p => p.id));
        const toRemove: any[] = [];
        const toAdd: any[] = [];

        // データから消えたポスター（削除・フィルタ対象外化・重なりグループへの移行等）のマーカーを除去
        posterMarkersRef.current.forEach((entry, id) => {
            if (!nextIds.has(id)) {
                toRemove.push(entry.marker);
                posterMarkersRef.current.delete(id);
            }
        });

        singlePosters.forEach(poster => {
            const isFloating = relocatingPoster?.id === poster.id;
            const isDropped = poster.id === justDroppedPinId;
            // 見た目・振る舞いに影響する項目だけを比較対象にする
            const signature = JSON.stringify([
                poster.lat, poster.lng, poster.type, poster.status, poster.removed,
                poster.address, poster.memo, isFloating, isDropped,
            ]);

            const existing = posterMarkersRef.current.get(poster.id);
            if (existing && existing.signature === signature) {
                return; // 変化なし。マーカーはそのまま維持する
            }
            if (existing) {
                toRemove.push(existing.marker);
            }

            const { marker } = createPosterMarker(poster, { isFloating, isDropped });

            posterMarkersRef.current.set(poster.id, { marker, signature });
            toAdd.push(marker);
        });

        toRemove.forEach(m => { m.map = null; });
        toAdd.forEach(m => { m.map = map; });

        // ==================== 完全に同一座標で重なっているピンの表示 ====================
        // 通常のクラスタリングは画面上のピクセル距離で判定するため、同一座標のピンはズームインしても
        // 永遠に重なったまま分離できない。そのため専用に「重なりバッジ付きピン（タップで展開）」を描画する。
        overlapMarkersRef.current.forEach(m => { m.map = null; });
        overlapMarkersRef.current = [];

        groupedByPosition.forEach((group, key) => {
            if (group.length < 2) return;
            // 集計表示中は重なりピンも出さない（町域の集計ピンに含めて数える）
            if (isAggregate) return;
            const center = { lat: group[0].lat, lng: group[0].lng };

            if (spreadGroupKey === key) {
                // 展開表示: 中心から円状にオフセットした位置に、ポスターごとの個別マーカーを配置する
                const zoom = map.getZoom() ?? 16;
                const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
                const radiusM = 42 * metersPerPixel; // 画面上で約42px広がるように調整

                group.forEach((poster, i) => {
                    const angle = (-90 + (360 * i) / group.length) * (Math.PI / 180);
                    const dLat = (radiusM * Math.sin(angle)) / 111320;
                    const dLng = (radiusM * Math.cos(angle)) / (111320 * Math.cos(center.lat * Math.PI / 180));

                    const spreadPoster: PosterPin = { ...poster, lat: center.lat + dLat, lng: center.lng + dLng };
                    const isFloating = relocatingPoster?.id === poster.id;
                    const isDropped = poster.id === justDroppedPinId;
                    const { marker } = createPosterMarker(spreadPoster, {
                        isFloating, isDropped, extraClass: 'pin-spread-animate', zIndex: 1200,
                    });
                    marker.map = map;
                    overlapMarkersRef.current.push(marker);
                });

                // 中心に「閉じる」ボタンを表示する
                const closeEl = document.createElement('div');
                closeEl.style.cssText = `
                    width: 28px; height: 28px;
                    background-color: #374151;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 16px; font-weight: 700;
                    line-height: 1;
                    border: 2.5px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                    cursor: pointer;
                `;
                closeEl.textContent = '×';
                closeEl.classList.add('pin-spread-animate');
                const closeMarker = new AdvancedMarkerElement({
                    position: center,
                    title: '閉じる',
                    content: closeEl,
                    zIndex: 1300,
                });
                closeEl.addEventListener('gmp-click', () => setSpreadGroupKey(null));
                closeMarker.addListener('click', () => setSpreadGroupKey(null));
                closeMarker.map = map;
                overlapMarkersRef.current.push(closeMarker);
            } else {
                // 重なり表示: 代表ピン1つに「件数バッジ」を重ねて表示し、重なっていることを視覚化する
                const representative = group[0];
                const domEl = buildDomMarker(representative, false, colorsMap);

                const badge = document.createElement('div');
                badge.textContent = `×${group.length}`;
                badge.style.cssText = `
                    position: absolute;
                    top: -6px;
                    right: -10px;
                    background-color: #DC2626;
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    min-width: 20px;
                    height: 20px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    border: 2px solid white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    pointer-events: none;
                `;
                domEl.appendChild(badge);

                const marker = new AdvancedMarkerElement({
                    position: center,
                    title: `${group.length}件のポスターが重なっています（タップで展開）`,
                    content: domEl,
                    zIndex: 950,
                });
                marker.element?.addEventListener('gmp-click', () => setSpreadGroupKey(key));
                marker.addListener('click', () => setSpreadGroupKey(key));
                marker.map = map;
                overlapMarkersRef.current.push(marker);
            }
        });

        // ==================== 町域ごとの集計ピン ====================
        // 広い縮尺では、ピンを町域（市区町村＋町名）ごとにまとめて件数を出す。
        // 距離でまとめる方式と違い、件数がそのまま「この地区に何枚あるか」になり、
        // 縮尺を変えてもまとまり方が動かない。
        aggregateMarkersRef.current.forEach(m => { m.map = null; });
        aggregateMarkersRef.current = [];

        if (isAggregate) {
            const targets = posters.filter(p => !keepIndividually.has(p.id));
            aggregateByTown(targets).forEach(town => {
                const el = buildAggregateMarkerEl(town);
                const marker = new AdvancedMarkerElement({
                    position: { lat: town.lat, lng: town.lng },
                    title: `${town.town}（${town.count}件）`,
                    content: el,
                    zIndex: 900,
                });

                // 掘り下げ: 個別ピンが出る縮尺まで寄せ、その町域の代表座標へ移動する。
                // 素の DOM の click ではなく Google 側のイベントを使う。DOM の click は
                // 地図まで伝わってしまい、地図タップ（新規ピンの追加）も同時に起きるため。
                const drillDown = () => {
                    map.setZoom(AGGREGATE_ZOOM);
                    map.panTo({ lat: town.lat, lng: town.lng });
                };
                marker.element?.addEventListener('gmp-click', drillDown);
                marker.addListener('click', drillDown); // 古い環境向けのフォールバック

                marker.map = map;
                aggregateMarkersRef.current.push(marker);
            });
        }

        // 新規追加中の「仮ピン」を地図上に描画（markersRef は仮ピン専用。毎回作り直すため先に破棄する）
        markersRef.current.forEach(m => { m.map = null; });
        markersRef.current = [];

        if (selectedPoster && !selectedPoster.id && selectedPoster.lat && selectedPoster.lng) {
            // 既存の仮ピン用 InfoWindow があれば閉じる
            if (infoWindowRef.current) {
                infoWindowRef.current.close();
                infoWindowRef.current = null;
            }

            const dummyPoster = {
                id: 'temp-marker-id',
                lat: selectedPoster.lat,
                lng: selectedPoster.lng,
                type: selectedPoster.type || '佐藤まさし',
                status: ['仮ピン'],
                address: selectedPoster.address || '',
                quantity: selectedPoster.quantity || 1,
                name: (selectedPoster as any).name || '選択された場所',
                googleMapsUrl: (selectedPoster as any).googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${selectedPoster.lat},${selectedPoster.lng}`
            } as any as PosterPin;
            
            const isFloating = relocatingPoster?.id === 'temp-marker-id';
            const domEl = buildDomMarker(dummyPoster, isFloating, colorsMap); // 移動中ならさらに浮いた大きなデザインに

            const marker = new AdvancedMarkerElement({
                position: { lat: selectedPoster.lat, lng: selectedPoster.lng },
                map,
                title: '新規追加プレイス',
                content: domEl,
                zIndex: 1500, // 通常のピンよりも最前面に表示
            });

            // --- 2秒長押しで onPinLongPress 発火 (仮ピン用移動調整) ---
            let longPressTimer: ReturnType<typeof setTimeout> | null = null;
            const startLongPress = () => {
                domEl.classList.add('longpress-scaling');
                longPressTimer = setTimeout(() => {
                    if (onPinLongPressRef.current) onPinLongPressRef.current(dummyPoster);
                }, 2000);
            };
            const cancelLongPress = () => {
                domEl.classList.remove('longpress-scaling');
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };
            domEl.addEventListener('mousedown', startLongPress);
            domEl.addEventListener('touchstart', startLongPress, { passive: true });
            domEl.addEventListener('mouseup', cancelLongPress);
            domEl.addEventListener('touchend', cancelLongPress);

            // 仮ピンのクリックイベント：親の onMarkerClick を呼び出す
            marker.element?.addEventListener('gmp-click', () => {
                cancelLongPress();
                if (onMarkerClickRef.current) {
                    onMarkerClickRef.current(dummyPoster);
                }
            });
            marker.addListener('click', () => {
                cancelLongPress();
                if (onMarkerClickRef.current) {
                    onMarkerClickRef.current(dummyPoster);
                }
            });

            // Google Map標準風の InfoWindow (吹き出し情報カード) を開く
            const escapeHtml = (str: string) => {
                return str
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            const infoHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 6px 4px; font-size: 13px; line-height: 1.4; color: #374151; max-width: 250px;">
                    <div style="font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml((dummyPoster as any).name || '選択された場所')}
                    </div>
                    <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">
                        日本<br/>${escapeHtml((dummyPoster.address || '').replace(/^日本、/, ''))}
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 6px;">
                        <a href="#" id="register-temp-btn" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                            新規登録する →
                        </a>
                    </div>
                </div>
            `;

            const infoWindow = new window.google.maps.InfoWindow({
                content: infoHtml,
                pixelOffset: new window.google.maps.Size(0, -10)
            });

            infoWindow.open({
                map,
                anchor: marker
            });
            infoWindowRef.current = infoWindow;

            // HTMLがDOMに配置されたタイミングで「新規登録する」ボタンにリスナーをアタッチ
            infoWindow.addListener('domready', () => {
                const registerBtn = document.getElementById('register-temp-btn');
                if (registerBtn) {
                    registerBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        cancelLongPress();
                        if (onMarkerClickRef.current) {
                            onMarkerClickRef.current(dummyPoster);
                        }
                    });
                }
            });

            // X をクリックした際のクローズイベント
            infoWindow.addListener('closeclick', () => {
                if (onCancelTempPinRef.current) {
                    onCancelTempPinRef.current();
                }
            });

            markersRef.current.push(marker);
        } else {
            // 仮ピンがない場合は確実に InfoWindow を閉じる
            if (infoWindowRef.current) {
                infoWindowRef.current.close();
                infoWindowRef.current = null;
            }
        }
    }, [map, posters, relocatingPoster, selectedPoster, justDroppedPinId, spreadGroupKey, zoom]);

    // Current Location Marker
    useEffect(() => {
        if (!map || !currentLocation) return;

        const AdvancedMarkerElement = (window.google.maps as any).marker?.AdvancedMarkerElement;
        if (!AdvancedMarkerElement) return;

        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 18px; height: 18px;
            background-color: #3B82F6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
        `;

        const marker = new AdvancedMarkerElement({
            position: currentLocation,
            map,
            content: dot,
            zIndex: 2000,
        });

        return () => {
            marker.map = null;
        };
    }, [map, currentLocation]);

    // ==================== ナビゲーション（単一ピンへの経路案内） ====================
    const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
    const [navError, setNavError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(true);
    const lastRouteOriginRef = useRef<{ lat: number, lng: number } | null>(null);
    const lastRouteTimeRef = useRef(0);
    const lastRouteKeyRef = useRef<string | null>(null);

    // DirectionsRenderer のセットアップ・ナビ終了時のクリーンアップ
    useEffect(() => {
        if (!map) return;
        if (!directionsRendererRef.current) {
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: { strokeColor: '#4F46E5', strokeWeight: 6, strokeOpacity: 0.85 },
            });
        }
        if (navigationTarget) {
            directionsRendererRef.current.setMap(map);
            setIsFollowing(true);
            map.setZoom(17);
        } else {
            directionsRendererRef.current.setMap(null);
            setDirectionsResult(null);
            setNavError(null);
            lastRouteOriginRef.current = null;
            lastRouteKeyRef.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, navigationTarget?.id]);

    // 現在地から目的地までの経路を検索・再検索する
    // （移動手段やナビ対象が変わった際は即座に、それ以外は「一定距離動いた かつ 一定時間経過」で再計算する）
    useEffect(() => {
        if (!map || !navigationTarget || !currentLocation) return;

        if (!directionsServiceRef.current) {
            directionsServiceRef.current = new window.google.maps.DirectionsService();
        }

        const key = `${navigationTarget.id}-${navigationMode}`;
        const forceRecompute = lastRouteKeyRef.current !== key;

        const origin = currentLocation;
        const last = lastRouteOriginRef.current;
        const now = Date.now();
        const movedEnough = !last || haversineDistanceMeters(last, origin) > 40;
        const timeElapsed = now - lastRouteTimeRef.current > 8000;

        if (!forceRecompute && !(movedEnough && timeElapsed)) return;

        lastRouteKeyRef.current = key;
        lastRouteOriginRef.current = origin;
        lastRouteTimeRef.current = now;

        directionsServiceRef.current.route({
            origin,
            destination: { lat: navigationTarget.lat, lng: navigationTarget.lng },
            travelMode: window.google.maps.TravelMode[navigationMode],
            region: 'jp',
            language: 'ja',
        }, (result, status) => {
            if (status === 'OK' && result) {
                setDirectionsResult(result);
                setNavError(null);
                directionsRendererRef.current?.setDirections(result);
            } else {
                setNavError('経路を取得できませんでした。しばらくしてから再度お試しください。');
            }
        });
    }, [map, navigationTarget, navigationMode, currentLocation]);

    // ナビ中は現在地に地図を自動追従させる（手動でドラッグされたら追従を止める）
    useEffect(() => {
        if (!map || !navigationTarget || !currentLocation || !isFollowing) return;
        map.panTo(currentLocation);
    }, [map, navigationTarget, currentLocation, isFollowing]);

    useEffect(() => {
        if (!map) return;
        const listener = map.addListener('dragstart', () => {
            if (navigationTarget) setIsFollowing(false);
        });
        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [map, navigationTarget]);

    const handleRecenterNav = () => {
        setIsFollowing(true);
        if (currentLocation) map?.panTo(currentLocation);
    };

    const navLeg = directionsResult?.routes[0]?.legs[0];
    const navStep = navLeg?.steps[0];
    const isArrived = !!navLeg?.distance && navLeg.distance.value < 30;

    return (
        <div className="w-full h-full relative">
            <div ref={ref} id="map-container" className="w-full h-full" />
            {map && (
                <div className="absolute top-1/2 -translate-y-1/2 right-4 z-50 flex flex-col gap-2">
                    <button
                        onClick={handleResetHeading}
                        className="p-2 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-10 h-10 cursor-pointer"
                        title="北を上にする"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="w-6 h-6"
                            style={{ transform: `rotate(${-heading}deg)`, transition: 'transform 0.1s ease-out' }}
                        >
                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                            <path d="M12,2 L16,12 L12,9.5 L8,12 Z" fill="#EF4444" />
                            <path d="M12,22 L16,12 L12,9.5 L8,12 Z" fill="#9CA3AF" />
                        </svg>
                    </button>
                    {onLocateMe && (
                        <button
                            onClick={onLocateMe}
                            className="p-2 bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-10 h-10 cursor-pointer"
                            title="現在地へ移動"
                        >
                            <Navigation className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}

            {/* ナビゲーション案内バナー */}
            {map && navigationTarget && (
                <>
                    <div className="absolute top-safe-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                            <div className="flex items-center justify-between px-4 pt-3">
                                <div className="flex gap-1.5">
                                    {(['DRIVING', 'WALKING', 'BICYCLING'] as const).map(m => (
                                        <button
                                            key={m}
                                            onClick={() => onChangeNavigationMode?.(m)}
                                            className={`p-2 rounded-full transition-colors ${navigationMode === m ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'}`}
                                            title={m === 'DRIVING' ? '車' : m === 'WALKING' ? '徒歩' : '自転車'}
                                        >
                                            {m === 'DRIVING' && <Car className="w-4 h-4" />}
                                            {m === 'WALKING' && <Footprints className="w-4 h-4" />}
                                            {m === 'BICYCLING' && <Bike className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={onExitNavigation}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                    title="ナビ終了"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            <div className="px-4 pb-4 pt-2">
                                {navError ? (
                                    <p className="text-sm text-red-500 dark:text-red-400">{navError}</p>
                                ) : isArrived ? (
                                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">目的地に到着しました</p>
                                ) : navStep ? (
                                    <>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                                            {stripHtml(navStep.instructions)}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {navStep.distance?.text}先　・　残り{navLeg?.distance?.text} / 約{navLeg?.duration?.text}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">経路を検索中...</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {!isFollowing && (
                        <button
                            onClick={handleRecenterNav}
                            className="absolute bottom-safe-24 right-4 z-40 px-4 py-2.5 bg-white dark:bg-zinc-800 rounded-full shadow-xl border border-gray-200 dark:border-zinc-700 text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
                        >
                            <Navigation className="w-4 h-4" />
                            現在地に戻る
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export const MapWrapper: React.FC<MapComponentProps> = (props) => {
    // キーが未設定のまま地図を初期化すると、原因の分かりにくい認証エラーになるため先に弾く
    if (!MAP_API_KEY || !MAP_ID) {
        const missing = [
            !MAP_API_KEY && 'VITE_GOOGLE_MAPS_API_KEY',
            !MAP_ID && 'VITE_GOOGLE_MAPS_MAP_ID',
        ].filter(Boolean).join(' / ');
        return (
            <div className="w-full h-full relative flex items-center justify-center p-6" style={{ minHeight: 'calc(100dvh - 4rem)' }}>
                <div className="max-w-sm text-center">
                    <p className="font-bold text-red-600 dark:text-red-400 mb-2">地図を表示できません</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        環境変数 {missing} が設定されていません。<br />
                        ビルド環境の設定を確認してください。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative" style={{ minHeight: 'calc(100dvh - 4rem)' }}>
            <Wrapper apiKey={MAP_API_KEY} render={render} libraries={["places", "marker"]}>
                <MapInner {...props} />
            </Wrapper>
        </div>
    );
};
