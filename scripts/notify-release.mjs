#!/usr/bin/env node
/**
 * デプロイ完了をハブ（kurobot-hub）に伝える。kurobot 共通規格 §7。
 *
 *   node scripts/notify-release.mjs --targets web
 *   node scripts/notify-release.mjs --targets app --mention here --sheet
 *   node scripts/notify-release.mjs --targets web,app --channel "#10_地元活動全般"
 *
 * デプロイの流れの最後で1回だけ呼ぶ。文面はハブがこのプロジェクトの
 * /api/dev-facts を読んで組み立てるので、ここでは Slack のトークンも文面も持たない。
 * 必要なのは KUROBOT_HUB_URL と KUROBOT_SHARED_SECRET の2つだけ
 * （環境変数、無ければ .env.local / .env から読む）。
 *
 * 既存の Cloud Functions の日次レポート（SLACK_WEBHOOK_URL）とは無関係。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠️ new URL(import.meta.url).pathname は使わない。パーセントエンコードされた文字列が
// 返るため、日本語や括弧を含むパスでは .env.local を見つけられず、
// 「KUROBOT_HUB_URL と KUROBOT_SHARED_SECRET が必要です」で黙って止まる。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 引数 ──
const argv = process.argv.slice(2);
const opt = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(`--${name}`);

const targets = (opt('targets') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const mention = opt('mention');
const channel = opt('channel');
const sheetLink = has('sheet');

if (!targets.length || targets.some((t) => t !== 'web' && t !== 'app')) {
    console.error('使い方: node scripts/notify-release.mjs --targets web|app|web,app [--mention channel|here|none] [--channel "#..."] [--sheet]');
    process.exit(2);
}
if (mention && !['channel', 'here', 'none'].includes(mention)) {
    console.error('--mention は channel / here / none のいずれかです');
    process.exit(2);
}

// ── 環境変数（無ければ .env.local → .env の順に KUROBOT_* だけ拾う）──
const readEnvFile = (file) => {
    try {
        const out = {};
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            const m = line.match(/^\s*(KUROBOT_[A-Z_]+)\s*=\s*(.*)\s*$/);
            if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
        return out;
    } catch {
        return {};
    }
};
const fileEnv = { ...readEnvFile(path.join(ROOT, '.env')), ...readEnvFile(path.join(ROOT, '.env.local')) };
const env = (k) => process.env[k] || fileEnv[k] || '';

const hubUrl = env('KUROBOT_HUB_URL').replace(/\/+$/, '');
const secret = env('KUROBOT_SHARED_SECRET');
if (!hubUrl || !secret) {
    console.error('KUROBOT_HUB_URL と KUROBOT_SHARED_SECRET が必要です（.env.local に書くか環境変数で渡してください）');
    process.exit(2);
}

// ── 送信 ──
const body = { project: 'poster', targets };
if (mention) body.mention = mention;
if (channel) body.channel = channel;
if (sheetLink) body.sheetLink = true;

const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 15000);
try {
    const res = await fetch(`${hubUrl}/api/notify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 本文がJSONでない */ }

    if (!res.ok || (json && json.ok === false)) {
        console.error(`✗ 通知に失敗しました（HTTP ${res.status}）: ${json?.error || text.slice(0, 300)}`);
        console.error('  デプロイ自体は完了しています。ハブの状態を確認して、必要なら再実行してください。');
        process.exit(1);
    }
    console.log(`✓ ハブに通知しました（${targets.join(', ')}）${json?.channel ? ` → ${json.channel}` : ''}`);
} catch (e) {
    console.error(`✗ ハブに接続できませんでした: ${e instanceof Error ? e.message : String(e)}`);
    console.error('  デプロイ自体は完了しています。');
    process.exit(1);
} finally {
    clearTimeout(timer);
}
