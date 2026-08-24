import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { useSession } from './useSession';

/**
 * ネイティブアプリの最低バージョン確認。
 *
 * Webは更新すれば全員が即座に新しい版を使うが、ネイティブは古いバージョンが
 * 端末に残り続ける。本アプリは Firestore のスキーマが実際に育っており
 * （`city` の追加、グループ権限、`statusRemoved` 等）、古いクライアントが混ざると
 * 集計がずれる・権限判定に必要なフィールドを欠いたまま書き込まれる、といった
 * 不整合が起きうる。そのため、下限を割ったバージョンは利用を止める。
 *
 * 判定に使うのは Firestore の `settings/appVersion`:
 *   { minimum: '1.2.0', message?: string, iosUrl?: string, androidUrl?: string }
 *
 * ドキュメントが無い場合・読めない場合は「制限なし」として扱う。
 * 設定漏れでアプリが使えなくなる方が損害が大きいため、安全側を「通す」に倒している。
 */

export interface VersionGate {
    blocked: boolean;
    currentVersion: string;
    minimumVersion: string;
    message: string;
    storeUrl: string;
}

/** '1.2.3' 形式を比較する。a < b なら負の値。 */
const compareVersions = (a: string, b: string): number => {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
};

const EMPTY: VersionGate = {
    blocked: false, currentVersion: '', minimumVersion: '', message: '', storeUrl: '',
};

export const useAppVersionGate = (): VersionGate => {
    const { ready, user } = useSession();
    const [gate, setGate] = useState<VersionGate>(EMPTY);

    useEffect(() => {
        // Webは常に最新が配信されるため確認不要。
        // 設定の読み取りには承認済みメンバーであることが必要なのでログイン後に確認する。
        if (!Capacitor.isNativePlatform() || !ready || !user) return;

        let unsubscribe: (() => void) | null = null;
        let cancelled = false;

        (async () => {
            let currentVersion = '';
            try {
                currentVersion = (await CapApp.getInfo()).version;
            } catch {
                return; // バージョンが取れない環境では判定しない
            }
            if (cancelled) return;

            unsubscribe = onSnapshot(doc(db, COL.settings, 'appVersion'), (snap) => {
                if (!snap.exists()) { setGate(EMPTY); return; }
                const d = snap.data();
                const minimum = String(d.minimum ?? '');
                if (!minimum) { setGate(EMPTY); return; }

                const platform = Capacitor.getPlatform();
                setGate({
                    blocked: compareVersions(currentVersion, minimum) < 0,
                    currentVersion,
                    minimumVersion: minimum,
                    message: d.message ?? '',
                    storeUrl: (platform === 'ios' ? d.iosUrl : d.androidUrl) ?? '',
                });
            }, () => setGate(EMPTY));
        })();

        return () => { cancelled = true; unsubscribe?.(); };
    }, [ready, user]);

    return gate;
};
