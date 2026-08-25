# ストア申請の準備資料（内部テスト配信）

Phase 6 で App Store Connect / Google Play Console に入力・提出する内容をまとめたもの。
記載内容は実際のコードを確認して作成している（推測ではない）。

---

## 0. 確定している値

| 項目 | 値 |
|---|---|
| アプリ名（端末表示） | ポスターマップ |
| Bundle ID / パッケージ名 | `com.satoumasashi.postermap` |
| バージョン | 1.0.0（ビルド番号 1） |
| Apple Team ID | `46346RA3CT`（Masashi Satou） |
| 対応OS | iOS 15.0以上 / Android（Capacitor 8 の既定に準拠） |
| 配信形態 | TestFlight 内部テスト / Google Play 内部テスト（**一般公開はしない**） |
| プライバシーポリシー | `https://poster-map-app.vercel.app/privacy`（公開済み） |

### 署名の状態

- **iOS**: `DEVELOPMENT_TEAM = 46346RA3CT` を設定済み。`ios/ExportOptions.plist` も用意済み。
  現在あるのは **Apple Development** 証明書のみで、**Apple Distribution 証明書が未作成**。
  Xcode の自動署名で作成できるが、Apple Developer アカウントで
  Account Holder または Admin 権限が必要。
- **Android**: `android/app/build.gradle` に署名設定を追加済み。
  `android/keystore.properties` があればリリースビルドが署名され、無ければ未署名でビルドされる。
  **鍵（.jks）は未作成**。作成手順は `android/keystore.properties.example` に記載。

### ビルド確認済み

- iOS: Release アーカイブ成功（未署名）
- Android: `assembleRelease` 成功（未署名、7.6MB）

---

## 1. プライバシーポリシー（対応済み）

**登録するURL: `https://poster-map-app.vercel.app/privacy`**

アプリ専用のプライバシーポリシーを独自に作成し、本番環境に公開済み。
未ログインでアクセスできることを確認している（ストア審査では未ログインでの閲覧が前提）。

### なぜ独自に作成したか

既存の https://satoumasashi.com/privacypolicy/ を確認したところ、
ウェブサイト向けの内容のみで、位置情報・カメラ・アプリ・端末への言及が一切なかった。
両ストアともプライバシーポリシーはアプリの収集内容を網羅している必要があり、
ストアへの申告内容と食い違うと差し戻しの対象になる。

### どこで保持しているか

| 項目 | 内容 |
|---|---|
| 実体 | `public/privacy.html`（このリポジトリ内） |
| 公開URL | `https://poster-map-app.vercel.app/privacy` |
| 配信 | Vercel の本番デプロイに同梱。`vercel.json` で `/privacy` → `/privacy.html` にリライト |
| アプリ内 | ログイン画面下部からリンク。ネイティブでは同梱ファイル（`/privacy.html`）を直接開く |

**静的HTMLにしている理由**: Reactアプリに依存しないため、ログイン不要で開け、
アプリのJSが動かない状況でも表示できる。文面の変更はコードと同じ流れ
（コミット → デプロイ）で反映でき、変更履歴もGitに残る。

### 記載内容のうち、実装を確認して書いた事実

- 利用者の位置情報はサーバーに保存しない（画面表示と経路探索にのみ使用）
- バックグラウンドでの位置情報取得は行わない
- 広告配信・行動追跡（トラッキング）は行わない
- データの保管場所は日本国内（東京リージョン、`asia-northeast1`）

### 補足

ウェブサイト側のプライバシーポリシーは従来どおりで問題ない。
本ポリシーの冒頭で「本アプリにのみ適用される」旨を明記している。

## 2. Google Play — データセーフティの申告内容

Play Console →「アプリのコンテンツ」→「データセーフティ」に入力する。
コードを確認したうえでの回答は次のとおり。

### 全体

| 質問 | 回答 |
|---|---|
| データを収集・共有していますか | **はい** |
| 送信時に暗号化されますか | **はい**（すべて HTTPS） |
| データの削除をリクエストできますか | **はい**（事務所への連絡により対応） |

### 収集するデータの種類

