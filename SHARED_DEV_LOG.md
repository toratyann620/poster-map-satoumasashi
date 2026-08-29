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

### 2026-08-20 (Claude Code) その31
* **タスク**: Phase 1（Capacitor疎通検証）完了、Phase 2（グループ基盤）の実装
* **ユーザー確定事項**: 配信は限定配布（TestFlight内部テスト / Play内部テスト）、閲覧権限は自グループのみ（最厳格）、宇田川事務所の対象種別は「長田県議」で確定、PC管理画面は佐藤まさし事務所の管理者のみ。
* **内容**:
  * **Phase 1: Capacitor 8.5 導入と実機検証（完了・コミット `fb01b7e`）**
    * `capacitor.config.ts` の `server.hostname` を本番ドメインに合わせる方式を実装し、実機で検証。
      * **Android**: 狙いどおり `origin = https://poster-map-app.vercel.app` になることを確認（画面上の診断表示と、logcat の `Capacitor: Handling local request: https://poster-map-app.vercel.app/vite.svg` の両方で確認）。本番Webと完全に同一オリジンとなるため、リファラー制限・CORS・承認済みドメインが既存設定のまま通る。
      * **iOS**: `iosScheme: 'https'` は効かず `capacitor://poster-map-app.vercel.app` にフォールバックする。WKWebView が https を予約スキームとして扱い、カスタムスキームハンドラを登録できないため。**Capacitor側の仕様であり回避不可**。
    * **重大な発見①: Maps APIキーにリファラー制限が一切設定されていない。** `gcloud services api-keys describe` で確認したところ、制限は `apiTargets`（利用可能APIのホワイトリスト）のみ。そのため `capacitor://` オリジンでも地図が表示できてしまった。**キーは現在も本番Webのバンドルから容易に抽出でき、第三者が使用して課金を発生させられる状態**。ネイティブ配布でさらに露出が増えるため、リファラー制限の設定（またはネイティブ用に別キーを発行しバンドルID制限をかける）が別途必要。要ユーザー判断。
    * **重大な発見②: ネイティブでは `getAuth()` が使えない。** `getAuth()` が組み込むブラウザ用のpopup/redirectリゾルバがカスタムスキーム下で初期化に失敗し、**`onAuthStateChanged` が一度も発火せず、認証チェックのスピナーで永久に固まる**。iOSシミュレータで事象を再現・特定した（IndexedDBは正常に開けており、原因ではないことも確認済み）。`initializeAuth(app, { persistence: indexedDBLocalPersistence })` に変更して解決。`src/lib/firebase.ts` に `makeAuth()` ヘルパーを追加し、`useUsers` の二次App生成も統一。
    * **iOSシミュレータでの最終確認（iPhone 17）**: 自動ログイン後、地図タイル・ポスターピン・クラスタリング・重なりピンの「×2」バッジ・検索バー・絞り込みUI・コンパス・現在地ボタンがすべて正常表示され、Firestoreのリアルタイム取得も動作。Maps JS API v3.66.1a 読み込み成功、`tilesloaded` 発火、Geocoding OK、Directions OK（2.4km 8分）、Firebase Auth 到達性OKを個別に検証済み。
    * **Androidの検証範囲**: APKビルド成功（4.4MB、Capacitor 8 は Java 21 必須のため Android Studio 同梱JDKを使用）、オリジンとローカルアセット配信を確認。ただしエミュレータが `adb shell` すら応答しないほど非力（ANR多発、ソフトウェアGPU）で**機能全体の動作確認は未完了**。実機での確認が必要（Phase 6の内部テストで実施可能）。
    * 検証にあたり `qa.verification@satoumasashi.com`（role: admin）を作成。パスワードはリポジトリ外に保管。**検証完了後に削除予定**。自動ログイン用の一時パッチ（`src/main.tsx`）は検証後に元へ戻しており、コミットには含まれていない。
    * 参考: iOS のログに `Missing UsageDescription key for requested authorization` が出ており、位置情報の権限文言が未設定であることが実証された（Phase 5の対応項目）。
  * **Phase 2: グループ基盤（コミット `71a07d8`、コードのみ・データ投入は未実施）**
    * **環境分離の方式を確定**: 新しいFirebaseプロジェクトは作らず、同一プロジェクト内に `posters_v2` / `activityLogs_v2` / `groups` を並走させる（`src/lib/collections.ts`）。`users`・Storage・Auth は共通のままとすることで、**最終移行で写真の移行もパスワードの移行も不要**になる。ルールはコレクション単位で独立するため、v2のバグが現行 `posters` に影響しない。
    * **ブランチ分離**: Phase 2以降は `feature/groups-admin` ブランチで作業する。`main` は本番用として維持し、切替時（Phase 7）にマージする。
    * `PosterPin` に `city` を追加し、`src/lib/city.ts` でジオコーディング結果の `locality` から確定する方式を実装。住所文字列の部分一致（`address.includes('厚木市')`）は権限境界に使えないため（住所を書き換えれば越境でき、「ＲＥＥＶＥＳ」のように市区町村名を含まない住所はどのグループからも触れなくなる）。
    * セキュリティルールに `posters_v2` / `activityLogs_v2` の範囲判定を実装。**`update` は変更前と変更後の両方が権限範囲内であることを要求**し、`city`/`type` の書き換えによる越境を禁止する。
    * **権限昇格の穴を発見・対処**: `users` への書き込みが従来の `isAdmin()` のままだと、他事務所の管理者が自分の `groupId` を `admin` に書き換えて全データへ昇格できてしまう。`isSuperAdmin()`（role=admin かつ 所属グループが allowAll）に限定した。
    * `scripts/seed_groups.mjs` を作成（groups 4件の作成 ＋ 既存ユーザー全員への `groupId: 'admin'` 割り当て）。**実行は未了**（本番Firestoreへの書き込みが自動承認の対象外だったため）。
