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
// ⚠️ ここは「選択肢の既定値」と「ダッシュボードの並び順」にだけ使う。
// 実際に画面へ出る種類と色は Firestore の settings/pinTypes が持っており、
// 管理画面から編集できる。名前を変えるときは両方を揃えること。
export const POSTER_PERSONS = ['佐藤まさし', 'ごとう祐一', '堀江県議', '党員募集', '公明党', '中道', '共産党', 'なんばたつや', '渡辺のりゆき', 'おさだ進治', 'うだがわ希', '山口たかひろ', 'その他'] as const;
export type PosterPerson = typeof POSTER_PERSONS[number];

// ポスターの「状態」の選択肢（複数選択）
// ⚠️ 「挨拶済」はここから外した。誰がいつ挨拶したかが重要で、
// 付いている／いないの2値では記録として足りないため、独立した挨拶ログに移した。
// 絞り込みでは引き続き使えるようにしてある（GREETED_FILTER）。
export const POSTER_STATUS_OPTIONS = ['設置済', '張替え予定', '未設置', '要修理', 'その他'] as const;

/**
 * 絞り込み専用の擬似ステータス。
 * 実体は `greetings` に記録があるかどうかで、ポスターの status には入らない。
 */
export const GREETED_FILTER = '挨拶済';

/**
 * 挨拶の記録。ピン単位で積み重ねていく。
 *
 * 「いつ挨拶したか」と「いつ記録したか」を分けてある。
 * 現場で挨拶して後から入力することがあり、記録日時をもって
 * 挨拶日とすると実態とずれるため。
 */
export interface GreetingRecord {
    id: string;          // 取り消しの対象を特定するためのID
    by: string;          // 挨拶した人。既定は操作者だが変更できる
    date: string;        // 挨拶した日（YYYY-MM-DD）。既定は操作日だが変更できる
    note: string;        // 挨拶備考
    recordedBy: string;  // 記録した人
    recordedAt: number;  // 記録した日時
    /** 旧「挨拶済」ステータスから移した記録。日付が推定値であることを示す */
    migrated?: boolean;
}
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
    'なんばたつや': '#8B5CF6',   // violet-500
    '渡辺のりゆき': '#06B6D4',   // cyan-500
    'おさだ進治': '#84CC16',   // lime-500
    'うだがわ希': '#7E22CE',   // purple-700。既存11色と重ならない濃い紫を選んだ
    '山口たかひろ': '#14B8A6',   // teal-500
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
    greetings?: GreetingRecord[]; // 挨拶の記録（新しい順ではなく、記録した順に積む）
    removed?: boolean;       // 撤去フラグ（trueの場合マップ非表示、DBにデータは残る）
    removalReason?: string;  // 撤去した理由。撤去済みを表示する設定のときに詳細から確認できる
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
    /** 今日マイタスクに取った依頼の対象ピンだけを表示する */
    myTasksOnly?: boolean;
};

/** 依頼できる作業の種類 */
export const TASK_KINDS = ['設置', '撤去', '張替え', '修理', 'その他'] as const;
export type TaskKind = typeof TASK_KINDS[number];

/**
 * 作業の依頼（タスク）。Firestore の `tasks/{id}`。
 *
 * 事務所（グループ）単位で分ける。ポスターと同じ区切りにしておかないと、
 * 「依頼は見えるのに対象のピンは開けない」状態が起きるため。
 *
 * `assigneeUid` が空のものは事務所の全員に向けた共通の依頼として扱う。
 * 担当を決めずに「手が空いた人がやる」種類の依頼を、別の仕組みを足さずに表せる。
 */
