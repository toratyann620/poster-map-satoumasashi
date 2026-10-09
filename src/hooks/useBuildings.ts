import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where,
    type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { BUILDING_KINDS, type BuildingPin } from '../types';
import { useSession } from './useSession';

/**
 * 建物ピン（自治会掲示板・自治会館など）の読み書き。
 *
 * ⚠️ ポスター（usePosterData）とは別のコレクションを見る。混ぜないこと。
 * 設置率・枚数・日次レポート・CSV はいずれも posters_v2 しか見ないので、
 * ここに何件足してもポスターの数字は動かない。
 *
 * ⚠️ 絞り込み条件は firestore.rules の buildingInScope と1対1で対応していなければ
 * ならない。Firestore は「1件でもルールに反する結果を含みうるクエリ」を丸ごと
 * 拒否するため、条件を付け忘れると permission-denied になる（情報漏洩ではなく
 * 即座のエラーとして現れる）。
 */

export interface BuildingKind {
    name: string;
    color: string;
}

const DEFAULT_KINDS: BuildingKind[] = BUILDING_KINDS.map((k) => ({ name: k.name, color: k.color }));

/** 建物の取得クエリに付ける条件。ポスターと違い city だけで絞る（type は見ない） */
const scopeConstraints = (group: { allowAll: boolean; cities: string[] } | null): QueryConstraint[] => {
    if (!group) return [];
    if (group.allowAll) return [];
    return [where('city', 'in', group.cities)];
};

const parse = (id: string, d: Record<string, unknown>): BuildingPin => ({
    id,
    kind: String(d.kind ?? 'その他'),
    name: String(d.name ?? ''),
    lat: Number(d.lat ?? 0),
    lng: Number(d.lng ?? 0),
    city: String(d.city ?? ''),
    address: String(d.address ?? ''),
    memo: String(d.memo ?? ''),
    imageUrls: Array.isArray(d.imageUrls) ? (d.imageUrls as string[]) : [],
    createdAt: Number(d.createdAt ?? 0),
    updatedAt: Number(d.updatedAt ?? 0),
    createdBy: String(d.createdBy ?? ''),
    updatedBy: String(d.updatedBy ?? ''),
});

export const useBuildings = () => {
    const { ready, group, name } = useSession();
    const [fetched, setFetched] = useState<{ items: BuildingPin[]; loading: boolean }>({ items: [], loading: true });
    const [kinds, setKinds] = useState<BuildingKind[]>(DEFAULT_KINDS);

    const scopeKey = group ? `${group.id}|${group.allowAll}|${group.cities.join(',')}` : '';

    useEffect(() => {
        if (!ready || !group) return;
        const q = query(collection(db, COL.buildings), ...scopeConstraints(group));
        const unsub = onSnapshot(q, (snap) => {
            setFetched({ items: snap.docs.map((d) => parse(d.id, d.data())), loading: false });
        }, (error) => {
            console.error('建物ピンの取得に失敗しました:', error);
            setFetched({ items: [], loading: false });
        });
        return () => unsub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey]);

    // 種類は settings/buildingKinds で差し替えられる（アプリを配信し直さずに増やせる）。
    // 無ければコード側の既定値を使う。
    useEffect(() => {
        if (!ready || !group) return;
        const unsub = onSnapshot(doc(db, COL.settings, 'buildingKinds'), (snap) => {
            const list = snap.exists() ? snap.data()?.kinds : null;
            setKinds(Array.isArray(list) && list.length > 0 ? (list as BuildingKind[]) : DEFAULT_KINDS);
        }, () => setKinds(DEFAULT_KINDS));
        return () => unsub();
    }, [ready, group]);

    const buildings = useMemo(() => (ready && group ? fetched.items : []), [ready, group, fetched.items]);

    /** 種類 → 色。地図のマーカーが参照する */
    const colorOf = useCallback(
        (kind: string) => kinds.find((k) => k.name === kind)?.color ?? '#64748B',
        [kinds],
    );

    const addBuilding = useCallback(async (input: Omit<BuildingPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => {
        if (!input.city) {
            // city が無いとルール側で必ず拒否される。何が足りないかを先に伝える
            throw new Error('市区町村が取れませんでした。地図上で場所を取り直してください。');
        }
        const now = Date.now();
        // ⚠️ Firestore は undefined を受け付けない。写真を付けない登録で
        // imageUrls が undefined のまま渡ると、保存が丸ごと失敗する
        const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
        await addDoc(collection(db, COL.buildings), {
            ...clean,
            createdAt: now, updatedAt: now, createdBy: name, updatedBy: name,
        });
    }, [name]);

    const updateBuilding = useCallback(async (id: string, patch: Partial<BuildingPin>) => {
        const { id: _ignored, createdAt, createdBy, ...rest } = patch;
        void _ignored; void createdAt; void createdBy;
        const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
        await updateDoc(doc(db, COL.buildings, id), { ...clean, updatedAt: Date.now(), updatedBy: name });
    }, [name]);

    const removeBuilding = useCallback(async (id: string) => {
        await deleteDoc(doc(db, COL.buildings, id));
    }, []);

    return {
        buildings,
        kinds,
        colorOf,
        loading: ready && group ? fetched.loading : !ready,
        addBuilding,
        updateBuilding,
        removeBuilding,
    };
};
