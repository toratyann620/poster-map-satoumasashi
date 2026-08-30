// ────────────────────────────────────────────────────────────
// グループ（事務所）
// ────────────────────────────────────────────────────────────

// 権限判定の対象となる市区町村。ここに無い市区町村のポスターは
// allowAll のグループ（佐藤まさし事務所）だけが扱える。
export const TARGET_CITIES = ['厚木市', '海老名市', '伊勢原市'] as const;

/**
 * どのグループでも扱える種別。
 *
 * 事務所の担当外の掲示物を記録する受け皿が必要なため、
 * 「その他」だけはすべてのグループの担当範囲に含める。
 * 市区町村の条件は通常どおり効くので、担当エリア外までは見えない。
 *
 * ⚠️ この定数は firestore.rules の同名の例外と対になっている。
 *    片方だけ変更しないこと。
 */
export const ALWAYS_ALLOWED_TYPES = ['その他'] as const;

/**
 * グループ定義。Firestore の `groups/{groupId}` に保存する。
 * コードではなくデータとして持つことで、事務所の追加が
 * ドキュメント1件の作成だけで完結する（再デプロイ不要）。
 */
export interface Group {
    id: string;          // ドキュメントID = グループID（例: nanba）
    name: string;        // 表示名（例: 難波事務所）
    allowAll: boolean;   // true なら全ポスターを閲覧・編集可能（佐藤まさし事務所）
    cities: string[];    // allowAll=false のときに扱える市区町村
    types: string[];     // allowAll=false のときに扱えるポスター種別
}

// ポスターに紐づく「誰のポスターか」の選択肢（複数選択可）
export const POSTER_PERSONS = ['佐藤まさし', 'ごとう祐一', '堀江県議', '党員募集', '公明党', '中道', '共産党', '難波県議', '渡辺県議', '長田県議', '山口市長', 'その他'] as const;
export type PosterPerson = typeof POSTER_PERSONS[number];

// ポスターの「状態」の選択肢（複数選択）
export const POSTER_STATUS_OPTIONS = ['設置済', '張替え予定', '未設置', '挨拶済', '要修理', 'その他'] as const;
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
    city: string;            // 市区町村（例: 厚木市）。グループ権限の判定に使う正規化フィールド。
                             // 住所文字列の部分一致は権限境界に使えないため、ジオコーディング結果から設定する。
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

/**
 * 管理者が出すお知らせ。Firestore の `announcements/{id}`。
 *
 * ポスターの変更を知らせる「デイリー通知」とは別物で、こちらは
 * 人が書いて全メンバーに届ける連絡。グループでは絞っていない
 * （事務所をまたいだ連絡ができなくなるため）。逆に言えば、
 * 特定の事務所にしか関係しない内容は本文で明示する運用にする。
 */
export interface Announcement {
    id: string;
    title: string;
    body: string;
    /** true なら次回アプリを開いたときにモーダルで一度だけ表示する */
    isPopup: boolean;
    /** 配信時にプッシュ通知も送るか。送信は Cloud Functions が行う */
    sendPush?: boolean;
    publishedAt: number;
    createdBy: string;
}

// 変更履歴ログ
export interface ActivityLog {
    id: string;
    action: '追加' | '更新' | '削除';
    posterId: string;
    posterAddress: string;
    city: string;                 // 市区町村。ポスター本体と同じくグループ権限の判定に使う
    posterType?: string;          // ポスターの種類（例: 佐藤まさし）
    changedBy: string;
    changedAt: number;
    diff?: string;                // 変更サマリー（例: "ステータス: 未設置→設置済"）
    posterStatus?: string[];      // 更新後のステータス配列
    isNeedsRepair?: boolean;      // 要修理フラグ（通知強調表示用）
    isNewRegistration?: boolean;  // 新規登録フラグ（通知強調表示用）
    statusAdded?: string[];       // この更新で新たに付いたステータス（日次レポート集計用）
    statusRemoved?: string[];     // この更新で新たに外れたステータス（日次レポート集計用）
    removedChangedTo?: boolean | null; // 撤去フラグが変化した場合の変化後の値（変化していなければnull、日次レポート集計用）
}
