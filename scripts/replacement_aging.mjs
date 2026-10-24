/**
 * 「張り替えてから何日経ったか」を集計する。
 *
 *   node scripts/replacement_aging.mjs            # 本日を基準に集計
 *   node scripts/replacement_aging.mjs 2026-10-24 # 基準日を指定
 *
 * ■ 何を「張り替えた日」とみなすか（上から順に探し、見つかった時点で採用）
 *   1. 変更履歴で最後に「設置済」が**付いた**日
 *      - statusAdded に '設置済' が入っている履歴
 *      - 古い履歴は statusAdded を持たないので、posterStatus の前後比較で
 *        「設置済が無い → ある」に変わった時点を拾う
 *      - 新規登録（action='追加'）で最初から設置済だった場合もその日
 *   2. 履歴から追えない場合は、ピンの作成日（createdAt）
 *      新規設置した日、または v2 への初期インポート日にあたる
 *
 * ⚠️ 変更履歴（activityLogs_v2）は 2026-05-15 以降しかない。それ以前に
 * 設置されたピンは履歴から追えないため、ほぼ 2 の「作成日」になる。
 * 初期インポートは 2026-03 で、実際に貼った日より新しいとは限らない
 * （＝ここで出る経過日数は**実際より短め**に出ている可能性がある）。
 *
 * ■ 対象
 * いま「設置済」が付いている、撤去済みでない「佐藤まさし」のピン。
 * すでに「張替え予定」になっているものは、張り替え対象として拾われているので除く。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const TYPE = '佐藤まさし';
const arg = process.argv[2];
const BASE = arg ? new Date(`${arg}T23:59:59+09:00`).getTime() : Date.now();
const baseLabel = new Date(BASE).toLocaleDateString('ja-JP');

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const [posterSnap, logSnap] = await Promise.all([
    db.collection('posters_v2').get(),
    db.collection('activityLogs_v2').orderBy('changedAt', 'asc').get(),
]);

const posters = posterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const logsByPoster = new Map();
for (const d of logSnap.docs) {
    const l = d.data();
    if (!l.posterId) continue;
    if (!logsByPoster.has(l.posterId)) logsByPoster.set(l.posterId, []);
    logsByPoster.get(l.posterId).push(l);
}

/** そのピンで最後に「設置済」が付いた日。追えなければ null */
const lastInstalledAt = (posterId) => {
    const logs = logsByPoster.get(posterId);
    if (!logs) return null;
    let prev = null;
    let found = null;
    for (const log of logs) {
        const now = Array.isArray(log.posterStatus) ? log.posterStatus : null;
        if (Array.isArray(log.statusAdded) && log.statusAdded.includes('設置済')) {
            found = log.changedAt;
        } else if (prev !== null && now && !prev.includes('設置済') && now.includes('設置済')) {
            found = log.changedAt;
        } else if (prev === null && log.action === '追加' && now && now.includes('設置済')) {
            // 新規登録の時点ですでに設置済だった
            found = log.changedAt;
        }
        if (now) prev = now;
    }
    return found;
};

const qty = (p) => p.quantity || 1;
const DAY = 86400000;

const targets = posters.filter(
    (p) => !p.removed && p.type === TYPE && (p.status || []).includes('設置済'),
);

const rows = targets.map((p) => {
    const fromLog = lastInstalledAt(p.id);
    const at = fromLog ?? p.createdAt ?? null;
    return {
        p,
        at,
        source: fromLog ? '履歴' : '作成日',
        days: at ? Math.floor((BASE - at) / DAY) : null,
    };
});

const unknown = rows.filter((r) => r.days === null);
const known = rows.filter((r) => r.days !== null);

const sum = (list) => list.reduce((s, r) => s + qty(r.p), 0);
const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : '0.0');

const totalPins = known.length;
const totalQty = sum(known);

console.log(`基準日: ${baseLabel}`);
console.log(`対象: いま「設置済」の ${TYPE} のピン ${targets.length}件 / ${sum(rows)}枚`);
if (unknown.length) console.log(`  （日付を特定できなかったもの: ${unknown.length}件。集計から除く）`);
console.log();

console.log('■ 経過日数別（ご指定の区分・それ以上を含む累計）');
for (const th of [90, 180, 270]) {
    const hit = known.filter((r) => r.days >= th);
    console.log(`  ${String(th).padStart(3)}日以上: ${String(hit.length).padStart(4)}件 / ${String(sum(hit)).padStart(4)}枚`
        + `  （件数で ${pct(hit.length, totalPins)}% / 枚数で ${pct(sum(hit), totalQty)}%）`);
}

console.log('\n■ 重ならない区分（内訳）');
const bands = [
    ['90日未満', (d) => d < 90],
    ['90〜179日', (d) => d >= 90 && d < 180],
    ['180〜269日', (d) => d >= 180 && d < 270],
    ['270日以上', (d) => d >= 270],
];
for (const [label, f] of bands) {
    const hit = known.filter((r) => f(r.days));
    console.log(`  ${label.padEnd(12, '　')}: ${String(hit.length).padStart(4)}件 / ${String(sum(hit)).padStart(4)}枚`
        + `  （件数で ${pct(hit.length, totalPins)}%）`);
}

console.log('\n■ 日付の根拠');
for (const src of ['履歴', '作成日']) {
    const hit = known.filter((r) => r.source === src);
    console.log(`  ${src.padEnd(4, '　')}: ${String(hit.length).padStart(4)}件 / ${String(sum(hit)).padStart(4)}枚`
        + `  （${pct(hit.length, totalPins)}%）`);
}

console.log('\n■ 市区町村別の「90日以上」');
const CITIES = ['厚木市', '海老名市', '伊勢原市', 'それ以外'];
const cityOf = (a) => CITIES.find((c) => c !== 'それ以外' && String(a || '').includes(c)) || 'それ以外';
for (const c of CITIES) {
    const inCity = known.filter((r) => cityOf(r.p.address) === c);
    if (!inCity.length) continue;
    const over = inCity.filter((r) => r.days >= 90);
    console.log(`  ${c.padEnd(5, '　')}: ${String(over.length).padStart(4)}件 / ${String(sum(over)).padStart(4)}枚`
        + `  （その市の設置済 ${inCity.length}件のうち ${pct(over.length, inCity.length)}%）`);
}

const oldest = known.slice().sort((a, b) => b.days - a.days).slice(0, 5);
console.log('\n■ もっとも古い5件');
for (const r of oldest) {
    console.log(`  ${String(r.days).padStart(4)}日  ${r.p.address || '(住所なし)'}`
        + `  （${r.source}: ${new Date(r.at).toLocaleDateString('ja-JP')}）`);
}
process.exit(0);