* **次のステップ**: (1) `scripts/seed_groups.mjs` の実行（ルールのデプロイより先に必須。未実行のままルールを反映すると superAdmin が0名になり本番管理者がユーザー管理を失う）、(2) ルールのデプロイと権限境界のテスト、(3) Phase 3（アプリのグループ対応：全データ読み込みのグループ単位への書き換え、複合インデックス作成、各集計画面の対応）、(4) Phase 4（PC管理画面）、(5) Phase 5（ネイティブ統合：位置情報・カメラの権限、セーフエリア、強制アップデート）。
* **未解決の判断事項**: Maps APIキーのリファラー制限（上記の重大な発見①）。現行Webと将来のネイティブアプリの両方に関わるため、方針の確認が必要。

### 2026-08-20 (Claude Code) その32
* **タスク**: Phase 2 完了（グループ基盤の投入・ルール適用・検証）、Maps APIキーの制限設計と適用、Phase 3（アプリのグループ対応）
* **内容**:
  * **Phase 2 完了**
    * `scripts/seed_groups.mjs` を実行し、`groups` 4件（admin/nanba/udagawa/watanabe）を作成、既存ユーザー8名全員に `groupId: 'admin'` を割り当て。superAdmin 相当4名・groupId未設定0名を確認してからルールを反映した（順序を誤ると本番管理者がユーザー管理を失うため）。
    * **`scripts/test_rules.mjs` を新設**し、Firestoreエミュレータ上で権限境界を検証（`npm run test:rules`、**40件すべて成功**）。他グループの閲覧・更新・削除の拒否、絞り込み無しクエリの拒否、city/type 書き換えによる越境の拒否、他事務所管理者による groupId 昇格の拒否、履歴の改ざん・削除の拒否、現行 posters の動作不変などを網羅。Capacitor 8 と同様、firebase-tools も JDK 21 が必要なため Android Studio 同梱JDKを指定している。
    * ルールとインデックスを本番へデプロイ。デプロイ後、Playwrightで本番Webに実際にログインし、マーカー504件・タイル描画・ピン種別の表示が正常であることを確認済み（本番への影響なし）。
    * 副次的に、`notificationReads` コレクションにもルールが無く既定の拒否になっていた（通知の既読管理が機能していなかった）ことが判明し、あわせて修正した。
  * **Maps APIキーの制限（ユーザー依頼により最適構成を提案・適用）**
    * **重要な検証結果**: iOSのWebViewオリジン `capacitor://poster-map-app.vercel.app` が、Googleのリファラー制限のパターンとして**実際に機能する**ことをシミュレータ実機で確認した。当初はiOS用に別キー＋クォータ上限で被害を限定する案を想定していたが、**1本のキーで Web・Android・iOS すべてを制限下に置ける**ことが分かったため、より単純な構成を採用した。
    * 制限が実際に効いていることを両方向で確認: 許可外オリジン（`http://localhost:9999`）からは `RefererNotAllowedMapError` で拒否され、許可済オリジンからは成功する。
    * **採用した構成**:
      * 新規キー `Poster Map - Maps (restricted)`: Maps/Geocoding/Places/Directions のみ許可。リファラー制限 `https://poster-map-app.vercel.app/*` / `capacitor://poster-map-app.vercel.app/*` / `http://localhost:3062/*` / `http://localhost:5173/*`。
      * 既存キーを `Firebase key (Firestore/Auth/Storage only)` に改名し、**Maps系4APIを許可リストから除去**。Firebaseの構成キーは公開前提であり、保護はセキュリティルールが担う。
    * Vercelの `VITE_GOOGLE_MAPS_API_KEY`（Production/Preview/Development）を新キーに差し替え、`main` から本番デプロイして地図が正常表示されることを確認済み。ローカルの `.env.local` も差し替え済み。
    * **未完了の確認事項**: 旧キーからの Geocoding REST 呼び出しは `REQUEST_DENIED`（API制限が効いている）になったが、**Maps JavaScript API 経路だけは30分経過後もまだ通ってしまう**。設定自体は正しく反映されているため Google 側の伝播遅延と判断。後日あらためて確認が必要。
  * **Phase 3: アプリのデータ層をグループ対応（コミット `046eb2e`）**
    * `src/hooks/useSession.ts` を新設し、認証・ユーザー情報・所属グループの解決を一元化。**グループが確定するまでクエリを投げない**構造にした。ポスター取得には自グループの条件が必須で、条件の無いクエリはFirestoreに丸ごと拒否されるため。従来は各フックが認証を待たずにクエリを投げており、起動直後の permission-denied（本番でも発生していた既存の不具合）の原因でもあった。
    * `usePosterData` / `useActivityLogs` / `useAllActivityLogs` / `useDashboardData` / `useDailyNotifications` を `posters_v2` / `activityLogs_v2` とグループ絞り込みに対応。
    * `src/lib/activityLogs.ts` を新設し、4つのフックに書き写されていた同一の変換処理を集約（lintの指摘件数も 42→38 に減少）。
    * `App.tsx` の3箇所のジオコーディングで `city` を確定させる。グループ未割当てのアカウント向けの説明画面も追加（ルール側で全拒否されるため、原因の分からない白画面を避ける）。
    * **`scripts/verify_group_isolation.mjs` を新設**し、本番Firestoreに対して各グループの検証用アカウントを作り、アプリと同じクエリを実行して隔離を実証（**18件すべて成功**、実行後にアカウントと検証データは自動削除）。難波事務所には投入した7件中2件（厚木市×佐藤まさし/難波県議）のみが見え、市区町村なしのポスターや対象外種別は一切見えないことを確認。
    * **この検証で複合インデックス不足（`failed-precondition`）が発覚した。** エミュレータのルールテストでは表面化しない種類の問題で、実データ検証を入れた意義が出た。`firestore.indexes.json` を定義してデプロイし、READY 後に再検証して解消を確認している。
