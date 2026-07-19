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

- [ ] **🚨 Vercel本番環境でのGoogle Maps背景タイルグレーアウト問題の解決** (優先度: 高)
  - 現象: `https://poster-map-app.vercel.app/` で背景タイルがグレーアウトし、CORSエラー/`net::ERR_BLOCKED_BY_ORB` が発生する。
  - 切り分け: ローカル環境 (`localhost:3062`) では正常表示。APIキーのリファラー制限や、課金ステータスが原因と推測される。
  - 次のステップ: GCP管理画面側でのリファラー制限設定の確認・見直し。
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
