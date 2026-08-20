import { useState, useEffect } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { COL } from '../lib/collections';
import { parseActivityLog, logScopeConstraints } from '../lib/activityLogs';
import { useSession } from './useSession';

/**
 * 変更履歴の全件を時系列昇順（古い→新しい）でリアルタイム取得するフック。
 *
 * 「新規／撤去／張替え解除／修理解除」の指標算出（[posterMetrics.ts](../lib/posterMetrics.ts) の
 * computePosterMetrics）は、対象期間より前の履歴も含めて比較する必要があるため、
 * 表示件数を絞らず全件を保持する。
 *
 * 「全件」といっても自グループの範囲内に限られる。各事務所は自分たちの活動分だけを見る。
 */
export const useAllActivityLogs = () => {
    const { ready, group } = useSession();
    const [logsAsc, setLogsAsc] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    const scopeKey = group ? `${group.id}|${group.allowAll}|${group.cities}|${group.types}` : '';

    useEffect(() => {
        if (!ready) return;
        if (!group) { setLogsAsc([]); setLoading(false); return; }

        const q = query(
            collection(db, COL.activityLogs),
            ...logScopeConstraints(group),
            orderBy('changedAt', 'asc'),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogsAsc(snapshot.docs.map(parseActivityLog));
            setLoading(false);
        }, (error) => {
            console.error('変更履歴（全件）の取得に失敗しました:', error);
            setLogsAsc([]);
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey]);

    return { logsAsc, loading };
};
