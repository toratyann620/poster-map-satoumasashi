import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { POSTER_PERSONS, PERSON_COLORS } from '../types';
import { COL } from '../lib/collections';
import { useSession } from './useSession';

const SETTINGS_DOC = doc(db, COL.settings, 'pinTypes');

export interface PinType {
    name: string;
    color: string;
}

// デフォルトのピン種類（types/index.ts の POSTER_PERSONS から生成）
const DEFAULT_PIN_TYPES: PinType[] = POSTER_PERSONS.map(name => ({
    name,
    color: PERSON_COLORS[name as keyof typeof PERSON_COLORS] || '#6B7280',
}));

export const usePinTypes = () => {
    const { ready, user } = useSession();
    const [pinTypes, setPinTypes] = useState<PinType[]>(DEFAULT_PIN_TYPES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 認証が確定してから購読する。ログイン前に読みにいくと必ず拒否され、
        // 無言でコード内のデフォルト値へフォールバックしてしまう
        // （「党員募集」が消えていなかった不具合の再発防止）。
        // 未ログイン時は購読しない。pinTypes は初期値のデフォルト一覧のままになる。
        if (!ready || !user) return;

        // Firestoreの settings/pinTypes をリアルタイム監視
        const unsubscribe = onSnapshot(SETTINGS_DOC, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.types) && data.types.length > 0) {
                    setPinTypes(data.types as PinType[]);
                } else {
                    setPinTypes(DEFAULT_PIN_TYPES);
                }
            } else {
                // ドキュメントがなければデフォルトを使う（初回は書き込まない）
                setPinTypes(DEFAULT_PIN_TYPES);
            }
            setLoading(false);
        }, (err) => {
            console.error('usePinTypes: Firestore error', err);
            setPinTypes(DEFAULT_PIN_TYPES);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [ready, user]);

    const addPinType = async (name: string, color: string) => {
        if (!name.trim()) return;
        const next = [...pinTypes, { name: name.trim(), color }];
        await setDoc(SETTINGS_DOC, { types: next }, { merge: true });
    };

    const removePinType = async (name: string) => {
        const next = pinTypes.filter(t => t.name !== name);
        await setDoc(SETTINGS_DOC, { types: next }, { merge: true });
    };

    return {
        pinTypes,
        // 未ログイン時は購読しないため、読み込み中にはならない
        loading: ready && !!user ? loading : false,
        addPinType,
        removePinType,
    };
};
