import { useState, useEffect } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    orderBy,
    where,
    onSnapshot,
} from 'firebase/firestore';

/**
 * ダッシュボード用: 指定期間のアクティビティログをリアルタイムで取得するフック
 * dateFromStr, dateToStr は 'YYYY-MM-DD' 形式の文字列
 */
export const useDashboardData = (dateFromStr: string, dateToStr: string) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);

        // 期間の開始・終了タイムスタンプ（ローカル時刻の 0:00〜23:59:59）
        const startTs = new Date(dateFromStr + 'T00:00:00').getTime();
        const endTs = new Date(dateToStr + 'T23:59:59').getTime();

        // changedAt の範囲クエリ（同一フィールドの where + orderBy なので複合インデックス不要）
        const q = query(
            collection(db, 'activityLogs'),
            where('changedAt', '>=', startTs),
            where('changedAt', '<=', endTs),
            orderBy('changedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: ActivityLog[] = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    action: d.action || '更新',
                    posterId: d.posterId || '',
                    posterAddress: d.posterAddress || '',
                    posterType: d.posterType || '',
                    changedBy: d.changedBy || '',
                    changedAt: d.changedAt || 0,
                    diff: d.diff || '',
                    posterStatus: d.posterStatus || [],
                    isNeedsRepair: !!d.isNeedsRepair,
                    isNewRegistration: !!d.isNewRegistration,
                    statusAdded: d.statusAdded || [],
                    statusRemoved: d.statusRemoved || [],
                    removedChangedTo: d.removedChangedTo ?? null,
                };
            });
            setLogs(data);
            setLoading(false);
        }, (error) => {
            console.error('useDashboardData: Failed to fetch logs:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [dateFromStr, dateToStr]);

    return { logs, loading };
};
