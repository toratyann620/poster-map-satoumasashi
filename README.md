# ポスターマップ管理システム

ポスターの掲示場所をGoogle Maps上で管理・可視化するためのマップアプリケーションです。

## 1. システム概要
街中に掲示されているポスターの場所を地図上でピン留めし、写真や属性情報（住所、備考、ステータスなど）と共に管理します。
管理者はログイン後、マーカーの追加・編集・削除、およびデータのCSVエクスポート/インポートを行うことができます。

## 2. 技術スタック

### フロントエンド
- **コア**: React 19 / TypeScript
- **ビルドツール**: Vite 7
- **スタイリング**: Tailwind CSS 4
- **アイコン**: Lucide React / React Icons

### インフラ・外部サービス
- **デプロイ**: Vercel
- **BaaS**: Firebase (v12)
  - **Authentication**: 管理者認証
  - **Firestore**: ポスターデータの保存・管理
- **地図サービス**: Google Maps Platform
  - **Maps JavaScript API**: 地図描画、AdvancedMarkerElement の利用
  - **Places API**: 住所検索・オートコンプリート
  - **Geocoding API**: 住所から座標への変換

## 3. 主要な依存関係
- `@googlemaps/react-wrapper`: Google Maps SDKのReactラッパー
- `firebase`: データ永続化と認証
- `papaparse`: CSVデータのパースおよび生成
- `browser-image-compression`: アップロード画像の圧縮処理

## 4. プロジェクト構造
```text
src/
├── components/     # UIコンポーネント（Map, SearchBar, AdminPanel 等）
├── hooks/          # カスタムフック
├── lib/            # 外部ライブラリ設定（firebase.ts 等）
├── types/          # 型定義（Poster, User 等）
├── utils/          # ユーティリティ関数
├── App.tsx         # メインロジック・ステート管理
└── main.tsx        # エントリーポイント
```

## 5. 現在の課題（引き継ぎ用）

現在、**Vercelの本番環境でのみ、Google Mapsの背景タイルが表示されずグレーアウトする**という不具合が発生しています。

### 調査済みの事実
- **ローカル環境では正常に動作**: 全く同じAPIキーとMap IDを使用しても、`localhost`では背景が表示されます。
- **純粋なHTMLテストでも失敗**: React/Viteを介さない純粋なHTMLファイルをVercelに配置しても同様に背景がブロックされます。
- **マーカーは表示される**: APIキー自体は正常に読み込まれており、マーカーの描画やデータの取得は可能です。

### 推測される原因
Google Cloud Console上の設定（ウェブサイト制限のリファラーパターン）と、Vercelのドメイン間の不適合、あるいは課金（Billing）設定に関連するドメインレベルの制限が疑われています。
詳細はエンジニアへの依頼用資料を参照してください。

## 6. セットアップ方法

### 環境変数の設定
`.env.local` に以下のキーを設定する必要があります：
```text
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
...
VITE_GOOGLE_MAPS_API_KEY="AIzaSy..."
VITE_GOOGLE_MAPS_MAP_ID="..."
```

### コマンド
```bash
npm install     # 依存関係のインストール
npm run dev     # ローカル開発サーバー起動
npm run build   # プロダクションビルド
```

