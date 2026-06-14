import { useState, useEffect } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export const useActivityLogs = (maxCount = 100) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'activityLogs'),
            orderBy('changedAt', 'desc'),
            limit(maxCount)
        );

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
                });
            });
            setLogs(data);
            setLoading(false);
        }, (error) => {
            console.error('Failed to fetch activity logs:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [maxCount]);

    return { logs, loading };
};
