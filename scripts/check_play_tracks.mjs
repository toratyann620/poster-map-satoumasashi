/**
 * Google Play の各トラックに、いま何が配信されているかを確認する。
 *
 *   node scripts/check_play_tracks.mjs
 *
 * 「内部テスターが古いバージョンのまま」といった相談のとき、
 * 原因が「アップロードできていない」のか「下書きのまま公開していない」のかを
 * 切り分けるために使う。前提は upload_play.mjs と同じ。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PACKAGE = 'app.satoumasashi.postermap';
const KEY_PATH = path.join(os.homedir(), '.playconsole', 'play-publisher.json');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

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
const call = async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { ...auth, ...(options.headers ?? {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
};

const edit = await call(`${API}/applications/${PACKAGE}/edits`, { method: 'POST' });

const bundles = await call(`${API}/applications/${PACKAGE}/edits/${edit.id}/bundles`);
const codes = (bundles.bundles ?? []).map((b) => b.versionCode).sort((a, b) => a - b);
console.log('アップロード済みの versionCode:', codes.join(', ') || '(なし)');

const STATUS_LABEL = {
    completed: '公開済み（テスターに配信中）',
    draft: '★ 下書き（公開操作をするまでテスターには届きません）',
    inProgress: '段階的公開の途中',
    halted: '停止中',
};

for (const track of ['internal', 'alpha', 'beta', 'production']) {
    const label = { internal: '内部テスト', alpha: 'クローズドテスト', beta: 'オープンテスト', production: '製品版' }[track];
    let t;
    try {
        t = await call(`${API}/applications/${PACKAGE}/edits/${edit.id}/tracks/${track}`);
    } catch {
        console.log(`\n[${label}] 未使用`);
        continue;
    }
    console.log(`\n[${label}]`);
    for (const r of t.releases ?? []) {
        console.log(`  名前        : ${r.name ?? '(なし)'}`);
        console.log(`  versionCode : ${(r.versionCodes ?? []).join(', ') || '(なし)'}`);
        console.log(`  状態        : ${STATUS_LABEL[r.status] ?? r.status}`);
        if (r.userFraction) console.log(`  配信割合    : ${Math.round(r.userFraction * 100)}%`);
    }
    if (!(t.releases ?? []).length) console.log('  リリースなし');
}

await call(`${API}/applications/${PACKAGE}/edits/${edit.id}`, { method: 'DELETE' }).catch(() => {});
