/**
 * Play アプリ署名の証明書 SHA-256 を取り出す。
 *
 *   node scripts/get_play_signing_cert.mjs [versionCode]
 *
 * Android の App Links（リンクを押すとアプリが直接開く）は、
 * `/.well-known/assetlinks.json` に **Play が実際に配信する APK を署名している
 * 証明書**の SHA-256 が載っていないと検証が通らない。
 *
 * ⚠️ アップロード鍵（android/poster-map-upload.jks）の指紋では通らない。
 * Play アプリ署名が有効な場合、端末に届く APK は Google の鍵で署名し直されるため。
 *
 * Play Console の画面（セットアップ →「アプリの署名」）でも見られるが、
 * 手順を残すため API から取る。Play が生成した APK（＝実際に配信されるもの）を
 * ダウンロードし、その署名証明書を読む。
 *
 * 前提: ~/.playconsole/play-publisher.json（upload_play.mjs と同じ鍵）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PACKAGE = 'app.satoumasashi.postermap';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const KEY_PATH = path.join(os.homedir(), '.playconsole', 'play-publisher.json');
const versionCode = process.argv[2] ?? '18';

if (!fs.existsSync(KEY_PATH)) {
    console.error(`サービスアカウントの鍵が見つかりません: ${KEY_PATH}`);
    process.exit(1);
}

const getAccessToken = async () => {
    const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
        iss: key.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now, exp: now + 3600,
    })}`;
    const sig = crypto.sign('RSA-SHA256', Buffer.from(input), key.private_key).toString('base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${input}.${sig}`,
        }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`トークン取得に失敗: ${JSON.stringify(json).slice(0, 300)}`);
    return json.access_token;
};

const token = await getAccessToken();
const auth = { Authorization: `Bearer ${token}` };

// ① Play が生成した APK の一覧を取る（universal APK ＝ 端末向けに分割する前の1本）
console.log(`── versionCode ${versionCode} の生成APKを探す ──`);
const listRes = await fetch(`${API}/applications/${PACKAGE}/generatedApks/${versionCode}`, { headers: auth });
const list = await listRes.json();
if (!listRes.ok) {
    console.error(`一覧の取得に失敗（HTTP ${listRes.status}）: ${JSON.stringify(list).slice(0, 400)}`);
    process.exit(1);
}
const universal = list.generatedApks?.find((g) => g.generatedUniversalApk)?.generatedUniversalApk;
if (!universal?.downloadId) {
    console.error('universal APK が見つかりませんでした。応答:', JSON.stringify(list).slice(0, 400));
    process.exit(1);
}

// ② ダウンロードする
const out = path.join(os.tmpdir(), `play-${versionCode}-universal.apk`);
console.log('── ダウンロード ──');
const dlRes = await fetch(
    `${API}/applications/${PACKAGE}/generatedApks/${versionCode}/downloads/${universal.downloadId}:download?alt=media`,
    { headers: auth },
);
if (!dlRes.ok) {
    console.error(`ダウンロードに失敗（HTTP ${dlRes.status}）: ${(await dlRes.text()).slice(0, 300)}`);
    process.exit(1);
}
fs.writeFileSync(out, Buffer.from(await dlRes.arrayBuffer()));
console.log(`  ${out}（${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB）`);

// ③ 署名証明書の SHA-256 を読む
//
// ⚠️ keytool -printcert -jarfile は使えない。いまの APK は v2/v3 署名のみで、
// v1（JAR 署名）が無いため「署名付きJARファイルではありません」と言われる。
// Android SDK の apksigner を使う。
console.log('── 署名証明書 ──');
const findApksigner = () => {
    const base = path.join(os.homedir(), 'Library/Android/sdk/build-tools');
    const versions = fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : [];
    for (const v of versions) {
        const p = path.join(base, v, 'apksigner');
        if (fs.existsSync(p)) return p;
    }
    return null;
};
const apksigner = findApksigner();
if (!apksigner) {
    console.error('apksigner が見つかりません（Android SDK の build-tools を入れてください）。');
    process.exit(1);
}
const printed = execFileSync(apksigner, ['verify', '--print-certs', out], { encoding: 'utf8' });
// v2/v3/v4 で同じ証明書が複数回出るので、最初の1つを使う
const sha256 = printed.match(/SHA-256 digest:\s*([0-9a-f]{64})/i)?.[1];
const owner = printed.match(/Signer #1 certificate DN:\s*(.+)/)?.[1]?.trim();
if (!sha256) {
    console.error('SHA-256 を読み取れませんでした。apksigner の出力:\n', printed.slice(0, 800));
    process.exit(1);
}
// assetlinks.json は大文字コロン区切りの形式で書く
const formatted = sha256.toUpperCase().match(/.{2}/g).join(':');
console.log(`  発行先: ${owner ?? '(不明)'}`);
console.log(`  SHA-256: ${formatted}`);
console.log('\nこの値を public/.well-known/assetlinks.json に入れる。');
fs.unlinkSync(out);
