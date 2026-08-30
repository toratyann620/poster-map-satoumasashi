import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import type { Group } from '../types';
import { useSession } from './useSession';

/**
 * グループ（事務所）の一覧と編集。
 *
 * 読み取りは承認済みメンバー全員に許可されている（クライアントが自分の権限範囲に
 * 合致するクエリを組み立てるのに必要なため）。書き込みは佐藤まさし事務所の管理者のみで、
 * ルール側でも同じ条件を課している。
 */
export const useGroups = () => {
    const { ready } = useSession();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready) return;
        const unsubscribe = onSnapshot(collection(db, COL.groups), (snap) => {
            const list = snap.docs.map((d) => {
                const g = d.data();
                return {
                    id: d.id,
                    name: g.name ?? d.id,
                    allowAll: !!g.allowAll,
                    cities: Array.isArray(g.cities) ? g.cities : [],
                    types: Array.isArray(g.types) ? g.types : [],
                } satisfies Group;
            });
            // allowAll（佐藤まさし事務所）を先頭に、以降は名前順
            list.sort((a, b) => (Number(b.allowAll) - Number(a.allowAll)) || a.name.localeCompare(b.name, 'ja'));
            setGroups(list);
            setLoading(false);
        }, (e) => {
            console.error('グループの取得に失敗しました:', e);
            setGroups([]);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [ready]);

    /** グループの作成・更新。id はグループID（例: nanba）。 */
    const saveGroup = async (id: string, data: Omit<Group, 'id'>) => {
        await setDoc(doc(db, COL.groups, id), {
            name: data.name,
            allowAll: data.allowAll,
            cities: data.cities,
            types: data.types,
        }, { merge: true });
    };

    const removeGroup = async (id: string) => {
        await deleteDoc(doc(db, COL.groups, id));
    };

    return { groups, loading, saveGroup, removeGroup };
};