* **次のステップ**: Phase 4（PC管理画面）、Phase 5（ネイティブ統合：位置情報・カメラの権限文言、セーフエリア、強制アップデート）、Phase 6（内部テスト配信）、Phase 7（データ移行・切替）。あわせて旧キーのMaps JS API制限の反映確認。

### 2026-08-24 (Claude Code) その33
* **タスク**: Phase 4（PC向け管理画面）の実装と検証
* **内容**:
  * **検証用データの投入**: `scripts/migrate_to_v2.mjs` を新設し、本番 `posters` 1,460件と `activityLogs` 1,438件を v2 コレクションへ複写。**本番コレクションからは読み取りのみで、書き込みは一切行っていない**。冪等（同一IDへのPATCH）なので、Phase 7 の切替時に同じスクリプトで差分を再同期できる。
    * `city` の付与結果: 厚木市607 / 海老名市475 / 伊勢原市374 / 綾瀬市2 / 判定不能2件（`シャトルＡＺＵＭＡ`・`コスモ` の建物名のみ住所。ＲＥＥＶＥＳと同種）。
    * 変更履歴のうち92件は city 不明、463件は種別未記録（`posterType` が導入される前の古いログ）。これらは佐藤まさし事務所からのみ閲覧可能になる。
  * **管理画面（コミット `92989cc`）**: `/admin` に新設。`React.lazy` による遅延読み込みで、**モバイルに配布されるバンドルには載らない**（AdminApp は 65KB の独立チャンク）。アクセスできるのは佐藤まさし事務所（allowAll）の管理者のみ。
    * 新規タブ: ポスター管理（一覧・横断検索・4種の絞り込み・列ソート・ページ送り・複数選択・一括編集・1件編集）／市区町村の手当て／ユーザー管理（グループ割当対応）／グループ管理（事務所の追加と条件編集）／変更履歴（全期間の4指標つき）。
    * 既存の `DashboardTab` / `UserAnalyticsTab` / `SettingsTab` / `CsvActions` は書き直さずそのまま再利用している。
    * ルータは追加していない。`main.tsx` でパスを見て分岐し、タブ状態は `location.hash` で保持する方式。`/admin` の直アクセスが404にならないよう `vercel.json` に SPA リライトを追加。
  * **付随する修正**:
    * `usePosterData` に `bulkUpdatePosters` を追加。CSVインポート用の `setPostersBulk` はバッチ書き込みで速い代わりに変更履歴を残さないため、一括編集では1件ずつ更新して履歴（`（一括編集）` 付き）を残し、進捗を通知する。
    * `CsvActions` に `city` 列を追加（テンプレート・エクスポート・インポート）。新規行はジオコーディング結果から `city` を取る。
    * モバイルの `AdminPanel` のユーザー作成に所属グループの選択を追加。未選択では作成できないようにした（グループ無しのユーザーはログインできてもデータが一切見えないため）。
    * **`usePinTypes` をセッション層に揃えた**。このフックだけ認証を待たずにクエリを投げており、拒否されると無言でコード内のデフォルト値へフォールバックしていた。これが「党員募集が消えていなかった」不具合の構造そのものだったため、認証確定後にのみ購読するよう変更。この修正により**アプリのコンソールエラーが0件になった**。
    * 実装中、render 内でコンポーネントを定義していた箇所を3件修正（再描画のたびに入力欄が再マウントされ、1文字打つごとにフォーカスが外れる不具合）。lint が検出した。
  * **検証（開発サーバー上、Playwright / スクリーンショット取得済み）**:
    * ポスター一覧: 全1,460件・撤去を除く1,399件を表示。「厚木市」検索で587件、列ソート・ページ送り（14ページ）・複数選択が動作。
    * **一括編集**: UIから2件にタグを付与 → Firestore側で実際にタグが付いていること、`activityLogs_v2` に「タグ追加: …（一括編集）」が記録されることを確認。タグ削除で復元し、検証データは残していない。
    * 市区町村の手当て: 移行レポートと同じ「未設定2件・対象3市以外2件」が表示され、該当住所（シャトル／コスモ／綾瀬市）も一致。
    * グループ管理: 担当件数が条件どおり（佐藤まさし1,460 / 難波445 / 宇田川445 / 渡辺349）。
    * **権限ガード**: 検証用アカウントのロールと所属を一時的に変更して確認。一般ユーザー→「管理者権限のアカウントのみ」、他事務所の管理者→「佐藤まさし事務所の管理者のみ」で拒否されることを確認し、確認後に元へ戻した。
    * 回帰確認: ルール境界テスト40件・グループ隔離テスト18件とも全通過。地図画面もマーカー509件・タイル描画・重なりバッジすべて正常で、コンソールエラー0件。
    * `npx tsc -b` / `npm run build` / `npm run lint`（38件でベースライン維持）。
* **次のステップ**: Phase 5（ネイティブ統合：位置情報・カメラの権限文言、セーフエリア、強制アップデート機構、アイコン・スプラッシュ）、Phase 6（内部テスト配信。**Apple / Google の資格情報が必要なため着手前に要確認**）、Phase 7（データ移行・切替）。あわせて旧FirebaseキーのMaps JS API制限がGoogle側で反映されたかの再確認。

