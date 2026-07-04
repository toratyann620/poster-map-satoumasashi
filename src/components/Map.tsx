/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import type { PosterPin } from '../types';
import { PERSON_COLORS } from '../types';

// 環境変数から優先して読み込み、設定がない場合は指定された統一キーを使用する
const MAP_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDFVt8w4WjvR7U5xJRCA7-_2FY40hIlWdk";

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
}

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
    if (isInstalled || isGreeted || isReplacement) {
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

        pin.style.position = 'relative';
        pin.appendChild(badges);
    }

    container.appendChild(pin);
    container.appendChild(tip);

    return container;
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
    pinTypes = []
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const [heading, setHeading] = useState(0);
    const markersRef = useRef<any[]>([]);

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
                gestureHandling: 'cooperative',
                isFractionalZoomEnabled: true,
                mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '46b8813d0839a93d152e1d01', // 指定されたマップIDを設定
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
    useEffect(() => {
        if (!map) return;

        // 既存マーカーを破棄
        markersRef.current.forEach(m => { m.map = null; });
        markersRef.current = [];

        // AdvancedMarkerElement が利用可能かチェック
        const AdvancedMarkerElement =
            (window.google.maps as any).marker?.AdvancedMarkerElement;

        if (!AdvancedMarkerElement) {
            console.warn('AdvancedMarkerElement not available. Check mapId and library versions.');
            return;
        }

        posters.forEach(poster => {
            const isFloating = relocatingPoster?.id === poster.id;
            const domEl = buildDomMarker(poster, isFloating, colorsMap);

            const marker = new AdvancedMarkerElement({
                position: { lat: poster.lat, lng: poster.lng },
                map,
                title: poster.address || poster.memo || '',
                content: domEl,
                zIndex: isFloating ? 1000 : undefined,
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

            markersRef.current.push(marker);
        });

        // 新規追加中の「仮ピン」を地図上に描画
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
    }, [map, posters, relocatingPoster, selectedPoster]);

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

    return (
        <div className="w-full h-full relative">
            <div ref={ref} id="map-container" className="w-full h-full" />
            {map && (
                <button
                    onClick={handleResetHeading}
                    className="absolute top-1/2 -translate-y-1/2 right-4 z-50 p-2 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-10 h-10 cursor-pointer"
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
            )}
        </div>
    );
};

export const MapWrapper: React.FC<MapComponentProps> = (props) => {
    return (
        <div className="w-full h-full relative" style={{ minHeight: 'calc(100dvh - 4rem)' }}>
            <Wrapper apiKey={MAP_API_KEY} render={render} libraries={["places", "marker"]}>
                <MapInner {...props} />
            </Wrapper>
        </div>
    );
};
