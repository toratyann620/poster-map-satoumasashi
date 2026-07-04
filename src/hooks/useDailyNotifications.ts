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

// 指定された offsetDays（今日からの日数差。昨日なら -1、今日なら 0）の 0:00 〜 23:59:59.999 のタイムスタンプ（ms）を返す
const getDayRange = (offsetDays: number): { start: number; end: number; dateStr: string } => {
    const now = new Date();
    // JST = UTC+9
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);

    // 対象の日付（JST）
    const targetDate = new Date(jstNow);
    targetDate.setUTCDate(targetDate.getUTCDate() + offsetDays);

    const year = targetDate.getUTCFullYear();
    const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // JST 対象日 0:00:00.000 を UTC ms に変換
    const startJst = Date.UTC(year, targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0);
    const start = startJst - jstOffset;

    // JST 対象日 23:59:59.999 を UTC ms に変換
    const end = start + 24 * 60 * 60 * 1000 - 1;

    return { start, end, dateStr };
};

export interface DailyNotificationLog extends ActivityLog {
    isNeedsRepair?: boolean;
    isNewRegistration?: boolean;
    posterStatus?: string[];
}

export const useDailyNotifications = (userId: string | null, offsetDays: number) => {
    const [logs, setLogs] = useState<DailyNotificationLog[]>([]);
    const [isUnread, setIsUnread] = useState(false);
    const [loading, setLoading] = useState(true);
    const [targetDateStr, setTargetDateStr] = useState('');

    // 対象の範囲を計算
    const range = getDayRange(offsetDays);

    useEffect(() => {
        setTargetDateStr(range.dateStr);
        setLoading(true);

        // activityLogs から指定日分を取得
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
    }, [offsetDays, range.start, range.end, range.dateStr]);

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
    }, [userId, range.dateStr, offsetDays]);

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

    // 対象ログのうち「要修理」または「新規登録」の件数
    const urgentCount = logs.filter(l => l.isNeedsRepair || l.isNewRegistration).length;

    return {
        logs,
        isUnread: isUnread && logs.length > 0,
        urgentCount,
        loading,
        markAsRead,
        targetDateStr,
    };
};
