import { useState, useEffect, useCallback } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
} from 'firebase/firestore';

// JST で「昨日」の 0:00 〜 23:59:59.999 のタイムスタンプ（ms）を返す
const getYesterdayRange = (): { start: number; end: number; dateStr: string } => {
    const now = new Date();
    // JST = UTC+9
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);

    // 昨日の日付（JST）
    const jstYesterday = new Date(jstNow);
    jstYesterday.setUTCDate(jstYesterday.getUTCDate() - 1);

    const year = jstYesterday.getUTCFullYear();
    const month = String(jstYesterday.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstYesterday.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // JST 昨日 0:00:00.000 を UTC ms に変換
    const startJst = Date.UTC(year, jstYesterday.getUTCMonth(), jstYesterday.getUTCDate(), 0, 0, 0, 0);
    const start = startJst - jstOffset;

    // JST 昨日 23:59:59.999 を UTC ms に変換
    const end = start + 24 * 60 * 60 * 1000 - 1;

    return { start, end, dateStr };
};

export interface DailyNotificationLog extends ActivityLog {
    isNeedsRepair?: boolean;
    isNewRegistration?: boolean;
    posterStatus?: string[];
}

export const useDailyNotifications = (userId: string | null) => {
    const [logs, setLogs] = useState<DailyNotificationLog[]>([]);
    const [isUnread, setIsUnread] = useState(false);
    const [loading, setLoading] = useState(true);
    const [yesterdayDateStr, setYesterdayDateStr] = useState('');

    // 昨日の範囲を一度計算してメモ
    const range = getYesterdayRange();

    useEffect(() => {
        setYesterdayDateStr(range.dateStr);

        // activityLogs から昨日分を取得
        const q = query(
            collection(db, 'activityLogs'),
            where('changedAt', '>=', range.start),
            where('changedAt', '<=', range.end),
            orderBy('changedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: DailyNotificationLog[] = [];
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
                });
            });
            setLogs(data);
            setLoading(false);
        }, (error) => {
            console.error('Failed to fetch daily notifications:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    // 既読状態を確認
    useEffect(() => {
        if (!userId || !range.dateStr) return;

        const checkRead = async () => {
            try {
                const readDoc = await getDoc(
                    doc(db, 'notificationReads', `${userId}_${range.dateStr}`)
                );
                setIsUnread(!readDoc.exists());
            } catch (e) {
                console.warn('Failed to check notification read status:', e);
                setIsUnread(false);
            }
        };

        checkRead();
    }, [userId, range.dateStr]);

    // 既読にする
    const markAsRead = useCallback(async () => {
        if (!userId || !range.dateStr) return;
        try {
            await setDoc(doc(db, 'notificationReads', `${userId}_${range.dateStr}`), {
                userId,
                date: range.dateStr,
                readAt: Date.now(),
            });
            setIsUnread(false);
        } catch (e) {
            console.warn('Failed to mark notification as read:', e);
        }
    }, [userId, range.dateStr]);

    // 昨日のログのうち「要修理」または「新規登録」の件数
    const urgentCount = logs.filter(l => l.isNeedsRepair || l.isNewRegistration).length;

    return {
        logs,
        isUnread: isUnread && logs.length > 0,
        urgentCount,
        loading,
        markAsRead,
        yesterdayDateStr,
    };
};
