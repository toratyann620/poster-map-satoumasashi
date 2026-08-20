# 共同開発同期ログ (SHARED_DEV_LOG.md)

このファイルは、**Antigravity** と **Claude Code** が共同で開発を進めるにあたり、作業内容の同期やタスクの進捗管理を行うための共通ログファイルです。
各エージェントは、対話開始時に必ずこのファイルを読み込み、開発完了時にはこのファイルに履歴を追記・更新してください。

---

## 1. 共同開発のルール

1. **対話開始時の読み込み**:
   * セッション開始時、AIエージェントは必ずこの [SHARED_DEV_LOG.md](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/SHARED_DEV_LOG.md) を読み込み、現在の進捗状況と次のタスクを確認すること。
2. **作業完了時の記録**:
   * コード変更、バグ修正、機能追加、または重要な設計・技術的検討を行った場合は、セッション終了前に本ファイルの「3. 編集・検討履歴」に日付・作業担当（Antigravity / Claude Code）・詳細内容を必ず記録すること。
3. **タスクのステータス更新**:
   * 「2. タスク管理（TODO）」の進捗状況（未着手・進行中・完了）を都度更新すること。
4. **ポート管理ルール**:
   * ポート設定の変更や作成、起動スクリプト、環境変数（.env）などの変更を行う際は、必ず最優先で `/Users/kurokawamutsuo/開発フォルダ/997_開発ナレッジ/04_PORT_MANAGEMENT.md` (ポート台帳) を読み込み、そこに割り当てられているポート範囲のみを使用すること。

---

## 2. タスク管理 (TODO)

- [x] **🚨 Vercel本番環境でのGoogle Maps背景タイルグレーアウト問題の解決** (優先度: 高) — 2026-07-20 ユーザー確認により解決済み
  - 現象: `https://poster-map-app.vercel.app/` で背景タイルがグレーアウトし、CORSエラー/`net::ERR_BLOCKED_BY_ORB` が発生する。
  - 切り分け: ローカル環境 (`localhost:3062`) では正常表示。APIキーのリファラー制限や、課金ステータスが原因と推測される。
  - 対応: GCP Console側のAPIキー制限設定（詳細はClaude Codeの調査ログ参照）の見直しにより解消。ユーザーより本番環境での解決を確認済み。
- [ ] **その他新規機能・改善タスク** (ユーザーからの指示待ち)

---

## 3. 編集・検討履歴

