/**
 * 切替後に、旧コレクション（posters）へ取り残された変更が無いかを確認する。
 *
 * データ同期からWebのデプロイまでの間に、まだ旧環境を見ていたPCユーザーが
 * 編集した分は v1 にだけ残る。切替直後に一度実行して、差が無いことを確かめる。
 *
 * 読み取りのみ。何も書き込まない。
 *   node scripts/check_drift.mjs
 */
import { execSync } from 'node:child_process';

const PROJECT = 'satoumasashi-poster-map';
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const h = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT };
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const readAll = async (col) => {
    const out = new Map();
    let pageToken = '';
    do {
        const url = `${BASE}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const r = await (await fetch(url, { headers: h })).json();
        (r.documents ?? []).forEach((d) => {
            const id = d.name.split('/').pop();
            const f = d.fields ?? {};
            out.set(id, {
                updatedAt: Number(f.updatedAt?.integerValue ?? f.updatedAt?.doubleValue ?? 0),
                address: f.address?.stringValue ?? '',
                updatedBy: f.updatedBy?.stringValue ?? '',
            });
        });
        pageToken = r.nextPageToken ?? '';
    } while (pageToken);
    return out;
};

const [v1, v2] = await Promise.all([readAll('posters'), readAll('posters_v2')]);
const behind = [];
v1.forEach((a, id) => {
    const b = v2.get(id);
    if (!b) { behind.push({ id, ...a, why: 'v2 に無い' }); return; }
    if (a.updatedAt > b.updatedAt) behind.push({ id, ...a, why: 'v1 の方が新しい' });
});

console.log(`旧 posters ${v1.size}件 / 新 posters_v2 ${v2.size}件`);
if (behind.length === 0) {
    console.log('✅ 取り残された変更はありません。切替は完了しています。');
} else {
    console.log(`⚠️  旧環境にのみ残っている変更が ${behind.length}件 あります:`);
    behind.forEach((x) => console.log(
        `   ${x.address.slice(0, 30)} / ${new Date(x.updatedAt).toLocaleString('ja-JP')} / ${x.updatedBy} (${x.why})`));
    console.log('\n   node scripts/migrate_to_v2.mjs を実行すると取り込めます。');
    console.log('   ※ ただし切替後にアプリ側で同じピンを編集していると上書きされます。');
}
