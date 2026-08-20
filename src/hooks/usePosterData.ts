import { useState, useEffect, useMemo } from 'react';
import type { PosterPin, FilterState } from '../types';
import { db } from '../lib/firebase';
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
} from 'firebase/firestore';
import { COL } from '../lib/collections';
import { scopeConstraints } from '../lib/groups';
import { cityFromAddress } from '../lib/city';
import { useSession } from './useSession';

// アクティビティログをFirestoreに書き込むヘルパー。
// city / posterType はグループ権限の判定に使われるため、必ず埋める。
// 欠けているとルール側で弾かれ、履歴が残らなくなる。
const writeActivityLog = async (
    action: '追加' | '更新' | '削除',
    posterId: string,
    posterAddress: string,
    city: string,
    changedBy: string,
    diff?: string,
    posterType?: string,
    posterStatus?: string[],
    // 日次レポート等の集計用: この更新で「新たに付いた」「新たに外れた」ステータス、
    // および撤去フラグが変化した場合はその変化後の値（変化していなければ null）
    changeDetail?: {
        statusAdded?: string[];
        statusRemoved?: string[];
        removedChangedTo?: boolean | null;
    },
) => {
    try {
        const isNeedsRepair = Array.isArray(posterStatus) && posterStatus.includes('要修理');
        const isNewRegistration = action === '追加';
        await addDoc(collection(db, COL.activityLogs), {
            action,
            posterId,
            posterAddress,
            city: city || '',
            changedBy,
            changedAt: Date.now(),
            diff: diff || '',
            posterType: posterType || '',
            posterStatus: posterStatus || [],
            isNeedsRepair,
            isNewRegistration,
            statusAdded: changeDetail?.statusAdded || [],
            statusRemoved: changeDetail?.statusRemoved || [],
            removedChangedTo: changeDetail?.removedChangedTo ?? null,
        });
    } catch (e) {
        console.warn('Failed to write activity log:', e);
    }
};

