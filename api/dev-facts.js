/**
 * kurobot 共通規格 v1 — クライアント側の受け口（Vercel Functions）。
 *
 *   GET  /api/dev-facts   自己紹介（project）・いまの状態（version / facts）・道具（tools）
 *   POST /api/dev-facts   道具の実行 { tool, input }
 *
 * ハブ（kurobot-hub）だけが呼ぶ。どちらも Authorization: Bearer <KUROBOT_SHARED_SECRET>
 * を検証し、違えば 401。検証しないと URL を知る誰でも数字を読めてしまう。
 *
 * 決めごと:
 *  - facts は固定値を書かない。毎回 Firestore（posters_v2 / activityLogs_v2）から計算する。
 *    集計の基準はアプリのダッシュボードと同じ（撤去済みを除く／枚数は quantity の合計）。
 *  - version は android/app/build.gradle の versionName / versionCode を唯一の定義元として読む
 *    （iOS 側の pbxproj とは配信手順で常に揃えている）。読めない環境では
 *    Firestore の settings/appVersion.latest（更新案内の基準値）にフォールバックする。
 *  - changes は data/release-notes.json（利用者向けの変更点の唯一の定義元）から読む。
 *    デプロイ通知の本文はハブがこれを使って組み立てる。
 *  - 応答は3秒以内。Firestore の読み取り結果は5分キャッシュする（規格の上限）。
 *  - 道具はまだ無い。個人情報（氏名・住所・電話など）を返す道具を足すときは
 *    必ず sensitivity: "personal" を付けること（規格 §11）。
 *  - 道具名と input_schema のプロパティ名は英数字のみ（規格 §14。日本語のキーは Claude API が拒否する）。
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ⚠️ src/lib/collections.ts の COL と対になっている。片方だけ変更しないこと。
const COL = { posters: 'posters_v2', activityLogs: 'activityLogs_v2', settings: 'settings' };

const PRODUCTION_URL = 'https://poster-map-app.vercel.app';
const TARGET_TYPE = '佐藤まさし';
const CITIES = ['厚木市', '海老名市', '伊勢原市'];
const CACHE_MS = 5 * 60 * 1000;

/** ハブに宣言する道具。名前・プロパティ名は英数字のみ（規格 §14） */
const TOOLS = [];

// ────────────────────────────────────────────────────────────
// 認証
// ────────────────────────────────────────────────────────────

/**
 * Bearer を時間一定で比較する。長さが違うと timingSafeEqual が投げるため、
 * 両方を SHA-256 で同じ長さに揃えてから比べる。
 * シークレットが未設定なら必ず拒否する（開けたままにしない）。
 */
function isAuthorized(req) {
    const expected = process.env.KUROBOT_SHARED_SECRET || '';
    if (!expected) {
        console.error('KUROBOT_SHARED_SECRET が未設定のため、すべての要求を拒否しています');
        return false;
    }
    const header = String(req.headers?.authorization ?? '');
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) return false;
    const a = createHash('sha256').update(m[1].trim()).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
}

// ────────────────────────────────────────────────────────────
// Firestore
// ────────────────────────────────────────────────────────────

/**
 * サービスアカウントは Vercel の環境変数 FIREBASE_SERVICE_ACCOUNT に置く。
 * JSON そのままでも、base64 でも受け付ける（改行を含む秘密鍵を環境変数に入れる際、
 * base64 の方が事故が少ないため）。
 */
function getDb() {
    if (!getApps().length) {
        const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT が未設定です');
        const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        const sa = JSON.parse(json);
        initializeApp({ credential: cert(sa), projectId: sa.project_id });
    }
    return getFirestore();
}

// ────────────────────────────────────────────────────────────
// version — 唯一の定義元（build.gradle）から読む
// ────────────────────────────────────────────────────────────

/**
 * vercel.json の functions.includeFiles で build.gradle を関数に同梱している。
 * 実行環境によって作業ディレクトリの取り方が違うので、候補を順に試す。
 */
function readAppVersionFromGradle() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.join(process.cwd(), 'android', 'app', 'build.gradle'),
        path.join(here, '..', 'android', 'app', 'build.gradle'),
    ];
    for (const p of candidates) {
        try {
            const text = readFileSync(p, 'utf8');
            const name = text.match(/versionName\s+"([^"]+)"/)?.[1];
            const code = Number(text.match(/versionCode\s+(\d+)/)?.[1]);
            if (name) return { name, code: Number.isFinite(code) ? code : undefined };
        } catch {
            /* 次の候補へ */
        }
    }
    return null;
}

// ────────────────────────────────────────────────────────────
// changes — 利用者向けの変更点（data/release-notes.json）
// ────────────────────────────────────────────────────────────

/**
 * build.gradle と同じく includeFiles で同梱している。
 * 読めなくても manifest は成立させる（通知から変更点が落ちるだけ）。
 */
function readChanges() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.join(process.cwd(), 'data', 'release-notes.json'),
        path.join(here, '..', 'data', 'release-notes.json'),
    ];
    for (const p of candidates) {
        try {
            const { releases } = JSON.parse(readFileSync(p, 'utf8'));
            if (!Array.isArray(releases)) continue;
            return releases
                .filter((r) => r && typeof r.version === 'string' && Array.isArray(r.items) && r.items.length)
                .map((r) => ({ version: r.version, date: r.date, items: r.items.map(String) }));
        } catch {
            /* 次の候補へ */
        }
    }
    return [];
}

// ────────────────────────────────────────────────────────────
// facts — 実データから計算する
// ────────────────────────────────────────────────────────────

