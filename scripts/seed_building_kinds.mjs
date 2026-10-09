/**
 * 建物ピンの種類（settings/buildingKinds）を設定する。
 *
 *   node scripts/seed_building_kinds.mjs          # 現状の確認のみ
 *   node scripts/seed_building_kinds.mjs --apply  # 書き込む
 *
 * この文書が無ければ、アプリは src/types/index.ts の BUILDING_KINDS を使う。
 * 種類を増やしたいときにここへ書けば、**アプリを配信し直さずに**反映される。
 * 色は地図のマーカーの色になる。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');
admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const kinds = [
    { name: '自治会掲示板', color: '#0D9488' },
    { name: '自治会館', color: '#7C3AED' },
    { name: 'その他', color: '#64748B' },
];

const ref = db.collection('settings').doc('buildingKinds');
const cur = await ref.get();
console.log('現在:', cur.exists ? JSON.stringify(cur.data()?.kinds) : '(未設定。コード側の既定値が使われている)');
console.log(`${APPLY ? '設定する' : '設定予定'}:`);
for (const k of kinds) console.log(`  ${k.name.padEnd(8)} ${k.color}`);

if (APPLY) {
    await ref.set({ kinds, updatedAt: Date.now() }, { merge: true });
    console.log('\n✅ 書き込み完了');
} else {
    console.log('\n--apply を付けると実際に書き込みます。');
}
process.exit(0);
