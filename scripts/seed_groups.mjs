/**
 * Phase 2: groups コレクションの作成と、既存ユーザーへの groupId 割り当て。
 *
 * 本番への影響について:
 *  - `groups` は新規コレクション。現行アプリは一切参照しない。
 *  - `users` には `groupId` フィールドを「追加」するだけ。現行アプリは未知のフィールドを無視する。
 * どちらも現行の動作を変えない。
 *
 * このスクリプトはセキュリティルールをデプロイする「前」に実行しなければならない。
 * 新ルールの isSuperAdmin() は「role=admin かつ 所属グループが allowAll」を要求するため、
 * groupId が未設定のままルールを反映すると、本番の管理者がユーザー管理を行えなくなる。
 */
import { execSync } from 'node:child_process';

const PROJECT = 'satoumasashi-poster-map';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const h = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };

const sv = (s) => ({ stringValue: s });
const bv = (b) => ({ booleanValue: b });
const av = (arr) => ({ arrayValue: { values: arr.map(sv) } });

const GROUPS = [
  { id: 'admin',    name: '佐藤まさし事務所', allowAll: true,  cities: [],          types: [] },
  { id: 'nanba',    name: '難波事務所',       allowAll: false, cities: ['厚木市'],   types: ['佐藤まさし', '難波県議'] },
  { id: 'udagawa',  name: '宇田川事務所',     allowAll: false, cities: ['海老名市'], types: ['佐藤まさし', '長田県議'] },
  { id: 'watanabe', name: '渡辺事務所',       allowAll: false, cities: ['伊勢原市'], types: ['佐藤まさし', '渡辺県議'] },
];

console.log('── groups コレクションの作成 ──');
for (const g of GROUPS) {
  const fields = {
    name: sv(g.name),
    allowAll: bv(g.allowAll),
    cities: av(g.cities),
    types: av(g.types),
  };
  // PATCH（upsert）。既にあれば更新、無ければ作成。
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(`${BASE}/groups/${g.id}?${mask}`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ fields }),
  });
  const j = await res.json();
  if (!res.ok) { console.error(`  ❌ ${g.id}:`, JSON.stringify(j).slice(0, 240)); process.exit(1); }
  const scope = g.allowAll ? '全ポスター' : `${g.cities.join('・')} × ${g.types.join('/')}`;
  console.log(`  ✅ ${g.id.padEnd(9)} ${g.name.padEnd(11)} ${scope}`);
}

console.log('\n── 既存ユーザーへの groupId 割り当て ──');
const uRes = await fetch(`${BASE}/users?pageSize=300`, { headers: h });
const uJson = await uRes.json();
if (!uRes.ok) { console.error('users 取得失敗:', JSON.stringify(uJson).slice(0, 240)); process.exit(1); }

const users = uJson.documents ?? [];
let assigned = 0, kept = 0;
for (const doc of users) {
  const uid = doc.name.split('/').pop();
  const f = doc.fields ?? {};
  const current = f.groupId?.stringValue;
  const label = `${(f.name?.stringValue ?? '(名前なし)').padEnd(22)} ${(f.role?.stringValue ?? '?').padEnd(8)}`;
  if (current) { console.log(`  ・ ${label} 既に ${current} → 変更なし`); kept++; continue; }
  // 指示どおり、既存の全ユーザーアカウントは佐藤まさし事務所に所属させる
  const res = await fetch(`${BASE}/users/${uid}?updateMask.fieldPaths=groupId`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ fields: { groupId: sv('admin') } }),
  });
  if (!res.ok) { console.error(`  ❌ ${uid}:`, JSON.stringify(await res.json()).slice(0, 240)); process.exit(1); }
  console.log(`  ✅ ${label} → admin`);
  assigned++;
}

console.log(`\n合計 ${users.length} 名: 新規割り当て ${assigned} 名 / 既存維持 ${kept} 名`);

// 検証: superAdmin になれるユーザー（role=admin かつ groupId=admin）が存在すること
const vRes = await fetch(`${BASE}/users?pageSize=300`, { headers: h });
const vJson = await vRes.json();
const supers = (vJson.documents ?? []).filter((d) => {
  const f = d.fields ?? {};
  return f.role?.stringValue === 'admin' && f.groupId?.stringValue === 'admin';
});
const ungrouped = (vJson.documents ?? []).filter((d) => !(d.fields ?? {}).groupId?.stringValue);

console.log(`\n検証: superAdmin 相当 ${supers.length} 名 / groupId 未設定 ${ungrouped.length} 名`);
if (supers.length === 0) { console.error('⛔ superAdmin が0名です。ルールをデプロイしてはいけません。'); process.exit(1); }
if (ungrouped.length > 0) { console.error('⛔ groupId 未設定のユーザーが残っています。'); process.exit(1); }
console.log('✅ ルールをデプロイして問題ない状態です。');
