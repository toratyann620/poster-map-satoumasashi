/**
 * ミーティング用の進捗レポートの数字を出す。
 *
 *   node scripts/progress_report.mjs 2026-09-13 2026-09-27
 *
 * 第1引数が前回の基準日、第2引数が今回の基準日（省略時は本日）。
 *
 * ⚠️ 集計基準はアプリのダッシュボード（src/components/DashboardTab.tsx）と揃えている。
 * ここを変えると会議の数字とアプリの画面が食い違うので、片方だけ直さないこと。
 *   - 対象は type === '佐藤まさし' のみ
 *   - 撤去済み（removed）は分母・分子とも除く
 *   - 枚数は quantity の合算（ピンの箇所数ではない）
 *   - 市区町村は address の部分一致（DashboardTab の getCityCategory と同一）
 *   - 設置率の表示は小数第1位と、画面と同じ四捨五入の整数を併記
 *
 * 「前回時点」の枚数は履歴から遡って再構築していない（quantity の変更や
 * 撤去の取り消しまで正確に復元できないため）。前回の数字は前回の議事録の値を使い、
 * このスクリプトは**今回時点**と**期間中のイベント数**だけを出す。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const TYPE = '佐藤まさし';
const CITIES = ['厚木市', '海老名市', '伊勢原市', 'それ以外'];

const fromStr = process.argv[2];
const toStr = process.argv[3] || new Date().toISOString().slice(0, 10);
if (!fromStr || !/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    console.error('使い方: node scripts/progress_report.mjs <前回の基準日 YYYY-MM-DD> [今回の基準日 YYYY-MM-DD]');
    process.exit(2);
}
const rangeStart = new Date(`${fromStr}T00:00:00+09:00`).getTime();
const rangeEnd = new Date(`${toStr}T23:59:59+09:00`).getTime() + 1;

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const cityOf = (a) => CITIES.find((c) => c !== 'それ以外' && String(a || '').includes(c)) || 'それ以外';
const qty = (p) => p.quantity || 1;
const statusesOf = (p) => (Array.isArray(p.status) ? p.status : p.status ? [p.status] : []);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);

// 住所を「市区町村＋町名」まで短縮（src/lib/posterMetrics.ts の shortenAddress と同じ）
const shortenAddress = (address) => {
    if (!address) return '(住所不明)';
    let s = String(address).trim().replace(/^\S*?[都道府県]/, '');
    const idx = s.search(/[0-9０-９]/);
    if (idx > 0) s = s.slice(0, idx);
    return s.trim() || String(address).trim();
};
const tally = (items, get) => {
    const m = new Map();
    for (const it of items) {
        const k = shortenAddress(get(it));
        m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const [posterSnap, logSnap] = await Promise.all([
    db.collection('posters_v2').get(),
    db.collection('activityLogs_v2').orderBy('changedAt', 'asc').get(),
]);
const allPosters = posterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const allLogsAsc = logSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => l.posterType === TYPE);

const active = allPosters.filter((p) => !p.removed && p.type === TYPE);

// ── 市区町村別 設置進捗（今回時点）──
const rows = CITIES.map((city) => {
    const ps = active.filter((p) => cityOf(p.address) === city);
    const total = ps.reduce((s, p) => s + qty(p), 0);
    const installed = ps.filter((p) => statusesOf(p).includes('設置済')).reduce((s, p) => s + qty(p), 0);
    return { city, pins: ps.length, total, installed, rate: pct(installed, total) };
});
const gTotal = rows.reduce((s, r) => s + r.total, 0);
const gInstalled = rows.reduce((s, r) => s + r.installed, 0);

console.log(`=== ${toStr} 時点（${TYPE}・撤去済みを除く・枚数ベース）===`);
console.log('市区町村   設置 /  総数    設置率           ピン箇所  未設置枠');
for (const r of rows) {
    console.log(
        `${r.city.padEnd(5, '　')} ${String(r.installed).padStart(5)} / ${String(r.total).padStart(5)}`
        + `  ${r.rate.toFixed(1).padStart(5)}% / ${String(Math.round(r.rate)).padStart(3)}%`
        + `   ${String(r.pins).padStart(6)}   ${String(r.total - r.installed).padStart(5)}`,
    );
}
console.log(
    `${'合計'.padEnd(5, '　')} ${String(gInstalled).padStart(5)} / ${String(gTotal).padStart(5)}`
    + `  ${pct(gInstalled, gTotal).toFixed(1).padStart(5)}% / ${String(Math.round(pct(gInstalled, gTotal))).padStart(3)}%`
    + `   ${String(active.length).padStart(6)}   ${String(gTotal - gInstalled).padStart(5)}`,
);

// ── 期間中の4指標（新規／撤去／張替え解除／修理解除）──
const logsInRange = allLogsAsc.filter((l) => l.changedAt >= rangeStart && l.changedAt < rangeEnd);
const newPosters = active.filter((p) => typeof p.createdAt === 'number' && p.createdAt >= rangeStart && p.createdAt < rangeEnd);
const removedLogs = logsInRange.filter((l) => l.removedChangedTo === true);

// 張替え解除・修理解除は全履歴から再構築してから期間で切る（posterMetrics.ts と同じ）
const byPoster = new Map();
for (const l of allLogsAsc) {
    if (!l.posterId) continue;
    if (!byPoster.has(l.posterId)) byPoster.set(l.posterId, []);
    byPoster.get(l.posterId).push(l);
}
const replaceCancel = [];
const repairCancel = [];
for (const logs of byPoster.values()) {
    let prev = null;
    for (const log of logs) {
        if (Array.isArray(log.statusRemoved)) {
            if (log.statusRemoved.includes('張替え予定')) replaceCancel.push(log);
            if (log.statusRemoved.includes('要修理')) repairCancel.push(log);
        } else if (prev !== null && Array.isArray(log.posterStatus)) {
            if (prev.includes('張替え予定') && !log.posterStatus.includes('張替え予定')) replaceCancel.push(log);
            if (prev.includes('要修理') && !log.posterStatus.includes('要修理')) repairCancel.push(log);
        }
        if (Array.isArray(log.posterStatus)) prev = log.posterStatus;
    }
}
const inRange = (arr) => arr.filter((e) => e.changedAt >= rangeStart && e.changedAt < rangeEnd);

console.log(`\n=== ${fromStr} 〜 ${toStr} の活動（${TYPE}）===`);
const show = (label, items, get) => {
    console.log(`${label}: ${items.length}件`);
    for (const [addr, n] of tally(items, get).slice(0, 8)) console.log(`    ${addr} ${n}`);
};
show('新規登録', newPosters, (p) => p.address);
show('撤去', removedLogs, (l) => l.posterAddress);
show('張替え解除', inRange(replaceCancel), (l) => l.posterAddress);
show('修理解除', inRange(repairCancel), (l) => l.posterAddress);
console.log(`変更履歴の総件数: ${logsInRange.length}件`);

// ── 参考: ステータス内訳（未設置枠の中身を見るため）──
const st = {};
for (const p of active) for (const s of statusesOf(p)) st[s] = (st[s] || 0) + qty(p);
console.log(`\n=== ${toStr} 時点のステータス別 枚数（重複あり）===`);
for (const [k, v] of Object.entries(st).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
const noStatus = active.filter((p) => statusesOf(p).length === 0).reduce((s, p) => s + qty(p), 0);
if (noStatus) console.log(`  (ステータス未設定): ${noStatus}`);

const removedAll = allPosters.filter((p) => p.removed && p.type === TYPE);
console.log(`\n撤去済み（累計・分母から除外している分）: ${removedAll.length}箇所 / ${removedAll.reduce((s, p) => s + qty(p), 0)}枚`);
process.exit(0);
