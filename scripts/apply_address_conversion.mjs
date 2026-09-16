/**
 * 旧住所のピンを新住居表示へ切り替える（data/old-address-pins.json の exact を反映）。
 *
 *   node scripts/apply_address_conversion.mjs          # 確認のみ（書き込まない）
 *   node scripts/apply_address_conversion.mjs --apply  # 実際に書き込む
 *
 * 1件ごとに次を行う:
 *   - address を新住所に置き換える
 *   - memo の末尾に「旧住所表記：<元の住所>」を追記する（元の表記を失わないため）
 *   - lat / lng を新住所の緯度経度に置き換える（find_old_addresses で取得済み・ROOFTOP のみ）
 *   - 変更履歴（activityLogs_v2）に「更新」を1件残す（ピンの「ログ」タブから経緯を追えるように）
 *
 * ⚠️ 書き込む前に、DB の現在の住所が変更案を作った時点と同じであることを確かめる。
 * 変更案の生成後に誰かが住所を直していたら、その1件はスキップして人に判断を戻す。
 */
import fs from 'node:fs';
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');
admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

// 既定は照合スクリプトの出力。現地確認で個別に決めた分は PLAN=<jsonのパス> で渡せる
// （同じ形: { exact: [{ id, oldAddress, newAddress, geo:{lat,lng,precision}, moved }] }）
const plan = JSON.parse(fs.readFileSync(process.env.PLAN || 'data/old-address-pins.json', 'utf8'));
const targets = plan.exact.filter((r) => r.geo?.lat && r.geo?.lng && r.geo.precision === 'ROOFTOP');

console.log(APPLY ? '★ 実際に書き込みます' : '確認のみ（書き込みません）');
console.log(`対象: ${targets.length}件（変更案 ${plan.exact.length}件のうち座標が番地レベルで確定したもの）\n`);

let done = 0;
const skipped = [];

for (const r of targets) {
    const ref = db.collection('posters_v2').doc(r.id);
    const snap = await ref.get();
    if (!snap.exists) { skipped.push({ ...r, reason: 'ピンが削除されている' }); continue; }
    const cur = snap.data();

    // 変更案を作ったときと住所が変わっていたら触らない
    if (cur.address !== r.oldAddress) {
        skipped.push({ ...r, reason: `住所が変更案と違う（現在: "${cur.address}"）` });
        continue;
    }

    const oldMemo = String(cur.memo ?? '').trim();
    const note = `旧住所表記：${r.oldAddress}`;
    const newMemo = oldMemo ? `${oldMemo}\n${note}` : note;

    console.log(`${done + 1}. ${r.oldAddress}`);
    console.log(`   住所  → ${r.newAddress}`);
    console.log(`   備考  → ${JSON.stringify(newMemo)}`);
    console.log(`   座標  → ${r.geo.lat}, ${r.geo.lng}（${r.moved}m 移動）`);

    if (APPLY) {
        const now = Date.now();
        await ref.update({
            address: r.newAddress,
            memo: newMemo,
            lat: r.geo.lat,
            lng: r.geo.lng,
            updatedAt: now,
            updatedBy: 'システム移行',
        });
        // ピンのログから経緯を追えるようにする。日次レポートの4指標には影響しない
        // （新規は createdAt、撤去は removedChangedTo、張替え・修理は status の変化で数えるため）
        await db.collection('activityLogs_v2').add({
            action: '更新',
            posterId: r.id,
            posterAddress: r.newAddress,
            city: cur.city || '海老名市',
            changedBy: 'システム移行',
            changedByGroupId: 'admin',
            changedAt: now,
            diff: `住所を新住居表示へ変更: ${r.oldAddress} → ${r.newAddress}（${r.basis || '海老名市の新旧対照表に基づく'}。位置も ${r.moved}m 調整）`,
            posterType: cur.type || '',
            posterStatus: Array.isArray(cur.status) ? cur.status : [],
            isNeedsRepair: false,
            isNewRegistration: false,
            statusAdded: [],
            statusRemoved: [],
            removedChangedTo: null,
        });
        console.log('   → 書き込み完了');
    }
    done++;
    console.log();
}

console.log(`${APPLY ? '反映' : '反映予定'}: ${done}件 / スキップ: ${skipped.length}件`);
for (const s of skipped) console.log(`  スキップ: ${s.oldAddress} — ${s.reason}`);
if (!APPLY) console.log('\n--apply を付けると実際に書き込みます。');
