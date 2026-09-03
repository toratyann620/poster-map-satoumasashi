import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { useSession } from './useSession';

/**
 * 同じ事務所に所属する人の一覧。依頼の担当者を選ぶために使う。
 *
 * `useUsers` は条件を付けずに全件を取りにいくため、管理者しか使えない。
 * 一般ユーザーも依頼を出せるようにするには、自分の事務所だけに絞った
 * このクエリが要る（セキュリティルール側も同じ条件で許可している）。
 */

export interface GroupMember {
    id: string;
    name: string;
}

export const useGroupMembers = () => {
    const { ready, groupId } = useSession();
    const [fetched, setFetched] = useState<{ items: GroupMember[]; loading: boolean }>(
        { items: [], loading: true },
    );

    useEffect(() => {
        if (!ready || !groupId) return;

        const q = query(collection(db, COL.users), where('groupId', '==', groupId));
        const unsubscribe = onSnapshot(q, (snap) => {
            setFetched({
                items: snap.docs
                    .map((d) => ({ id: d.id, name: String(d.data().name ?? '') }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
                loading: false,
            });
        }, (error) => {
            // 取れなくても依頼自体は出せる（担当者を選ばない全員あてになる）
            console.warn('同じ事務所のメンバーを取得できませんでした:', error);
            setFetched({ items: [], loading: false });
        });

        return () => unsubscribe();
    }, [ready, groupId]);

    const members = useMemo(
        () => (ready && groupId ? fetched.items : []),
        [ready, groupId, fetched.items],
    );

    return { members, loading: ready && groupId ? fetched.loading : !ready };
};