export const usePosterData = () => {
    const session = useSession();
    const { group, name: userName, role: userRole } = session;

    const [posters, setPosters] = useState<PosterPin[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterState>({
        keyword: '',
        types: [],   // 空配列 = すべて表示
        status: [],  // 空配列 = すべて表示
        tags: [],    // 空配列 = すべて表示
    });

    // グループが確定してから購読を開始する。
    // 権限範囲の条件を付けずに問い合わせると Firestore がクエリごと拒否するため、
    // 「まだ分からないので全件取りにいく」という挙動は許されない。
    const scopeKey = group
        ? `${group.id}|${group.allowAll}|${group.cities.join(',')}|${group.types.join(',')}`
        : '';

    useEffect(() => {
        if (!session.ready) return;
        if (!group) {
            setPosters([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, COL.posters),
            ...scopeConstraints(group),
            orderBy('updatedAt', 'desc'),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: PosterPin[] = [];
            snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                data.push({
                    id: docSnap.id,
                    lat: d.lat,
                    lng: d.lng,
                    type: d.type || '',
                    status: d.status || [],
                    address: d.address || '',
                    city: d.city || '',
                    placement: d.placement || '',
                    quantity: d.quantity || 1,
                    owner: d.owner || '',
                    contact: d.contact || '',
                    memo: d.memo || '',
                    specialNote: d.specialNote || '',
                    imageUrl: d.imageUrl || '',
                    imageUrls: d.imageUrls || [],
                    tags: d.tags || [],
                    removed: !!d.removed,
                    createdAt: d.createdAt || Date.now(),
                    updatedAt: d.updatedAt || Date.now(),
                    createdBy: d.createdBy || '',
                    updatedBy: d.updatedBy || '',
                } as PosterPin);
            });
            setPosters(data);
            setLoading(false);
        }, (error) => {
            console.error('ポスターの取得に失敗しました:', error);
            setPosters([]);
            setLoading(false);
        });

        return () => unsubscribe();
        // scopeKey にグループの条件を畳み込んでいるため、条件が変われば購読を張り直す
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.ready, scopeKey]);

    // city は権限判定に使う必須フィールド。呼び出し元が指定していなければ住所から補う。
    const ensureCity = (p: Partial<PosterPin>): string => p.city || cityFromAddress(p.address);

    const addPoster = async (posterData: Partial<PosterPin>) => {
        const city = ensureCity(posterData);
        try {
            const now = Date.now();
            const docRef = await addDoc(collection(db, COL.posters), {
                ...posterData,
                city,
                type: posterData.type || '佐藤まさし',
                status: Array.isArray(posterData.status) ? posterData.status : ['設置済'],
                createdAt: now,
                updatedAt: now,
                createdBy: userName,
                updatedBy: userName,
            });
            const diff = `枚数: ${posterData.quantity || 1}枚`;
            await writeActivityLog('追加', docRef.id, posterData.address || '住所未設定', city, userName, diff, posterData.type || '', Array.isArray(posterData.status) ? posterData.status : []);
        } catch (e) {
            console.error('Error adding document: ', e);
            alert(describeWriteError(e, '登録'));
        }
    };

    const updatePoster = async (id: string, updates: Partial<PosterPin>) => {
        const currentPoster = posters.find(p => p.id === id);
        try {
            const posterRef = doc(db, COL.posters, id);
            // 種類情報: updates に含まれる場合はそれを優先、なければ現在の state から取得
            const posterType = updates.type || currentPoster?.type || '';
            // 住所が変わり、かつ city が指定されていない場合は住所から引き直す
            const nextCity = updates.city ?? (updates.address ? cityFromAddress(updates.address) : currentPoster?.city ?? '');

            // 差分サマリーを作成
            const diffParts: string[] = [];
            if (updates.status) diffParts.push(`ステータス: ${Array.isArray(updates.status) ? updates.status.join(',') : updates.status}`);
            if (updates.address) diffParts.push(`住所: ${updates.address}`);
            if (updates.type) diffParts.push(`種類: ${updates.type}`);
            if (updates.quantity !== undefined) diffParts.push(`枚数: ${updates.quantity}枚`);
            if (updates.removed !== undefined) diffParts.push(updates.removed ? '撤去' : '撤去解除');
            const diff = diffParts.length > 0 ? diffParts.join(' / ') : '内容を更新';

            // 日次レポート等の集計用: 変更前後のステータスを比較し、新たに付いた／外れたフラグを記録する
            const prevStatus: string[] = Array.isArray(currentPoster?.status)
                ? currentPoster!.status
                : (currentPoster?.status ? [currentPoster.status as unknown as string] : []);
            const nextStatusArr: string[] | undefined = updates.status
                ? (Array.isArray(updates.status) ? updates.status : [updates.status as unknown as string])
                : undefined;
            const statusAdded = nextStatusArr ? nextStatusArr.filter(s => !prevStatus.includes(s)) : [];
            const statusRemoved = nextStatusArr ? prevStatus.filter(s => !nextStatusArr.includes(s)) : [];
            const removedChangedTo = (updates.removed !== undefined && updates.removed !== currentPoster?.removed)
                ? updates.removed
                : null;

            await updateDoc(posterRef, {
                ...updates,
                city: nextCity,
                updatedAt: Date.now(),
                updatedBy: userName,
            });
            const newStatus = updates.status || currentPoster?.status || [];
            await writeActivityLog('更新', id, updates.address || currentPoster?.address || '', nextCity, userName, diff, posterType, Array.isArray(newStatus) ? newStatus : [newStatus], {
                statusAdded,
                statusRemoved,
                removedChangedTo,
            });
        } catch (e) {
            console.error('Error updating document: ', e);
            alert(describeWriteError(e, '更新'));
        }
    };

    const deletePoster = async (id: string, address?: string) => {
        try {
            // 削除前に種類・市区町村を state から取得（削除後は参照できないため）
            const currentPoster = posters.find(p => p.id === id);
            const posterType = currentPoster?.type || '';
            const diff = `枚数: ${currentPoster?.quantity || 1}枚`;
            await writeActivityLog('削除', id, address || '住所不明', currentPoster?.city || '', userName, diff, posterType);
            await deleteDoc(doc(db, COL.posters, id));
        } catch (e) {
            console.error('Error deleting document: ', e);
            alert(describeWriteError(e, '削除'));
        }
    };

    // Firestoreのバッチ書き込みは1回あたり最大500件までのため、余裕を持って分割コミットする
    const BULK_WRITE_CHUNK_SIZE = 400;

    const setPostersBulk = async (newPosters: PosterPin[]) => {
        // 呼び出し元（CSVインポート確認画面など）で詳細なエラー内容を表示できるよう、
        // ここではエラーを握りつぶさずそのまま呼び出し元に伝播させる
        for (let i = 0; i < newPosters.length; i += BULK_WRITE_CHUNK_SIZE) {
            const chunk = newPosters.slice(i, i + BULK_WRITE_CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(p => {
                if (p.id) {
                    const ref = doc(db, COL.posters, p.id);
                    // 部分更新でも city は必ず載せる（ルールが city を要求するため）
                    batch.set(ref, { ...p, city: ensureCity(p) }, { merge: true });
                } else {
                    const ref = doc(collection(db, COL.posters));
                    batch.set(ref, {
                        ...p,
                        city: ensureCity(p),
                        type: typeof p.type === 'string' ? p.type : (Array.isArray(p.type) && p.type[0]) || '佐藤まさし',
                        status: Array.isArray(p.status) ? p.status : (p.status ? [p.status] : ['設置済']),
                        createdAt: p.createdAt || Date.now(),
                        updatedAt: Date.now(),
                        createdBy: userName,
                    });
                }
            });
            await batch.commit();
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
        userRole,
        group,
    };
};

/**
 * 書き込みエラーを利用者向けの文言にする。
 * permission-denied は「権限範囲外の操作をした」場合に返るため、
 * 「保存に失敗しました」よりも原因が伝わる文言にしておく。
 */
const describeWriteError = (e: unknown, verb: string): string => {
    const code = (e as { code?: string })?.code ?? '';
    if (code === 'permission-denied') {
        return `このポスターは担当範囲外のため${verb}できません。\n担当の市区町村・種別の範囲をご確認ください。`;
    }
    return `データの${verb}に失敗しました。`;
};
