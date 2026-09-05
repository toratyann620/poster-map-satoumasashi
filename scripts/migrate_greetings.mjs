/**
 * ステータスの「挨拶済」を、独立した挨拶ログへ移す。
 *
 * 挨拶は「済んでいるか」よりも「誰がいつ挨拶したか」が重要なため、
 * 2値のステータスから記録の積み上げに変えた。その際、既にある
 * 「挨拶済」を落とさずに引き継ぐのがこのスクリプトの役目。
 *
 * 誰がいつ挨拶したかの推定:
 *   変更履歴の diff は「その時点の状態」の写しであって差分ではない。
 *   そのため「挨拶済を付けた瞬間」は直接には分からない。
 *   代わりに、そのピンの履歴を古い順に見て **最初に「挨拶済」が現れたログ** を探し、
 *   その記録者と日時を採用する。これが手元のデータで辿れる最も古い証跡になる。
 *   履歴が無いピンは辿れないため、実行日を記録日として残す（記録が消えるよりはよい）。
 *
 * 推定で入れた記録には migrated: true を付ける。画面上でも「旧データ」と分かるようにし、
 * 日付を確定値として扱わないようにするため。
 *
 * 使い方:
 *   node scripts/migrate_greetings.mjs          # 確認のみ（書き込まない）
 *   node scripts/migrate_greetings.mjs --apply  # 実際に書き込む
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const GREETED = '挨拶済';

/** diff 文字列から「ステータス: a,b,c」の部分を取り出す */
const statusFromDiff = (diff) => {
    const m = typeof diff === 'string' ? diff.match(/ステータス:\s*([^/]+)/) : null;
    return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
};

/** そのログの時点で「挨拶済」が付いていたか */
const logHasGreeted = (v) =>
    (v.statusAdded ?? []).includes(GREETED)
    || (v.posterStatus ?? []).includes(GREETED)
    || statusFromDiff(v.diff).includes(GREETED);

const ymd = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ── 履歴を読み込む。v2 と旧コレクションの両方を見る（移行前の記録は旧側にしかない）
const firstGreetedByPoster = new Map();
for (const col of ['activityLogs_v2', 'activityLogs']) {
    const snap = await db.collection(col).get().catch(() => null);
    if (!snap) continue;
    for (const d of snap.docs) {
        const v = d.data();
        if (!v.posterId || !logHasGreeted(v)) continue;
        const at = Number(v.changedAt) || 0;
        if (!at) continue;
        const prev = firstGreetedByPoster.get(v.posterId);
        if (!prev || at < prev.at) {
            firstGreetedByPoster.set(v.posterId, { at, by: v.changedBy || '' });
        }
    }
}

const posters = await db.collection('posters_v2').get();
const targets = posters.docs.filter((d) => (d.data().status ?? []).includes(GREETED));

console.log(`ポスター総数        : ${posters.size}件`);
console.log(`「挨拶済」のピン    : ${targets.length}件`);
console.log(`${APPLY ? '★ 実際に書き込みます' : '確認のみ（書き込みません）'}\n`);

let traced = 0;
let assumedToday = 0;
let skipped = 0;
const todayStr = ymd(Date.now());
const writes = [];

for (const doc of targets) {
    const v = doc.data();

    // 既に挨拶の記録があるピンは触らない（再実行しても重複しないようにする）
    if (Array.isArray(v.greetings) && v.greetings.length > 0) { skipped++; continue; }

    const hit = firstGreetedByPoster.get(doc.id);
    const record = hit
        ? { by: hit.by || '（記録なし）', date: ymd(hit.at), recordedAt: hit.at }
        : { by: '（記録なし）', date: todayStr, recordedAt: Date.now() };
    if (hit) traced++; else assumedToday++;

    writes.push({
        ref: doc.ref,
        address: v.address || '',
        greeting: {
            id: `g_migrated_${doc.id}`,
            by: record.by,
            date: record.date,
            note: hit ? '' : '移行時に挨拶日が特定できなかったため、移行日を記録しています',
            recordedBy: 'システム移行',
            recordedAt: record.recordedAt,
            migrated: true,
        },
        status: (v.status ?? []).filter((s) => s !== GREETED),
    });
}

console.log(`履歴から辿れた      : ${traced}件`);
console.log(`辿れず本日として記録: ${assumedToday}件`);
console.log(`既に記録があり対象外: ${skipped}件\n`);

console.log('=== 書き込む内容の例（先頭5件）===');
for (const w of writes.slice(0, 5)) {
    console.log(`  ${w.address}`);
    console.log(`    挨拶: ${w.greeting.by} / ${w.greeting.date}${w.greeting.migrated ? ' (推定)' : ''}`);
    console.log(`    ステータス: [${w.status.join(', ')}]`);
}

if (!APPLY) {
    console.log('\n--apply を付けると実際に書き込みます。');
    process.exit(0);
}

// ── 書き込み
let done = 0;
for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) {
        batch.update(w.ref, { greetings: [w.greeting], status: w.status });
    }
    await batch.commit();
    done += Math.min(400, writes.length - i);
    console.log(`  ${done}/${writes.length}件 完了`);
}
console.log('\n移行が完了しました。');
