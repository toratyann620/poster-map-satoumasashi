// ポスターに紐づく「誰のポスターか」の選択肢（複数選択可）
export const POSTER_PERSONS = ['佐藤まさし', 'ごとう祐一', '堀江県議', '党員募集', '公明党', '中道', '共産党', '難波県議', '渡辺県議', '長田県議', '山口市長', 'その他'] as const;
export type PosterPerson = typeof POSTER_PERSONS[number];

// ポスターの「状態」の選択肢（複数選択）
export const POSTER_STATUS_OPTIONS = ['設置済', '張替え予定', '未設置', '挨拶済', 'その他'] as const;
export type PosterStatus = typeof POSTER_STATUS_OPTIONS[number];

// マーカーの色マッピング
export const PERSON_COLORS: Record<PosterPerson, string> = {
    '佐藤まさし': '#3B82F6',  // blue-500
    'ごとう祐一': '#EAB308',  // yellow-500
    '堀江県議': '#10B981',   // emerald-500
    '党員募集': '#F43F5E',   // rose-500
    '公明党': '#EC4899',   // pink-500
    '中道': '#F59E0B',   // amber-500
    '共産党': '#EF4444',   // red-500
    '難波県議': '#8B5CF6',   // violet-500
    '渡辺県議': '#06B6D4',   // cyan-500
    '長田県議': '#84CC16',   // lime-500
    '山口市長': '#14B8A6',   // teal-500
    'その他': '#6B7280',   // gray-500
};

export interface PosterPin {
    id: string;              // Firestoreドキュメントid
    lat: number;             // 緯度
    lng: number;             // 経度
    type: string;            // 誰のポスターか（単一選択）
    status: string[];        // 設置状況（複数選択）
    address: string;         // 所在地
    placement: string;       // 設置方法 (例: 針金, フェンス)
    quantity: number;        // 枚数
    owner: string;           // 所有者
    contact: string;         // 連絡先
    memo: string;            // 備考
    specialNote: string;     // 特記事項
    imageUrl: string;        // 写真 (Base64またはStorage URL、互換性用)
    imageUrls?: string[];    // 複数写真 (Storage URL配列)
    tags?: string[];         // カスタムタグ (複数指定可能)
    removed?: boolean;       // 撤去フラグ（trueの場合マップ非表示、DBにデータは残る）
    createdAt: number;       // 作成日時 (timestamp)
    updatedAt: number;       // 更新日時 (timestamp)
    createdBy: string;       // 登録者
    updatedBy: string;       // 最終更新者
}

export type FilterState = {
    keyword: string;
    types: string[];   // 複数選択、空配列 = すべて表示
    status: string[];  // 複数選択、空配列 = すべて表示
    tags: string[];    // 複数選択、空配列 = すべて表示
};

// 変更履歴ログ
export interface ActivityLog {
    id: string;
    action: '追加' | '更新' | '削除';
    posterId: string;
    posterAddress: string;
    posterType?: string; // ポスターの種類（例: 佐藤まさし）※B案: 今後のログから含まれる
    changedBy: string;
    changedAt: number;
    diff?: string;  // 変更サマリー（例: "ステータス: 未設置→設置済"）
}
