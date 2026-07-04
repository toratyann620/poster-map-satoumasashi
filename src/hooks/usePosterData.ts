import { useState, useEffect, useMemo } from 'react';
import type { PosterPin, FilterState } from '../types';
import sampleData from '../data/sample.json';
import { db, auth } from '../lib/firebase';
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    writeBatch,
    getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// アクティビティログをFirestoreに書き込むヘルパー
const writeActivityLog = async (
    action: '追加' | '更新' | '削除',
    posterId: string,
    posterAddress: string,
    changedBy: string,
    diff?: string,
    posterType?: string  // B案: 種類情報を含める（ダッシュボード集計用）
) => {
    try {
        await addDoc(collection(db, 'activityLogs'), {
            action,
            posterId,
            posterAddress,
            changedBy,
            changedAt: Date.now(),
            diff: diff || '',
            posterType: posterType || '',
        });
    } catch (e) {
        console.warn('Failed to write activity log:', e);
    }
};

export const usePosterData = () => {
    const [posters, setPosters] = useState<PosterPin[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterState>({
        keyword: '',
        types: [],   // 空配列 = すべて表示
        status: [],  // 空配列 = すべて表示
        tags: [],    // 空配列 = すべて表示
    });
    const [userRole, setUserRole] = useState<'admin' | 'general'>('general');
    const [userName, setUserName] = useState<string>('unknown');

    // Load from Firestore in real-time — wait for auth to confirm sign-in first
    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                if (unsubscribeSnapshot) {
                    unsubscribeSnapshot();
                    unsubscribeSnapshot = null;
                }
                setPosters([]);
                setLoading(false);
                setUserRole('general');
                setUserName('unknown');
                return;
            }

            // Get user info (role and name)
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUserRole(data.role || 'general');
                    setUserName(data.name || user.displayName || user.email || 'unknown');
                } else {
                    setUserRole('general');
                    setUserName(user.displayName || user.email || 'unknown');
                }
            } catch (e) {
                console.error('Failed to get user info', e);
                setUserRole('general');
                setUserName(user.displayName || user.email || 'unknown');
            }

            const q = query(collection(db, 'posters'), orderBy('updatedAt', 'desc'));

            unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                const data: PosterPin[] = [];
                snapshot.forEach((docSnap) => {
                    const d = docSnap.data();
                    // typeが配列（旧データ）の場合は先頭を取り出し文字列に変換（マイグレーション）
                    let typeVal: string = '佐藤まさし';
                    if (typeof d.type === 'string' && d.type) {
                        const legacyMap: Record<string, string> = { sato: '佐藤まさし', goto: 'ごとう祐一' };
                        typeVal = legacyMap[d.type] || d.type;
                    } else if (Array.isArray(d.type) && d.type.length > 0) {
                        const legacyMap: Record<string, string> = { sato: '佐藤まさし', goto: 'ごとう祐一' };
                        typeVal = legacyMap[d.type[0]] || d.type[0];
                    }

                    data.push({
                        id: docSnap.id,
                        lat: d.lat,
                        lng: d.lng,
                        type: typeVal,
                        status: d.status || '設置済',
                        address: d.address || '',
                        placement: d.placement || '',
                        quantity: d.quantity || 1,
                        owner: d.owner || '',
                        contact: d.contact || '',
                        memo: d.memo || '',
                        specialNote: d.specialNote || '',
                        imageUrl: d.imageUrl || '',
                        createdAt: d.createdAt || Date.now(),
                        updatedAt: d.updatedAt || Date.now(),
                        createdBy: d.createdBy || '',
                        updatedBy: d.updatedBy || '',
                    } as PosterPin);
                });
                setPosters(data);
                setLoading(false);

                // Auto-load sample data only when the collection is truly empty
                if (data.length === 0) {
                    const autoLoad = async () => {
                        try {
                            const batch = writeBatch(db);
                            sampleData.forEach((p: any) => {
                                const ref = doc(collection(db, 'posters'));
                                // 旧サンプルデータの変換
                                const legacyMap: Record<string, string> = { sato: '佐藤まさし', goto: 'ごとう祐一' };
                                const typeArr = Array.isArray(p.type) ? p.type : [legacyMap[p.type] || p.type || '佐藤まさし'];
                                batch.set(ref, {
                                    ...p,
                                    type: typeArr,
                                    status: Array.isArray(p.status) ? p.status : (p.status ? [p.status] : ['設置済']),
                                    tags: undefined,
                                    owner: '',
                                    contact: '',
                                    imageUrl: '',
                                    createdBy: userName,
                                    updatedBy: userName,
                                    createdAt: Date.now(),
                                    updatedAt: Date.now()
                                });
                            });
                            await batch.commit();
                            console.log('Sample data auto-loaded to Firestore.');
                        } catch (e) {
                            console.error('Failed to auto-load sample data', e);
                        }
                    };
                    autoLoad();
                }

            }, (error) => {
                console.error('Error fetching real-time data from Firestore:', error);
                setLoading(false);
            });
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
        };
    }, []);

    const addPoster = async (posterData: Partial<PosterPin>) => {
        try {
            const now = Date.now();
            const docRef = await addDoc(collection(db, 'posters'), {
                ...posterData,
                type: posterData.type || '佐藤まさし',
                status: Array.isArray(posterData.status) ? posterData.status : ['設置済'],
                createdAt: now,
                updatedAt: now,
                createdBy: userName,
                updatedBy: userName
            });
            const diff = `枚数: ${posterData.quantity || 1}枚`;
            await writeActivityLog('追加', docRef.id, posterData.address || '住所未設定', userName, diff, posterData.type || '');
        } catch (e) {
            console.error('Error adding document: ', e);
            alert('データの保存に失敗しました。');
        }
    };

    const updatePoster = async (id: string, updates: Partial<PosterPin>) => {
        try {
            const posterRef = doc(db, 'posters', id);
            // 種類情報: updates に含まれる場合はそれを優先、なければ現在の state から取得
            const currentPoster = posters.find(p => p.id === id);
            const posterType = updates.type || currentPoster?.type || '';
            // 差分サマリーを作成
            const diffParts: string[] = [];
            if (updates.status) diffParts.push(`ステータス: ${Array.isArray(updates.status) ? updates.status.join(',') : updates.status}`);
            if (updates.address) diffParts.push(`住所: ${updates.address}`);
            if (updates.type) diffParts.push(`種類: ${updates.type}`);
            if (updates.quantity !== undefined) diffParts.push(`枚数: ${updates.quantity}枚`);
            const diff = diffParts.length > 0 ? diffParts.join(' / ') : '内容を更新';
            await updateDoc(posterRef, {
                ...updates,
                updatedAt: Date.now(),
                updatedBy: userName
            });
            await writeActivityLog('更新', id, updates.address || currentPoster?.address || '', userName, diff, posterType);
        } catch (e) {
            console.error('Error updating document: ', e);
            alert('データの更新に失敗しました。');
        }
    };

    const deletePoster = async (id: string, address?: string) => {
        try {
            // 削除前に種類情報を state から取得（削除後は参照できないため）
            const currentPoster = posters.find(p => p.id === id);
            const posterType = currentPoster?.type || '';
            const diff = `枚数: ${currentPoster?.quantity || 1}枚`;
            await writeActivityLog('削除', id, address || '住所不明', userName, diff, posterType);
            await deleteDoc(doc(db, 'posters', id));
        } catch (e) {
            console.error('Error deleting document: ', e);
            alert('データの削除に失敗しました。');
        }
    };

    const setPostersBulk = async (newPosters: PosterPin[]) => {
        try {
            const batch = writeBatch(db);
            newPosters.forEach(p => {
                if (p.id) {
                    const ref = doc(db, 'posters', p.id);
                    batch.set(ref, p, { merge: true });
                } else {
                    const ref = doc(collection(db, 'posters'));
                    batch.set(ref, {
                        ...p,
                        type: typeof p.type === 'string' ? p.type : (Array.isArray(p.type) && p.type[0]) || '佐藤まさし',
                        status: Array.isArray(p.status) ? p.status : (p.status ? [p.status] : ['設置済']),
                        createdAt: p.createdAt || Date.now(),
                        updatedAt: Date.now(),
                        createdBy: userName
                    });
                }
            });
            await batch.commit();
        } catch (e) {
            console.error("Error bulk uploading array: ", e);
            alert('一括インポートに失敗しました。');
        }
    };

    // フィルター適用
    const filteredPosters = useMemo(() => {
        return posters.filter(p => {
            // typeフィルター（複数選択: いずれか一つでも含まれていれば表示）
            if (filter.types && filter.types.length > 0) {
                // 文字列比較（poster.typeは単一文字列）
                if (!filter.types.includes(p.type)) return false;
            }
            // statusフィルター（複数選択: いずれか一つでも含まれていれば表示）
            if (filter.status && filter.status.length > 0) {
                const hasMatch = filter.status.some(s => p.status?.includes(s));
                if (!hasMatch) return false;
            }

            // タグフィルター（複数選択: いずれか一つでも含まれていれば表示）
            if (filter.tags && filter.tags.length > 0) {
                const hasTagMatch = filter.tags.some(t => p.tags?.includes(t));
                if (!hasTagMatch) return false;
            }

            // キーワードフィルター（住所・備考・特記事項・所有者・タグ名も対象）
            if (filter.keyword) {
                const term = filter.keyword.toLowerCase();
                const addressMatch = (p.address || '').toLowerCase().includes(term);
                const memoMatch = (p.memo || '').toLowerCase().includes(term);
                const specialMatch = (p.specialNote || '').toLowerCase().includes(term);
                const ownerMatch = (p.owner || '').toLowerCase().includes(term);
                const tagMatch = (p.tags || []).some(t => t.toLowerCase().includes(term));
                if (!addressMatch && !memoMatch && !specialMatch && !ownerMatch && !tagMatch) return false;
            }

            return true;
        });
    }, [posters, filter]);

    return {
        posters,
        filteredPosters,
        filter,
        setFilter,
        addPoster,
        updatePoster,
        deletePoster,
        setPosters: setPostersBulk,
        loading,
        userRole
    };
};