export interface Task {
    id: string;
    groupId: string;
    title: string;
    body: string;
    kind: TaskKind;
    /** 対象のポスター。新規設置など、まだピンが無い依頼では空 */
    posterId?: string;
    /** 対象の場所。posterId がある場合はその住所を写しておく（ピンが消えても依頼は残るため） */
    address?: string;
    /** 担当者の uid。空なら事務所の全員向け */
    assigneeUid?: string;
    assigneeName?: string;
    /** 期限（YYYY-MM-DD）。空なら期限なし */
    dueDate?: string;
    status: 'open' | 'done';
    createdBy: string;
    createdAt: number;
    completedBy?: string;
    completedAt?: number;
    /** 完了時に残す結果。任意。完了済みの一覧から確認できる */
    completionNote?: string;
    /**
     * 「今日やる」として取った人（マイタスク）。
     * 取った日（takenDate, YYYY-MM-DD）の間だけ有効で、翌日には自動的に依頼へ戻る。
     * 戻す処理は書かず、日付が今日と一致するかで判定する（夜間のジョブが要らない）。
     */
    takenBy?: string;
    takenByName?: string;
    takenAt?: number;
    takenDate?: string;
    /**
     * 作成時にプッシュ通知を送るか。
     * ⚠️ プッシュは 2026-10-03 に全面停止したため、いまは参照されない
     * （functions の PUSH_ENABLED が false）。過去の依頼に値が残っている。
     */
    notify?: boolean;

    /** 作成時に Slack（#13_地元ポスター掲示物）へ投稿するか */
    slackNotify?: boolean;
    /**
     * メンション先。`settings/slackMentions` に登録された `mention` の値をそのまま持つ
     * （`<@U…>` / `<!subteam^S…>` / `<!here>` など Slack の記法）。
     * ⚠️ 送信時に Cloud Functions 側で設定済みの一覧と突き合わせ、
     * 一覧に無いものは捨てる。クライアントから任意の文字列を混ぜられないようにするため。
     */
    slackMentions?: string[];
    /** メンションの後ろに添える一言（任意） */
    slackMessage?: string;
}

/**
 * Slack のメンション先の候補。`settings/slackMentions` の `targets` に入れる。
 *
 * Slack の API を叩いてメンバーを引くことはできない（日次レポートと同じ
 * Incoming Webhook しか持っておらず、webhook では users.list を呼べない）ため、
 * 管理画面から手で登録する。メンバーIDは Slack のプロフィール →
 * 「その他」→「メンバーIDをコピー」で取れる。
 */
export interface SlackMentionTarget {
    /** 画面に出す名前。例: 「黒川睦夫」「@here（チャンネルにいる人全員）」 */
    label: string;
    /** Slack に渡す記法。例: `<@U0ABCDEF>` / `<!subteam^S012345>` / `<!here>` */
    mention: string;
}

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
    /** 操作した人の所属グループID。デイリー通知を事務所単位に絞るために使う */
    changedByGroupId?: string;
    changedAt: number;
    diff?: string;                // 変更サマリー（例: "ステータス: 未設置→設置済"）
    posterStatus?: string[];      // 更新後のステータス配列
    isNeedsRepair?: boolean;      // 要修理フラグ（通知強調表示用）
    isNewRegistration?: boolean;  // 新規登録フラグ（通知強調表示用）
    statusAdded?: string[];       // この更新で新たに付いたステータス（日次レポート集計用）
    statusRemoved?: string[];     // この更新で新たに外れたステータス（日次レポート集計用）
    removedChangedTo?: boolean | null; // 撤去フラグが変化した場合の変化後の値（変化していなければnull、日次レポート集計用）
}

/**
 * ログイン画面から届く新規登録の申請。
 *
 * 書き込みは Cloud Functions（submitAccountRequest / reviewAccountRequest）だけが行う。
 * クライアントからは佐藤まさし事務所の管理者が読むことしかできない。
 */
export interface AccountRequest {
    id: string;
    name: string;
    email: string;
    /** 申請者が入力したグループID */
    groupId: string;
    /** 申請時点のグループ名（グループ名が変わっても申請時の記録を残すため写しておく） */
    groupName?: string;
    /** 申請者が書いた連絡事項。任意 */
    note?: string;
    /**
     * 申請されたメールアドレスに既にアカウントがあるか。
     * 申請者には返さず、管理画面でのみ分かるようにしている
     * （在籍者を外から総当たりで調べられないようにするため）。
     */
    emailInUse?: boolean;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: number;
    /** 承認時に決めた権限 */
    role?: 'admin' | 'general';
    /** 承認で作られたアカウントの uid */
    createdUid?: string;
    reviewedBy?: string;
    reviewedAt?: number;
    rejectReason?: string;
    /** 案内メールを送れたか。false のときは初期パスワードを手渡しする運用になる */
    mailSent?: boolean;
    mailError?: string;
}