### 2026-08-24 (Claude Code) その34
* **タスク**: Phase 5（ネイティブ統合）の実装と実機検証
* **内容**（コミット `02c33e3`）:
  * **権限**: `@capacitor/geolocation` / `@capacitor/camera` を導入し、`Info.plist` と `AndroidManifest.xml` に利用目的・権限を追加。
    * `src/lib/geolocation.ts` と `src/lib/photos.ts` で Web とネイティブの差を吸収した。ネイティブで `navigator.geolocation` を直接呼ぶとOSの権限要求の経路が無く、iOSでは利用目的が未設定だとアプリごと落ちる（その31で実機ログから確認済みだった事象）。
    * **バックグラウンド位置情報は意図的に要求していない**。常時許可は両ストアの審査が一段厳しくなる（Google Playは用途説明の動画提出を求める）一方、本アプリのナビは画面を開いている間だけ動けば足りるため。
    * 写真は `PhotoPicker` に集約し、ネイティブでは「撮影する」「写真から選ぶ」を出し分ける。現場でその場撮影する使い方が中心のため。
    * iOS の `UIRequiredDeviceCapabilities` が `armv7`（32bit端末向け）のままだったので `arm64` に修正した。
  * **セーフエリア**: `body` にパディングを当てていたため、**地図が下へずれて上部に白帯が出て、画面下も見切れていた**（実機で確認）。地図を全面に敷き、検索バーやボタン側でインセットを吸収する方式へ変更。あわせて、`PinBottomSheet` が使っていた `pb-safe` が**未定義で効いていなかった**ことも判明したため、ユーティリティを `index.css` に定義した。
  * **強制アップデート**: `src/hooks/useAppVersionGate.ts` と `settings/appVersion` による下限バージョン確認を追加。ネイティブは古い版が端末に残り続けるため、Firestoreのスキーマが育っている本アプリでは不整合（権限判定に必要なフィールドを欠いた書き込み等）を防ぐ仕組みが要る。**設定が無い／読めない場合は「制限なし」に倒している**（設定漏れでアプリが使えなくなる方が損害が大きいため）。`scripts/seed_app_version.mjs` で下限を設定できる。
  * **アイコン・スプラッシュ**: `assets/` にソース画像を追加し、`@capacitor/assets` で両OS分（Android 100点 / iOS 13点）を生成。アプリのアクセントカラー（indigo）と地図ピンのモチーフに合わせた。
  * **バージョン**: iOS `MARKETING_VERSION` と Android `versionName` を `1.0.0` に統一。
* **検証（iOSシミュレータ / iPhone 17、スクリーンショット取得済み）**:
  * 権限ダイアログが日本語の利用目的文つきで表示され、ログから `Missing UsageDescription key` が消えたことを確認。
  * 許可後、`simctl location` で設定した座標（厚木中央公園）に現在地の青いドットが表示されることを確認。ポスターも1,475枚分が正常表示。
  * 地図が全面表示になり、検索バーがダイナミックアイランドを避けて配置されることを確認（修正前は上部に白帯が出ていた）。
  * 下限を `2.0.0` に設定すると「現在のバージョン 1.0.0 ／ 必要なバージョン 2.0.0 以上」で利用が止まり、`1.0.0` に戻すと通常表示に戻ることを確認。
  * Android も APK ビルド成功（4.5MB → 9.6MB。プラグインとアイコン追加分）。
* **未検証**: カメラの実動作。シミュレータにカメラが無いため、実機での確認が必要（Phase 6の内部テストで実施可能）。Android の機能全体もエミュレータが非力で未完了のままで、実機確認が必要。
* **次のステップ**: Phase 6（内部テスト配信）。**Apple Developer / Google Play Console の資格情報と署名設定が必要なため、着手前にユーザーへ必要物を提示する**。その後 Phase 7（データ移行・切替）。

### 2026-08-25 (Claude Code) その35
* **タスク**: 更新案内の1週間再表示の追加と、Phase 6（内部テスト配信）の準備
* **内容**:
  * **更新案内の再表示（コミット `973efb4` / `9f7ebae`）**: 「あとで」を選んだまま放置されると古い版が残り続けるため、記憶を永久にせず**1週間で失効**させるようにした。記憶をバージョン文字列から `{ version, at }` に変更（旧形式も読める）。時間経過はUI操作では再現しづらいため、判定を `src/lib/updatePrompt.ts` の `shouldShowUpdatePrompt()` として純粋関数に切り出し、`npm run test:update-prompt`（7件）で検証している。現在時刻はモジュール読み込み時に一度だけ取得する（レンダーのたびに読むと結果が不安定になるうえ、判定は「起動時点で1週間たっていたか」で足りるため）。
  * **署名設定（コミット `12a0a71`）**:
    * 既存のプロビジョニングプロファイル（別アプリ `jp.kanagawa16.partymember` のもの）から **Apple Team ID `46346RA3CT`（Masashi Satou）** が判明したため、Xcodeプロジェクトに設定。`ios/ExportOptions.plist`（app-store-connect 方式・自動署名）も追加した。
    * 現状あるのは **Apple Development 証明書のみで、Distribution 証明書は未作成**。Xcodeの自動署名で作成できるが Admin 権限が要る。
    * Android は `keystore.properties` があれば署名し、無ければ未署名でビルドする方式にした（開発時に鍵が無くても困らないようにするため）。鍵と資格情報は `.gitignore` で除外し、作成手順は `android/keystore.properties.example` に記載。**鍵は未作成**。
    * **ビルド確認**: iOS の Release アーカイブ成功（未署名）、Android の `assembleRelease` / `bundleRelease` 成功（未署名、AAB 6.6MB）。
  * **⚠️ プライバシーポリシーの不足を発見**: ユーザーから提示された https://satoumasashi.com/privacypolicy/ を取得して内容を確認したところ、**ウェブサイト向けの記載のみで、位置情報・カメラ・アプリ・端末への言及が一切無い**。両ストアともプライバシーポリシーはアプリの収集内容を網羅している必要があり、申告内容と食い違うと差し戻しになる。同じページの末尾に追記する形の文案を `docs/store-submission.md` に用意した（URLが変わらないため、ストアには従来どおりのURLを登録できる）。
  * **申告内容の確定**: コードを実際に確認したうえで、Google Play のデータセーフティと Apple の App Privacy に入力する内容を整理した。
    * **重要な確認**: ユーザーの現在地は画面表示と経路探索にのみ使われ、**Firestore・Storage のいずれにも保存していない**（`src/App.tsx` の `currentLocation` はコンポーネントの状態としてのみ保持）。このため「位置情報は収集しない」と申告できる。経路探索でGoogleへ送信される点はプライバシーポリシーに記載する。
    * トラッキングは無し（広告・解析SDKは未導入。Firebase Analytics は `src/lib/firebase.ts` で明示的に無効化済み）。
    * 掲示場所の所有者の氏名・連絡先は**第三者の個人情報をスタッフが入力している**ため、取得時の同意の取り方について運用面の整理を推奨する旨も記載した（ストアの必須要件ではないが法務上の論点）。
