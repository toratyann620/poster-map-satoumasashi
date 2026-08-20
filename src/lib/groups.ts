import { where, type QueryConstraint } from 'firebase/firestore';
import type { Group, PosterPin } from '../types';

/**
 * グループ権限のクライアント側ロジック。
 *
 * ⚠️ ここでの判定は「見せない」ためのものであって、「触れない」ことの保証ではない。
 * 情報漏洩を防ぐ実際の境界は firestore.rules 側にあり、本ファイルの内容は
 * ルールの条件と1対1で対応していなければならない。片方だけを変更しないこと。
 */

/** ポスター1件がグループの権限範囲に入るか */
export const isPosterInScope = (group: Group | null, poster: Pick<PosterPin, 'city' | 'type'>): boolean => {
    if (!group) return false;
    if (group.allowAll) return true;
    return group.cities.includes(poster.city ?? '') && group.types.includes(poster.type ?? '');
};

/**
 * ポスター取得クエリに付ける絞り込み条件を組み立てる。
 *
 * 閲覧を自グループのみに制限する場合、クライアントは必ずこの条件を付けなければならない。
 * Firestore は「1件でもルールに反する結果を含みうるクエリ」を丸ごと拒否するため、
 * 条件を付けずに全件取得しようとすると permission-denied になる（絞り込み漏れは
 * 情報漏洩ではなく即座のエラーとして現れる、という点で安全側の設計になっている）。
 */
export const scopeConstraints = (group: Group | null): QueryConstraint[] => {
    if (!group) return [];
    if (group.allowAll) return [];
    return [
        where('city', 'in', group.cities),
        where('type', 'in', group.types),
    ];
};

/**
 * `in` 句の展開数が Firestore の上限（1クエリあたり30）に収まるか。
 * 事務所の条件を管理画面から編集できるようにするため、保存前の検証に使う。
 */
export const MAX_DISJUNCTIONS = 30;

export const validateGroupScope = (group: Pick<Group, 'allowAll' | 'cities' | 'types'>): string | null => {
    if (group.allowAll) return null;
    if (group.cities.length === 0) return '市区町村を1つ以上指定してください。';
    if (group.types.length === 0) return 'ポスター種別を1つ以上指定してください。';
    const combinations = group.cities.length * group.types.length;
    if (combinations > MAX_DISJUNCTIONS) {
        return `市区町村×種別の組み合わせが${combinations}通りあり、Firestoreの上限（${MAX_DISJUNCTIONS}）を超えます。条件を絞ってください。`;
    }
    return null;
};

/** グループ未割り当てのユーザーに見せる説明文 */
export const NO_GROUP_MESSAGE =
    'アカウントにグループが割り当てられていません。管理者にお問い合わせください。';
