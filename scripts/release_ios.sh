#!/usr/bin/env bash
#
# iOS のリリースビルドを作り、App Store Connect（TestFlight）へアップロードする。
#
#   ./scripts/release_ios.sh
#
# 前提:
#   - Xcode に Apple Developer アカウントがサインイン済み
#   - ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 が配置済み
#   - ios/appstore.env に KEY_ID と ISSUER_ID が記載済み（.gitignore 済み）
#
# ビルド番号（CURRENT_PROJECT_VERSION）は同じ値で2回アップロードできない。
# 2回目以降は Xcode プロジェクトの値を上げること。
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if [ ! -f ios/appstore.env ]; then
  echo "ios/appstore.env がありません。KEY_ID と ISSUER_ID を記載してください。" >&2
  exit 1
fi
# shellcheck disable=SC1091
source ios/appstore.env

VERSION=$(grep -m1 "MARKETING_VERSION" ios/App/App.xcodeproj/project.pbxproj | sed 's/.*= \(.*\);/\1/')
BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj | sed 's/.*= \(.*\);/\1/')
OUT="build/upload/postermap-${VERSION}-build${BUILD}.ipa"

echo "── Web アセットをビルド ──"
npm run build

echo "── ネイティブへ同期 ──"
npx cap sync ios

echo "── アーカイブ ──"
rm -rf build/App.xcarchive
xcodebuild -scheme App -configuration Release -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -project ios/App/App.xcodeproj \
  -archivePath "$ROOT/build/App.xcarchive" \
  archive -allowProvisioningUpdates

echo "── IPA を書き出し ──"
rm -rf build/ipa
xcodebuild -exportArchive \
  -archivePath "$ROOT/build/App.xcarchive" \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath "$ROOT/build/ipa" \
  -allowProvisioningUpdates

mkdir -p build/upload
cp build/ipa/App.ipa "$OUT"
echo "  生成: $OUT"

echo "── 検証 ──"
xcrun altool --validate-app -f "$OUT" -t ios \
  --apiKey "$APPSTORE_KEY_ID" --apiIssuer "$APPSTORE_ISSUER_ID"

echo "── アップロード ──"
xcrun altool --upload-app -f "$OUT" -t ios \
  --apiKey "$APPSTORE_KEY_ID" --apiIssuer "$APPSTORE_ISSUER_ID"

echo
echo "✅ 完了。App Store Connect の TestFlight タブで処理状況を確認してください。"
echo "   処理には数分〜十数分かかります。"
