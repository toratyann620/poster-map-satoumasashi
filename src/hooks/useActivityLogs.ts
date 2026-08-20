import { useState, useEffect } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { COL } from '../lib/collections';
import { parseActivityLog, logScopeConstraints } from '../lib/activityLogs';
import { useSession } from './useSession';

/** 直近の変更履歴。自グループの範囲に絞って取得する。 */
export const useActivityLogs = (maxCount = 100) => {
    const { ready, group } = useSession();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    const scopeKey = group ? `${group.id}|${group.allowAll}|${group.cities}|${group.types}` : '';

    useEffect(() => {
        // グループが確定するまで問い合わせない（条件の無いクエリは拒否されるため）
        if (!ready) return;
        if (!group) { setLogs([]); setLoading(false); return; }

        const q = query(
            collection(db, COL.activityLogs),
            ...logScopeConstraints(group),
            orderBy('changedAt', 'desc'),
            limit(maxCount),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(parseActivityLog));
            setLoading(false);
        }, (error) => {
            console.error('変更履歴の取得に失敗しました:', error);
            setLogs([]);
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey, maxCount]);

    return { logs, loading };
};
