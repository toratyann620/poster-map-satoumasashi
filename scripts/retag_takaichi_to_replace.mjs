/**
 * 「高市」タグのピンを「設置済」から「張替え予定」に切り替える。
 *
 *   node scripts/retag_takaichi_to_replace.mjs          # 確認のみ（書き込まない）
 *   node scripts/retag_takaichi_to_replace.mjs --apply  # 実際に書き込む
 *
 * ⚠️ 設置率に直接効く変更。「設置済」を外すぶん、分子がそのまま減る。
 * 実行前に、減る枚数を必ず確認すること。
 *
 * ⚠️ 履歴には statusRemoved: ['設置済'] / statusAdded: ['張替え予定'] を入れる。
 * 日次レポートの「張替え完了」は statusRemoved に '張替え予定' が入った件数を
 * 数えているので、ここで '張替え予定' を**付ける**分は集計に影響しない。
 * 後日この張替えを完了させたときに、はじめて「張替え完了」として数えられる。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');
const TAG = '高市';

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const snap = await db.collection('posters_v2').get();
const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// 撤去済みは触らない（地図にも集計にも出ないため、状態を変える意味がない）
const targets = all.filter((p) => !p.removed && (p.tags || []).includes(TAG) && (p.status || []).includes('設置済'));

const qty = (p) => p.quantity || 1;
const losing = targets.reduce((s, p) => s + qty(p), 0);

// 変更後の設置率を出すために、対象の種類ごとの現状も見ておく
const activeSato = all.filter((p) => !p.removed && p.type === '佐藤まさし');
const total = activeSato.reduce((s, p) => s + qty(p), 0);
const installed = activeSato.filter((p) => (p.status || []).includes('設置済')).reduce((s, p) => s + qty(p), 0);

console.log(APPLY ? '★ 実際に書き込みます' : '確認のみ（書き込みません）');
console.log(`対象: ${targets.length}件 / ${losing}枚（「${TAG}」タグ・撤去済みを除く・「設置済」が付いているもの）\n`);
console.log('設置率への影響（佐藤まさし・撤去済みを除く）');
console.log(`  変更前: ${installed} / ${total} = ${((installed / total) * 100).toFixed(1)}%`);
console.log(`  変更後: ${installed - losing} / ${total} = ${(((installed - losing) / total) * 100).toFixed(1)}%`);
console.log(`  → ${((installed / total) * 100 - ((installed - losing) / total) * 100).toFixed(1)}pt 下がります\n`);

if (!APPLY) {
    console.log('ステータスの内訳（変更前）');
    const byStatus = {};
    for (const p of targets) {
        const k = (p.status || []).slice().sort().join('+') || '(なし)';
        byStatus[k] = (byStatus[k] || 0) + 1;
    }
    for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}件`);
    console.log('\n--apply を付けると実際に書き込みます。');
    process.exit(0);
}

let done = 0;
for (const p of targets) {
    const before = Array.isArray(p.status) ? p.status : [];
    // 「設置済」を外して「張替え予定」を足す。ほかのステータスはそのまま残す
    const after = [...new Set(before.filter((s) => s !== '設置済').concat('張替え予定'))];
    const now = Date.now();

    await db.collection('posters_v2').doc(p.id).update({
        status: after, updatedAt: now, updatedBy: 'システム更新',
    });
    await db.collection('activityLogs_v2').add({
        action: '更新',
        posterId: p.id,
        posterAddress: p.address || '',
        city: p.city || '',
        changedBy: 'システム更新',
        changedByGroupId: 'admin',
        changedAt: now,
        diff: `ステータス: ${before.join(',') || '(なし)'} → ${after.join(',')}（「${TAG}」タグの一括切り替え）`,
        posterType: p.type || '',
        posterStatus: after,
        isNeedsRepair: after.includes('要修理'),
        isNewRegistration: false,
        statusAdded: before.includes('張替え予定') ? [] : ['張替え予定'],
        statusRemoved: ['設置済'],
        removedChangedTo: null,
    });
    done++;
}

console.log(`✅ ${done}件を「張替え予定」に切り替えました。`);
process.exit(0);
