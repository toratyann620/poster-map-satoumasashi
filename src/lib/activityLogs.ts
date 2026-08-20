import { where, type QueryConstraint, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { ActivityLog, Group } from '../types';

/**
 * 変更履歴の共通処理。
 *
 * 履歴を読むフックが4つ（一覧・全件・日次通知・ダッシュボード）あり、
 * それぞれが同じ変換を書き写していたため、ここに集約する。
 * グループ権限の導入でフィールドが1つ増えるたびに4箇所直す、という状態を避ける狙いもある。
 */

/** Firestore のドキュメントを ActivityLog に変換する */
export const parseActivityLog = (snap: QueryDocumentSnapshot<DocumentData>): ActivityLog => {
    const d = snap.data();
    return {
        id: snap.id,
        action: d.action || '更新',
        posterId: d.posterId || '',
        posterAddress: d.posterAddress || '',
        city: d.city || '',
        posterType: d.posterType || '',
        changedBy: d.changedBy || '',
        changedAt: d.changedAt || 0,
        diff: d.diff || '',
        posterStatus: d.posterStatus || [],
        isNeedsRepair: !!d.isNeedsRepair,
        isNewRegistration: !!d.isNewRegistration,
        statusAdded: d.statusAdded || [],
        statusRemoved: d.statusRemoved || [],
        removedChangedTo: d.removedChangedTo ?? null,
    };
};

/**
 * 変更履歴の取得クエリに付ける絞り込み条件。
 *
 * ポスター本体と同じ範囲に絞る。フィールド名だけが異なる（type ではなく posterType）。
 * 履歴にも住所・種別・変更内容が含まれるため、ここを絞らないと
 * 他事務所の活動内容が読めてしまう。
 */
export const logScopeConstraints = (group: Group | null): QueryConstraint[] => {
    if (!group || group.allowAll) return [];
    return [
        where('city', 'in', group.cities),
        where('posterType', 'in', group.types),
    ];
};
