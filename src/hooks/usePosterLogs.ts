import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { parseActivityLog, logScopeConstraints } from '../lib/activityLogs';
import { useSession } from './useSession';
import type { ActivityLog } from '../types';

/**
 * 1つのピンの変更履歴。詳細画面の「ログ」タブで使う。
 *
 * グループの絞り込み条件（city / posterType）を必ず付ける。
 * `posterId` の一致だけではセキュリティルールが範囲内だと判定できず、
 * 佐藤まさし事務所以外のアカウントで permission-denied になるため。
 *
 * ⚠️ この組み合わせには複合インデックスが要る（firestore.indexes.json に定義済み）。
 * 足りないと画面には何も出ず、コンソールにだけエラーが出る形になる。
 */
export const usePosterLogs = (posterId: string | null | undefined, maxCount = 100) => {
    const { ready, group } = useSession();
    const [fetched, setFetched] = useState<{ logs: ActivityLog[]; loading: boolean }>({ logs: [], loading: true });

    const scopeKey = group ? `${group.id}|${group.allowAll}|${group.cities}|${group.types}` : '';

    useEffect(() => {
        if (!ready || !group || !posterId) return;

        const q = query(
            collection(db, COL.activityLogs),
            where('posterId', '==', posterId),
            ...logScopeConstraints(group),
            orderBy('changedAt', 'desc'),
            limit(maxCount),
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            setFetched({ logs: snap.docs.map(parseActivityLog), loading: false });
        }, (error) => {
            console.error('ピンの変更履歴の取得に失敗しました:', error);
            setFetched({ logs: [], loading: false });
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey, posterId, maxCount]);

    const enabled = !!(ready && group && posterId);
    return {
        logs: enabled ? fetched.logs : [],
        loading: enabled ? fetched.loading : false,
    };
};
