/**
 * Google Play のストア掲載情報（説明文・アイコン・スクリーンショット）を登録する。
 *
 *   node scripts/setup_play_listing.mjs
 *
 * 内部テストであっても、掲載情報が揃っていないと
 * Play Console の「テスト参加用リンク」が有効にならない。
 *
 * 画像は build/play-assets/ に用意しておく（scripts/ 内のコメント参照）:
 *   icon.png     512x512
 *   feature.png  1024x500
 *   screen1..3.png  スマートフォンのスクリーンショット（最低2枚）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PACKAGE = 'app.satoumasashi.postermap';
const LANG = 'ja-JP';
const KEY_PATH = path.join(os.homedir(), '.playconsole', 'play-publisher.json');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const ASSETS = 'build/play-assets';

const SHORT = 'ポスター掲示場所を地図で管理するスタッフ専用アプリ';

const FULL = `本アプリは、ポスターの掲示場所を地図上で管理するためのスタッフ専用ツールです。
一般の方はご利用いただけません。

■ 主な機能
・掲示場所を地図上で確認し、掲示状況を記録する
・現在地から掲示場所までの経路を案内する
・掲示状況を写真で記録する
・担当する市区町村・種別の範囲内で情報を共有する
・掲示枚数や設置率を集計して確認する

■ ご利用について
利用には、事務所から発行されたアカウントが必要です。
アカウントをお持ちでない方はご利用いただけません。

■ 権限について
・位置情報：地図への現在地表示と経路案内に使用します。アプリを表示している間のみ取得し、
　サーバーには保存しません。
・カメラ／写真：掲示状況を記録するために使用します。

プライバシーポリシー: https://poster-map-app.vercel.app/privacy`;

// ── 認証 ──
const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwtInput = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
})}`;
const jwt = `${jwtInput}.${crypto.sign('RSA-SHA256', Buffer.from(jwtInput), key.private_key).toString('base64url')}`;
const tokenRes = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
})).json();
const auth = { Authorization: `Bearer ${tokenRes.access_token}` };

const call = async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { ...auth, ...(options.headers ?? {}) } });
    const text = await res.text();
    if (!res.ok) {
        let msg = text.slice(0, 300);
        try { msg = JSON.parse(text).error?.message ?? msg; } catch { /* HTML応答などはそのまま */ }
        throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return text ? JSON.parse(text) : {};
};

const edit = await call(`${API}/applications/${PACKAGE}/edits`, { method: 'POST' });
console.log(`編集ID: ${edit.id}`);

try {
    // ── 説明文 ──
    console.log('\n── 説明文を登録 ──');
    const listing = await call(`${API}/applications/${PACKAGE}/edits/${edit.id}/listings/${LANG}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            language: LANG,
            title: 'ポスター管理アプリ｜神奈川16区',
            shortDescription: SHORT,
            fullDescription: FULL,
        }),
    });
    console.log(`  名前      : ${listing.title}`);
    console.log(`  短い説明  : ${listing.shortDescription.length}文字`);
    console.log(`  詳しい説明: ${listing.fullDescription.length}文字`);

    // ── 画像 ──
    const uploadImage = async (type, file) => {
        const p = path.join(ASSETS, file);
        if (!fs.existsSync(p)) { console.log(`  ⚠️ ${file} が無いので省略`); return; }
        const r = await call(
            `${UPLOAD}/applications/${PACKAGE}/edits/${edit.id}/listings/${LANG}/${type}?uploadType=media`,
            { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: fs.readFileSync(p) },
        );
        console.log(`  ✅ ${type.padEnd(18)} ${file} (${(fs.statSync(p).size / 1024).toFixed(0)} KB)`);
        return r;
    };

    console.log('\n── 画像を登録 ──');
    // 既存の画像を消してから入れ直す（重複登録を避けるため）
    for (const type of ['icon', 'featureGraphic', 'phoneScreenshots']) {
        await call(`${API}/applications/${PACKAGE}/edits/${edit.id}/listings/${LANG}/${type}`, { method: 'DELETE' })
            .catch(() => { /* 未登録なら消すものが無いだけ */ });
    }
    await uploadImage('icon', 'icon.png');
    await uploadImage('featureGraphic', 'feature.png');
    for (const f of ['screen1.png', 'screen2.png', 'screen3.png']) {
        await uploadImage('phoneScreenshots', f);
    }

    // ── 確定 ──
    console.log('\n── 変更を確定 ──');
    await call(`${API}/applications/${PACKAGE}/edits/${edit.id}:commit`, { method: 'POST' });
    console.log('\n✅ ストア掲載情報を登録しました。');
    console.log('   Play Console →「ストアの設定」→「メインのストアの掲載情報」で確認できます。');
} catch (e) {
    console.error(`\n⛔ 失敗しました: ${e.message}`);
    await call(`${API}/applications/${PACKAGE}/edits/${edit.id}`, { method: 'DELETE' }).catch(() => { });
    console.error('   編集セッションを破棄しました（Play 側に変更は残っていません）。');
    process.exit(1);
}