* **ユーザー対応待ち**: (1) プライバシーポリシーへの追記、(2) App Store Connect でのアプリ作成（Bundle ID `com.satoumasashi.postermap`）、(3) Apple Distribution 証明書の作成、(4) Play Console でのアプリ作成、(5) Play App Signing の有効化とアップロード鍵の作成、(6) 内部テスターの登録（各最大100人）。
* **次のステップ**: 上記が揃い次第、アーカイブ作成とアップロード。その後 Phase 7（データ移行・切替）。

### 2026-08-25 (Claude Code) その36
* **タスク**: アプリ専用プライバシーポリシーの作成・公開
* **内容**（コミット `cee5e8c` / main へ `5abf3d7` として取り込み）:
  * **独自に作成した理由**: 既存の https://satoumasashi.com/privacypolicy/ を取得して確認したところ、ウェブサイト向けの内容のみで、位置情報・カメラ・アプリ・端末への言及が一切なかった。両ストアともプライバシーポリシーはアプリの収集内容を網羅している必要があり、申告内容と食い違うと差し戻しになるため、アプリ専用のものを新規に作成した。ウェブサイト側のポリシーは従来どおりでよく、本ポリシーの冒頭で「本アプリにのみ適用される」旨を明記している。
  * **保持方法**: `public/privacy.html` として**静的HTML**で持つ。Reactアプリに依存しないため、**ログイン不要で開け、アプリのJSが動かない状況でも表示できる**（ストア審査では未ログインでの閲覧が前提になる）。文面の変更はコードと同じ流れ（コミット→デプロイ）で反映でき、変更履歴もGitに残る。
  * **公開URL**: `https://poster-map-app.vercel.app/privacy`（`vercel.json` のリライトで `/privacy.html` を配信）。**本番へデプロイ済みで、未ログインでのHTTP 200を確認済み**。
  * ログイン画面の下部からリンクした。リンク先は実ファイル名（`/privacy.html`）にしている。ネイティブアプリではVercelのリライトが効かず、同梱されたファイルを直接開く必要があるため。
  * **記載内容は実装を確認して作成した**。とくに次は事実として書いている:
    * 利用者の位置情報はサーバーに保存しない（`src/App.tsx` の `currentLocation` はコンポーネントの状態としてのみ保持）
    * バックグラウンドでの位置情報取得は行わない
    * 広告配信・行動追跡は行わない（Firebase Analytics は無効化済み）
    * データの保管場所は日本国内（Firestore・Storage・Functions すべて `asia-northeast1` であることを実際に確認）
  * 掲示場所の所有者など**第三者の個人情報の扱い**と、その方からの開示・訂正・削除請求の窓口についても章を設けた。
  * ブランチ運用: プライバシーポリシーはグループ機能とは独立しているため、`main` へ cherry-pick して本番デプロイし、その後 `main` を作業ブランチへマージした（`vercel.json` が main に無く競合したため、将来のマージで再衝突しないよう同一内容で作成した）。
* **次のステップ**: ユーザー側での (1) App Store Connect でのアプリ作成、(2) Apple Distribution 証明書の作成、(3) Play Console でのアプリ作成、(4) Play App Signing の有効化とアップロード鍵の作成、(5) 内部テスターの登録。揃い次第アーカイブとアップロードを行う。

### 2026-08-25 (Claude Code) その37
* **タスク**: Bundle ID の変更と、Phase 6（内部テスト配信）の実行
* **内容**:
  * **Bundle ID を `app.satoumasashi.postermap` に変更（コミット `e6dfff9`）**: ユーザー指定。当初 GCP のプロジェクト名に合わせた `satoumasashi-poster-map` の要望があったが、**Androidのパッケージ名はJavaの識別子でありハイフンが使えない**ため不可能であること、Firebase との紐付けは Web SDK 経由なので Bundle ID と GCP プロジェクト名に技術的な関係が無いことを説明し、逆ドメイン形式で確定した。iOS・Android 両方（Javaパッケージのディレクトリ移動を含む）を変更し、**IPA の `CFBundleIdentifier` と AAB 内の AndroidManifest を展開して**新IDのみになっていることを確認した。
  * **Android の署名（コミット `8bc36b2`）**: アップロード鍵 `android/poster-map-upload.jks` を生成（alias: `poster-map`、2054年まで有効）。SHA-1 / SHA-256 の指紋を docs に記録。鍵と `keystore.properties` は `.gitignore` で除外しており、**このMacにしか存在しないためバックアップが必須**である旨をユーザーへ伝えた。Play App Signing は有効化済みとの回答を得ている。
  * **⚠️ 配布物からデバッグ用ファイルを削除（コミット `a062e09`）**: IPA の中身を検証していて、`public/map-test.html`（2026年7月のCORS調査で作った検証ページ）に**Firebaseキーと Map ID が直書きされたまま**残っており、本番Webで公開（HTTP 200）され、アプリのバンドルにも同梱されていることが判明した。該当キーは既にFirebase専用APIへ制限済みのため影響は限定的だが削除し、IPA と AAB を再生成して両方から消えたことを確認した。
  * **App Store Connect API キーの管理（コミット `a282d4a`）**: ユーザーがプロジェクト直下に置いた `AuthKey_767NSJKV27.p8` について、まず **Git に流出していないこと（未追跡・履歴にも無し）を確認**したうえで `~/.appstoreconnect/private_keys/` へ移動し、ディレクトリ700・ファイル600に設定。**ファイル名は変更していない**（Appleのツールは `AuthKey_<キーID>.p8` の形式で鍵を探すため、改名すると見つけられなくなる）。`.gitignore` に `*.p8` / `AuthKey_*` / `ios/appstore.env` を追加した。
  * **✅ iOS の初回アップロード完了（コミット `a395766`）**:
    * Xcodeへのアカウント登録が済んだ結果、自動署名で **Apple Distribution 証明書（Cloud Managed）とApp Store用プロファイルが生成**され、アーカイブ・IPA書き出しに成功。`codesign` と `embedded.mobileprovision` を検査し、`Apple Distribution: Masashi Satou (46346RA3CT)` による署名・App Store配布方式（端末限定でない）であることを確認した。
    * `altool --validate-app` で **VERIFY SUCCEEDED（エラーなし）**、`--upload-app` で **UPLOAD SUCCEEDED**。
    * App Store Connect API を直接叩いて確認したところ、**ビルド1の処理は完了（processingState: VALID）**。有効期限は 2026-11-23（TestFlightの90日制限）。
    * App Store Connect 上のアプリ名は「ポスター管理アプリ｜神奈川16区」（App ID `6804988572`）。
  * **リリース自動化**: `scripts/release_ios.sh`（ビルド→同期→アーカイブ→書き出し→検証→アップロードを1コマンド）と `scripts/release_android.sh`（署名済みAAB生成）を作成した。**ビルド番号は同じ値で2回アップロードできない**ため、2回目以降は `CURRENT_PROJECT_VERSION` / `versionCode` を上げる必要がある旨をスクリプト内とdocsに明記した。
