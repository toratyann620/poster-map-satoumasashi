/**
 * ステータスが「要修理」のピンから、修理の依頼をまとめて作る。
 *
 *   node scripts/create_repair_tasks.mjs          # 確認のみ（書き込まない）
 *   node scripts/create_repair_tasks.mjs --apply  # 実際に作る
 *
 * 決めごと（2026-09-27 ユーザー指示）:
 *  - 依頼日は「要修理になった日」に遡る（履歴から特定。辿れないものは実行日）。
 *    放置されている実態がマイページの「N日経過」にそのまま出る。
 *  - 事務所は担当エリアで振り分けず、すべて佐藤まさし事務所（admin）に集約する。
 *  - 担当者は決めない（事務所の全員あて）。手が空いた人が拾えるようにするため。
 *  - 期限は付けない。
 *
 * ⚠️ プッシュ通知は送らない（notify: false）。
 * まとめて作ると件数分の通知が一度に飛ぶため。周知は別途お知らせで行う。
 *
 * ⚠️ 未対応の修理依頼が既にあるピンは作らない。再実行しても増えない。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');
admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const GROUP_ID = 'admin';            // 佐藤まさし事務所に集約
const CREATED_BY = 'システム（要修理の一括起票）';

const ymd = (ms) => {
    const d = new Date(ms); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};

// ── 対象のピン ──
const posters = await db.collection('posters_v2').get();
const targets = posters.docs.filter((d) => {
    const v = d.data();
    return !v.removed && (Array.isArray(v.status) ? v.status : []).includes('要修理');
});

// ── 既に未対応の修理依頼があるピンは除く ──
const tasks = await db.collection('tasks').get();
const covered = new Set(
    tasks.docs.filter((d) => d.data().kind === '修理' && d.data().status === 'open')
        .map((d) => d.data().posterId).filter(Boolean),
);

// ── 「要修理」が最初に付いた日を履歴から拾う ──
// ⚠️ 履歴の diff は「その時点の状態」の写しで差分ではない。最初に現れた時点を
// 「その頃には要修理だった」ことの根拠として使う（これ以上は遡れない）。
const logs = await db.collection('activityLogs_v2').orderBy('changedAt', 'asc').get();
const firstRepairAt = new Map();
for (const d of logs.docs) {
    const v = d.data();
    if (!v.posterId || firstRepairAt.has(v.posterId)) continue;
    const hit = (v.statusAdded ?? []).includes('要修理')
        || (v.posterStatus ?? []).includes('要修理')
        || String(v.diff ?? '').includes('要修理');
    if (hit) firstRepairAt.set(v.posterId, Number(v.changedAt) || 0);
}

const now = Date.now();
const plans = [];
const skipped = [];

for (const d of targets) {
    const v = d.data();
    if (covered.has(d.id)) { skipped.push({ address: v.address, reason: '未対応の修理依頼が既にある' }); continue; }

    const at = firstRepairAt.get(d.id) || 0;
    const createdAt = at || now;
    const days = Math.floor((now - createdAt) / 86400000);

    const memo = String(v.memo ?? '').trim();
    const body = [
        at ? `${ymd(at)} から「要修理」のままになっています（${days}日経過）。`
           : '「要修理」になった日が履歴から特定できませんでした。',
        memo ? `現地の記録: ${memo}` : '',
        '修理が済んだら、ピンのステータスから「要修理」を外してください。',
    ].filter(Boolean).join('\n');

    plans.push({
        posterId: d.id,
        address: v.address || '(住所なし)',
        type: v.type || '',
        city: v.city || '',
        title: `修理: ${v.address || '(住所なし)'}`,
        body,
        createdAt,
        days,
        tracedDate: at ? ymd(at) : null,
    });
}

plans.sort((a, b) => b.days - a.days);

console.log(APPLY ? '★ 実際に作成します' : '確認のみ（作成しません）');
console.log(`要修理のピン: ${targets.length}件 / 作成対象: ${plans.length}件 / 除外: ${skipped.length}件\n`);
console.log('共通の設定: 種類=修理 ／ 事務所=佐藤まさし事務所 ／ 担当者=全員あて ／ 期限なし ／ 通知しない\n');

plans.forEach((p, i) => {
    console.log(`${i + 1}. ${p.title}`);
    console.log(`   種類のピン: ${p.type}（${p.city}）`);
    console.log(`   依頼日    : ${ymd(p.createdAt)}${p.tracedDate ? `（要修理になった日。${p.days}日経過）` : '（履歴から辿れず本日）'}`);
    console.log(`   本文      : ${p.body.replace(/\n/g, '\n               ')}`);
    console.log();
});
if (skipped.length) {
    console.log('除外:');
    for (const s of skipped) console.log(`  ${s.address} — ${s.reason}`);
}

if (!APPLY) { console.log('\n--apply を付けると実際に作成します。'); process.exit(0); }

for (const p of plans) {
    await db.collection('tasks').add({
        groupId: GROUP_ID,
        kind: '修理',
        title: p.title,
        body: p.body,
        posterId: p.posterId,
        address: p.address,
        status: 'open',
        createdBy: CREATED_BY,
        createdAt: p.createdAt,
        notify: false,
    });
}
console.log(`\n${plans.length}件を作成しました。`);
