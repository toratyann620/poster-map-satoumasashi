import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { COL } from '../lib/collections';
import { useSession } from './useSession';
import type { AccountRequest } from '../types';

/**
 * 新規登録の申請の購読と、承認／却下。
 *
 * 読めるのは佐藤まさし事務所の管理者だけ（ルール側でも同じ条件）。
 * それ以外のアカウントで購読しようとすると permission-denied になるため、
 * `isSuperAdmin` を確かめてから購読を張る。
 *
 * 承認・却下は Cloud Function に委ねる。ログインアカウントの作成と
 * users ドキュメントの作成、案内メールの送信を1回の操作でまとめて行う必要があり、
 * クライアントでやると途中で失敗したときに中途半端な状態が残るため。
 */

export interface ReviewResult {
    ok: boolean;
    approved: boolean;
    uid?: string;
    email?: string;
    /** メールを送れなかった場合のみ入る。管理画面に表示して口頭で伝える */
    password?: string;
    mailSent?: boolean;
    mailError?: string;
}

const parse = (id: string, d: Record<string, unknown>): AccountRequest => ({
    id,
    name: String(d.name ?? ''),
    email: String(d.email ?? ''),
    groupId: String(d.groupId ?? ''),
    groupName: d.groupName ? String(d.groupName) : undefined,
    note: d.note ? String(d.note) : undefined,
    emailInUse: d.emailInUse === true,
    status: d.status === 'approved' ? 'approved' : d.status === 'rejected' ? 'rejected' : 'pending',
    createdAt: Number(d.createdAt) || 0,
    role: d.role === 'admin' ? 'admin' : d.role === 'general' ? 'general' : undefined,
    createdUid: d.createdUid ? String(d.createdUid) : undefined,
    reviewedBy: d.reviewedBy ? String(d.reviewedBy) : undefined,
    reviewedAt: d.reviewedAt ? Number(d.reviewedAt) : undefined,
    rejectReason: d.rejectReason ? String(d.rejectReason) : undefined,
    mailSent: d.mailSent === true,
    mailError: d.mailError ? String(d.mailError) : undefined,
});

export const useAccountRequests = () => {
    const { ready, isSuperAdmin } = useSession();
    const [fetched, setFetched] = useState<{ items: AccountRequest[]; loading: boolean }>({ items: [], loading: true });

    useEffect(() => {
        // 権限が無いアカウントでは購読を張らない。張ると permission-denied になる
        if (!ready || !isSuperAdmin) return;

        // status で絞らず全件を新しい順で取る。複合インデックスが要らず、
        // 件数もごく少ないため、未処理／処理済みの振り分けは画面側で行う
        const q = query(collection(db, COL.accountRequests), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setFetched({ items: snap.docs.map((d) => parse(d.id, d.data())), loading: false });
        }, (error) => {
            console.error('申請の取得に失敗しました:', error);
            setFetched({ items: [], loading: false });
        });
        return () => unsubscribe();
    }, [ready, isSuperAdmin]);

    const requests = useMemo(
        () => (ready && isSuperAdmin ? fetched.items : []),
        [ready, isSuperAdmin, fetched.items],
    );
    const loading = ready ? (isSuperAdmin && fetched.loading) : true;

    const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
    const reviewed = useMemo(() => requests.filter((r) => r.status !== 'pending'), [requests]);

    const review = useCallback(async (input: {
        requestId: string;
        approve: boolean;
        role?: 'admin' | 'general';
        groupId?: string;
        rejectReason?: string;
    }): Promise<ReviewResult> => {
        const call = httpsCallable<typeof input, ReviewResult>(functions, 'reviewAccountRequest');
        const res = await call(input);
        return res.data;
    }, []);

    return { requests, pending, reviewed, loading, review };
};
