/**
 * TestFlight のビルドの処理状況を見る。
 *
 *   node scripts/check_testflight.mjs 19     # build 19 の状態
 *   node scripts/check_testflight.mjs        # 直近5件
 *
 * 配信の締めで「VALID になったか」を確かめるのに使う。VALID になるまでは
 * テスターに配信されないので、`settings/appVersion.latest` を上げるのは
 * これが VALID になってから（TestFlight に無い版への更新を促してしまうため）。
 *
 * ⚠️ 以前はこのスクリプトを一時フォルダに置いていたが、セッションをまたぐと
 * 消えていて毎回書き直していたため、リポジトリに入れた。
 *
 * 前提: ios/appstore.env（APPSTORE_KEY_ID / APPSTORE_ISSUER_ID）と
 *       ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ⚠️ new URL(import.meta.url).pathname は使わない。パーセントエンコードされた
// 文字列が返るため、日本語や括弧を含むこのリポジトリのパスでは解決できない
// （notify-release.mjs で実際に踏んだ）。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = Object.fromEntries(
    fs.readFileSync(path.join(ROOT, 'ios/appstore.env'), 'utf8')
        .split('\n')
        .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
);
const keyId = env.APPSTORE_KEY_ID;
const p8Path = path.join(os.homedir(), '.appstoreconnect/private_keys', `AuthKey_${keyId}.p8`);
if (!fs.existsSync(p8Path)) {
    console.error(`秘密鍵が見つかりません: ${p8Path}`);
    process.exit(1);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const header = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
const payload = b64({ iss: env.APPSTORE_ISSUER_ID, exp: Math.floor(Date.now() / 1000) + 600, aud: 'appstoreconnect-v1' });
const signer = createSign('SHA256');
signer.update(`${header}.${payload}`);
const jwt = `${header}.${payload}.${signer.sign({ key: fs.readFileSync(p8Path, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

const want = process.argv[2];
const url = want
    ? `https://api.appstoreconnect.apple.com/v1/builds?filter[version]=${want}&limit=5&fields[builds]=version,processingState,uploadedDate`
    : 'https://api.appstoreconnect.apple.com/v1/builds?limit=5&sort=-uploadedDate&fields[builds]=version,processingState,uploadedDate';

const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
const json = await res.json();
if (!res.ok) {
    console.error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    process.exit(1);
}
if (!json.data?.length) {
    console.log(want ? `build ${want}: まだ一覧に出ていません（アップロード直後は数分かかります）` : 'ビルドがありません');
    process.exit(0);
}
for (const b of json.data) {
    console.log(`build ${b.attributes.version}: ${b.attributes.processingState}  (uploaded ${b.attributes.uploadedDate})`);
}
