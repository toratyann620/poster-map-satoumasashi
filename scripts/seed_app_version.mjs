/**
 * ネイティブアプリの最低バージョン設定（settings/appVersion）を作成・更新する。
 *
 * アプリ側は `useAppVersionGate` でこのドキュメントを見ている。
 *
 *   minimum … これを下回ると利用を止める（強制アップデート）
 *   latest  … これを下回ると更新を促すポップアップを出す（閉じられる）
 *
 * ドキュメントが無い場合は「制限なし」として扱うため、
 * 設定漏れでアプリが使えなくなることはない。
 *
 * 実行例:
 *   node scripts/seed_app_version.mjs                       # 現状の確認のみ
 *   node scripts/seed_app_version.mjs --latest 1.1.0        # 更新を促すだけ
 *   node scripts/seed_app_version.mjs --minimum 1.1.0 --latest 1.1.0   # 利用も止める
 */
import { execSync } from 'node:child_process';

const PROJECT = 'satoumasashi-poster-map';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const h = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };

const argOf = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
};

const current = await (await fetch(`${BASE}/settings/appVersion`, { headers: h })).json();
if (current.fields) {
    console.log('現在の設定:');
    Object.entries(current.fields).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} ${v.stringValue ?? ''}`));
} else {
    console.log('settings/appVersion はまだ存在しません。');
}

const minimum = argOf('minimum');
const latest = argOf('latest');
if (!minimum && !latest) {
    console.log('\n--minimum <バージョン>（利用を止める下限）または');
    console.log('--latest <バージョン>（更新を促す最新版）を付けると設定できます。');
    process.exit(0);
}

const fields = {
    minimum: { stringValue: minimum ?? current.fields?.minimum?.stringValue ?? '' },
    latest: { stringValue: latest ?? current.fields?.latest?.stringValue ?? '' },
    message: { stringValue: argOf('message') ?? '機能追加のため、最新版へ更新してください。' },
    iosUrl: { stringValue: argOf('ios-url') ?? current.fields?.iosUrl?.stringValue ?? '' },
    androidUrl: { stringValue: argOf('android-url') ?? current.fields?.androidUrl?.stringValue ?? '' },
};
const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
const res = await fetch(`${BASE}/settings/appVersion?${mask}`, { method: 'PATCH', headers: h, body: JSON.stringify({ fields }) });
if (!res.ok) { console.error('保存に失敗:', JSON.stringify(await res.json()).slice(0, 300)); process.exit(1); }
if (minimum) console.log(`\n✅ 下限を ${minimum} に設定しました。これを下回る端末は利用できなくなります。`);
if (latest) console.log(`✅ 最新版を ${latest} に設定しました。これを下回る端末には更新を促すポップアップが出ます。`);
