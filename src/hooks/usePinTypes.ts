import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { POSTER_PERSONS, PERSON_COLORS } from '../types';

const SETTINGS_DOC = doc(db, 'settings', 'pinTypes');

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
    const [pinTypes, setPinTypes] = useState<PinType[]>(DEFAULT_PIN_TYPES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
    }, []);

    const addPinType = async (name: string, color: string) => {
        if (!name.trim()) return;
        const next = [...pinTypes, { name: name.trim(), color }];
        await setDoc(SETTINGS_DOC, { types: next }, { merge: true });
    };

    const removePinType = async (name: string) => {
        const next = pinTypes.filter(t => t.name !== name);
        await setDoc(SETTINGS_DOC, { types: next }, { merge: true });
    };

    return { pinTypes, loading, addPinType, removePinType };
};
