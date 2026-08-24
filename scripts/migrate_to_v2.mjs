/**
 * 現行の本番コレクションから v2 コレクションへの複写。
 *
 *   posters        → posters_v2        （city を付与）
 *   activityLogs   → activityLogs_v2   （city を付与、posterType は既存値）
 *
 * 重要な性質:
 *  - **本番コレクションからは読み取りのみ。書き込みは一切行わない。**
 *    現行のWebアプリは最後まで無傷で動き続ける。
 *  - 冪等。同じドキュメントIDへ PATCH するため、何度実行しても結果は同じ。
 *    Phase 7 の切替時に同じスクリプトで差分を再同期する。
 *
 * `city` は権限判定に使う必須フィールドで、これが無いと
 * 佐藤まさし事務所以外のグループからは一切見えなくなる（安全側の既定動作）。
 *
 * 実行: node scripts/migrate_to_v2.mjs
 *       node scripts/migrate_to_v2.mjs --dry-run   （書き込まずに集計だけ出す）
 */
import { execSync } from 'node:child_process';

const PROJECT = 'satoumasashi-poster-map';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const DRY_RUN = process.argv.includes('--dry-run');

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const h = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };

// src/lib/city.ts の cityFromAddress と同じロジック。
// ここを変えたら向こうも変えること（権限境界の判定が食い違うため）。
const cityFromAddress = (address) => {
    if (!address) return '';
    const s = String(address).trim().replace(/^\s*(北海道|(?:京都|大阪)府|東京都|\S{2,3}県)/, '');
    const m = s.match(/^(.+?[市区町村])/);
    return m ? m[1] : '';
};

const readAll = async (collectionName) => {
    const docs = [];
    let pageToken = '';
    do {
        const url = `${BASE}/${collectionName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url, { headers: h });
        const json = await res.json();
        if (!res.ok) throw new Error(`${collectionName} の読み取りに失敗: ${JSON.stringify(json).slice(0, 300)}`);
        docs.push(...(json.documents ?? []));
        pageToken = json.nextPageToken ?? '';
        process.stdout.write(`\r  ${collectionName}: ${docs.length}件 読み取り済み`);
    } while (pageToken);
    process.stdout.write('\n');
    return docs;
};

// Firestore の commit は1回あたり最大500件
const COMMIT_CHUNK = 400;

const writeAll = async (collectionName, entries) => {
    let written = 0;
    for (let i = 0; i < entries.length; i += COMMIT_CHUNK) {
        const chunk = entries.slice(i, i + COMMIT_CHUNK);
        const writes = chunk.map(({ id, fields }) => ({
            update: {
                name: `projects/${PROJECT}/databases/(default)/documents/${collectionName}/${id}`,
                fields,
            },
            updateMask: { fieldPaths: Object.keys(fields) },
        }));
        const res = await fetch(`${BASE}:commit`, { method: 'POST', headers: h, body: JSON.stringify({ writes }) });
        if (!res.ok) throw new Error(`${collectionName} への書き込みに失敗: ${JSON.stringify(await res.json()).slice(0, 400)}`);
        written += chunk.length;
        process.stdout.write(`\r  ${collectionName}: ${written}/${entries.length}件 書き込み済み`);
    }
    process.stdout.write('\n');
    return written;
};

// ══════════════════════════════════════════════════════════
console.log(DRY_RUN ? '【ドライラン】書き込みは行いません\n' : '');

console.log('── posters を読み取り ──');
const posters = await readAll('posters');

const posterEntries = [];
const cityTally = new Map();
const cityFailures = [];

for (const d of posters) {
    const id = d.name.split('/').pop();
    const fields = { ...d.fields };
    const address = fields.address?.stringValue ?? '';
    // 既に city があれば尊重する（管理画面で手当てした値を上書きしないため）
    const existing = fields.city?.stringValue;
    const city = existing || cityFromAddress(address);
    fields.city = { stringValue: city };
    cityTally.set(city || '(判定不能)', (cityTally.get(city || '(判定不能)') || 0) + 1);
    if (!city) cityFailures.push({ id, address, type: fields.type?.stringValue ?? '' });
    posterEntries.push({ id, fields });
}

console.log('\n── city の付与結果 ──');
[...cityTally.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${String(c).padEnd(14)} ${String(n).padStart(5)}件`));

if (cityFailures.length) {
    console.log(`\n⚠️  市区町村を判定できなかったポスター ${cityFailures.length}件`);
    console.log('   （佐藤まさし事務所のみが扱える状態になります。管理画面の「市区町村の手当て」で修正してください）');
    cityFailures.forEach((f) => console.log(`   ${f.id}  type=${f.type}  address="${f.address}"`));
}

console.log('\n── activityLogs を読み取り ──');
const logs = await readAll('activityLogs');

const logEntries = logs.map((d) => {
    const id = d.name.split('/').pop();
    const fields = { ...d.fields };
    const existing = fields.city?.stringValue;
    fields.city = { stringValue: existing || cityFromAddress(fields.posterAddress?.stringValue ?? '') };
    // posterType が空だと allowAll 以外のグループから読めなくなるため、欠けている場合は明示的に空文字を入れる
    if (!fields.posterType) fields.posterType = { stringValue: '' };
    return { id, fields };
});

const logsWithoutType = logEntries.filter((e) => !e.fields.posterType.stringValue).length;
const logsWithoutCity = logEntries.filter((e) => !e.fields.city.stringValue).length;

console.log(`\n  変更履歴 ${logEntries.length}件（city不明 ${logsWithoutCity}件 / 種別不明 ${logsWithoutType}件）`);
if (logsWithoutType) {
    console.log('   ※ 種別が記録されていない古いログは、佐藤まさし事務所からのみ閲覧可能になります');
}

if (DRY_RUN) {
    console.log('\n【ドライラン】ここで終了します。');
    process.exit(0);
}

console.log('\n── posters_v2 へ書き込み ──');
const pw = await writeAll('posters_v2', posterEntries);

console.log('\n── activityLogs_v2 へ書き込み ──');
const lw = await writeAll('activityLogs_v2', logEntries);

// 検証: 件数が一致するか
const verify = async (name, expected) => {
    let count = 0, pageToken = '';
    do {
        const res = await fetch(`${BASE}/${name}?pageSize=300&mask.fieldPaths=city${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: h });
        const json = await res.json();
        count += (json.documents ?? []).length;
        pageToken = json.nextPageToken ?? '';
    } while (pageToken);
    const ok = count === expected;
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${count}件（期待 ${expected}件）`);
    return ok;
};

console.log('\n── 検証 ──');
const okP = await verify('posters_v2', pw);
const okL = await verify('activityLogs_v2', lw);

console.log(`\n${okP && okL ? '✅ 複写が完了しました。本番の posters / activityLogs は変更していません。' : '❌ 件数が一致しません。'}`);
process.exit(okP && okL ? 0 : 1);
