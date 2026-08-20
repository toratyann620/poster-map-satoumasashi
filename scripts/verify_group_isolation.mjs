/**
 * 本番Firestoreに対する、グループ隔離の実地検証。
 *
 * エミュレータのルールテスト（scripts/test_rules.mjs）はルールの論理を検証するもので、
 * こちらは「実際のFirestoreで、アプリが投げるクエリがそのまま通るか」を確かめる。
 * 複合インデックスの不足はエミュレータでは表面化しないため、この検証が必要になる。
 *
 * 実行後、作成した検証用アカウントは削除される。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import crypto from 'node:crypto';

const PROJECT = 'satoumasashi-poster-map';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const adminH = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);

const sv = (s) => ({ stringValue: s });
const dv = (n) => ({ doubleValue: n });
const iv = (n) => ({ integerValue: String(n) });
const arr = (a) => ({ arrayValue: { values: a.map(sv) } });

// ── 検証用ポスターの投入（ルールを迂回する管理者権限で） ────────────
const FIXTURES = [
  { id: 'zz_verify_atsugi_sato', city: '厚木市', type: '佐藤まさし' },
  { id: 'zz_verify_atsugi_nanba', city: '厚木市', type: '難波県議' },
  { id: 'zz_verify_atsugi_goto', city: '厚木市', type: 'ごとう祐一' },
  { id: 'zz_verify_ebina_sato', city: '海老名市', type: '佐藤まさし' },
  { id: 'zz_verify_ebina_osada', city: '海老名市', type: '長田県議' },
  { id: 'zz_verify_isehara_wata', city: '伊勢原市', type: '渡辺県議' },
  { id: 'zz_verify_nocity', city: '', type: '佐藤まさし' },
];

console.log('── 検証用ポスターを投入 ──');
for (const f of FIXTURES) {
  const fields = {
    lat: dv(35.44), lng: dv(139.36), type: sv(f.type), city: sv(f.city),
    status: arr(['設置済']), address: sv(`検証用（${f.city || '市区町村なし'}）`),
    placement: sv(''), quantity: iv(1), owner: sv(''), contact: sv(''), memo: sv(''),
    specialNote: sv(''), imageUrl: sv(''), createdAt: iv(Date.now()), updatedAt: iv(Date.now()),
    createdBy: sv('verify'), updatedBy: sv('verify'),
  };
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const r = await fetch(`${BASE}/posters_v2/${f.id}?${mask}`, { method: 'PATCH', headers: adminH, body: JSON.stringify({ fields }) });
  if (!r.ok) { console.error('投入失敗', f.id, JSON.stringify(await r.json()).slice(0, 200)); process.exit(1); }
}
console.log(`  ${FIXTURES.length} 件を posters_v2 に投入しました`);

// ── 検証用アカウントの作成 ──────────────────────────────────
const ACCOUNTS = [
  { key: 'nanba', groupId: 'nanba', label: '難波事務所' },
  { key: 'udagawa', groupId: 'udagawa', label: '宇田川事務所' },
  { key: 'watanabe', groupId: 'watanabe', label: '渡辺事務所' },
];
const created = [];

console.log('\n── 検証用アカウントを作成 ──');
for (const a of ACCOUNTS) {
  const email = `zz.verify.${a.key}@satoumasashi.com`;
  const password = crypto.randomBytes(18).toString('base64url');
  const su = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const sj = await su.json();
  if (!su.ok) { console.error('作成失敗', email, JSON.stringify(sj).slice(0, 200)); process.exit(1); }
  const uid = sj.localId;
  const fields = { name: sv(`検証:${a.label}`), email: sv(email), role: sv('general'), groupId: sv(a.groupId) };
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const r = await fetch(`${BASE}/users/${uid}?${mask}`, { method: 'PATCH', headers: adminH, body: JSON.stringify({ fields }) });
  if (!r.ok) { console.error('usersドキュメント作成失敗', JSON.stringify(await r.json()).slice(0, 200)); process.exit(1); }
  created.push({ ...a, email, password, uid });
  console.log(`  ✅ ${a.label} (${a.groupId})`);
}

// ── アプリと同じクエリを、各アカウントで実行する ────────────────
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
}, 'verify');
const auth = getAuth(app);
let db;
try { db = initializeFirestore(app, { experimentalForceLongPolling: true }); } catch { db = getFirestore(app); }

const GROUP_SCOPE = {
  nanba: { cities: ['厚木市'], types: ['佐藤まさし', '難波県議'] },
  udagawa: { cities: ['海老名市'], types: ['佐藤まさし', '長田県議'] },
  watanabe: { cities: ['伊勢原市'], types: ['佐藤まさし', '渡辺県議'] },
};

let pass = 0; const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); pass++; }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); fails.push(name); }
};

for (const a of created) {
  console.log(`\n── ${a.label} として検証 ──`);
  await signInWithEmailAndPassword(auth, a.email, a.password);
  const scope = GROUP_SCOPE[a.groupId];

  // 1. アプリと同じ絞り込みクエリ（複合インデックスが効いているかもここで分かる）
  try {
    const snap = await getDocs(query(
      collection(db, 'posters_v2'),
      where('city', 'in', scope.cities),
      where('type', 'in', scope.types),
      orderBy('updatedAt', 'desc'),
    ));
    const got = snap.docs.map((d) => `${d.data().city}/${d.data().type}`);
    const allInScope = got.every((g) => {
      const [c, t] = g.split('/');
      return scope.cities.includes(c) && scope.types.includes(t);
    });
    check('自グループ条件のクエリが成功し、範囲内のみ返る', allInScope, `${snap.size}件: ${[...new Set(got)].join(', ')}`);
  } catch (e) {
    check('自グループ条件のクエリが成功し、範囲内のみ返る', false, String(e.code || e.message).slice(0, 120));
  }

  // 2. 絞り込み無しの全件クエリは拒否されるはず
  try {
    await getDocs(query(collection(db, 'posters_v2'), orderBy('updatedAt', 'desc')));
    check('🔒 絞り込み無しの全件クエリが拒否される', false, '通ってしまった');
  } catch (e) {
    check('🔒 絞り込み無しの全件クエリが拒否される', e.code === 'permission-denied', e.code);
  }

  // 3. 他グループの担当ポスターを直接更新できないこと
  const foreign = a.groupId === 'nanba' ? 'zz_verify_ebina_sato' : 'zz_verify_atsugi_nanba';
  try {
    await updateDoc(doc(db, 'posters_v2', foreign), { memo: '不正な更新' });
    check('🔒 他グループのポスターを更新できない', false, '通ってしまった');
  } catch (e) {
    check('🔒 他グループのポスターを更新できない', e.code === 'permission-denied', e.code);
  }

  // 4. 自グループのポスターは更新できること
  const own = { nanba: 'zz_verify_atsugi_nanba', udagawa: 'zz_verify_ebina_osada', watanabe: 'zz_verify_isehara_wata' }[a.groupId];
  try {
    await updateDoc(doc(db, 'posters_v2', own), { memo: `検証 ${Date.now()}` });
    check('自グループのポスターは更新できる', true);
  } catch (e) {
    check('自グループのポスターは更新できる', false, String(e.code || e.message).slice(0, 120));
  }

  // 5. 管轄外の新規追加ができないこと
  try {
    await addDoc(collection(db, 'posters_v2'), {
      city: '横浜市', type: '佐藤まさし', lat: 35.4, lng: 139.6, status: ['設置済'],
      address: '不正', quantity: 1, createdAt: Date.now(), updatedAt: Date.now(),
    });
    check('🔒 管轄外の新規追加が拒否される', false, '通ってしまった');
  } catch (e) {
    check('🔒 管轄外の新規追加が拒否される', e.code === 'permission-denied', e.code);
  }

  // 6. 変更履歴のグループ絞り込みクエリ（インデックス確認）
  try {
    const snap = await getDocs(query(
      collection(db, 'activityLogs_v2'),
      where('city', 'in', scope.cities),
      where('posterType', 'in', scope.types),
      orderBy('changedAt', 'desc'),
    ));
    check('変更履歴の絞り込みクエリが成功する', true, `${snap.size}件`);
  } catch (e) {
    check('変更履歴の絞り込みクエリが成功する', false, String(e.code || e.message).slice(0, 140));
  }

  await signOut(auth);
}

// ── 後始末 ───────────────────────────────────────────────
console.log('\n── 後始末 ──');
for (const a of created) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`, {
    method: 'POST', headers: adminH, body: JSON.stringify({ localId: a.uid }),
  });
  await fetch(`${BASE}/users/${a.uid}`, { method: 'DELETE', headers: adminH });
  console.log(`  ${r.ok ? '✅' : '❌'} ${a.email} を削除`);
}
if (process.env.KEEP_FIXTURES !== '1') {
  for (const f of FIXTURES) await fetch(`${BASE}/posters_v2/${f.id}`, { method: 'DELETE', headers: adminH });
  console.log(`  ✅ 検証用ポスター ${FIXTURES.length} 件を削除`);
} else {
  console.log('  （KEEP_FIXTURES=1 のため検証用ポスターは残しました）');
}

await deleteApp(app);
console.log(`\n${'═'.repeat(52)}`);
console.log(`  成功 ${pass} 件 / 失敗 ${fails.length} 件`);
console.log('═'.repeat(52));
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exit(1); }