const qtyOf = (p) => (typeof p.quantity === 'number' && p.quantity > 0 ? p.quantity : 1);
const statusesOf = (p) => (Array.isArray(p.status) ? p.status : p.status ? [p.status] : []);
const isInstalled = (p) => statusesOf(p).includes('設置済');
const cityOf = (p) => p.city || CITIES.find((c) => String(p.address || '').includes(c)) || '';
const rateOf = (posters) => {
    const total = posters.reduce((s, p) => s + qtyOf(p), 0);
    const installed = posters.filter(isInstalled).reduce((s, p) => s + qtyOf(p), 0);
    return total > 0 ? Math.round((installed / total) * 100) : 0;
};

let cache = null; // { at: number, data: { facts, appVersionLatest } }

async function loadSnapshot(db) {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // 必要な項目だけ取る。写真URLなどの大きな項目を持ち込まないため
    const [postersSnap, weekLogs, appVersionDoc] = await Promise.all([
        db.collection(COL.posters)
            .select('type', 'status', 'quantity', 'removed', 'city', 'address', 'createdAt', 'greetings')
            .get(),
        db.collection(COL.activityLogs).where('changedAt', '>=', weekAgo).count().get(),
        db.collection(COL.settings).doc('appVersion').get(),
    ]);

    const all = postersSnap.docs.map((d) => d.data());
    const active = all.filter((p) => !p.removed);
    const removed = all.length - active.length;
    const sato = active.filter((p) => p.type === TARGET_TYPE);

    const facts = [
        { label: `${TARGET_TYPE}ポスター枚数`, value: sato.reduce((s, p) => s + qtyOf(p), 0), unit: '枚' },
        { label: `${TARGET_TYPE}設置率`, value: rateOf(sato), unit: '%' },
        ...CITIES.map((city) => ({
            label: `設置率（${city}）`,
            value: rateOf(sato.filter((p) => cityOf(p) === city)),
            unit: '%',
        })),
        { label: '登録ピン数（全種類・撤去済みを除く）', value: active.length, unit: '箇所' },
        { label: '撤去済みピン数', value: removed, unit: '箇所' },
        {
            label: `直近7日の新規登録（${TARGET_TYPE}）`,
            value: sato.filter((p) => typeof p.createdAt === 'number' && p.createdAt >= weekAgo).length,
            unit: '箇所',
        },
        { label: '直近7日の変更件数', value: weekLogs.data().count, unit: '件' },
        {
            label: '挨拶の記録があるピン数',
            value: active.filter((p) => Array.isArray(p.greetings) && p.greetings.length > 0).length,
            unit: '箇所',
        },
    ];

    const data = {
        facts,
        appVersionLatest: appVersionDoc.exists ? String(appVersionDoc.data()?.latest || '') : '',
    };
    cache = { at: now, data };
    return data;
}

// ────────────────────────────────────────────────────────────
// manifest
// ────────────────────────────────────────────────────────────

async function buildManifest() {
    const db = getDb();
    const { facts, appVersionLatest } = await loadSnapshot(db);

    const gradle = readAppVersionFromGradle();
    const store = gradle?.name || appVersionLatest || undefined;
    const build = gradle?.code;
    // ブラウザ版は同じソースから配信しているので版はアプリと同じ。
    // Vercel が git のコミットを教えてくれる環境では、どのコミットかも添える
    const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
    const web = store ? (sha ? `${store} (${sha})` : store) : undefined;

    const version = {};
    if (web) version.web = web;
    if (store) version.store = store;
    if (build !== undefined) version.build = build;

    // 配信状況は settings/appVersion.latest（配信完了後に更新する値）から導く。
    // gradle の版と一致するときだけ build 番号を添える（配信済みと断言できる範囲に留める）
    const distribution = {};
    if (appVersionLatest) {
        const withBuild = gradle && gradle.name === appVersionLatest && build !== undefined;
        distribution.ios = `TestFlight に ${appVersionLatest}${withBuild ? ` (build ${build})` : ''} を配信済み`;
        distribution.android = `Play 内部テスト・クローズドテストに ${appVersionLatest}${withBuild ? ` (versionCode ${build})` : ''} を配信済み`;
    }

    const slackChannels = (process.env.KUROBOT_SLACK_CHANNELS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const project = {
        id: 'poster',
        name: 'ポスターアプリ',
        description:
            '選挙ポスターの掲示場所を地図上のピンで記録・共有するアプリ。設置状況・写真・所有者への挨拶の記録を事務所ごとに管理し、設置率を集計する。',
        keywords: ['ポスター', '設置', '掲示', '設置率', 'ピン', '撤去', '張替え', '挨拶', '掲示場所', 'マップ'],
        productionUrl: PRODUCTION_URL,
        sheetTab: 'マップアプリ',
    };
    if (slackChannels.length) project.slackChannels = slackChannels;

    const manifest = { kurobot: 1, project };
    if (Object.keys(version).length) manifest.version = version;
    manifest.facts = facts;
    const changes = readChanges();
    if (changes.length) manifest.changes = changes;
    if (Object.keys(distribution).length) manifest.distribution = distribution;
    manifest.tools = TOOLS;
    manifest.generatedAt = new Date().toISOString();
    return manifest;
}

// ────────────────────────────────────────────────────────────
// handler
// ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (!isAuthorized(req)) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    try {
        if (req.method === 'GET') {
            return res.status(200).json(await buildManifest());
        }

        if (req.method === 'POST') {
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const tool = typeof body.tool === 'string' ? body.tool : '';
            if (!tool) return res.status(400).json({ ok: false, error: 'tool が指定されていません' });
            // 道具はまだ宣言していないので、何が来ても未知
            return res.status(404).json({ ok: false, error: `未知の道具: ${tool}` });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ ok: false, error: 'method not allowed' });
    } catch (e) {
        console.error('dev-facts failed', e);
        return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
}
