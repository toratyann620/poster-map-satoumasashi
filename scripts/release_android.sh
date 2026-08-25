#!/usr/bin/env bash
#
# Android のリリースビルド（署名済み AAB）を作る。
#
#   ./scripts/release_android.sh
#
# 生成物を Play Console の「内部テスト」トラックへアップロードする。
#
# 前提:
#   - android/keystore.properties と署名鍵（.jks）が配置済み
#
# versionCode は同じ値で2回アップロードできない。
# 2回目以降は android/app/build.gradle の値を上げること。
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f android/keystore.properties ]; then
  echo "android/keystore.properties がありません。署名鍵の設定が必要です。" >&2
  exit 1
fi

VERSION=$(grep -m1 'versionName' android/app/build.gradle | sed 's/.*"\(.*\)".*/\1/')
BUILD=$(grep -m1 'versionCode' android/app/build.gradle | sed 's/[^0-9]*\([0-9]*\).*/\1/')
OUT="build/upload/postermap-${VERSION}-build${BUILD}.aab"

echo "── Web アセットをビルド ──"
npm run build

echo "── ネイティブへ同期 ──"
npx cap sync android

echo "── AAB をビルド（署名込み）──"
( cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease )

mkdir -p build/upload
cp android/app/build/outputs/bundle/release/app-release.aab "$OUT"

echo
echo "✅ 完了: $OUT"
echo "   Play Console →「テスト」→「内部テスト」→「新しいリリースを作成」からアップロードしてください。"
