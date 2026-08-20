import { useState, useEffect } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { COL } from '../lib/collections';
import { parseActivityLog, logScopeConstraints } from '../lib/activityLogs';
import { useSession } from './useSession';

/**
 * ダッシュボード用: 指定期間のアクティビティログをリアルタイムで取得するフック
 * dateFromStr, dateToStr は 'YYYY-MM-DD' 形式の文字列
 *
 * 取得範囲は自グループの担当分に限られる（佐藤まさし事務所のみ全体を見る）。
 */
export const useDashboardData = (dateFromStr: string, dateToStr: string) => {
    const { ready, group } = useSession();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    const scopeKey = group ? `${group.id}|${group.allowAll}|${group.cities}|${group.types}` : '';

    useEffect(() => {
        if (!ready) return;
        if (!group) { setLogs([]); setLoading(false); return; }

        setLoading(true);

        // 期間の開始・終了タイムスタンプ（ローカル時刻の 0:00〜23:59:59）
        const startTs = new Date(dateFromStr + 'T00:00:00').getTime();
        const endTs = new Date(dateToStr + 'T23:59:59').getTime();

        const q = query(
            collection(db, COL.activityLogs),
            ...logScopeConstraints(group),
            where('changedAt', '>=', startTs),
            where('changedAt', '<=', endTs),
            orderBy('changedAt', 'desc'),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(parseActivityLog));
            setLoading(false);
        }, (error) => {
            console.error('ダッシュボードの履歴取得に失敗しました:', error);
            setLogs([]);
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey, dateFromStr, dateToStr]);

    return { logs, loading };
};
