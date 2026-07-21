import { useState, useEffect } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

/**
 * activityLogs の全件を時系列昇順（古い→新しい）でリアルタイム取得するフック。
 * 「新規／撤去／張替え解除／修理解除」の指標算出（[posterMetrics.ts](../lib/posterMetrics.ts) の
 * computePosterMetrics）は、対象期間より前の履歴も含めて比較する必要があるため、
 * 表示件数を絞らず全件を保持する。
 */
export const useAllActivityLogs = () => {
    const [logsAsc, setLogsAsc] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'activityLogs'), orderBy('changedAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: ActivityLog[] = [];
            snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                data.push({
                    id: docSnap.id,
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
                });
            });
            setLogsAsc(data);
            setLoading(false);
        }, (error) => {
            console.error('Failed to fetch all activity logs:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { logsAsc, loading };
};
