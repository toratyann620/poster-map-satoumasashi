import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { BUILDING_KINDS } from '../types';
import { useSession } from './useSession';

/**
 * 建物ピンの種類（`settings/buildingKinds`）。
 *
 * 地図のマーカーの色と、建物の登録画面の選択肢に使う。
 * 読めるのはメンバー全員、書けるのは佐藤まさし事務所の管理者だけ
 * （firestore.rules の settings の規定どおり）。
 *
 * ⚠️ 文書が無いときはコード側の既定値（types/index.ts の BUILDING_KINDS）に
 * 落ちる。黙って既定値になるのを避けたいので、読み取りに失敗したかどうかは
 * loading で分かるようにしてある。
 */

export interface BuildingKind {
    name: string;
    color: string;
}

export const DEFAULT_BUILDING_KINDS: BuildingKind[] = BUILDING_KINDS.map((k) => ({ name: k.name, color: k.color }));

const SETTINGS_DOC = doc(db, COL.settings, 'buildingKinds');

/** 同じ名前を二重に持たせない */
const dedupe = (list: BuildingKind[]): BuildingKind[] => {
    const seen = new Set<string>();
    return list.filter((k) => {
        if (!k?.name || seen.has(k.name)) return false;
        seen.add(k.name);
        return true;
    });
};

export const useBuildingKinds = () => {
    const { ready, user, isSuperAdmin } = useSession();
    const [kinds, setKinds] = useState<BuildingKind[]>(DEFAULT_BUILDING_KINDS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 認証が確定してから購読する。ログイン前に読むと必ず拒否され、
        // 既定値のまま黙って動いてしまう（pinTypes で踏んだのと同じ罠）
        if (!ready || !user) return;
        const unsub = onSnapshot(
            SETTINGS_DOC,
            (snap) => {
                const list = snap.exists() ? snap.data()?.kinds : null;
                setKinds(Array.isArray(list) && list.length > 0 ? dedupe(list as BuildingKind[]) : DEFAULT_BUILDING_KINDS);
                setLoading(false);
            },
            () => setLoading(false),
        );
        return () => unsub();
    }, [ready, user]);

    /** 一覧をまるごと置き換える */
    const save = useCallback(async (next: BuildingKind[]) => {
        if (!isSuperAdmin) throw new Error('種類の変更は佐藤まさし事務所の管理者のみ行えます。');
        await setDoc(SETTINGS_DOC, { kinds: dedupe(next), updatedAt: Date.now() }, { merge: true });
    }, [isSuperAdmin]);

    /** 種類 → 色。一覧から消えた種類は既定色にする（地図から消えないように） */
    const colorOf = useCallback(
        (kind: string) => kinds.find((k) => k.name === kind)?.color ?? '#64748B',
        [kinds],
    );

    return { kinds, colorOf, loading, save, canEdit: isSuperAdmin };
};
