import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * 現在地の取得。Web とネイティブ（Capacitor）の差を吸収する。
 *
 * ネイティブで `navigator.geolocation` をそのまま呼んではいけない。
 * OSの権限ダイアログを出す経路が無く、iOSでは Info.plist の利用目的が
 * 未設定だとアプリごと落ちる。プラグイン経由なら権限の要求・確認ができ、
 * 拒否された場合もこちらで検知して案内を出せる。
 *
 * バックグラウンド位置情報は要求しない（アプリ表示中のみ）。
 * 常時許可を求めると両ストアの審査が一段厳しくなるうえ、
 * 本アプリのナビは画面を開いている間だけ動けば足りるため。
 */

export type Coords = { lat: number; lng: number };

const isNative = () => Capacitor.isNativePlatform();

/** 位置情報の利用許可を求める。既に許可済みなら何もしない。 */
export const ensureLocationPermission = async (): Promise<boolean> => {
    if (!isNative()) return !!navigator.geolocation;
    try {
        const status = await Geolocation.checkPermissions();
        if (status.location === 'granted' || status.coarseLocation === 'granted') return true;
        if (status.location === 'denied') return false;
        const asked = await Geolocation.requestPermissions({ permissions: ['location'] });
        return asked.location === 'granted' || asked.coarseLocation === 'granted';
    } catch (e) {
        console.warn('位置情報の権限確認に失敗しました:', e);
        return false;
    }
};

const OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };

// 一発取得（現在地ボタン・ピン打ち）用。
// 常時 watchPosition が動いているので、直近30秒の測位はそのまま使ってよい。
// maximumAge を短くすると毎回GPSを取り直すことになり、屋外でも十数秒待たされる。
const ONESHOT_OPTIONS = { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 };

/**
 * 現在地の継続取得を開始する。返り値を呼ぶと停止する。
 * 権限が無い場合は onError を呼び、購読は行わない。
 */
export const watchPosition = (
    onUpdate: (pos: Coords) => void,
    onError: (reason: 'denied' | 'unavailable' | 'error') => void,
): (() => void) => {
    let stopped = false;
    let cleanup: (() => void) | null = null;

    const start = async () => {
        const allowed = await ensureLocationPermission();
        if (stopped) return;
        if (!allowed) { onError('denied'); return; }

        if (!isNative()) {
            const id = navigator.geolocation.watchPosition(
                (p) => onUpdate({ lat: p.coords.latitude, lng: p.coords.longitude }),
                () => onError('error'),
                OPTIONS,
            );
            cleanup = () => navigator.geolocation.clearWatch(id);
            return;
        }

        try {
            const id = await Geolocation.watchPosition(OPTIONS, (p, err) => {
                if (err || !p) { onError('error'); return; }
                onUpdate({ lat: p.coords.latitude, lng: p.coords.longitude });
            });
            cleanup = () => { Geolocation.clearWatch({ id }).catch(() => { }); };
        } catch (e) {
            console.warn('現在地の取得を開始できませんでした:', e);
            onError('error');
        }
    };

    start();

    return () => {
        stopped = true;
        cleanup?.();
    };
};

/** 現在地を1回だけ取得する（現在地ボタン用）。 */
export const getCurrentPosition = async (): Promise<Coords | null> => {
    const allowed = await ensureLocationPermission();
    if (!allowed) return null;

    if (!isNative()) {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
                () => resolve(null),
                ONESHOT_OPTIONS,
            );
        });
    }

    try {
        const p = await Geolocation.getCurrentPosition(ONESHOT_OPTIONS);
        return { lat: p.coords.latitude, lng: p.coords.longitude };
    } catch (e) {
        console.warn('現在地の取得に失敗しました:', e);
        return null;
    }
};
