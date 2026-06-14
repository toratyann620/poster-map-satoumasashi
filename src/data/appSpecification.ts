export interface SpecBlock {
    type: 'paragraph' | 'list' | 'info' | 'subheading';
    text?: string;
    items?: string[];
}

export interface SpecSection {
    id: string;
    title: string;
    blocks: SpecBlock[];
}

export const APP_SPECIFICATION: SpecSection[] = [
    {
        id: 'overview',
        title: '1. アプリケーション概要',
        blocks: [
            {
                type: 'paragraph',
                text: '本システムは、街中に掲示されているポスター（主に「佐藤まさし」ポスター）の掲示場所を Google Maps 上で可視化・共有し、設置状況や写真、所有者情報を一元管理するためのマップアプリケーションです。'
            },
            {
                type: 'paragraph',
                text: 'フィールドスタッフが現地でリアルタイムにピンの追加・更新を行えるモバイルフレンドリーな設計と、管理者が組織全体の活動量やポスター設置比率を把握できるダッシュボードを併せ持っています。'
            }
        ]
    },
    {
        id: 'tech-stack',
        title: '2. 技術スタック',
        blocks: [
            {
                type: 'subheading',
                text: '■ フロントエンド'
            },
            {
                type: 'list',
                items: [
                    'フレームワーク: React 19',
                    'ビルドツール: Vite 7',
                    '言語: TypeScript',
                    'スタイリング: Tailwind CSS 4',
                    'アイコン: Lucide React'
                ]
            },
            {
                type: 'subheading',
                text: '■ バックエンド (BaaS)'
            },
            {
                type: 'list',
                items: [
                    'データベース: Firebase Cloud Firestore (リアルタイム同期)',
                    '認証: Firebase Authentication (メール・パスワード認証)',
                    'ストレージ: Firebase Storage (ポスター掲示写真の保存)'
                ]
            },
            {
                type: 'subheading',
                text: '■ 地図サービス'
            },
            {
                type: 'list',
                items: [
                    'Google Maps Platform (Maps JavaScript API / Geocoding API / Places API)',
                    '主要機能: 高度なマーカー (AdvancedMarkerElement), ジオコーディング (座標から住所への逆引き), オートコンプリート (検索窓による位置移動)'
                ]
            }
        ]
    },
    {
        id: 'auth-permissions',
        title: '3. ユーザー認証と権限仕様',
        blocks: [
            {
                type: 'paragraph',
                text: 'ユーザーには「管理者 (admin)」または「一般 (general)」のいずれかのロールが割り当てられます。それぞれの操作権限は以下の通り定義されています。'
            },
            {
                type: 'subheading',
                text: '■ 一般ユーザー (general)'
            },
            {
                type: 'list',
                items: [
                    'マップ上でのポスターピンの閲覧',
                    'ポスターピンの新規追加 (フォームへの入力と地図タップ)',
                    'ポスターピン情報の編集 (設置数、ステータス、写真、メモなどの更新)',
                    'ポスターピンの削除',
                    '現在地取得機能の使用'
                ]
            },
            {
                type: 'subheading',
                text: '■ 管理者ユーザー (admin)'
            },
            {
                type: 'list',
                items: [
                    '一般ユーザーが実行できるすべての操作',
                    '「管理者パネル」へのアクセス',
                    'アカウントの新規作成 (表示名、メールアドレス、初期パスワード、権限の指定)',
                    '登録済みアカウントの削除 (Firebase Auth 側は手動で削除が必要)',
                    '変更履歴 (アクティビティログ) の閲覧 (最新200件)',
                    'CSVファイルを用いたポスターデータの一括エクスポート/インポート',
                    'ダッシュボードおよびユーザー分析機能の利用'
                ]
            },
            {
                type: 'info',
                text: 'セキュリティ強化のため、Firestore セキュリティルール (firestore.rules) にて、admin 以外のユーザーによる users コレクションの書き込み、および activityLogs コレクションの閲覧・削除はデータベースレベルで厳密に遮断されています。また、フロントエンドでも AdminPanel マウント時にロールの二重チェックを行っています。'
            }
        ]
    },
    {
        id: 'map-features',
        title: '4. マップ機能',
        blocks: [
            {
                type: 'subheading',
                text: '■ 住所・施設名検索'
            },
            {
                type: 'paragraph',
                text: '画面上部の検索窓より住所や施設名を検索し、該当箇所へマップの中心を瞬時に移動させることができます (Google Places API 利用)。'
            },
            {
                type: 'subheading',
                text: '■ マーカー表示'
            },
            {
                type: 'paragraph',
                text: 'Google Maps の AdvancedMarkerElement を使用し、ポスターの種類 (type) に応じた色付きピンを地図上にレンダリングします。ポスター種類ごとの色は以下のように定義されています。'
            },
            {
                type: 'list',
                items: [
                    '佐藤まさし: ブルー (#3B82F6)',
                    'ごとう祐一: イエロー (#EAB308)',
                    '高市早苗: エメラルド (#10B981)',
                    '党員募集: ローズ (#F43F5E)',
                    '公明党: ピンク (#EC4899)',
                    '中道: アンバー (#F59E0B)',
                    '共産党: レッド (#EF4444)',
                    '難波県議: バイオレット (#8B5CF6)',
                    '渡辺県議: シアン (#06B6D4)',
                    '長田県議: ライム (#84CC16)',
                    '山口市長: ティール (#14B8A6)',
                    'その他: グレー (#6B7280)'
                ]
            },
            {
                type: 'subheading',
                text: '■ 位置の微調整 (ピン長押し移動モード)'
            },
            {
                type: 'paragraph',
                text: 'ピンを「長押し」するとピンの移動モードに入ります。このモード中にマップ上の任意の場所をタップすると、その位置へピンを再配置し、自動で座標 (緯度・経度) が更新されます。'
            },
            {
                type: 'subheading',
                text: '■ 佐藤まさしポスター枚数ウィジェット'
            },
            {
                type: 'paragraph',
                text: 'マップの右下に表示される常設ウィジェットです。本アプリで最も重要な「佐藤まさし」ポスターの「総掲示枚数 ( quantity の合算)」と、活動ログから算出した「過去7日間の正確な純増減数 (追加数 - 削除数)」をリアルタイム表示し、現場の士気向上や状況把握を促進します。'
            }
        ]
    },
    {
        id: 'poster-management',
        title: '5. ポスター管理機能 (詳細フォーム)',
        blocks: [
            {
                type: 'paragraph',
                text: '地図上をタップして新規追加するか、既存のピンをタップすることで、詳細情報を管理する BottomSheet フォームが開きます。入力・管理できる項目は以下の通りです。'
            },
            {
                type: 'list',
                items: [
                    '緯度・経度: 地図上のタップ位置から自動取得。',
                    'ポスターの種類 (type): リストから単一選択 (佐藤まさし、ごとう祐一 等)。',
                    '設置状況 (status): 複数選択可 (設置済、張替え予定、未設置、挨拶済、その他)。',
                    '所在地 (address): Geocoding API により、ピン配置時に自動で逆引き住所を取得。編集も可能。',
                    '設置方法 (placement): フェンス、壁、針金などの固定方法を任意入力。',
                    '枚数 (quantity): その場所に掲示されているポスターの枚数 (デフォルト: 1枚)。',
                    '所有者 (owner): 掲示場所の提供者名。',
                    '連絡先 (contact): 所有者の電話番号等。',
                    '備考 (memo): 設置時のメモ書き。',
                    '特記事項 (specialNote): 特筆すべき情報（再訪問日の約束など）。',
                    '写真 (imageUrls): 最大複数枚の掲示写真を Firebase Storage へ直接アップロードして保存。アップロード時は画像圧縮ライブラリを介してファイルサイズを最適化します。'
                ]
            }
        ]
    },
    {
        id: 'dashboard-analytics',
        title: '6. ダッシュボードと分析機能',
        blocks: [
            {
                type: 'paragraph',
                text: '管理者専用の分析ツールです。日付レンジ（デフォルト: 本日から30日前）およびステータスフィルターでの絞り込みが可能です。なお、ダッシュボードおよびユーザー分析のすべての集計値（総数、グラフ、テーブル、ランキング等）は、ピンの箇所数（箇所数）ではなく、ポスターの合計枚数（各ピンの quantity の合計）を基準として集計します。'
            },
            {
                type: 'subheading',
                text: '■ ダッシュボードタブ'
            },
            {
                type: 'list',
                items: [
                    '佐藤まさし KPI: 「佐藤まさし」に特化した総ポスター枚数、設置済み率、および期間中の純増減枚数を表示します。',
                    '期間アクション総数: 期間中に実行された追加・更新・削除のアクションに伴う総ポスター枚数をカウントします。',
                    '最終更新日時 & 最も活動的な曜日の自動算出。',
                    '種類別ピン数推移折れ線グラフ: 各種類ポスターの期間中の累積ポスター枚数の増減推移を折れ線グラフ (SVG) で可視化します。',
                    '日別アクション推移グラフ: 毎日のアクション数（追加・更新・削除されたポスター枚数）を積み上げ棒グラフで表示します。',
                    '種類別サマリーテーブル: 種類ごとの現在のポスター枚数、設置率、追加・削除枚数、純増減を表形式で一覧化します。'
                ]
            },
            {
                type: 'subheading',
                text: '■ ユーザー分析タブ'
            },
            {
                type: 'list',
                items: [
                    '活動ランキング: 期間中のアクション枚数が最も多いユーザーをランキング順に表示し、各ユーザーの登録ポスター枚数や主要なポスター種類を表示します。',
                    'ユーザー別詳細ログ: ランキングのユーザーをクリックすることで、そのユーザーに絞り込まれた活動ログ（日時、住所、差分の詳細）をタイムライン表示します。'
                ]
            }
        ]
    },
    {
        id: 'csv-features',
        title: '7. CSVインポート/エクスポート仕様',
        blocks: [
            {
                type: 'paragraph',
                text: '管理者は、Firestore 内のすべてのポスターデータを CSV 形式でダウンロード（エクスポート）したり、外部で編集した CSV を取り込んで一括更新・新規追加（インポート）することができます。'
            },
            {
                type: 'subheading',
                text: '■ インポートの差分マージロジック'
            },
            {
                type: 'list',
                items: [
                    'CSV 内に `id` 列が存在し、その ID が既存の Firestore ドキュメントと一致する場合: 既存のデータを上書き（マージ）更新します。',
                    '`id` 列が空である、もしくは存在しない行の場合: 新規ポスターとして Firestore に追加し、自動でドキュメントIDを発行します。',
                    'インポート時のデータ形式自動変換: 旧形式の `type` (sato, goto などの英名) や `status` 配列のパース、日付のタイムスタンプ変換などをシステム内部で安全に行い、データベースの整合性を保証します。'
                ]
            }
        ]
    },
    {
        id: 'database-design',
        title: '8. データベース設計 (Firestore スキーマ)',
        blocks: [
            {
                type: 'subheading',
                text: '■ posters コレクション'
            },
            {
                type: 'list',
                items: [
                    'id: string (Firestore ドキュメントID)',
                    'lat: number (緯度)',
                    'lng: number (経度)',
                    'type: string (ポスター種類。佐藤まさし, ごとう祐一 等)',
                    'status: string[] (ステータス。設置済, 未設置 等の配列)',
                    'address: string (住所)',
                    'placement: string (設置方法)',
                    'quantity: number (枚数)',
                    'owner: string (所有者)',
                    'contact: string (連絡先)',
                    'memo: string (備考)',
                    'specialNote: string (特記事項)',
                    'imageUrls: string[] (写真のURL配列)',
                    'createdAt: number (作成タイムスタンプ)',
                    'updatedAt: number (更新タイムスタンプ)',
                    'createdBy: string (作成ユーザー名)',
                    'updatedBy: string (更新ユーザー名)'
                ]
            },
            {
                type: 'subheading',
                text: '■ users コレクション'
            },
            {
                type: 'list',
                items: [
                    'id: string (Auth UID と一致するドキュメントID)',
                    'name: string (表示名)',
                    'email: string (メールアドレス)',
                    'role: "admin" | "general" (権限ロール)'
                ]
            },
            {
                type: 'subheading',
                text: '■ activityLogs コレクション'
            },
            {
                type: 'list',
                items: [
                    'id: string (ドキュメントID)',
                    'action: "追加" | "更新" | "削除" (アクション種別)',
                    'posterId: string (対象ポスターID)',
                    'posterAddress: string (対象ポスターの住所)',
                    'posterType: string (対象ポスターの種類)',
                    'changedBy: string (操作者名)',
                    'changedAt: number (操作タイムスタンプ)',
                    'diff: string (変更差分サマリー。例: "ステータス: 未設置→設置済")'
                ]
            }
        ]
    }
];