* **残作業**: (1) Play Console への AAB アップロード（`build/upload/postermap-1.0.0-build1.aab`）、(2) 内部テスターの登録（iOS は App Store Connect のユーザーとして、Android はメールアドレス）、(3) 署名鍵のバックアップ、(4) 実機でのカメラ動作確認（シミュレータでは不可）。その後 Phase 7（データ移行・切替）。

### 2026-08-26 (Claude Code) その38
* **タスク**: Google Play へのアップロードをAPI経由で実行
* **内容**（コミット `a1e5f2e`）:
  * Play Developer API（`androidpublisher.googleapis.com`）を有効化し、アップロード専用のサービスアカウント `play-publisher@satoumasashi-poster-map.iam.gserviceaccount.com` を作成。鍵は `~/.playconsole/play-publisher.json` に600で配置し、リポジトリには含めない。
  * `scripts/upload_play.mjs`（`npm run upload:play`）を作成。編集セッション作成 → AABアップロード → 内部テストトラックへ割り当て → コミット を実行する。**途中で失敗した場合は編集セッションを破棄する**ため、Play側に中途半端な状態が残らない。
  * **権限付与でつまずいた点**: 最初の付与では403（PERMISSION_DENIED）が続いた。認証（トークン取得）は成功しており `UNAUTHENTICATED` ではなかったため、鍵やスクリプトではなくPlay Console側の権限が原因と切り分けられた。約8分の再試行でも変わらず、ユーザーが付与し直したところ通った。403時には「パッケージ名の一致」「招待が保留中でないか」「API利用規約への同意」を確認するよう案内する文言をスクリプトに組み込んである。
  * **✅ アップロード完了**: versionCode 1 を internal トラックへ反映。APIで状態を確認し、`internal / versionCode 1 / status: completed` およびリリースノートの登録を確認済み。
* **これで iOS・Android とも初回配信が完了した**（iOS はビルド1が TestFlight で VALID、Android は内部テストトラックで completed）。
* **残作業**: (1) 内部テスターの登録（iOS は App Store Connect のユーザーとして、Android はメールアドレス）、(2) 署名鍵のバックアップ（`android/poster-map-upload.jks` と `keystore.properties` はこのMacにしか無い）、(3) 実機でのカメラ動作確認。その後 Phase 7（データ移行・切替）。

### 2026-08-27 (Claude Code) その39
* **タスク**: グループIDのテストと、種類の選択肢・タグの絞り込み対応
* **内容**:
  * **テストアカウントの発行**: 難波事務所（`nanba`、一般ユーザー）として `test.nanba@satoumasashi.com` を作成。担当種別が2つある事務所を選び、種別による絞り込みも確認できるようにした。作成後に実際にログインして、445件（厚木市 × 佐藤まさし421 / 難波県議24）のみが見え、他市区町村・担当外種別・全件クエリ・ユーザー一覧がいずれも `permission-denied` になることを確認済み。
  * **タグは対応不要だった**: `allTags` は `posters`（グループ絞り込み済み）から生成しているため、既に担当範囲のタグのみが出る状態だった。実データで裏を取り、難波事務所には「井上武・高市」のみが見え、他事務所のタグ（れいわ新選組・参政党・金沢ゆい）は出ないことを確認した。
  * **種類の選択肢を担当範囲に絞った（コミット `d258e40`）**: 入力欄（ピンの編集フォーム・検索の絞り込み）に出す種類を、所属事務所が扱えるものだけに限定。担当外を選べてしまうと保存の瞬間にルール側で拒否され「入力したのに保存できない」状態になるため、入口で防ぐ。地図のマーカー色には全種別のリストを使う（色の対応表として参照するだけのため）。
  * **「その他」をどのグループでも扱えるようにした**: ユーザー要望。**UIだけで選べるようにするとルール側で拒否されるため、`firestore.rules` にも同じ例外を実装**した（`src/types/index.ts` の `ALWAYS_ALLOWED_TYPES` と対になる旨を双方にコメントで明記）。市区町村の条件は通常どおり効くため、担当エリア外の「その他」は見えない。
    * **副作用として可視件数が増える**: 難波事務所は 445件 → 453件（厚木市の「その他」8件が追加）。宇田川事務所も海老名市の「その他」2件が加わる。担当エリア内の掲示物を扱えるようにするという要望の趣旨に沿った変化と判断した。
  * **検証**: ルール境界テストを46件に拡充（「その他」の検証6件を追加）し全通過。加えて難波事務所のテストアカウントで本番Firestoreに対し、厚木市の「その他」は追加でき、海老名市の「その他」と厚木市の「ごとう祐一」は拒否されることを実地確認した。
  * 管理画面の確認用URL `https://postermap-admin.vercel.app`（Vercelのプレビュー保護あり）を最新の内容に更新した。
