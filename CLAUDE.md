# CLAUDE.md

本ファイルは、**Claude Code** および **Antigravity** が本プロジェクトの開発方針、技術スタック、詳細仕様、および共同開発ルールを瞬時に把握するためのガイドラインです。

---

## 1. 共同開発プロトコル (重要)

本プロジェクトは **Antigravity** と **Claude Code** が共同で開発を行います。
齟齬を防ぐため、以下のルールを厳守してください。

1. **セッション開始時**:
   * 作業を開始する前に、必ず共通の進捗管理ファイルである [SHARED_DEV_LOG.md](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/SHARED_DEV_LOG.md) を読み込み、現在の進捗と未完了タスクを確認してください。
2. **作業完了時**:
   * 編集した内容や検討した事項がある場合は、セッションを終える前に必ず [SHARED_DEV_LOG.md](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/SHARED_DEV_LOG.md) の「3. 編集・検討履歴」に進捗状況を追記し、必要に応じて「2. タスク管理（TODO）」を更新してください。
3. **ポート管理ルール**:
   * ポート設定の変更や作成、起動スクリプト、環境変数（.env）などの変更を行う際は、必ず最優先で `/Users/kurokawamutsuo/開発フォルダ/997_開発ナレッジ/04_PORT_MANAGEMENT.md` (ポート台帳) を読み込み、割り当てられているポート範囲のみを使用してください。

---

## 2. 開発コマンド

### パッケージマネージャー
本プロジェクトは `npm` を使用します。

### 主要スクリプト
* **ローカルサーバー起動**:
  ```bash
  npm run dev
  ```
  *(注: `predev` により、ポート `3062` を使用しているプロセスが自動でキルされます。本アプリは通常ポート `3062` 等で動作することを前提としています)*
* **ビルド**:
  ```bash
  npm run build
  ```
* **静的解析 (Lint)**:
  ```bash
  npm run lint
  ```
* **プレビュー**:
  ```bash
  npm run preview
  ```

---

## 3. 技術スタック

* **フロントエンド**: React 19 / TypeScript / Vite 7 / Tailwind CSS 4
* **UIアイコン**: Lucide React
* **画像処理**: `browser-image-compression` (アップロード時の圧縮)
* **CSV操作**: `papaparse`
* **BaaS (Firebase v12)**:
  * **Authentication**: 管理者およびスタッフのログイン認証
  * **Firestore**: ポスターデータ、変更履歴、ユーザーロールの管理
  * **Storage**: ポスター画像の保存（Blob形式で圧縮アップロード）
* **地図サービス**: Google Maps Platform (Maps JavaScript API / Geocoding API / Places API)
* **デプロイ先**: Vercel

---

## 4. アプリケーション詳細仕様

本アプリは、主に「佐藤まさし」ポスターの掲示場所を Google Maps 上で可視化・共有し、設置状況や写真、所有者情報を一元管理するためのシステムです。

### 4.1. ユーザー認証と権限
* **一般ユーザー (`general`)**:
  * ピンの閲覧・追加・編集・削除
  * 位置の微調整（長押し移動モード）、現在地取得機能の使用
* **管理者ユーザー (`admin`)**:
  * 一般権限の全操作
  * 「管理者パネル」へのアクセス（ユーザー管理・新規アカウント作成・アカウント削除・変更履歴閲覧）
  * CSVファイルを用いたポスターデータの一括エクスポート/インポート
  * ダッシュボードおよびユーザー分析機能の利用

> [!IMPORTANT]
> セキュリティルール (`firestore.rules`) により、`admin` 以外のユーザーによる `users` コレクションの書き込み、および `activityLogs` コレクションの閲覧・削除はデータベースレベルで禁止されています。

### 4.2. マップ機能
* **住所・施設名検索**: Google Places API を利用したオートコンプリート検索バー。
* **高度なマーカー (AdvancedMarkerElement)**: ポスターの種類 (`type`) に応じてピンの色を動的に変更。
  * *例: 佐藤まさし = ブルー (#3B82F6), ごとう祐一 = イエロー (#EAB308) 等*
* **位置の微調整 (長押し移動)**: ピンを長押しして移動モードにし、マップ上をタップすることで正確な緯度経度を再設定可能。
* **ポスター枚数ウィジェット**: マップ右下に「佐藤まさし」の「総掲示枚数 (quantity合算)」と「過去7日間の純増減数」を表示。

### 4.3. ポスター詳細フォーム (BottomSheet)
新規追加およびピンタップ時に開くフォーム。
* **入力項目**: 緯度経度、種類 (`type`)、設置状況 (`status`: 複数選択可)、所在地 (`address`: Geocodingで自動逆引き・手動編集可)、設置方法、枚数 (`quantity`: デフォルト1)、所有者、連絡先、備考、特記事項、写真（Firestore / Storage に複数保存）

### 4.4. ダッシュボードと分析
* 全ての集計値（総数、グラフ、テーブル、ランキング等）は、ピンの箇所数ではなく、**ポスターの合計枚数（`quantity` の合計値）**を基準に集計。
* **種類別ピン数推移グラフ**: 折れ線グラフ (SVG) で期間中の累積ポスター枚数の増減推移を可視化。
* **ユーザー分析**: 活動ランキングの表示および、ユーザーごとの活動ログタイムラインの絞り込み表示。

### 4.5. CSVインポートのマージロジック
* CSV内に `id` 列が存在し、既存のFirestoreドキュメントと一致する場合：上書きマージ更新。
* `id` 列がない、または空の場合：新規ポスターとして追加。
* インポート時に旧形式の `type` (sato 等の英名) や `status` 配列のパース、日付のタイムスタンプ変換を自動実行。

---

## 5. データベース設計 (Firestore スキーマ)

### ① `posters` コレクション
* `id`: string (ドキュメントID)
* `lat` / `lng`: number (座標)
* `type`: string (佐藤まさし, ごとう祐一 等)
* `status`: string[] (設置済, 未設置 等の配列)
* `address`: string (住所)
* `placement`: string (設置方法)
* `quantity`: number (枚数)
* `owner` / `contact` / `memo` / `specialNote`: string
* `imageUrls`: string[] (Storageの写真URL配列)
* `createdAt` / `updatedAt`: number (タイムスタンプ)
* `createdBy` / `updatedBy`: string (操作ユーザー名)

### ② `users` コレクション
* `id`: string (Auth UID)
* `name`: string (表示名)
* `email`: string
* `role`: `"admin"` | `"general"`

### ③ `activityLogs` コレクション
* `id`: string
* `action`: `"追加"` | `"更新"` | `"削除"`
* `posterId`: string
* `posterAddress` / `posterType`: string
* `changedBy`: string
* `changedAt`: number
* `diff`: string (変更内容の差分サマリー。例: `"ステータス: 未設置→設置済"`)
