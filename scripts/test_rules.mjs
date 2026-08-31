/**
 * セキュリティルールの権限境界テスト。
 *
 * 実行:  npm run test:rules
 *   （firebase emulators:exec 経由で Firestore エミュレータ上で実行される。本番には一切触れない）
 *
 * ここで検証しているのは「アプリが正しく絞り込むか」ではなく
 * 「アプリが間違っても、データベースが拒否するか」である。
 * 情報漏洩を防ぐ境界はルール側にあるため、こちらが正典となる。
 */
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc, orderBy,
} from 'firebase/firestore';

const PROJECT_ID = 'rules-test-' + process.env.RULES_TEST_RUN_ID;

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: fs.readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// ── 前提データ（ルールを迂回して投入する）─────────────────────────
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();

  await setDoc(doc(db, 'groups/admin'), { name: '佐藤まさし事務所', allowAll: true, cities: [], types: [] });
  await setDoc(doc(db, 'groups/nanba'), { name: '難波事務所', allowAll: false, cities: ['厚木市'], types: ['佐藤まさし', '難波県議'] });
  await setDoc(doc(db, 'groups/udagawa'), { name: '宇田川事務所', allowAll: false, cities: ['海老名市'], types: ['佐藤まさし', '長田県議'] });

  await setDoc(doc(db, 'users/super1'), { name: '佐藤事務所の管理者', role: 'admin', groupId: 'admin' });
  await setDoc(doc(db, 'users/satoGeneral'), { name: '佐藤事務所の一般', role: 'general', groupId: 'admin' });
  await setDoc(doc(db, 'users/nanbaAdmin'), { name: '難波事務所の管理者', role: 'admin', groupId: 'nanba' });
  await setDoc(doc(db, 'users/nanbaUser'), { name: '難波事務所の一般', role: 'general', groupId: 'nanba' });
  await setDoc(doc(db, 'users/noGroup'), { name: 'グループ未割当', role: 'general' });

  const poster = (over) => ({
    lat: 35.44, lng: 139.36, status: ['設置済'], address: 'テスト住所', placement: '',
    quantity: 1, owner: '', contact: '', memo: '', specialNote: '', imageUrl: '',
    createdAt: 1, updatedAt: 1, createdBy: 'seed', updatedBy: 'seed', ...over,
  });

  await setDoc(doc(db, 'posters_v2/atsugi_sato'), poster({ city: '厚木市', type: '佐藤まさし' }));
  await setDoc(doc(db, 'posters_v2/atsugi_nanba'), poster({ city: '厚木市', type: '難波県議' }));
  await setDoc(doc(db, 'posters_v2/atsugi_goto'), poster({ city: '厚木市', type: 'ごとう祐一' }));
  await setDoc(doc(db, 'posters_v2/ebina_sato'), poster({ city: '海老名市', type: '佐藤まさし' }));
  await setDoc(doc(db, 'posters_v2/nocity_sato'), poster({ city: '', type: '佐藤まさし' }));
  await setDoc(doc(db, 'posters_v2/atsugi_other'), poster({ city: '厚木市', type: 'その他' }));
  await setDoc(doc(db, 'posters_v2/ebina_other'), poster({ city: '海老名市', type: 'その他' }));

  const log = (over) => ({ action: '更新', posterId: 'x', posterAddress: 'a', changedBy: 'seed', changedAt: 1, ...over });
  await setDoc(doc(db, 'activityLogs_v2/log_atsugi'), log({ city: '厚木市', posterType: '佐藤まさし' }));
  await setDoc(doc(db, 'activityLogs_v2/log_ebina'), log({ city: '海老名市', posterType: '佐藤まさし' }));
});