| データ種別 | 収集 | 共有 | 必須 | 目的 |
|---|---|---|---|---|
| 名前 | ○ | × | 必須 | アプリの機能、アカウント管理 |
| メールアドレス | ○ | × | 必須 | アプリの機能、アカウント管理 |
| ユーザーID | ○ | × | 必須 | アプリの機能、アカウント管理 |
| 電話番号 | ○ | × | 任意 | アプリの機能（掲示場所の所有者の連絡先） |
| 住所 | ○ | × | 必須 | アプリの機能（掲示場所の所在地） |
| 正確な位置情報 | **×（収集しない）** | — | — | 端末上での表示と経路探索にのみ使用し、保存しない |
| 写真 | ○ | × | 任意 | アプリの機能（掲示状況の記録） |
| アプリのアクティビティ（その他） | ○ | × | 必須 | アプリの機能（変更履歴） |

**位置情報を「収集しない」と申告する根拠**: 現在地は画面表示と経路探索にのみ使用し、
Firestore・Storage のいずれにも保存していない（`src/App.tsx` の `currentLocation` は
コンポーネントの状態としてのみ保持される）。
経路探索のため Google へ送信される点は、プライバシーポリシーに記載する。

> ⚠️ この判断は「保存しないなら収集にあたらない」というGoogleの定義に基づく。
> 申告時にPlay Console上の説明文を読み、齟齬がないか確認すること。

---

## 3. Apple — App Privacy（プライバシー情報）の申告内容

App Store Connect →「App のプライバシー」に入力する。

| データ種別 | 収集 | 用途 | 個人と紐づくか | トラッキング |
|---|---|---|---|---|
| 名前 | ○ | App の機能 | 紐づく | いいえ |
| メールアドレス | ○ | App の機能 | 紐づく | いいえ |
| 電話番号 | ○ | App の機能 | 紐づく | いいえ |
| 住所（物理的な住所） | ○ | App の機能 | 紐づく | いいえ |
| 写真 | ○ | App の機能 | 紐づく | いいえ |
| ユーザーID | ○ | App の機能 | 紐づく | いいえ |
| 位置情報（正確な位置情報） | **×** | — | — | — |

トラッキングは行っていない（広告SDK・解析SDKは組み込んでいない。
Firebase Analytics は `src/lib/firebase.ts` で明示的に無効化済み）。

---

## 4. ストア掲載情報の下書き

内部テストでも最低限の掲載情報が必要になる。

**アプリ名**: ポスターマップ

**短い説明（Google Play・80文字以内）**:
```
ポスター掲示場所を地図で管理するスタッフ専用アプリ
```

**詳しい説明**:
```
本アプリは、ポスターの掲示場所を地図上で管理するためのスタッフ専用ツールです。
一般の方はご利用いただけません。

主な機能
・掲示場所を地図上で確認し、掲示状況を記録する
・現在地から掲示場所までの経路を案内する
・掲示状況を写真で記録する
・担当する市区町村・種別の範囲内で情報を共有する
・掲示枚数や設置率を集計して確認する

利用には、事務所から発行されたアカウントが必要です。
```

**カテゴリ**: ビジネス（Business）
**対象年齢**: 全年齢（Play の場合はコンテンツレーティング質問票に回答）

---

## 5. 残っている作業（担当の割り振り）

### ご対応いただくこと

1. **App Store Connect でアプリを新規作成** — Bundle ID `com.satoumasashi.postermap`
2. **Apple Distribution 証明書の作成** — Xcode の自動署名で作成可能（要 Admin 権限）
3. **Google Play Console でアプリを新規作成** — 同じパッケージ名
4. **Play App Signing の有効化と、アップロード鍵の作成**
   （鍵の作成コマンドは `android/keystore.properties.example` に記載）
5. **内部テスターの登録** — iOS は Apple ID、Android はメールアドレス（各最大100人）

### こちらで対応できること

- アーカイブ作成とアップロード用のコマンド整備
- スクリーンショットの取得（シミュレータから）
- データセーフティ／App Privacy の入力内容の確定（上記2・3の内容）
- 初回アップロード後の不具合対応

---

## 6. 参考: アーカイブとアップロードの手順

証明書と鍵が揃ったあとに実行するコマンド。

### iOS

```bash
npm run build
npx cap sync ios

xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Release -archivePath build/App.xcarchive archive

xcodebuild -exportArchive -archivePath build/App.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist -exportPath build/ipa

# App Store Connect へアップロード（要 App Store Connect API キー または Apple ID）
xcrun altool --upload-app -f build/ipa/App.ipa -t ios \
  --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
```

### Android

```bash
npm run build
npx cap sync android

cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew bundleRelease     # Play へは AAB を提出する

# 生成物: android/app/build/outputs/bundle/release/app-release.aab
# Play Console の「内部テスト」トラックへアップロードする
```
