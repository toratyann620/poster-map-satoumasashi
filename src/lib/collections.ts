/**
 * Firestore のコレクション名を一箇所に集約する。
 *
 * グループ権限の導入にあたり、ポスターと変更履歴は現行の本番コレクションとは
 * 別の「v2」コレクションで構築する。理由は2つ:
 *
 *  1. 本番環境（現行のWebアプリ）を最後まで無傷で動かし続けるため。
 *     v2 の実装やセキュリティルールに不備があっても、現行の `posters` には届かない。
 *  2. v2 では `city` フィールドが権限判定の前提になるため、
 *     `city` を持たない既存データと混在させられないため。
 *
 * ユーザー・設定・Storage・Auth は共通のまま使う。これにより
 * 最終移行時に「写真の移行」「パスワードの移行」が一切不要になる。
 */
export const COL = {
    /** ポスター（グループ権限あり） */
    posters: 'posters_v2',
    /** 変更履歴（グループ権限あり） */
    activityLogs: 'activityLogs_v2',
    /** ユーザー（現行と共通。groupId フィールドを追加して使う） */
    users: 'users',
    /** グループ定義（新規） */
    groups: 'groups',
    /** アプリ設定（現行と共通） */
    settings: 'settings',
} as const;

/** 移行元となる現行の本番コレクション（移行スクリプトからのみ参照する） */
export const LEGACY_COL = {
    posters: 'posters',
    activityLogs: 'activityLogs',
} as const;
