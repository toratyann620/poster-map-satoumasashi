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
