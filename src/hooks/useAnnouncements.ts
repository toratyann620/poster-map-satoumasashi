import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { useSession } from './useSession';
import { readString, writeString, readStringList, writeStringList } from '../lib/deviceStore';
import type { Announcement } from '../types';

/**
 * 管理者からのお知らせの購読と、未読・ポップアップ表示済みの管理。
 *
 * 既読の記録は端末に置く（共通仕様の SecureStore に相当）。Firestore に
 * 置けば端末間で揃うが、そのために全メンバーが書き込めるコレクションを
 * 増やすことになる。お知らせを読んだかどうかは取り違えても実害が無いので、
 * 権限の面を単純に保つ方を選んだ。
 */

const LAST_READ_KEY = 'announcements_last_read';
const SHOWN_POPUPS_KEY = 'shown_popup_ids';

/** 一覧に出す上限。これを超えて遡る要件は今のところ無い。 */
const FETCH_LIMIT = 50;

export const useAnnouncements = () => {
    const { ready, user } = useSession();
    // 取得結果はまとめて1つの state に持つ。効果の中で同期的に setState すると
    // 再描画が連鎖するため、更新は onSnapshot のコールバックからだけ行う。
    const [fetched, setFetched] = useState<{ items: Announcement[]; loading: boolean }>(
        { items: [], loading: true },
    );
    // localStorage の値を state に写して、既読にした瞬間に再描画されるようにする
    const [lastReadAt, setLastReadAt] = useState<number>(() => Number(readString(LAST_READ_KEY)) || 0);
    const [shownPopupIds, setShownPopupIds] = useState<string[]>(() => readStringList(SHOWN_POPUPS_KEY));

    useEffect(() => {
        if (!ready || !user) return;

        const q = query(
            collection(db, COL.announcements),
            orderBy('publishedAt', 'desc'),
            limit(FETCH_LIMIT),
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            setFetched({
                items: snap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        title: String(data.title ?? ''),
                        body: String(data.body ?? ''),
                        isPopup: data.isPopup === true,
                        publishedAt: Number(data.publishedAt) || 0,
                        createdBy: String(data.createdBy ?? ''),
                    };
                }),
                loading: false,
            });
        }, (error) => {
            console.error('お知らせの取得に失敗しました:', error);
            setFetched({ items: [], loading: false });
        });

        return () => unsubscribe();
    }, [ready, user]);

    // ログイン前は購読していないので、取得済みの内容を見せない。
    // 三項演算子で毎回新しい配列を作ると、下の useMemo が毎描画やり直しになるため包む。
    const signedIn = ready && !!user;
    const announcements = useMemo(
        () => (signedIn ? fetched.items : []),
        [signedIn, fetched.items],
    );
    const loading = signedIn ? fetched.loading : !ready;

    const unreadCount = useMemo(
        () => announcements.filter(a => a.publishedAt > lastReadAt).length,
        [announcements, lastReadAt],
    );

    /** 一覧を開いたときに呼ぶ。それ以前のお知らせをすべて既読にする。 */
    const markAllRead = useCallback(() => {
        const now = Date.now();
        writeString(LAST_READ_KEY, String(now));
        setLastReadAt(now);
    }, []);

    /**
     * まだ出していないポップアップのうち、いちばん新しいもの。
     *
     * 一度に1件しか出さない。溜まっている場合は閉じるたびに次が出る。
     */
    const pendingPopup = useMemo(
        () => announcements.find(a => a.isPopup && !shownPopupIds.includes(a.id)) ?? null,
        [announcements, shownPopupIds],
    );

    /** ポップアップを閉じたことを記録する。同じお知らせは二度と出さない。 */
    const dismissPopup = useCallback((id: string) => {
        setShownPopupIds(prev => {
            if (prev.includes(id)) return prev;
            const next = [...prev, id];
            writeStringList(SHOWN_POPUPS_KEY, next);
            return next;
        });
    }, []);

    return { announcements, loading, unreadCount, markAllRead, pendingPopup, dismissPopup };
};
