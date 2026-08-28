/**
 * Google Play の内部テストトラックへ AAB をアップロードする。
 *
 *   node scripts/upload_play.mjs [AABのパス] [トラック]
 *
 * トラックは internal（内部テスト・既定）/ alpha（クローズドテスト）/
 * beta（オープンテスト）/ production（製品版）。
 * internal は審査なしで即時に配信されるが、それ以外は Google の審査を通る。
 *
 * 前提:
 *   - ~/.playconsole/play-publisher.json（サービスアカウントの鍵）
 *   - そのサービスアカウントが Play Console でアプリへのアクセスを許可されていること
 *     （Play Console → 設定 → API アクセス、またはユーザーと権限から招待する）
 *
 * Play の編集は「編集セッションを開く → 変更を積む → コミット」という流れで、
 * コミットするまで実際には反映されない。途中で失敗した場合は何も変わらない。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PACKAGE = 'app.satoumasashi.postermap';
const TRACK = process.argv[3] ?? 'internal'; // internal / alpha / beta / production
// completed = 即時反映 / draft = 下書き（Play Console から公開操作を行う）。
// 一度も公開していないアプリでは、内部テスト以外は draft でしか作成できない。
const STATUS = process.env.RELEASE_STATUS ?? (TRACK === 'internal' ? 'completed' : 'draft');
const TRACK_LABEL = { internal: '内部テスト', alpha: 'クローズドテスト', beta: 'オープンテスト', production: '製品版' }[TRACK] ?? TRACK;
const KEY_PATH = path.join(os.homedir(), '.playconsole', 'play-publisher.json');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';

const aabPath = process.argv[2] ?? 'build/upload/postermap-1.0.0-build1.aab';

if (!fs.existsSync(KEY_PATH)) {
    console.error(`サービスアカウントの鍵が見つかりません: ${KEY_PATH}`);
    process.exit(1);
}
if (!fs.existsSync(aabPath)) {
    console.error(`AAB が見つかりません: ${aabPath}`);
    console.error('先に ./scripts/release_android.sh を実行してください。');
    process.exit(1);
}

// ── サービスアカウントでアクセストークンを取得 ──
const getAccessToken = async () => {
    const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
        iss: key.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
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

const call = async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { ...auth, ...(options.headers ?? {}) } });
    const text = await res.text();
    if (!res.ok) {
        let msg = text.slice(0, 400);
        try { msg = JSON.parse(text).error?.message ?? msg; } catch { /* そのまま */ }
        throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return text ? JSON.parse(text) : {};
};

// ── 1. 編集セッションを開く ──
console.log('── 編集セッションを開始 ──');
let edit;
try {
    edit = await call(`${API}/applications/${PACKAGE}/edits`, { method: 'POST' });
} catch (e) {
    if (String(e.message).includes('403')) {
        const email = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')).client_email;
        console.error('\n⛔ Play Console からこのサービスアカウントへのアクセスが許可されていません。');
        console.error('\n   Play Console で次の操作を行ってください:');
        console.error('   1. 「ユーザーと権限」→「ユーザーを招待」');
        console.error(`   2. メールアドレスに次を入力: ${email}`);
        console.error('   3. アプリ「ポスター管理アプリ｜神奈川16区」を選択');
        console.error('   4. 権限に「リリース」→「製品版以外のトラックへのリリース」を付与');
        console.error('\n   反映まで数分かかることがあります。');
        process.exit(1);
    }
    throw e;
}
console.log(`  編集ID: ${edit.id}`);

try {
    // ── 2. AAB をアップロード ──
    const size = fs.statSync(aabPath).size;
    console.log(`\n── AAB をアップロード（${(size / 1024 / 1024).toFixed(2)} MB）──`);
    const bundle = await call(
        `${UPLOAD_API}/applications/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: fs.readFileSync(aabPath),
        },
    );
    console.log(`  versionCode: ${bundle.versionCode}`);
    console.log(`  SHA-256: ${bundle.sha256 ?? '-'}`);

    // ── 3. 内部テストトラックへ割り当て ──
    console.log(`\n── ${TRACK_LABEL}（${TRACK}）トラックへ割り当て ──`);
    const track = await call(`${API}/applications/${PACKAGE}/edits/${edit.id}/tracks/${TRACK}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            track: TRACK,
            releases: [{
                versionCodes: [String(bundle.versionCode)],
                status: STATUS,
                releaseNotes: [{
                    language: 'ja-JP',
                    text: process.env.RELEASE_NOTES
                        ?? '初回リリース。ポスター掲示場所の地図表示・記録・経路案内に対応しています。',
                }],
            }],
        }),
    });
    console.log(`  リリース状態: ${track.releases?.[0]?.status}`);
    if (STATUS === 'draft') {
        console.log('  （下書きとして作成しました。公開するには Play Console での操作が必要です）');
    }

    // ── 4. コミット（ここで初めて反映される）──
    console.log('\n── 変更を確定 ──');
    const committed = await call(`${API}/applications/${PACKAGE}/edits/${edit.id}:commit`, { method: 'POST' });
    console.log(`  確定: ${committed.id}`);

    console.log(`\n✅ ${TRACK_LABEL}トラックへの反映が完了しました。`);
    console.log(`   Play Console →「テスト」→「${TRACK_LABEL}」で確認できます。`);
    if (STATUS === 'draft') {
        console.log(`   ⚠️ まだ下書きです。Play Console →「テスト」→「${TRACK_LABEL}」を開き、`);
        console.log('      内容を確認して「公開を開始」（審査へ送信）してください。');
    } else if (TRACK !== 'internal') {
        console.log('   ⚠️ 内部テスト以外は Google の審査を通ります。公開まで時間がかかります。');
    }
} catch (e) {
    // 失敗したら編集セッションを破棄する（中途半端な状態を残さないため）
    console.error(`\n⛔ 失敗しました: ${e.message}`);
    try {
        await call(`${API}/applications/${PACKAGE}/edits/${edit.id}`, { method: 'DELETE' });
        console.error('   編集セッションを破棄しました（Play 側に変更は残っていません）。');
    } catch { /* 破棄に失敗しても、コミットしていないので実害はない */ }
    process.exit(1);
}