* **注意**: 配信済みのアプリ（TestFlight ビルド1 / Play versionCode 1）は**この変更を含まない**。アプリ上で確認するには再ビルドとアップロードが必要（ビルド番号の繰り上げが必須）。
* **次のステップ**: 追加の修正要望をまとめてから再ビルドするか、すぐ配信するかの判断。その後 Phase 7（データ移行・切替）。
### 2026-08-29 (Claude Code) その40
* **タスク**: ダッシュボードの集計条件の見直しと、集計値の読み取りづらさの是正（`main` ブランチ＝現行本番）
* **背景**: ユーザーから「8/15〜8/21 の集計で新規42件・貼替/修理/撤去118件と出たが、体感では1か月で16件程度の増加しかない」との指摘。実際に本番へログインして検証したところ、**表示していたのは既定の30日間（7/29〜8/28）であり、指定した1週間ではなかった**ことが判明した。数値自体の誤りではなく、期間の取り違えと単位・定義の分かりにくさが原因。
* **内容**:
  * **条件設定の変更**（コミット `7414894`）: 「ステータス」を外して「種類」を追加し、**期間・市区町村・種類・タグの4条件がすべての集計に効く**ようにした。「佐藤まさし」固定だったカードも選択中の種類に連動する。枚数・設置率・新規数からは**撤去済みを除外**し、その旨を各カードに明記。グラフは固定560px幅だったため期間が短いと右側が空いていたので、`ResizeObserver` で描画領域の実寸を測る方式に変更し、PC幅では2枚を横並びにした。
  * **読み取りづらさの是正**（コミット `087af76`）:
    * **集計期間**: 「30日間」のように日数を常時表示し、「直近7日」「直近30日」のプリセットを追加。今回の取り違えはこれで防げる。
    * **期間アクション**: 条件設定が効いておらず全件の履歴数を表示していた不具合を修正（`logs` → `scopedLogs`）。大きい数字は履歴の**件数**、内訳は**枚数**と単位が混在していたため「件」「枚」を明示し、`+ / ○ / −` を「追加」「更新」「削除」に改めた。「新規」と紛らわしいので、掲示箇所の数は下の作業成果を見る旨を添えた。
    * **期間内の作業成果**: 上のカードが「枚」なのに対しこちらは「箇所」なので明記。「張替え」「修理」は**予定フラグが外れた＝作業が完了した数**なので「張替え完了」「修理完了」に改称した。
    * **Slack日次レポート**（`functions/index.js`）: 見出しに集計対象（佐藤まさし）と単位（箇所）を明記。画面側は種類を絞り込めるようになったため、レポートの範囲が固定であることが分かるようにした。ラベルも画面と同じ「張替え完了」「修理完了」に統一。
  * **署名鍵の混入と是正**: `7414894` の前の版（`e659b76`）に、Androidのアップロード署名鍵 `android/poster-map-upload.jks`、`keystore.properties`、`ios/appstore.env`、ビルド成果物が混入していた。**原因は、これらの除外設定を `feature/groups-admin` の `.gitignore` にしか入れていなかったこと**。push前に発見し、コミットを作り直して除去、`main` の `.gitignore` を作業ブランチと同内容に更新した。復元した鍵が、Playへアップロード済みのAABの署名者とSHA-256が一致することを確認済み。再発時に更新不能になるため、`~/.playconsole/keys/` にリポジトリ外の控えを置いた（600）。
  * **単位の統一（コミット `c1602dd`）**: 上記の是正中に、`parseQuantityFromDiff` が拾う diff の「枚数: N枚」が**変更後の値ではなく、その時点の枚数の記録**であることを本番の変更履歴400件を読んで確認した。追加は42/42件、削除は17/17件が枚数を含むため合算できるが、**更新は72%（244/341件）にしか無く、無い場合は1として数えていた**。加えて同じピンを3回更新すれば3回足されるため、更新の枚数合算は意味を持たない。そこで日別アクション推移と期間アクションカードを**操作の件数に統一**し（大きい数字＝追加＋更新＋削除で突き合わせ可能になった）、各表示に単位を明記した（枚数カード＝枚 / 作業成果＝箇所 / 期間アクション＝件 / 日別アクション推移＝件 / 種類別ピン数推移＝枚 / 種類別サマリー＝枚）。種類別サマリーの純増減は追加・削除しか使っておらず枚数として正しいため据え置き、その前提をコメントに残した。
* **デプロイ**: Vercelは**GitHub連携ではなく手動デプロイの構成**（push だけでは反映されない）。`vercel deploy --prod` で本番反映し、公開中のバンドル `index-Dzxf8jZp.js` に新しい文言が入っていることを確認した。`functions:dailyPosterReport` はユーザー側で実行し、`Successful update operation` を確認済み。
* **検証**: `tsc` / `build` 通過、lint は 41→40 件。ビルド成果物に新しい文言が入ることを確認。種類の切り替えで枚数が連動することを本番で確認済み（すべて1,779枚 → 佐藤まさし1,401枚 → ＋ごとう祐一1,516枚。1,401は別途集計した1,477枚から撤去済み76枚を引いた値と一致）。
* **未完了 / 次のステップ**:
  1. **改修後の画面の目視確認が未実施**。検証アカウント `qa.verification@satoumasashi.com` は有効だが `.env.e2e.local` のパスワードが古く、再設定も自動承認の対象外だった。
  2. **Cloud Functions のランタイムが Node.js 20 のまま**。デプロイ時の警告で判明。`firebase-tools` のランタイム定義を確認したところ **2026-04-30に非推奨、2026-10-30に廃止**で、廃止後は関数をデプロイできなくなる。約2か月しか猶予がない。`functions/package.json` の `engines.node` を `"22"` にするだけで期限は2027-04-30（廃止は2028-10-31）まで延びる。導入済みの `firebase-functions@6.6.0` / `firebase-admin@12.x` はいずれも `node >=14` を要求するだけなので、**この変更にライブラリの更新は不要**。同時に出ていた「firebase-functions が古い」警告（6.6.0 → 7.3.2）は破壊的変更を伴うため別件として切り離すのが安全。
  3. 検証アカウントは全フェーズ完了後に削除する。