### 2026-07-20 (Antigravity)
* **タスク**: プロジェクト初期読み込みおよび共同開発プロトコルの確立、ローカル起動
* **内容**:
  * [AGENT_HANDOVER.md](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/AGENT_HANDOVER.md) と [src/data/appSpecification.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/data/appSpecification.ts) を元に、システムの仕様と現状を把握。
  * Claude Codeとの共同開発用の共通ログファイル [SHARED_DEV_LOG.md](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/SHARED_DEV_LOG.md) を新規作成。
  * プロジェクト全体の仕様と開発者向けルールを記した [CLAUDE.md](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/CLAUDE.md) を作成完了。
  * `npm run dev` により、ローカル開発サーバー（[http://localhost:3062/](http://localhost:3062/)）を起動。

### 2026-07-20 (Claude Code)
* **タスク**: 🚨 Vercel本番環境でのGoogle Mapsタイルグレーアウト問題の原因調査（GCP APIキー制限の観点）
* **内容**:
  * [src/components/Map.tsx:8](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx#L8) を確認したところ、`VITE_GOOGLE_MAPS_API_KEY` が未設定の場合にハードコードされたフォールバックキー（`AIzaSyDFVt8w4WjvR7U5xJRCA7-_2FY40hIlWdk`）に静かに差し替わる実装になっていることを発見。Vercel Production環境変数が実際に設定されているか、DevTools NetworkタブでリクエストURLの `key=` パラメータを見て確認する必要がある（ローカルと本番で異なるキーが使われている可能性を否定できていない）。
  * AGENT_HANDOVER.mdに記載の試行済みリファラーパターン `*poster-map-app.vercel.app/*` は、Googleのリファラー制限仕様（`*` はサブドメインワイルドカードとして直後に `.` が必要）に合致しておらず、正しくマッチしていない可能性が高いと判断。`https://poster-map-app.vercel.app/*` や `https://*.vercel.app/*` のような正規パターンへの修正を推奨。
  * マーカー/検索UIは表示されるがタイルのみグレーアウトする切り分けから、Maps JavaScript API自体の初期化（キー認証）は通っており、タイルリクエスト単位でのリファラー拒否または課金ステータスの問題である可能性が高いと分析。GCP Console → Google Maps Platform → 指標（Metrics）で `RefererNotAllowedMapError` / `BillingNotEnabledMapError` の有無を確認するのが最も確実な切り分け方法として提案。
  * ユーザーへ、GCP側の具体的な確認・設定手順（キー特定、HTTPリファラー登録形式、API制限、課金アカウントのリンク状況、反映確認）を提示。実際のGCP側設定変更はユーザー側での対応待ち（Claude CodeからはGoogle Cloud Consoleへのアクセス権限なし）。
* **次のステップ**: ユーザーがGCP Console側で上記設定を確認・修正後、本番環境で再テストし、結果をこのログに追記する。

### 2026-07-20 (Claude Code) その2
* **タスク**: 現在地ボタンを設定メニューから独立させ、常時表示化
* **内容**:
  * これまで [App.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/App.tsx) の歯車（設定）展開メニュー内にあった「現在地へ移動」ボタンを削除。
  * 代わりに [src/components/Map.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx) 内の「北を上にする」コンパスボタン（画面右側中央、`w-10 h-10`）と同じコンテナ（`flex flex-col`）にまとめ、コンパスボタンの直下にサイズを揃えて常時表示するボタンとして追加。
  * `MapComponentProps` に `onLocateMe?: () => void` を追加し、`App.tsx` 側の既存 `locateMe()` 関数（Geolocation取得＋地図中心移動）をそのまま `MapWrapper` に渡す形で再利用（ロジック変更なし、配置のみ変更）。
  * `npx tsc -b` で型チェックOK、`npm run lint` で新規エラーなし（既存の `no-explicit-any` 等の警告は本変更と無関係の既存分のみ）を確認済み。
  * ポート3062が使用中（Antigravity側のセッションと推測）のため `npm run dev` の再起動はせず、Vite HMRでの反映を想定。実ブラウザでの見た目確認はユーザー側またはAntigravity側での確認を推奨。
* **次のステップ**: 実機/ブラウザでコンパスボタン直下の現在地ボタンの見た目・タップ動作を確認。問題なければ完了。

### 2026-07-20 (Claude Code) その3
* **タスク**: ピンの緯度経度と住所情報の関係性を仕様変更（住所とピン位置を分離して扱う）
* **内容**: ユーザー要望に基づき、以下4パターンの挙動を整理・実装。
  1. **住所入力からの新規ピン作成**: 住所→緯度経度を自動判定（既存の [App.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/App.tsx) `handleSave` のロジックで元々対応済みと確認、ロジック維持）。
  2. **マップ任意位置への新規ピン作成**: タップ位置→緯度経度確定、位置から住所を逆ジオコーディング（既存の `handleMapClick` で元々対応済みと確認、変更なし）。
  3. **既存ピンの位置移動（長押し）**: 緯度経度のみ更新し、住所は変更しない（既存の `handleMapClick` の移動処理で元々対応済みと確認、変更なし）。
  4. **既存ピンの住所修正（新規実装）**: [PinBottomSheet.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/PinBottomSheet.tsx) の所在地欄の下に「緯度経度も修正する」チェックボックス（デフォルトOFF、既存ピン編集時のみ表示）を追加。OFF時は住所のみ更新し座標は変更しない。ON時は保存時に修正後の住所を再ジオコーディングして座標を更新し、`App.tsx` の `finishSave` から地図を新しい位置へパン（`setMapCenter`）+ 該当マーカーに `justDroppedPinId` を介してドロップインアニメーション（[src/index.css](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/index.css) の `pin-drop-animate` / `@keyframes pin-drop-bounce`、[src/components/Map.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx) のマーカー生成処理）を実行。ジオコーディング失敗時は座標を変更せずアラート表示。
  * `onSave` のシグネチャに `recalcLatLng?: boolean` を追加（`PinBottomSheet` → `App.tsx`）。
  * `npx tsc -b` 型チェックOK、`npm run lint` で新規エラーなし（既存の `no-explicit-any` 等の警告のみ）を確認済み。ポート3062使用中のため実サーバーでの目視確認は未実施（Vite HMRでの反映を想定）。
* **次のステップ**: 実機/ブラウザで「①住所からの新規登録」「②マップタップでの新規登録」「③長押し移動（住所が変わらないこと）」「④住所修正チェックボックスON/OFF時の挙動とドロップエフェクト」の4パターンを一通り動作確認する。

### 2026-07-20 (Claude Code) その4
* **タスク**: Firestoreデータ修正 — `type`が「高市早苗」のポスターの一括修正（ユーザー依頼、コード変更なし）
* **内容**:
  * ユーザーから提供されたログイン情報を用いて、Firestore `posters` コレクションを直接操作するワンタイムスクリプト（プロジェクト外のスクラッチパッドに作成、実行後は都度削除）で以下を実行。
  * 対象: `type` に「高市早苗」を含むポスター **65件**（事前にユーザーへ件数集計を報告済み）。
  * 変更内容: `type` を「佐藤まさし」に修正 / `tags` に「高市」を追加（既存タグは保持）。アプリの `usePosterData.ts` の `updatePoster` と同様に `updatedAt` / `updatedBy`（ログイン中のユーザー名）を更新し、`activityLogs` にも更新履歴（diff: `種類: 高市早苗→佐藤まさし / タグ追加: 高市`）を記録。
  * 安全対策として、変更前の対象65件のフルデータをスクラッチパッドにJSONバックアップとして保存済み（ロールバック用、リポジトリ外・Gitには含まれない）。
  * 実行後に再集計し、`type`「高市早苗」の残存が0件であること、`tags`に「高市」を持つポスターが70件（今回の65件 + 元々別ユーザーが個別に付与していた既存5件、いずれもtypeは元から「佐藤まさし」で整合性に問題なし）であることを検証済み。
  * ログイン情報はチャット上で受け取ったが、コードやリポジトリには一切保存していない（スクリプトは環境変数経由で受け渡し、使用後に削除）。
* **次のステップ**: 特になし（完了）。管理パネルの「変更履歴」タブから今回の一括更新ログ（65件分、`changedBy`=ユーザー名）を確認可能。

### 2026-07-20 (Claude Code) その5
* **タスク**: これまでのコード修正（現在地ボタン常時表示化 / ピン位置と住所の分離仕様）を本番環境へデプロイ
* **内容**:
  * `npm run build`（`tsc -b && vite build`）でビルドエラーがないことを確認済み。
  * `src/App.tsx`, `src/components/Map.tsx`, `src/components/PinBottomSheet.tsx`, `src/index.css` の変更、および新規作成した `CLAUDE.md` / `SHARED_DEV_LOG.md` をコミット（`9315ba9`）。
  * ユーザーの承認を得た上で `git push origin main` を実行し `origin/main` (`https://github.com/toratyann620/poster-map-satoumasashi.git`) に反映。
  * `npx vercel --prod` で本番デプロイを実行し、`https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_A8R5vikd3BzEbd43v5VpbohrDvPu`, readyState: `READY`）。
  * 注意: これは既知の「🚨 Vercel本番環境でのGoogle Maps背景タイルグレーアウト問題」（GCP APIキーのリファラー制限が原因と推測、上記「その1」参照）を解決するデプロイではない。その問題はGCP Console側の設定修正がまだ完了していないため、依然として残存している可能性が高い。
* **次のステップ**: 本番URL (`https://poster-map-app.vercel.app`) で「現在地ボタンの表示位置」「住所修正時の緯度経度チェックボックス挙動」を実機確認。GCPタイルグレーアウト問題は別途対応が必要。

### 2026-07-20 (Claude Code) その6
* **タスク**: 🚨 Vercel本番環境でのGoogle Maps背景タイルグレーアウト問題 — 解決確認
* **内容**: ユーザーより、本問題は既に解決済みであるとの報告を受けた。「2. タスク管理」のチェックを完了に更新。解決に至った具体的なGCP側の設定変更内容の詳細は本セッションでは共有されていないため、次回同種の問題が発生した場合は、以前の調査ログ（「その1」参照：APIキーのリファラー制限パターンの書式、Vercel Production環境変数の設定漏れ、課金ステータス等）を出発点に再調査すること。
* **次のステップ**: なし（解決済み）。

### 2026-07-20 (Claude Code) その7
* **タスク**: CSVインポート処理の仕様確認・修正（ID照合、項目別の部分上書き、確認ダイアログ、結果表示）
* **内容**: ユーザーからの仕様確認依頼を受け、[CsvActions.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/CsvActions.tsx) の `handleImport` を全面改修。
  * **不具合の発見・修正**: 従来はCSVの列が空欄でも `status`（デフォルト`['設置済']`）や `type`（デフォルト`'佐藤まさし'`）等に強制的にデフォルト値を補完しており、既存データの更新時に「CSVに存在しない項目」まで意図せず上書きしてしまう不具合があった。今回、更新行（idが既存データと一致する場合）についてはCSVに値がある項目のみを部分オブジェクトとして構築し、`usePosterData.ts` の `setPostersBulk` が内部で使う `batch.set(ref, p, {merge:true})` の部分マージ機能を活かして「値がない項目は上書きしない」仕様を実現。
  * **ID照合ロジック**: `id` が空欄→新規登録 / `id` が現在のFirestore `posters` コレクションに存在→更新（部分上書き） / `id` が存在しない→エラー（インポート対象外）、の3分類を実装。IDの存在確認は基本的に `posters` prop（リアルタイム同期データ）を使用し、空の場合は `handleExport` と同様に `getDocs` で直接取得するフォールバックを追加。
  * **確認ダイアログ**: CSVパース後、`react-dom` の `createPortal`（[NotificationPanel.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/NotificationPanel.tsx) と同じPortalパターン。FABメニューの親要素にTailwindのtransformクラスが付与されており、position:fixedの子要素が正しく最前面に表示されない問題を回避するため）で `document.body` 直下にモーダルを表示。新規/更新/エラーの件数と、エラー行のID・理由一覧を表示し、「実行する」「キャンセル」ボタンを配置。
  * **既存ピンの緯度経度**: 更新行では `lat`/`lng` が両方ともCSVに有効な数値で入っている場合のみ座標を上書きし、住所のみ変更された場合は座標を変更しない（直近実装した「住所修正時は緯度経度も修正する」チェックボックスと同じ思想を踏襲）。新規行は従来通り、緯度経度が無ければ住所から自動ジオコーディング。
  * **実行結果の表示**: 「実行する」押下時に `setPosters`（`usePosterData.ts` の `setPostersBulk`）を呼び出し、成功時は新規/更新の件数、失敗時はエラー詳細（`e.message`等）をポップアップで表示。
  * `usePosterData.ts` の `setPostersBulk` を修正: (1) Firestoreのバッチ上限(500件)を超える大量インポートに備え400件ごとにチャンク分割してコミット、(2) 従来は内部で `alert` してエラーを握りつぶしていたが、呼び出し元（CsvActions）で詳細なエラー内容を表示できるよう、エラーを外側にそのまま伝播させる形に変更（この関数の呼び出し元は `CsvActions.tsx` のみのため影響範囲は限定的）。
  * `npx tsc -b` 型チェックOK、`npm run build` ビルド成功、`npm run lint` で新規エラーなし（既存の `no-explicit-any` パターンに準拠）を確認済み。ポート3062使用中のため実ブラウザでの動作確認は未実施。
* **次のステップ**: 実機で「①新規行のみのCSV」「②既存IDへの部分項目更新（一部列を空欄にして上書きされないこと）」「③存在しないIDを含むCSV（エラー表示・除外）」の3パターンを一通りインポートして確認する。

### 2026-07-20 (Claude Code) その8
* **タスク**: CSVインポート修正（コミット `2f3ad06`）を本番環境へデプロイ
* **内容**:
  * `npm run build` でビルド成功を再確認後、`SHARED_DEV_LOG.md` / `src/components/CsvActions.tsx` / `src/hooks/usePosterData.ts` をコミット（`2f3ad06`）。
  * `git push origin main` を実行し `origin/main` に反映。
  * `npx vercel --prod` で本番デプロイを実行し、`https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_9kZBRjqyZxqH4Yf2Sxx1hdvhMdtx`, readyState: `READY`）。
* **次のステップ**: 本番URLでCSVインポートの新規/更新/エラー確認ダイアログの実機動作確認。

### 2026-07-20 (Claude Code) その9
* **タスク**: CSVインポートの部分上書き判定を「値の空欄」ではなく「フィールド(列)の存在有無」に修正
* **内容**: ユーザーより「値が空欄かどうかではなく、CSVにそのフィールド(列)自体が存在するかどうかで上書き可否を判定すべき」との訂正を受け、[CsvActions.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/CsvActions.tsx) の更新行（id一致）のフィールド判定ロジックを修正。
  * `hasColumn(row, key)`（`Object.prototype.hasOwnProperty` でCSVヘッダーにその列が存在するかを判定）を追加。Papaparseの `header:true` では、列さえあれば値が空欄でもキー自体は各行オブジェクトに存在する挙動を利用。
  * `type` / `status` / `address` / `placement` / `owner` / `contact` / `memo` / `specialNote` / `imageUrl` の9項目について、列が無ければ既存値を維持、列があれば値が空欄でもその空欄で上書き（＝クリア）するよう変更。
  * 例外としてユーザーの承認を得た上で以下2点を維持:
    1. `quantity`（数値型）: 列があるが値が空欄の場合は `0` として上書き（数値型のため「空欄のまま」を保存できないため）。
    2. `lat`/`lng`（緯度経度）: 他項目と異なり「両方とも有効な数値が入力されている場合のみ」上書きする特別扱いを維持（ピンの位置が消えて地図に表示できなくなることを防ぐため）。
  * `type`/`status`の値パース関数を「新規行用（空欄はデフォルト値を補完: type→佐藤まさし、status→['設置済']）」と「更新行用（空欄はそのまま空欄・空配列として書き込む、デフォルト補完なし）」に分離（`parseTypeForNewRow` / `parseStatusForNewRow` / `parseTypeValueRaw` / `parseStatusValueRaw`）。
  * `npx tsc -b` 型チェックOK、`npm run build` ビルド成功、`npm run lint` で新規エラーなし（既存の `no-explicit-any` パターンに準拠）を確認済み。
* **次のステップ**: 本番デプロイ後、実機で「列自体が無い項目は上書きされない」「列はあるが空欄の項目はクリアされる」の両パターンを確認する。

### 2026-07-20 (Claude Code) その10
* **タスク**: CSVインポート列存在判定の修正（コミット `495f12e`）を本番環境へデプロイ
* **内容**:
  * `npm run build` でビルド成功を再確認後、`SHARED_DEV_LOG.md` / `src/components/CsvActions.tsx` をコミット（`495f12e`）。
  * `git push origin main` を実行し `origin/main` に反映。
  * `npx vercel --prod` で本番デプロイを実行し、`https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_9rWftjWdmYwip9hxTJ9nyC6RdBwq`, readyState: `READY`）。
* **次のステップ**: 本番URLでCSVインポートの「列が無い項目は維持」「列はあるが空欄の項目はクリア」の実機動作確認。

### 2026-07-20 (Claude Code) その11
* **タスク**: ピンの種類（`type`）一覧から「党員募集」を削除（ユーザー依頼、コード変更なし）
* **内容**:
  * ピンの種類一覧は `settings/pinTypes` というFirestoreドキュメントで管理されており（[usePinTypes.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/hooks/usePinTypes.ts)）、管理パネルの「ピンの種類管理」（[SettingsTab.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/SettingsTab.tsx)）から追加・削除できる。
  * 確認したところ `settings/pinTypes` ドキュメントはまだ一度も作成されておらず、アプリはコード内のデフォルト値（[src/types/index.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/types/index.ts) の `POSTER_PERSONS`／`PERSON_COLORS`、「党員募集」を含む12種類）にフォールバックしている状態だった。
  * ユーザー提供のログイン情報を用いて、管理パネルの削除機能（`removePinType`）と全く同じロジック（デフォルト一覧から対象を除いて `settings/pinTypes` を新規作成）をスクリプト（プロジェクト外のスクラッチパッド、実行後削除）で実行し、「党員募集」を除いた11種類で `settings/pinTypes` ドキュメントを新規作成。
  * 既存の `posters` コレクションで `type` が「党員募集」のデータは **0件** であることを確認済み（削除による既存データへの影響なし）。
  * コードの変更は無いため、デプロイは不要（Firestoreの設定データのみの変更、即時に全ユーザーへ反映済み）。
* **次のステップ**: なし（完了）。

### 2026-07-21 (Claude Code) その19
* **タスク**: 「新規／撤去／張替え解除／修理解除」の4指標を、通知画面・ダッシュボード・ユーザー分析・ユーザー管理・変更履歴の各画面にも表示する仕様見直し
* **内容**: ユーザーより「今後の重要指標になる」との方針を受け、Slack日次レポート（[functions/index.js](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/functions/index.js)）で使っている集計ロジックをアプリのクライアント側にも共通化して展開。
  * **共有ロジックの新規作成**: [src/lib/posterMetrics.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/lib/posterMetrics.ts) に `reconstructStatusRemovedEvents`（張替え予定／要修理フラグが外れたイベントをactivityLogsの全履歴から再構築）と `computePosterMetrics`（新規/撤去/張替え解除/修理解除の件数・住所別内訳を算出）を実装。Cloud Functionsのロジックと同一のアルゴリズム。
  * [src/hooks/useAllActivityLogs.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/hooks/useAllActivityLogs.ts) を新規作成し、activityLogs全件を時系列昇順でリアルタイム取得（再構築の精度確保のため、期間指定クエリではなく全件取得が必要）。既存の `useActivityLogs.ts` / `useDashboardData.ts` / `useDailyNotifications.ts` にも `statusAdded`/`statusRemoved`/`removedChangedTo` フィールドを追加。
  * **通知画面** ([NotificationPanel.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/NotificationPanel.tsx)): 表示中の日付（スワイプ/ボタンで切替可能）の4指標サマリーをログ一覧の上部に追加。App.tsxから`posters`をpropsとして渡すよう変更。
  * **ダッシュボード** ([DashboardTab.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/DashboardTab.tsx)): 選択中の期間（日付レンジピッカー）に対する4指標カードを新規セクションとして追加。カードにホバーすると住所別内訳をツールチップ表示。
  * **ユーザー分析** ([UserAnalyticsTab.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/UserAnalyticsTab.tsx)): ユーザーごとのアクティビティランキングに、4指標のバッジ（新規/撤去/張替え/修理の件数）を追加（`newPosters`は`createdBy`、他3指標は`changedBy`で人別に集計）。
  * **管理パネル/ユーザー管理** ([AdminPanel.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/AdminPanel.tsx)): ユーザー一覧テーブルに新規/撤去/張替え/修理の4列（全期間累計）を追加。
  * **管理パネル/変更履歴** (同ファイル): 全期間累計の4指標サマリーをヘッダー下に追加し、各ログ行に該当する場合（撤去/張替え解除/修理解除）のバッジを表示するようにした（該当ログIDの集合をあらかじめ算出してO(1)判定）。
  * 「撤去」は2026-07-20の記録開始以前は集計不可という制約は、ユーザー管理・ダッシュボードの注記として明記。
  * `npx tsc -b` 型チェックOK、`npm run build` ビルド成功、`npm run lint` で新規エラー・警告なし（既存の `no-explicit-any`・`Date.now`等の警告は本変更と無関係の既存分のみ）を確認済み。ポート3062使用中のため実ブラウザでの動作確認は未実施。
* **次のステップ**: 本番デプロイ後、各画面で4指標の表示・内訳・バッジが正しく機能しているか実機確認する。

### 2026-07-21 (Claude Code) その20
* **タスク**: 4指標の各画面展開（コミット `34a1ecf`）を本番環境へデプロイ
* **内容**:
  * `git push origin main` 実行後、`npx vercel --prod` で本番デプロイを実行し、`https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_YhhoPafbkTiKnc3QtHoKW4FPJjJD`, readyState: `READY`）。
* **次のステップ**: 本番URLで通知画面・ダッシュボード・ユーザー分析・ユーザー管理・変更履歴の各画面を実機確認する。

### 2026-07-20 (Claude Code) その12
* **タスク**: Slack Webhookによる日次報告（毎日18時、集計範囲: 前日18時〜当日18時）の新規実装
* **内容**:
  * **データモデル拡張**: [usePosterData.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/hooks/usePosterData.ts) の `updatePoster` を修正し、更新のたびに変更前後のステータス配列を比較して「新たに付いたフラグ」「新たに外れたフラグ」（`statusAdded`/`statusRemoved`）と、撤去フラグが変化した場合の変化後の値（`removedChangedTo`）を `activityLogs` に構造化して記録するよう拡張（[types/index.ts](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/types/index.ts) の `ActivityLog` 型にも同フィールドを追加）。従来の `diff` 文字列だけでは「ステータスが何から何に変わったか」「撤去フラグが変化したか」を判別できず、日次集計に必要な情報が失われていたための対応。
  * **Cloud Functions新規導入**: `functions/` ディレクトリを新規作成し、`dailyPosterReport` という2nd Gen Cloud Function（Node.js 20, リージョン `asia-northeast1`）を実装。Cloud Scheduler（`0 18 * * *`, タイムゾーン `Asia/Tokyo`）で毎日18時に自動実行され、直近24時間（前日18時〜当日18時）の `posters`/`activityLogs` を集計してSlack Webhookへ投稿する。
    * 新規: `createdAt` が範囲内のポスター件数
    * 撤去: `activityLogs.removedChangedTo === true` の件数
    * 張替え解除・修理解除: `activityLogs.statusRemoved` にそれぞれ「張替え予定」「要修理」を含む件数
    * 住所は「都道府県」と「丁目・番地以降」を正規表現で除去し、市区町村＋町名レベルまで短縮（例: 神奈川県厚木市妻田南1-22-47 → 厚木市妻田南）
    * 設置率は既存の [DashboardTab.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/DashboardTab.tsx) の算出方法（佐藤まさし、市区町村別、設置済枚数／全体枚数）をそのまま踏襲し、厚木市・伊勢原市・海老名市の内訳を表示。
  * **基盤整備**: `firebase.json` / `.firebaserc` を新規作成し、プロジェクト `satoumasashi-poster-map` と紐付け。Firebase CLI（`firebase-tools`）が未ログインだったため、ユーザーにブラウザでの対話的ログインを依頼して完了。Slack Webhook URLはソースコードに含めず、Firebase Secret Manager（`functions:secrets:set SLACK_WEBHOOK_URL`）に安全に登録。
  * **デプロイ時のトラブルシューティング**: 初回デプロイ時に `iam.serviceaccounts.actAs` 権限エラーが発生（新規プロジェクトでデフォルトのComputeサービスアカウントが作成された直後のIAM反映待ちが原因の典型的な一時エラー）。90秒待って再実行したところ成功。また、Artifact Registryのコンテナイメージ自動削除ポリシーが未設定だった警告に対し、`firebase functions:artifacts:setpolicy --location asia-northeast1 --days 7 --force` で7日保持のクリーンアップポリシーを設定（不要なストレージ課金の蓄積を防止）。
  * **動作確認**: `gcloud scheduler jobs run` でCloud Schedulerジョブを手動トリガーしてテスト実行。Cloud Functionのログにエラー・警告が一切ないことを確認し、Slackへの送信成功を確認。ユーザーからも実際のSlackメッセージで「新規」件数が正しく表示されたことを確認済み。
  * **既知の制約（要フォローアップ）**: テスト実行の時点では、上記のデータモデル拡張（`usePosterData.ts` の変更）がまだVercel本番環境にデプロイされておらず、実際にアプリ上で行われた更新操作が旧コードでログされていたため、「撤去」「張替え」「修理」がいずれも0件と表示された。この日次レポート機能を実用に足るものにするには、`usePosterData.ts` / `types/index.ts` の変更を本番デプロイする必要がある（本セッションで続けて対応）。
* **次のステップ**: `usePosterData.ts` / `types/index.ts` の変更を本番Vercel環境へデプロイし、以降のポスター更新操作から正しく「撤去」「張替え解除」「修理解除」が集計されることを、翌日以降の実際の18時配信、または再度の手動テスト実行で確認する。

### 2026-07-20 (Claude Code) その13
* **タスク**: activityLogs拡張（コミット `1860f58`）を本番環境へデプロイ
* **内容**:
  * `npm run build` でビルド成功を確認後、`git push origin main` を実行し `origin/main` に反映。
  * `npx vercel --prod` で本番デプロイを実行し、`https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_AYsoLNZcoH9WQ3EGAK1SgKTFYrCG`, readyState: `READY`）。
  * これにより、本番デプロイ以降にアプリ上で行われたポスター更新（ステータス変更・撤去操作）から、`statusAdded`/`statusRemoved`/`removedChangedTo` が正しく `activityLogs` に記録されるようになった。
* **次のステップ**: デプロイ後に実際に「撤去」「張替え予定の解除」「要修理の解除」操作を行い、翌日18時の自動配信（または手動テスト実行）で件数が正しくカウントされることを確認する。

### 2026-07-20 (Claude Code) その14
* **タスク**: 日次Slackレポートの「張替え解除・修理解除」を過去ログから遡って再構築するロジックの追加、および集計結果の整合性検証
* **内容**:
  * **遡り集計ロジックの追加**: `activityLogs`には従来から各更新時点の `posterStatus`（更新後のステータス配列）が記録されていたことを踏まえ、[functions/index.js](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/functions/index.js) に `reconstructStatusRemovedEvents` を追加。ポスターごとに全履歴を時系列で並べ、直前ログの `posterStatus` と比較して「張替え予定」「要修理」フラグが外れた瞬間を検出する（`statusRemoved` フィールドが記録されている新しいログはそちらを優先、無い場合のみ再構築にフォールバック）。`activityLogs` は971件と少量のため全件取得しても問題ないことを確認済み。デプロイ・`gcloud scheduler jobs run` による手動テストで正常動作を確認。
  * **本日分（過去24時間）の実データによる整合性検証**: ユーザーからの「本日集計分と変更履歴を見比べると一致していないように見える」との指摘を受け、生ログを直接ダンプして手動照合を実施。
    * 「張替え解除」3件（厚木市三田南／厚木市下荻野／厚木市酒井）は再構築ロジックにより正しく検出されていることを確認。ユーザーが見た「0件」表示は、遡り集計ロジック追加前（1回目）のテスト送信だった可能性が高いと判断。
    * 「修理解除」「撤去」の0件は、生ログを精査した結果、本日実際に該当操作が行われていなかったための正しい結果と判明。
    * 副次的な発見として、CSVインポート機能（`setPostersBulk`）が `activityLogs` へ一切書き込みを行っておらず、管理パネルの「変更履歴」タブにCSVインポート分（本日25件）が表示されない仕様上のギャップを発見。ユーザーに報告したところ「問題ありません（対応不要）」との回答。
  * **「新規」件数の定義確認**: ユーザーより「新規設置＝新規でIDが発行された件数」と定義が明示され、現在の実装（`posters.createdAt` が集計期間内にある、現在存在するドキュメントをカウント）がその定義と一致していることを確認・合意。同一住所への複数登録（CSVインポートで3住所×計9件、同一type・同一quantityで1〜2秒以内に作成）についても、それぞれ別IDが発行されている以上、定義通り個別カウントで正しい旨を確認。
* **次のステップ**: 特になし（集計ロジックの整合性確認は完了）。翌日18時の本番配信で最終確認を推奨。

### 2026-07-21 (Claude Code) その15
* **タスク**: ユーザー依頼により、2026年7月19日18:00〜7月20日18:00（JST）の集計を再度Slackへ手動投稿
* **内容**:
  * デプロイ済みのCloud Function `dailyPosterReport` は常に「実行時点から過去24時間」で集計するため、既に日付が変わった状態（本日は2026-07-21）から指定の過去の固定期間をそのまま投稿することはできない。そのため、`functions/index.js` と全く同じ集計ロジックを持つワンタイムスクリプト（プロジェクト外のスクラッチパッド、実行後削除）を作成し、`rangeStart`/`rangeEnd` を明示的に指定（`2026-07-19T18:00:00+09:00` 〜 `2026-07-20T18:00:00+09:00`）して実行し、Slack Webhookへ実際に投稿した。
  * 結果: 新規30箇所／撤去0箇所／張替え3箇所／修理0箇所、設置率61%(厚木78%/伊勢原66%/海老名市38%) — ユーザーが当初提示したフォーマット例の数値（61%/78%/66%/38%）と完全に一致する結果となった。
* **次のステップ**: 特になし。今後、過去の任意期間を再投稿したい場合は同様のワンタイムスクリプトで対応可能（恒常的に必要であれば、Cloud Functionを日付パラメータ付きで手動実行できるHTTPトリガー等に拡張することも検討可）。

### 2026-07-21 (Claude Code) その16
* **タスク**: Slack Webhook URLを本番用に切り替え
* **内容**:
  * ユーザーより「本番用」のWebhook URL（Slack Incoming Webhook、値は非公開。Firebase Secret Managerに登録済み）が提供された。これまで使用していたURL（テスト用と思われる）とは別チャンネル宛。
  * まず、その1（2026-07-20）と同じ7/19 18:00〜7/20 18:00分のレポートを、ワンタイムスクリプトでこの新しいURLへ投稿（内容はその15と同一、正常に送信成功）。
  * 続けて、今後の毎日18時の自動配信もこちらの本番URL宛になるよう、`firebase functions:secrets:set SLACK_WEBHOOK_URL`でシークレットを新しい値（バージョン2）に更新し、`firebase deploy --only functions`で`dailyPosterReport`を再デプロイして新バージョンのシークレットを反映（デプロイ成功）。
  * 以前のテスト用Webhook URLは、Secret Managerの旧バージョン（バージョン1）としてのみ残存しており、現在の関数は参照していない。
* **次のステップ**: 明日以降の18時の自動配信が、本番Webhook URL宛に正しく送信されることを確認する。

### 2026-07-21 (Claude Code) その17
* **タスク**: 誤って実際のWebhook URLをコミットしてしまった件の是正、および前回未コミットだった`functions/index.js`の反映
* **内容**:
  * その16の作業中、`SHARED_DEV_LOG.md`に実際のSlack Webhook URLをそのまま記載してコミットしてしまい、GitHubのシークレットスキャン（Push Protection）によりpushがブロックされた。
  * 該当コミットは一度もリモートにpushされていなかったため、`git reset --soft`でpush前の状態（`origin/main`と同じ）まで戻し、URLを伏せ字にした上で1つのクリーンなコミット（`41d1d00`）として作成し直し、シークレットを含まない状態でpush成功。
  * あわせて、その14で実装・デプロイ済みだったが未コミットのままだった `functions/index.js` の張替え/修理解除の遡り集計ロジック（`reconstructStatusRemovedEvents`等）もこの機会にコミット。
  * 教訓: 今後、実際のWebhook URLやAPIキー等の機微情報は `SHARED_DEV_LOG.md` 等のコミット対象ファイルに直接書かず、「値は非公開」等の表現に留めること。
* **次のステップ**: なし（是正完了）。

### 2026-07-21 (Claude Code) その18
* **タスク**: 全項目0件の場合はSlack通知を送信しない仕様に変更
* **内容**:
  * ユーザー依頼により、[functions/index.js](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/functions/index.js) の `buildReport` が新規/撤去/張替え/修理の合計件数（`totalCount`）も返すように変更し、`dailyPosterReport` 側で `totalCount === 0` の場合はSlackへの投稿をスキップ（ログのみ出力）するよう修正。
  * `node -c index.js` で構文チェックOK、`firebase deploy --only functions` でデプロイ成功。
* **次のステップ**: なし（完了）。

（注: 「その19」「その20」はファイル中盤（本エントリより前）に記録されています。日付順の並びが一部前後していますが、内容はすべて残っています。）

### 2026-07-21 (Claude Code) その21
* **タスク**: 現在地取得を `watchPosition` 方式に変更（移動中に現在地が更新されない問題の修正）
* **内容**:
  * ユーザーより「移動中に現在地がなかなか更新されない」との報告を受け、[App.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/App.tsx) の現在地取得ロジックを調査。従来は起動時・現在地ボタン押下時の `getCurrentPosition`（一回きりのスナップショット取得）のみで、移動中に自動更新される仕組みが無いことが原因と判明。ユーザーに仕様を説明し、`watchPosition` 方式への変更を提案・承認を得た。
  * `App.tsx` の初回ロード用 `useEffect` を `navigator.geolocation.watchPosition` に置き換え、位置が変わるたびに `currentLocation`（青い現在地ドット）を継続的に更新するよう修正。地図の中心・ズーム（`mapCenter`）は「初回の位置取得時」と「現在地ボタン押下時（`locateMe`、変更なし）」のみ更新する設計とし、移動のたびに地図が強制的に再センタリング／ズームリセットされる副作用を避けた。オプションは `{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }`。コンポーネントアンマウント時は `clearWatch` でクリーンアップ。
  * `npx tsc -b` 型チェックOK、`npm run build` ビルド成功。
  * コミット（`52f5967`）→ `git push` → `npx vercel --prod` で本番デプロイ完了（`https://poster-map-app.vercel.app`、Deployment ID: `dpl_D5CoQFSY6ou3XvDFCBwSyoy5MYHQ`, readyState: `READY`）。
* **次のステップ**: 実機（スマートフォン等、GPS付きデバイス）で実際に移動しながら現在地ドットがリアルタイムに追従するか確認する。バッテリー消費が体感で許容範囲か合わせて確認するとなお良い。

### 2026-07-21 (Claude Code) その22
* **タスク**: Slack日次報告（新規/撤去/張替え/修理）の集計対象を「佐藤まさし」のポスターのみに限定
* **内容**:
  * ユーザー依頼により、[functions/index.js](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/functions/index.js) の `buildReport` を修正。従来は「新規」「撤去」「張替え解除」「修理解除」の4指標が全ての `type` を対象としていた（設置率のみ既存仕様で「佐藤まさし」限定だった）のに対し、4指標すべてを `type === '佐藤まさし'` のポスターのみに絞り込むよう変更。
    * 「新規」: `posters` フィルタに `p.type === '佐藤まさし'` を追加。
    * 「撤去」「張替え解除」「修理解除」: 現在 `type` が「佐藤まさし」であるポスターIDの集合（`satoPosterIds`）を作成し、`activityLogs` 由来のイベントを `posterId` で絞り込み。`reconstructStatusRemovedEvents` が返すイベントオブジェクトに `posterId` を追加してフィルタ可能にした。
  * 過去3日間のデータで変更前後の件数を比較検証（新規: 2→1件「ごとう祐一」1件除外、張替え: 12→10件、撤去・修理は該当なしのため変化なし）し、意図通りに絞り込まれていることを確認。
  * `node -c index.js` で構文チェックOK、`firebase deploy --only functions` でデプロイ成功。
* **次のステップ**: なし（完了）。次回の18時配信、または手動テストで実際のSlack投稿内容を確認するとより確実。

### 2026-07-21 (Claude Code) その23
* **タスク**: ナビ機能（STEP1: 単一ピンへの経路案内）の実現可能性検討・要件定義・実装
* **内容**:
  * ユーザーから「ナビ機能」「巡回最適ルート提案（ピン指定/周辺指定）」の2段階構想について実現可能性の相談を受け、まず要件定義のみ（実装保留）で回答。Directions APIの利用可否・経由地点上限（約25地点）・音声案内やバックグラウンド動作の技術的制約等を整理して提示。
  * ユーザーより「STEP1（単一ピンへのナビ機能）から実装してほしい」との指示を受け、以下の方針をデフォルトとして実装（音声読み上げなし/テキスト案内のみ、ナビ中も移動手段切替可、手動ドラッグで自動追従を一時停止し「現在地に戻る」ボタンで再開）。
  * **GCP側の準備**: プロジェクト `satoumasashi-poster-map` で Directions API（`directions-backend.googleapis.com`）を有効化。既存のMaps APIキー（Firebase自動作成の "Browser key"）は「APIの制限」で使用可能なAPIをホワイトリスト化していたため、`gcloud services api-keys update` で `directions-backend.googleapis.com` を許可リストに追加（他の既存許可APIは維持）。実際にDirections APIを呼び出して`status: OK`になることを確認。
    * 補足: `gcloud services api-keys` 系コマンドは、ローカル環境のADC（Application Default Credentials）のquotaプロジェクトが別の無関係なプロジェクト（`ldp-member-app-kanagawa16`）に紐づいており、`--project`指定だけでは正しいプロジェクトに向かない挙動があった。ADC設定自体の変更は無関係な他プロジェクトに影響するリスクがあるため行わず、`--billing-project`フラグで明示的に迂回した。
  * **実装内容**:
    * [PinBottomSheet.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/PinBottomSheet.tsx): 閲覧モードの操作行に「ナビ開始」ボタンを追加（既存ピンかつ緯度経度がある場合のみ表示）。`onStartNavigation`プロパティ経由で親に通知。
    * [App.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/App.tsx): `navigationTarget`/`navigationMode`ステートを追加。ナビ中は地図タップ・他ピンのタップ・FABメニュー等の通常UIを無効化/非表示にする（既存の移動モードと同様のパターン）。
    * [Map.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx): `DirectionsService`/`DirectionsRenderer`（Maps JavaScript APIの標準機能、追加ライブラリ読み込み不要）を用いて経路探索・描画を実装。
      * 現在地（`watchPosition`で継続取得中の位置）を起点に、40m以上移動 かつ 前回計算から8秒以上経過した場合に自動で経路を再計算（Google純正の「コース逸脱時の自動リルート」相当。単純な距離・時間スロットリングによる簡易実装）。移動手段変更時・ナビ開始時は即座に再計算。
      * 案内バナーに次の案内文（HTMLタグを除去したテキスト）・次の分岐までの距離・残り距離/所要時間を表示。`language: 'ja', region: 'jp'`を指定し日本語で案内されるようにした。
      * 車/徒歩/自転車のモード切替アイコン、ナビ終了ボタン、目的地到着時（残り30m未満）の到着表示を実装。
      * ナビ中は現在地に地図を自動追従（`panTo`のみでズームは強制しない）。地図を手動ドラッグすると追従を一時停止し、「現在地に戻る」ボタンで再開できるようにした。
  * **動作確認**: `npx tsc -b`型チェックOK、`npm run build`ビルド成功、`npm run lint`で新規エラーなし。ローカルにPlaywright（`npm install --no-save`、`package.json`は変更していない）を導入し、`npm run dev`で起動した実際のアプリをヘッダレスChromiumで操作して検証。
    * 実際にログインし、地図上の実ピンをクリック→詳細シートに「ナビ開始」ボタンが表示されることを確認。
    * ボタン押下でDirections APIが呼ばれ、案内バナーに「北東に進む」「0.1 km先・残り0.4 km / 約2分」等、日本語で正しく表示されることを確認（初回テストでは英語表示だったため`language: 'ja'`を追加して修正）。
    * 徒歩モードへの切替で経路が再計算され、表示内容が更新される（残り距離・所要時間が車と異なる値になる）ことを確認。
    * 「ナビ終了」ボタンでナビUIが正しく閉じることを確認。
    * コンソールエラーは、ヘッドレスChromium特有のWebGL非対応によるVector Map→Rasterフォールバック警告（本番の実ブラウザでは発生しない、アプリのバグではない）以外に発生なし。
* **次のステップ**: STEP1はデプロイ前の実装完了・ローカル動作確認済みの状態。ユーザーの確認を経て本番デプロイを行う。STEP2（ピン指定モード／周辺指定モードの巡回最適ルート）は別途着手。

### 2026-08-09 (Claude Code) その24
* **タスク**: ポスター件数増加に伴うマップ描画のパフォーマンス改善（マーカー表示方式の見直し）
* **内容**:
  * ユーザーより「ポスター件数が多くなり動作が重い」との報告、および別システムの仕様（deck.gl + Postgresでズーム連動の集計/個別ピン切替、bboxクエリ等）を参考として共有された。
  * 原因調査: [Map.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx) の「Sync Markers」useEffectが、`posters`配列（Firestoreのリアルタイムリスナーにより1件でも更新があるたびに新しい配列参照が生成される）を依存配列に持ち、**変更内容に関わらず毎回全ピン（1000件超）のDOM要素を破棄→再生成**していたことが主因と判明。
  * 別システムの技術構成（deck.gl/Postgres/bboxクエリAPI）はこのアプリのFirebase/Vanilla Google Maps JS APIという構成とは大きく異なり、そのまま移植すると過剰な書き換えになるため採用せず、**同じ狙い（ズームレベルに応じた個別/集計表示切替、描画コスト削減）を、既存スタック内で実現する方針**を採用（ユーザーに説明の上で実施）。
  * **実装**:
    1. `@googlemaps/markerclusterer`（Google公式）を導入。
    2. マーカー同期ロジックを全破棄・全再生成方式から**差分更新方式**に書き換え。ポスターごとに `id -> {marker, signature}` を保持し、位置・種類・ステータス・撤去フラグ・住所・備考等が変化した場合のみDOM要素を作り直し、変化がなければ既存マーカーをそのまま維持するようにした。
    3. 通常のポスターマーカーは `MarkerClusterer` の管理下に置き、ズームアウト時は近接ピンを件数バッジ付きの集計マーカー（インディゴ色の円、件数に応じてサイズ可変）にまとめ、ズームインすると自動的に個別ピンに戻る仕様にした（クラスタタップ時のズームインは`MarkerClusterer`の標準動作をそのまま利用）。
    4. 移動中（長押しリロケート）のピンはクラスタに埋もれて見えなくならないよう、クラスタリング対象から除外し常に個別マーカーとして表示するようにした。
    5. 仮ピン（新規登録中・検索結果ピン）用のマーカー管理を、ポスターピン用の管理（`posterMarkersRef`）と分離し、専用の`markersRef`でのクリーンアップ処理を維持。
  * **動作確認**: Playwright（`npm install --no-save`、`package.json`には`@googlemaps/markerclusterer`のみ正式追加）でローカルアプリを実操作。
    * ズーム16（初期表示）でマーカー要素1036個 → ズーム11（広域）で**27個まで削減**（クラスタ化）→ ズーム17（詳細）で1412個（個別表示に復帰）と、狙い通りズーム連動で描画コストが大きく変動することを確認。
    * クラスタバブルのクリックでズームイン（標準動作）、個別ピンのクリックで詳細シートが正しく開くことを確認（クラスタリング導入によるリグレッションなし）。
    * コンソールエラーは、ヘッドレスChromium特有のVector Map→Rasterフォールバック警告以外に発生なし。
    * `npx tsc -b`型チェックOK、`npm run build`ビルド成功、`npm run lint`で新規エラーなし。
* **次のステップ**: ユーザーの確認を経て本番デプロイ。実際に体感速度が改善したか、実機（特に低スペック端末）でのフィードバックを次回確認する。

### 2026-08-09 (Claude Code) その25
* **タスク**: マーカー描画パフォーマンス改善（コミット `833248f`）を本番環境へデプロイ
* **内容**:
  * `npm run build` でビルド成功を確認後、`npx vercel --prod` を実行。
  * 初回試行時に `"Not authorized"` エラーが発生（Vercel CLIが `vercel@58.9.0` に自動更新されたタイミングと重なったが、`vercel whoami` ではログイン状態は正常だったため一時的な問題と判断）。再実行したところ成功。
  * `https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_HxKe3oMU7ZYFTogHBWbXgBgdj1Vo`, readyState: `READY`）。
  * これにより、STEP1ナビ機能・マーカークラスタリング/差分更新によるパフォーマンス改善の両方が本番環境で利用可能になった。
* **次のステップ**: 本番URLで「ナビ開始」ボタンの表示、および多数ピン表示時の体感速度改善を実機で確認する。

### 2026-08-14 (Claude Code) その26
* **タスク**: Slack日次報告で住所が「アパート名のみ」表示されていた件の原因調査（コード変更なし）
* **内容**:
  * ユーザーより、8月8日のSlack報告で「新規」内訳の1件が「市区町村＋町域」ではなく「ＲＥＥＶＥＳ」（アパート名）とだけ表示された、という指摘を受け調査。
  * 該当ポスター（id: `MNk1R7VtkoshM6DhkF3X`, 登録: 2026/8/8 10:36, 登録者: 望月海璃）のFirestore実データを確認したところ、`address`フィールドの値が最初から `"ＲＥＥＶＥＳ１"` のみで、都道府県・市区町村名が一切入力されていないことが判明。
  * `functions/index.js` の `shortenAddress` は「先頭の都道府県を除去」「最初の数字以降を除去」という仕様通りに動作しており、末尾の「１」のみを除去した結果「ＲＥＥＶＥＳ」が残ったもの。**関数のバグではなく、登録時点で住所欄に建物名しか入力されていなかったことが根本原因**と結論。
  * ユーザーへ対応案（①該当データの住所を修正、②市区町村名を含まない短縮結果はフォールバック表示にする安全策をコードに追加、③対応不要）を提示し、回答待ちの状態。
* **次のステップ**: ユーザーからの対応方針の回答待ち。

### 2026-08-14 (Claude Code) その27
* **タスク**: 完全に同一座標に重なったピンを、画面上で視認・個別タップ可能にする機能を追加
* **内容**:
  * ユーザーより、「同一座標に複数ピンが重なった場合に画面上で分かるようにし、タップで展開して個別にタップできるようにしたい」との依頼。実データを調査したところ、**同一座標グループが28件、最大9件のピンが完全に同一座標に重なっているケースが判明**（異なる住所が同じ座標にジオコーディングされたことが原因と推測、CLAUDE.md記載の住所自動判定機能に起因）。直近実装したマーカークラスタリング（画面上のピクセル距離ベース）は、同一座標のピンは常に距離0のため、ズームインしても永遠にクラスタのまま分離できないという課題も判明。
  * [Map.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx) のマーカー同期ロジックを拡張:
    * 緯度経度を小数点6桁（約10cm精度）で丸めたキーでポスターをグループ化し、2件以上重なるグループを「重なりグループ」として通常のクラスタリング対象から除外。
    * 重なりグループは通常時、代表ピン1つに赤い件数バッジ（例:「×9」）を重ねて表示し、重なっていることを視覚化。
    * タップすると、中心から円状に均等配置した個別ピンとして「パッと展開」するアニメーション（`pin-spread-pop`キーフレーム、[index.css](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/index.css)）付きで分散表示。展開半径は現在のズームレベルに応じて画面上で約42pxになるよう、Web Mercator近似式でメートル→緯度経度に変換して計算。
    * 展開中は中心に黒い「×」の閉じるボタンを表示し、タップで元の重なり表示に戻せる。ズーム操作をすると自動的に閉じる（`zoom_changed`イベントで検知）。
    * 展開された個別ピンは通常のピンと同じ長押し（移動）・タップ（詳細表示）が可能。
    * 既存の単一ポスター用の差分更新（`posterMarkersRef`）・クラスタリングロジックとは別に、重なりグループ専用の`overlapMarkersRef`で管理し、毎回作り直す方式（重なりグループはデータ全体からすれば少数のため、パフォーマンスへの影響は軽微と判断）。
  * **動作確認**: Playwright（`npm install --no-save`、`package.json`変更なし）で実データ（9件重複グループ）を用いて実機確認。
    * 最大ズーム（zoom 20）でも「×9」バッジ付き1ピンとして正しく表示されることを確認（クラスタリングだけでは解決しない課題が実際に再現・解消されたことを確認）。
    * タップで9件が中心の閉じるボタンを囲んで円状に展開されることを確認。
    * 閉じるボタンタップで正しく重なり表示に戻ることを確認。
    * 展開中の個別ピンをタップすると、通常の詳細シート（「修正」ボタン・種類バッジ等）が正しく開くことを確認（リグレッションなし）。
    * コンソールエラーは、ヘッドレスChromium特有のVector Map→Rasterフォールバック警告以外に発生なし。
    * `npx tsc -b`型チェックOK、`npm run build`ビルド成功、`npm run lint`で新規エラーなし。
* **次のステップ**: ユーザーの確認を経て本番デプロイ。その26（住所がアパート名のみになる問題）の対応方針とあわせて確認するとよい。

### 2026-08-14 (Claude Code) その28
* **タスク**: その26（ＲＥＥＶＥＳ住所問題）の解決確認、および重なりピン展開機能（コミット `d11a632`）の本番デプロイ
* **内容**:
  * その26の「ＲＥＥＶＥＳ」住所問題について、ユーザーが該当ポスターの住所データを手動で修正済みとのこと。コード対応は不要と判断し、対応完了で確定。
  * `npm run build` でビルド成功を確認後、`npx vercel --prod` を実行。
  * 1回目の試行で `"Not authorized"` エラー（Vercel CLIが `vercel@59.0.0` に自動更新されたタイミングと重なった。過去にも同様の事象があり、`vercel whoami` ではログイン状態は正常だったため一時的な問題と判断）。再実行したところ成功。
  * `https://poster-map-app.vercel.app` に反映完了（Deployment ID: `dpl_71boAUkbsBddWHTecr7wTdSFtV6S`, readyState: `READY`）。
  * これにより、重なりピンの視覚化・展開表示機能が本番環境で利用可能になった。
* **次のステップ**: 本番URLで、同一座標に重なったピン（バッジ表示・タップ展開・閉じるボタン）の実機動作を確認する。

### 2026-08-19 (Claude Code) その29
* **タスク**: ネイティブアプリ化（App Store / Google Play 配信）の要件定義、および Phase 0（セキュリティ修正）の実装
* **内容**:
  * **方針決定（ユーザー確認済み）**:
    * 配信形態: **限定配布**（iOS = TestFlight内部テスト / Android = Google Play内部テスト）。一般公開はしない。これによりApple 4.2「最低限の機能性」の審査、政治関連コンテンツの審査リスク、審査用デモアカウントの提出がいずれも不要になる。
    * 実現方式: **Capacitor**（WebView型）。既存のReact/Viteコードをほぼ100%流用し、iOS/Androidを1コードベースで賄う。React Native再実装は工数が見合わないため不採用。
    * 対象OS: iOS・Android両方。
    * グループの閲覧権限: **閲覧も自グループのみ**（最も厳格な設定）。
    * 宇田川事務所（udagawa）の対象種別は「長田県議」で確定（事務所名と担当議員名が異なるのは実態どおり）。
    * PC管理画面の利用者: **佐藤まさし事務所の管理者のみ**。
  * **Phase 0 実装（本セッションで完了、未コミット・未デプロイ）**:
    1. **自己登録の廃止** — [Login.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Login.tsx) から「新規アカウントを作成」ボタンと `createUserWithEmailAndPassword` を撤去。誰でもアカウントを作成でき、かつ `firestore.rules` の `posters` が `allow read, write: if request.auth != null` だったため、**第三者が自己登録すれば全ポスターデータを閲覧・改ざん・削除できる状態**だった。ストア配信により登録画面が公開されるため、配信形態を問わず必須の修正。副次効果としてAppleのアプリ内アカウント削除要件（5.1.1(v)）の対象外になる。
    2. **セキュリティルールの強化** — [firestore.rules](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/firestore.rules) に `isMember()`（`users/{uid}` ドキュメントの存在を要求）を新設し、`posters` の条件を「ログイン済み」から「承認済みメンバー」に変更。これにより、**`useUsers.removeUser` がFirestoreドキュメントのみ削除しAuthアカウントを残すため「削除したはずのユーザーが全データにアクセスし続けられる」既存の穴も同時に解消**する。
    3. 上記に伴い判明した既存不具合2件も修正:
       * `settings` コレクションにルールが無く既定の拒否になっていたため、`settings/pinTypes` の読み取りが失敗し `usePinTypes` が無言でコード内デフォルト値にフォールバックしていた。**その11（2026-07-20）で実施した「党員募集」の削除がアプリに反映されていなかった可能性が高い**（デプロイ後に要確認）。`settings` に read: メンバー / write: 管理者 のルールを追加。
       * `activityLogs` の閲覧が管理者限定だったが、通知画面・4指標の集計は全ユーザーの画面で使われているため、一般ユーザーでは権限エラーで空になっていた。承認済みメンバー全員が読めるよう変更。
    4. **ハードコードキーの除去** — [Map.tsx](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/Map.tsx) の Maps APIキー（10行目）と Map ID（旧317行目）の直書きフォールバックを削除し、環境変数のみから読むよう変更。未設定時は不足している変数名を画面に明示する。ネイティブアプリではバンドルが端末に配布され直書き値が抽出可能なうえ、差し替えに再配信が必要になるため。
    * `npx tsc -b` 型チェックOK、`npm run build` ビルド成功、`npm run lint` は変更前後とも 42 problems で新規エラーなし。
  * **設計方針（Phase 1以降、詳細は検討書アーティファクトに記載）**:
    * **環境分離**: 新しいFirebaseプロジェクトは作らず、**同一プロジェクト内に `posters_v2` / `activityLogs_v2` / `groups` を並走**させる。`users`・Storage・Authは共通のまま使うため、**写真の移行もパスワードの移行も不要**になり、最終移行は「ポスターと変更履歴のコピー＋`city` の一括判定」だけで済む。ルールはコレクション単位で独立するため、新環境のバグが現行 `posters` に影響しない。
    * **グループ制御**: 条件は `groups` コレクションにデータとして持たせ（事務所の追加が再デプロイ不要になる）、**Firestoreセキュリティルールで直接判定**する。`update` は変更前と変更後の両方を検査し、市区町村や種別を書き換えて管轄を越える操作を禁止する。
    * **`city` フィールドの新設が前提**: 現在の市区町村判定は `address.includes('厚木市')` という住所文字列の部分一致のみ（[DashboardTab.tsx:309](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/components/DashboardTab.tsx#L309)）で、権限境界には使えない（住所を書き換えれば越境できる／「ＲＥＥＶＥＳ」のように市区町村名を含まない住所が実在しどのグループからも触れなくなる）。ジオコーディング結果の `locality` から `city` を自動設定する方式に変更する。`city` が空または3市以外のポスターは佐藤まさし事務所のみが閲覧・編集可能とする。
    * **読み込み方式の全面変更**: 現在 `posters` は全件を無条件取得する1本のクエリ（[usePosterData.ts:105](file:///Users/kurokawamutsuo/開発フォルダ/058_【MA】ポスターアプリ(poster-map-satoumasashi)/src/hooks/usePosterData.ts#L105)）。閲覧をグループ単位に絞るとこのクエリはFirestoreに丸ごと拒否されるため、`where('city','in',...)` / `where('type','in',...)` を明示したクエリへ書き換え、複合インデックスを作成する必要がある。ダッシュボード・通知・4指標・ユーザー分析の集計もグループ単位に変わる。
    * **PC管理画面**: 既存コードベース内の `/admin` ルートとして遅延読み込みで構築（モバイルのバンドルには含めない）。Authアカウントの削除にはAdmin SDKが要るため、呼び出し可能なCloud Functionの新設が必要。
  * **デプロイ前に必要な確認（未実施）**: ルール強化により `users` ドキュメントを持たないAuthアカウントは即座に失権する。自己登録で入った正規スタッフがいる場合その人も締め出されるため、**Authアカウントと `users` ドキュメントを突き合わせる確認スクリプト**（読み取り専用）をスクラッチパッドに用意した。本番データの読み取りが自動承認の対象外だったため、実行はユーザー側で行う。
* **次のステップ**: (1) 確認スクリプトの実行と結果の判断、(2) Phase 0 のコミット・push・Vercel本番デプロイ、(3) デプロイ後に「党員募集」がピン種別一覧から消えるかの確認、(4) Phase 1（Capacitor疎通検証・本番環境に影響しないため並行着手可能）。

### 2026-08-20 (Claude Code) その30
* **タスク**: Phase 0（セキュリティ修正）の本番デプロイと、テストアカウントの整理
* **内容**:
  * **事前監査（読み取り専用）**: Authアカウントと `users` ドキュメントを突き合わせた結果、Auth 11件・`users` 7件で、`users` ドキュメントを持たない4件はすべてテストアカウント（`temp_aggregator_new@test.com` / `jetski_test_01@example.com` / `test_agent@example.com` / `guest@satoumasahi.com` ※最後の1件はドメインが `satoumasashi` ではなく `satoumasahi` の誤綴り、一度もログイン実績なし）であることを確認。正規スタッフ7名（全員 `@satoumasashi.com`、うち管理者3名）は全員 `users` ドキュメントを保持しており、**ルール強化による締め出しは発生しないことを確認**した上でデプロイに進んだ。
    * 補足: `identitytoolkit.googleapis.com` はquotaプロジェクトの指定を要求するが、ローカルADCのquotaプロジェクトが無関係な別プロジェクト（`ldp-member-app-kanagawa16`）に紐づいているため、その23と同様にADC設定自体は変更せず、`x-goog-user-project` ヘッダーで明示的に上書きして回避した。
  * **デプロイ**: コミット `170064f` → `git push origin main` → `firebase deploy --only firestore:rules`（ルールのコンパイル・リリース成功）→ `npx vercel --prod`（Deployment: `poster-map-k2h7klxkx-muogs-projects.vercel.app`, target: `production`）。
  * **本番動作確認**: Playwrightで `https://poster-map-app.vercel.app` を実際に開き、ログイン画面から「新規アカウントを作成」ボタンが消え、「アカウントは管理者が発行します」の案内文が表示されることを確認済み。
    * 未ログイン状態でコンソールに出る2件の権限エラー（`activityLogs` / `settings` の Missing or insufficient permissions）は、**認証前にフックがFirestoreを読もうとして正しく拒否されているもの**で、ルールが意図どおり機能している証拠。リグレッションではない。ただしログイン前にデータ取得フックが走る構造自体は改善余地があり、後日の整理候補として記録する。
  * **テストアカウント4件の削除**: ユーザー承認のもと、対象メールアドレスの許可リストと「`users` ドキュメントを持たないこと」の二重の安全装置を入れたスクリプトで削除を実行。4件すべて削除成功し、**Authアカウント11→7件、`users` ドキュメントを持たないアカウントは0件**になった。
  * **「党員募集」問題の決着**: `settings/pinTypes` ドキュメントの実データを直接確認したところ、**11件（党員募集を含まない）で正しく保存されていた**。つまりその11（2026-07-20）の削除作業自体は成功していたが、`settings` にセキュリティルールが無く既定の拒否になっていたため読み取りが失敗し、`usePinTypes` が無言でコード内デフォルト（党員募集を含む12件）にフォールバックしていた。**今回の `settings` ルール追加により、意図した11件が正しくアプリに反映される**ようになった。
* **次のステップ**: Phase 1（Capacitor疎通検証）。iOS/Androidプロジェクトを生成し、WebView内でMaps / Geocoding / Places / Directions / Storage / Auth が疎通するかを実機確認する。とくに `capacitor.config.ts` の `server.hostname` を既存ドメインに合わせることでAPIキーのリファラー制限・StorageのCORS・Authの承認済みドメインをまとめて通す方式が成立するかが最大の未知数。本番環境には影響しない作業。
