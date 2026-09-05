/**
 * ポスターの種類の名称を変更し、新しい種類を追加する。
 *
 *   node scripts/rename_poster_types.mjs          # 確認のみ（書き込まない）
 *   node scripts/rename_poster_types.mjs --apply  # 実際に書き込む
 *
 * ⚠️ 順番が重要。
 * 種類は「市区町村 × 種別」というグループの権限判定に使われている。
 * ポスターの種類を先に変えると、グループの `types` にはまだ旧名しか無いため、
 * その瞬間に該当事務所からポスターが**見えなくなり、書き込みも拒否される**。
 *
 * そのため次の順で進める:
 *   1. グループの types に「旧名と新名の両方」を入れる（どちらでも通る状態にする）
 *   2. posters_v2 / activityLogs_v2 / activityLogs の種類を置き換える
 *   3. グループの types から旧名を外す
 *   4. settings/pinTypes を置き換え、新しい種類を追加する
 *
 * 変更履歴（activityLogs）も対象にするのは、履歴の閲覧権限が posterType で
 * 判定されているため。ここを置き換えないと、該当事務所から過去の履歴が消える。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

/** 旧名 → 新名 */
const RENAME = {
    '難波県議': 'なんばたつや',
    '長田県議': 'おさだ進治',
    '渡辺県議': '渡辺のりゆき',
    '山口市長': '山口たかひろ',
};

/** 追加する種類と、その挿入位置（この種類の直後に入れる） */
const ADD = { name: 'うだがわ希', color: '#7E22CE', after: 'おさだ進治' };

const log = (...a) => console.log(...a);
const commitAll = async (writes, label) => {
    if (!APPLY) return;
    for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        for (const w of writes.slice(i, i + 400)) batch.update(w.ref, w.data);
        await batch.commit();
    }
    if (writes.length) log(`    → ${writes.length}件を更新しました（${label}）`);
};

log(APPLY ? '★ 実際に書き込みます\n' : '確認のみ（書き込みません）\n');
log('変更内容:');
for (const [a, b] of Object.entries(RENAME)) log(`  ${a}  →  ${b}`);
log(`  ＋ ${ADD.name}（${ADD.color}）を「${ADD.after}」の直後に追加\n`);

// ── 1. グループの types を「旧名＋新名」に広げる ───────────────
log('[1] グループの権限を先に広げる（旧名と新名の両方を許可）');
const groups = await db.collection('groups').get();
const groupWrites = [];
for (const d of groups.docs) {
    const types = d.data().types ?? [];
    const hit = types.filter((t) => RENAME[t]);
    if (!hit.length) continue;
    const widened = [...new Set([...types, ...hit.map((t) => RENAME[t])])];
    log(`  ${d.id}: ${JSON.stringify(types)} → ${JSON.stringify(widened)}`);
    groupWrites.push({ ref: d.ref, data: { types: widened } });
}
if (!groupWrites.length) log('  対象なし');
await commitAll(groupWrites, 'groups');

// ── 2. ポスターと変更履歴を置き換える ─────────────────────────
log('\n[2] ポスターと変更履歴の種類を置き換える');
const targets = [
    { col: 'posters_v2', field: 'type' },
    { col: 'activityLogs_v2', field: 'posterType' },
    { col: 'activityLogs', field: 'posterType' },
];
for (const { col, field } of targets) {
    const snap = await db.collection(col).get().catch(() => null);
    if (!snap) { log(`  ${col}: 取得できませんでした`); continue; }
    const writes = [];
    const counts = {};
    let diffHits = 0;
    for (const d of snap.docs) {
        const v = d.data();
        const data = {};

        const next = RENAME[v[field]];
        if (next) {
            counts[v[field]] = (counts[v[field]] ?? 0) + 1;
            data[field] = next;
        }

        // ⚠️ 変更履歴の diff は「種類: 難波県議」のような文章として保存されている。
        // ここを置き換えないと、フィールドを直しても**画面の変更履歴には旧名が出続ける**。
        if (typeof v.diff === 'string') {
            let text = v.diff;
            for (const [a, b] of Object.entries(RENAME)) text = text.split(a).join(b);
            if (text !== v.diff) { data.diff = text; diffHits++; }
        }

        if (Object.keys(data).length) writes.push({ ref: d.ref, data });
    }
    const detail = Object.entries(counts).map(([k, v]) => `${k} ${v}件`).join(' / ') || '対象なし';
    log(`  ${col}.${field}: ${detail}${diffHits ? ` / 差分の文章 ${diffHits}件` : ''}`);
    await commitAll(writes, `${col}.${field}`);
}

// ── 3. グループから旧名を外す ────────────────────────────────
log('\n[3] グループから旧名を外す');
if (APPLY) {
    const after = await db.collection('groups').get();
    const trimWrites = [];
    for (const d of after.docs) {
        const types = d.data().types ?? [];
        const trimmed = types.filter((t) => !RENAME[t]);
        if (trimmed.length === types.length) continue;
        log(`  ${d.id}: ${JSON.stringify(types)} → ${JSON.stringify(trimmed)}`);
        trimWrites.push({ ref: d.ref, data: { types: trimmed } });
    }
    await commitAll(trimWrites, 'groups');
    if (!trimWrites.length) log('  対象なし');
} else {
    for (const w of groupWrites) {
        log(`  ${w.ref.id}: 旧名を外して ${JSON.stringify(w.data.types.filter((t) => !RENAME[t]))} になります`);
    }
    if (!groupWrites.length) log('  対象なし');
}

// ── 4. 種類の一覧（画面に出る名前と色）を置き換える ───────────
log('\n[4] settings/pinTypes を置き換え、新しい種類を追加する');
const ref = db.collection('settings').doc('pinTypes');
const cur = (await ref.get()).data() ?? {};
const list = (cur.types ?? []).map((t) => ({ ...t, name: RENAME[t.name] ?? t.name }));

if (list.some((t) => t.name === ADD.name)) {
    log(`  ${ADD.name} は既にあります`);
} else {
    const at = list.findIndex((t) => t.name === ADD.after);
    const insertAt = at >= 0 ? at + 1 : list.length;
    list.splice(insertAt, 0, { name: ADD.name, color: ADD.color });
    log(`  ${ADD.name} を ${insertAt + 1} 番目に挿入`);
}
log('  結果: ' + list.map((t) => t.name).join(' / '));
if (APPLY) {
    await ref.set({ types: list }, { merge: true });
    log('    → 更新しました');
}

log(APPLY ? '\n完了しました。' : '\n--apply を付けると実際に書き込みます。');