### 2026-08-29 (Claude Code) その41
* **タスク**: `docs/アプリ共通仕様.md` の内容を本アプリへ実装（`feature/groups-admin`）と、Cloud Functions のランタイム更新
* **前提**: 仕様書は Expo + NestJS + Next.js を前提に書かれているため、本アプリ（React + Vite + Capacitor + Firebase）向けに読み替えて実装した。仕様書自身が「守るべきルール集ではなく出発点」「実装が変わったら必ずここを書き換えること」と定めているため、読み替え表と実装して分かったことを仕様書の「0. 他の構成への読み替え」として追記済み。
* **実装状況の棚卸し**:

  | 仕様 | 状況 |
  | --- | --- |
  | 1. チュートリアル | **新規実装** |
  | 2.1 プッシュ通知 | **未実装**（下記） |
  | 2.2 アプリ内通知一覧 | **新規実装**（`announcements`） |
  | 2.3 ポップアップ通知 | **新規実装** |
  | 3. アップデート通知 | 実装済み（その35で対応。7日再表示・強制停止とも仕様どおり）|
  | 4.1 自動ログイン | 実装済み（Firebase Auth + `indexedDBLocalPersistence`）|
  | 4.2 パスワードマネージャー連携 | **新規実装** |
  | 4.3 初期パスワード生成 | **新規実装** |
  | 5. テスター連携 | 運用ルール。ルール5-7により対外連絡は発注者確認が必須のため、こちらからは連絡しない |

* **主な判断**:
  * **`SecureStore` → `localStorage`**: 仕様書が SecureStore を使うのは RN に localStorage が無いためで、機密だからではない。WebView 上では localStorage がそのまま使え、「その端末にだけ残る」性質も同じ。プライベートモード等で例外を投げるため `src/lib/deviceStore.ts` で try/catch を集約した。
  * **お知らせは既存の「デイリー通知」に相乗りさせず、メガホンのアイコンで分けた**。既存パネルは日付スワイプの処理が入り組んでおり、そこへ差し込むと壊しやすい。ポスターの変更（アプリ由来）と事務局からの連絡（人が書いたもの）は性質も違う。
  * **お知らせの本文はプレーンテキストとして描画**。改行を活かすためだけに HTML として描くと注入の余地を作るため、`white-space: pre-wrap` で見た目だけ再現している。
  * **`mustChangePassword` の解除にルールの例外を1つ追加**。`users` は佐藤まさし事務所の管理者しか書けない設計なので、そのままでは本人がフラグを下ろせない。`affectedKeys().hasOnly(['mustChangePassword'])` かつ「false にすることだけ」の2条件に絞ったため、`role` や `groupId` の書き換えには使えない。
  * **お知らせはグループで絞っていない**。事務所をまたいだ連絡ができなくなるため。代わりに管理画面に「特定の事務所にだけ関係する内容は本文に書くこと」と明記した。
* **検証**:
  * ルール境界テスト **46→56件、全通過**（お知らせ5件・`mustChangePassword` 5件を追加）。とくに「本人でも他フィールドを同時には変えられない」「この例外を使って groupId は書き換えられない」が拒否されることを確認。
  * 初期パスワードを2万件生成し、要件違反0件・重複0件。先頭が大文字になる割合は38%で理論値37.7%と一致し、Fisher-Yates が効いていることを確認。
  * 一時的なプレビュー画面を作り、チュートリアル／ポップアップ／お知らせ一覧／パスワード変更の4画面を実機幅（420px）で描画確認し、確認後に撤去。
  * ログイン画面の属性をブラウザ上で確認（`id=login-email` / `name=username` / `autocomplete=username` ほか）。
  * `tsc` / `build` 通過、lint 37→36件。
* **Cloud Functions のランタイム**: `engines.node` を 20 → 22 に更新（コミット `a0359f3`、`main`）。Node 20 は 2026-10-30 に廃止されデプロイ不能になるため。`firebase-functions@6.6.0` / `firebase-admin@12.x` はいずれも `node>=14` 要求のためライブラリ更新は不要。**デプロイは未実施**。
* **未完了 / 次のステップ**:
  1. **プッシュ通知（仕様2.1）が未実装**。`@capacitor/push-notifications` の導入に加え、**APNs 認証キーを Apple Developer で発行し Firebase に登録する作業**（ユーザー側でしかできない）と、`google-services.json` / `GoogleService-Info.plist` の配置、送信用の Cloud Function、管理画面の送信フォームが要る。ネイティブ設定の変更を伴うため再ビルド・再申請が必要で、クローズドテスト審査中のビルドに影響する。着手の可否を確認すること。
  2. **今回の変更はまだ配信されていない**。`feature/groups-admin` 上のコミット `209f302`。ユーザーに届けるには新しいビルドの作成と TestFlight / Play への提出が要る。
  3. **セキュリティルールのデプロイが未実施**。`announcements` と `users` の更新ルールを本番へ反映しないとお知らせ機能は動かない（`firebase deploy --only firestore:rules`）。
  4. Node 22 ランタイムのデプロイ（`npx firebase-tools deploy --only functions:dailyPosterReport --project satoumasashi-poster-map`）。
