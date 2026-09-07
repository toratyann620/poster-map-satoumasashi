import { useState, useEffect, useCallback } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { parseActivityLog, logScopeConstraints } from '../lib/activityLogs';
import { useSession } from './useSession';
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
export const getDayRange = (offsetDays: number): { start: number; end: number; dateStr: string } => {
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
    const { ready, group } = useSession();
    const [logs, setLogs] = useState<DailyNotificationLog[]>([]);
    const [isUnread, setIsUnread] = useState(false);
    const [loading, setLoading] = useState(true);
    const [targetDateStr, setTargetDateStr] = useState('');

    // 対象の範囲を計算
    const range = getDayRange(offsetDays);

    const scopeKey = group ? `${group.id}|${group.allowAll}|${group.cities}|${group.types}` : '';

    useEffect(() => {
        setTargetDateStr(range.dateStr);
        if (!ready) return;
        if (!group) { setLogs([]); setLoading(false); return; }

        setLoading(true);

        // 変更履歴から指定日分を、自グループの担当範囲に絞って取得する
        const q = query(
            collection(db, COL.activityLogs),
            ...logScopeConstraints(group),
            where('changedAt', '>=', range.start),
            where('changedAt', '<=', range.end),
            orderBy('changedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // 同じ事務所のメンバーが行った処理だけに絞る。
            // デイリー通知は「自分の事務所の今日の動き」を見る場なので、
            // 佐藤まさし事務所（全件が読める）でも自事務所ぶんだけにする。
            // 管理画面の変更履歴・ダッシュボードは別のフックで、従来どおり全件を扱う
            setLogs(snapshot.docs.map(parseActivityLog)
                .filter((l) => (l.changedByGroupId || 'admin') === group.id));
            setLoading(false);
        }, (error) => {
            console.error('日次通知の取得に失敗しました:', error);
            setLogs([]);
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey, offsetDays, range.start, range.end, range.dateStr]);

    // 既読状態を確認
    useEffect(() => {
        if (!userId || !range.dateStr) return;

        const checkRead = async () => {
            try {
                // その日の既読と、「過去分をまとめて既読」の記録（{uid}_all）の両方を見る。
                // まとめて既読は「この日時より前はぜんぶ読んだ」という1つの印で持つ。
                // 日ごとのドキュメントを過去分すべてに作る方式だと書き込みが際限なく増える
                const [dayDoc, allDoc] = await Promise.all([
                    getDoc(doc(db, 'notificationReads', `${userId}_${range.dateStr}`)),
                    getDoc(doc(db, 'notificationReads', `${userId}_all`)),
                ]);
                const allReadBefore = Number(allDoc.data()?.allReadBefore ?? 0);
                setIsUnread(!dayDoc.exists() && range.end > 0 && !(allReadBefore >= range.end));
            } catch (e) {
                console.warn('Failed to check notification read status:', e);
                setIsUnread(false);
            }
        };

        checkRead();
    }, [userId, range.dateStr, range.end, offsetDays]);

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

    /** 過去の通知をまとめて既読にする（今この瞬間までを既読扱いにする） */
    const markAllPastRead = useCallback(async () => {
        if (!userId) return;
        try {
            await setDoc(doc(db, 'notificationReads', `${userId}_all`), {
                userId,
                allReadBefore: Date.now(),
            });
            setIsUnread(false);
        } catch (e) {
            console.warn('Failed to mark all notifications as read:', e);
        }
    }, [userId]);

    // 対象ログのうち「要修理」または「新規登録」の件数
    const urgentCount = logs.filter(l => l.isNeedsRepair || l.isNewRegistration).length;

    return {
        logs,
        isUnread: isUnread && logs.length > 0,
        urgentCount,
        loading,
        markAsRead,
        markAllPastRead,
        targetDateStr,
    };
};