// ── テストランナー ───────────────────────────────────────────
let passed = 0;
const failures = [];
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}`); failures.push({ name, message: String(e).slice(0, 200) }); }
};
const section = (s) => console.log(`\n── ${s} ──`);

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

const P = 'posters_v2';

// ═══════════════════════════════════════════════════════════
section('未認証・グループ未割当のアカウント');

await t('未認証ユーザーはポスターを読めない', () =>
  assertFails(getDoc(doc(anon(), `${P}/atsugi_sato`))));

await t('users ドキュメントを持たないアカウントはポスターを読めない', () =>
  assertFails(getDoc(doc(as('strangerWithAuthOnly'), `${P}/atsugi_sato`))));

await t('groupId 未割当のメンバーはポスターを読めない', () =>
  assertFails(getDoc(doc(as('noGroup'), `${P}/atsugi_sato`))));

// ═══════════════════════════════════════════════════════════
section('佐藤まさし事務所（allowAll）');

await t('全ポスターを読める（自事務所の市区町村以外も）', async () => {
  await assertSucceeds(getDoc(doc(as('satoGeneral'), `${P}/atsugi_sato`)));
  await assertSucceeds(getDoc(doc(as('satoGeneral'), `${P}/ebina_sato`)));
  await assertSucceeds(getDoc(doc(as('satoGeneral'), `${P}/atsugi_goto`)));
});

await t('市区町村が空のポスターも読める（他グループからは不可のもの）', () =>
  assertSucceeds(getDoc(doc(as('satoGeneral'), `${P}/nocity_sato`))));

await t('絞り込み無しの全件クエリが通る', () =>
  assertSucceeds(getDocs(query(collection(as('satoGeneral'), P), orderBy('updatedAt', 'desc')))));

await t('任意のポスターを更新・削除できる', async () => {
  await assertSucceeds(updateDoc(doc(as('satoGeneral'), `${P}/ebina_sato`), { memo: 'ok' }));
  await assertSucceeds(deleteDoc(doc(as('satoGeneral'), `${P}/nocity_sato`)));
});

// ═══════════════════════════════════════════════════════════
section('難波事務所（厚木市 × 佐藤まさし/難波県議）— 閲覧');

await t('自グループ条件のポスターは読める', async () => {
  await assertSucceeds(getDoc(doc(as('nanbaUser'), `${P}/atsugi_sato`)));
  await assertSucceeds(getDoc(doc(as('nanbaUser'), `${P}/atsugi_nanba`)));
});

await t('🔒 市区町村が違うポスターは読めない（海老名市）', () =>
  assertFails(getDoc(doc(as('nanbaUser'), `${P}/ebina_sato`))));

await t('🔒 種別が対象外のポスターは読めない（ごとう祐一）', () =>
  assertFails(getDoc(doc(as('nanbaUser'), `${P}/atsugi_goto`))));

await t('🔒 絞り込み無しの全件クエリは拒否される', () =>
  assertFails(getDocs(query(collection(as('nanbaUser'), P), orderBy('updatedAt', 'desc')))));

await t('🔒 市区町村だけ絞ったクエリも拒否される（種別の条件が無い）', () =>
  assertFails(getDocs(query(collection(as('nanbaUser'), P), where('city', 'in', ['厚木市'])))));

await t('🔒 他グループの条件で問い合わせても拒否される', () =>
  assertFails(getDocs(query(collection(as('nanbaUser'), P),
    where('city', 'in', ['海老名市']), where('type', 'in', ['佐藤まさし'])))));

await t('自グループ条件を明示したクエリは通る', () =>
  assertSucceeds(getDocs(query(collection(as('nanbaUser'), P),
    where('city', 'in', ['厚木市']), where('type', 'in', ['佐藤まさし', '難波県議'])))));

// ═══════════════════════════════════════════════════════════
section('難波事務所 — 編集・削除・新規追加');

await t('自グループ条件のポスターを更新できる', () =>
  assertSucceeds(updateDoc(doc(as('nanbaUser'), `${P}/atsugi_nanba`), { memo: '更新' })));

await t('🔒 他グループのポスターは更新できない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), `${P}/ebina_sato`), { memo: '不正' })));

await t('🔒 他グループのポスターは削除できない', () =>
  assertFails(deleteDoc(doc(as('nanbaUser'), `${P}/ebina_sato`))));

await t('🔒 市区町村を書き換えて管轄外へ送り出せない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), `${P}/atsugi_sato`), { city: '海老名市' })));

await t('🔒 種別を対象外へ書き換えられない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), `${P}/atsugi_sato`), { type: 'ごとう祐一' })));

await t('自グループ条件の新規ポスターを追加できる', () =>
  assertSucceeds(addDoc(collection(as('nanbaUser'), P),
    { city: '厚木市', type: '佐藤まさし', lat: 1, lng: 1, status: [], address: 'x', quantity: 1 })));

await t('🔒 管轄外の新規ポスターは追加できない', () =>
  assertFails(addDoc(collection(as('nanbaUser'), P),
    { city: '海老名市', type: '佐藤まさし', lat: 1, lng: 1, status: [], address: 'x', quantity: 1 })));

await t('🔒 city を省いた新規ポスターは追加できない', () =>
  assertFails(addDoc(collection(as('nanbaUser'), P),
    { type: '佐藤まさし', lat: 1, lng: 1, status: [], address: 'x', quantity: 1 })));

// ═══════════════════════════════════════════════════════════
section('「その他」の種別（どのグループでも扱える）');

await t('自分の市区町村の「その他」は読める', () =>
  assertSucceeds(getDoc(doc(as('nanbaUser'), `${P}/atsugi_other`))));

await t('🔒 他の市区町村の「その他」は読めない（市区町村の条件は効く）', () =>
  assertFails(getDoc(doc(as('nanbaUser'), `${P}/ebina_other`))));

await t('自分の市区町村の「その他」を更新できる', () =>
  assertSucceeds(updateDoc(doc(as('nanbaUser'), `${P}/atsugi_other`), { memo: '更新' })));

await t('自分の市区町村に「その他」を新規追加できる', () =>
  assertSucceeds(addDoc(collection(as('nanbaUser'), P),
    { city: '厚木市', type: 'その他', lat: 1, lng: 1, status: [], address: 'x', quantity: 1 })));

await t('🔒 他の市区町村に「その他」は追加できない', () =>
  assertFails(addDoc(collection(as('nanbaUser'), P),
    { city: '海老名市', type: 'その他', lat: 1, lng: 1, status: [], address: 'x', quantity: 1 })));

await t('「その他」を含めたクエリが通る', () =>
  assertSucceeds(getDocs(query(collection(as('nanbaUser'), P),
    where('city', 'in', ['厚木市']), where('type', 'in', ['佐藤まさし', '難波県議', 'その他'])))));

// ═══════════════════════════════════════════════════════════
section('変更履歴 (activityLogs_v2)');

await t('自グループの履歴は読める', () =>
  assertSucceeds(getDoc(doc(as('nanbaUser'), 'activityLogs_v2/log_atsugi'))));

await t('🔒 他グループの履歴は読めない', () =>
  assertFails(getDoc(doc(as('nanbaUser'), 'activityLogs_v2/log_ebina'))));

await t('佐藤まさし事務所は全履歴を読める', () =>
  assertSucceeds(getDoc(doc(as('satoGeneral'), 'activityLogs_v2/log_ebina'))));

await t('🔒 履歴は改ざんできない（管理者でも更新不可）', () =>
  assertFails(updateDoc(doc(as('super1'), 'activityLogs_v2/log_atsugi'), { changedBy: '改ざん' })));

await t('🔒 履歴は削除できない（管理者でも不可）', () =>
  assertFails(deleteDoc(doc(as('super1'), 'activityLogs_v2/log_atsugi'))));

// ═══════════════════════════════════════════════════════════
section('権限昇格の防止');

await t('🔒 他事務所の管理者は自分の groupId を書き換えられない', () =>
  assertFails(updateDoc(doc(as('nanbaAdmin'), 'users/nanbaAdmin'), { groupId: 'admin' })));

await t('🔒 他事務所の管理者は他人のユーザー情報を変更できない', () =>
  assertFails(updateDoc(doc(as('nanbaAdmin'), 'users/nanbaUser'), { role: 'admin' })));

await t('🔒 一般ユーザーは自分を管理者に昇格できない', () =>
  assertFails(updateDoc(doc(as('satoGeneral'), 'users/satoGeneral'), { role: 'admin' })));

await t('佐藤まさし事務所の管理者はユーザーを作成できる', () =>
  assertSucceeds(setDoc(doc(as('super1'), 'users/newbie'),
    { name: '新規', email: 'a@b.c', role: 'general', groupId: 'nanba' })));

await t('🔒 他事務所の管理者はグループ定義を書き換えられない', () =>
  assertFails(updateDoc(doc(as('nanbaAdmin'), 'groups/nanba'), { cities: ['厚木市', '海老名市'] })));

await t('佐藤まさし事務所の管理者はグループ定義を変更できる', () =>
  assertSucceeds(updateDoc(doc(as('super1'), 'groups/nanba'), { cities: ['厚木市'] })));

await t('メンバーはグループ定義を読める（クエリ組み立てに必要）', () =>
  assertSucceeds(getDoc(doc(as('nanbaUser'), 'groups/nanba'))));

// ═══════════════════════════════════════════════════════════
section('通知の既読状態 (notificationReads)');

await t('自分の既読状態を書き込める', () =>
  assertSucceeds(setDoc(doc(as('nanbaUser'), 'notificationReads/nanbaUser_2026-08-20'),
    { userId: 'nanbaUser', date: '2026-08-20', readAt: 1 })));

await t('自分の既読状態を読める', () =>
  assertSucceeds(getDoc(doc(as('nanbaUser'), 'notificationReads/nanbaUser_2026-08-20'))));

await t('🔒 他人の既読状態は読めない', () =>
  assertFails(getDoc(doc(as('nanbaUser'), 'notificationReads/satoGeneral_2026-08-20'))));

await t('🔒 他人の既読状態は書き換えられない', () =>
  assertFails(setDoc(doc(as('nanbaUser'), 'notificationReads/satoGeneral_2026-08-20'),
    { userId: 'satoGeneral', date: '2026-08-20', readAt: 1 })));

// ═══════════════════════════════════════════════════════════
section('お知らせ (announcements)');

await t('佐藤まさし事務所の管理者はお知らせを出せる', () =>
  assertSucceeds(setDoc(doc(as('super1'), 'announcements/a1'),
    { title: 'お知らせ', body: '本文', isPopup: false, publishedAt: 1, createdBy: '管理者' })));

await t('他事務所のメンバーもお知らせを読める（事務所をまたいで届く）', () =>
  assertSucceeds(getDoc(doc(as('nanbaUser'), 'announcements/a1'))));

await t('🔒 他事務所の管理者はお知らせを出せない', () =>
  assertFails(setDoc(doc(as('nanbaAdmin'), 'announcements/a2'),
    { title: '勝手なお知らせ', body: '本文', isPopup: true, publishedAt: 1, createdBy: '難波' })));

await t('🔒 一般ユーザーはお知らせを消せない', () =>
  assertFails(deleteDoc(doc(as('satoGeneral'), 'announcements/a1'))));

await t('🔒 users ドキュメントを持たないアカウントはお知らせを読めない', () =>
  assertFails(getDoc(doc(as('strangerWithAuthOnly'), 'announcements/a1'))));

// ═══════════════════════════════════════════════════════════
section('初期パスワードの変更記録 (users.mustChangePassword)');

await t('本人は mustChangePassword を false にできる', () =>
  assertSucceeds(updateDoc(doc(as('nanbaUser'), 'users/nanbaUser'), { mustChangePassword: false })));

await t('🔒 本人でも他のフィールドを同時には変えられない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), 'users/nanbaUser'),
    { mustChangePassword: false, role: 'admin' })));

await t('🔒 本人でも mustChangePassword を true には戻せない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), 'users/nanbaUser'), { mustChangePassword: true })));

await t('🔒 他人の mustChangePassword は変えられない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), 'users/satoGeneral'), { mustChangePassword: false })));

await t('🔒 この例外を使って groupId は書き換えられない', () =>
  assertFails(updateDoc(doc(as('nanbaUser'), 'users/nanbaUser'), { groupId: 'admin' })));

// ═══════════════════════════════════════════════════════════
section('プッシュ通知のトークン (pushTokens)');

const pushDoc = (uid) => ({ uid, token: `tok_${uid}`, platform: 'ios', updatedAt: 1 });

await t('自分のトークンを登録できる', () =>
  assertSucceeds(setDoc(doc(as('nanbaUser'), 'pushTokens/tok_nanbaUser'), pushDoc('nanbaUser'))));

await t('同じ端末から登録し直せる（上書き）', () =>
  assertSucceeds(setDoc(doc(as('nanbaUser'), 'pushTokens/tok_nanbaUser'), pushDoc('nanbaUser'))));

await t('自分のトークンを削除できる（ログアウト時）', async () => {
  await assertSucceeds(deleteDoc(doc(as('nanbaUser'), 'pushTokens/tok_nanbaUser')));
  await setDoc(doc(as('nanbaUser'), 'pushTokens/tok_nanbaUser'), pushDoc('nanbaUser'));
});

await t('🔒 他人になりすましてトークンを登録できない', () =>
  assertFails(setDoc(doc(as('nanbaUser'), 'pushTokens/tok_evil'), pushDoc('satoGeneral'))));

await t('🔒 他人のトークンを削除できない', () =>
  assertFails(deleteDoc(doc(as('satoGeneral'), 'pushTokens/tok_nanbaUser'))));

await t('🔒 管理者でもトークンを読めない（誰がどの端末かを見せない）', () =>
  assertFails(getDoc(doc(as('super1'), 'pushTokens/tok_nanbaUser'))));

await t('🔒 users ドキュメントを持たないアカウントは登録できない', () =>
  assertFails(setDoc(doc(as('strangerWithAuthOnly'), 'pushTokens/tok_stranger'),
    pushDoc('strangerWithAuthOnly'))));

// ═══════════════════════════════════════════════════════════
section('作業の依頼 (tasks)');

const task = (over) => ({
  groupId: 'nanba', title: '張り替えのお願い', body: '', kind: '張替え',
  status: 'open', createdBy: 'seed', createdAt: 1, ...over,
});

await t('自事務所あての依頼を作れる', () =>
  assertSucceeds(setDoc(doc(as('nanbaAdmin'), 'tasks/t1'), task())));

await t('同じ事務所の一般ユーザーが読める', () =>
  assertSucceeds(getDoc(doc(as('nanbaUser'), 'tasks/t1'))));

await t('担当者でなくても完了にできる（代わりに済ませることがあるため）', () =>
  assertSucceeds(updateDoc(doc(as('nanbaUser'), 'tasks/t1'),
    { status: 'done', completedBy: '難波事務所の一般', completedAt: 2 })));

await t('佐藤まさし事務所は他事務所の依頼も読める', () =>
  assertSucceeds(getDoc(doc(as('super1'), 'tasks/t1'))));

await t('佐藤まさし事務所は他事務所あての依頼を作れる', () =>
  assertSucceeds(setDoc(doc(as('super1'), 'tasks/t2'), task({ groupId: 'nanba', createdBy: '佐藤事務所' }))));

await t('🔒 他事務所の依頼は読めない', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'tasks/t_other'), { ...task(), groupId: 'udagawa' });
  });
  await assertFails(getDoc(doc(as('nanbaUser'), 'tasks/t_other')));
});

await t('🔒 他事務所あての依頼は作れない', () =>
  assertFails(setDoc(doc(as('nanbaAdmin'), 'tasks/t3'), task({ groupId: 'udagawa' }))));

await t('🔒 依頼を別の事務所へ付け替えられない', () =>
  assertFails(updateDoc(doc(as('nanbaAdmin'), 'tasks/t1'), { groupId: 'udagawa' })));

await t('🔒 一般ユーザーは依頼を削除できない', () =>
  assertFails(deleteDoc(doc(as('nanbaUser'), 'tasks/t1'))));

await t('管理者は依頼を削除できる', () =>
  assertSucceeds(deleteDoc(doc(as('nanbaAdmin'), 'tasks/t2'))));

await t('🔒 users ドキュメントを持たないアカウントは依頼を読めない', () =>
  assertFails(getDoc(doc(as('strangerWithAuthOnly'), 'tasks/t1'))));

// ═══════════════════════════════════════════════════════════
section('現行の本番コレクション（動作を変えていないこと）');

await t('承認済みメンバーは現行 posters を読み書きできる', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'posters/legacy1'), { type: '佐藤まさし', address: 'x' });
  });
  await assertSucceeds(getDoc(doc(as('nanbaUser'), 'posters/legacy1')));
  await assertSucceeds(updateDoc(doc(as('nanbaUser'), 'posters/legacy1'), { memo: 'ok' }));
});

await t('🔒 users ドキュメントを持たないアカウントは現行 posters も読めない', () =>
  assertFails(getDoc(doc(as('strangerWithAuthOnly'), 'posters/legacy1'))));

// ═══════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(56)}`);
console.log(`  成功 ${passed} 件 / 失敗 ${failures.length} 件`);
console.log('═'.repeat(56));
if (failures.length) {
  failures.forEach((f) => console.log(`\n❌ ${f.name}\n   ${f.message}`));
}
await testEnv.cleanup();
process.exit(failures.length ? 1 : 0);
