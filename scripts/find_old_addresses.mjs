/**
 * 旧住所のまま登録されているポスターを洗い出す。
 *
 *   node scripts/find_old_addresses.mjs
 *   → data/old-address-pins.json（変更案）と、一覧の表示
 *
 * 照合は「海老名市 + 旧大字名 + 番地」で行う。data/address-map.json の
 * 旧住所（大字・親番地・枝番地）と突き合わせ、一致したものを変更対象とする。
 *
 * ⚠️ 枝番地の扱いに注意。対照表は枝番地まで含めて1件ずつ対応が決まっており、
 * 「大谷1234-5」と「大谷1234-6」で新住所が違うことがある。親番地だけの一致で
 * 代表を当てると、隣家の住所を当ててしまう。枝番地まで一致した場合のみ確実とし、
 * 親番地しか無い／枝番が対照表に無い場合は「要確認」として分けて出す。
 */
import fs from 'node:fs';
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const { entries } = JSON.parse(fs.readFileSync('data/address-map.json', 'utf8'));

const toHalf = (s) => String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ー−‐―－]/g, '-')
    .replace(/　/g, ' ');

// 旧大字名の一覧（照合の入口を絞る）
const oazaSet = [...new Set(entries.map((e) => e.oldOaza))];

// 索引: 「大字|親|枝」と「大字|親」の2段
const byExact = new Map();
const byOya = new Map();
for (const e of entries) {
    byExact.set(`${e.oldOaza}|${e.oldOya}|${e.oldEda ?? ''}`, e);
    const k = `${e.oldOaza}|${e.oldOya}`;
    if (!byOya.has(k)) byOya.set(k, []);
    byOya.get(k).push(e);
}

/**
 * 住所文字列から「旧大字 + 番地」を取り出す。
 *
 * ⚠️ 除外の条件が要。実際に次の2つで誤検出した:
 *  1. 「東柏ケ谷」は独立した町名だが「柏ケ谷」を含むため、部分一致だと拾ってしまう。
 *     → 大字名の直前が「市」か地名の切れ目であることを要求する。
 *  2. 「東柏ケ谷4-11-4」のような**3段の番地はすでに住居表示済み**（丁目-街区-住居番号を
 *     ハイフンで書いた形）。これを旧番地とみなすと「柏ケ谷五丁目47-3 -4」という
 *     出鱈目な住所を作ってしまう。
 * 旧住所は「大字 + 番地（枝番まで＝最大2段）」の形にしか成りえないので、
 * 3段以上の番地は最初から対象外とする。
 */
const parseOld = (address) => {
    const a = toHalf(address).replace(/\s+/g, ' ');
    // 「丁目」を含む住所は既に新住居表示。対象外
    if (/丁目/.test(a)) return null;
    // 3段以上の番地（1-2-3）は住居表示済みとみなす
    if (/\d+\s*-\s*\d+\s*-\s*\d+/.test(a)) return null;

    for (const oaza of oazaSet) {
        const i = a.indexOf(oaza);
        if (i < 0) continue;
        // 「東柏ケ谷」を「柏ケ谷」と誤認しないよう、直前が市名か区切りであることを要求
        const before = a[i - 1] ?? '';
        if (before && !'市 　'.includes(before)) continue;
        // 大字名の直後に数字が続くこと（「大谷南」のような別地名を誤検出しない）
        const rest = a.slice(i + oaza.length);
        const m = rest.match(/^\s*(\d+)(?:\s*-\s*(\d+))?/);
        if (!m) continue;
        return {
            oaza,
            oya: Number(m[1]),
            eda: m[2] ? Number(m[2]) : null,
            // 番地より後ろに残る文字（建物名など）は新住所でも残す
            tail: rest.slice(m[0].length).trim(),
        };
    }
    return null;
};

const formatNew = (e, tail) => {
    const base = `神奈川県海老名市${e.newTown}${e.newGaiku}-${e.newNo}`;
    return tail ? `${base} ${tail}` : base;
};

const snap = await db.collection('posters_v2').where('city', '==', '海老名市').get();
const exact = [];
const needsCheck = [];
const skipped = [];

for (const d of snap.docs) {
    const v = d.data();
    const parsed = parseOld(v.address);
    if (!parsed) continue;

    const hitExact = byExact.get(`${parsed.oaza}|${parsed.oya}|${parsed.eda ?? ''}`);
    const row = {
        id: d.id,
        type: v.type,
        removed: !!v.removed,
        oldAddress: v.address,
        memo: v.memo ?? '',
        lat: v.lat, lng: v.lng,
        parsed,
    };

    if (hitExact) {
        exact.push({ ...row, newAddress: formatNew(hitExact, parsed.tail), match: '枝番まで一致' });
        continue;
    }
    // 枝番なしで登録されている／対照表に該当の枝番が無い場合
    const cands = byOya.get(`${parsed.oaza}|${parsed.oya}`) ?? [];
    if (cands.length === 0) { skipped.push({ ...row, reason: '対照表に該当なし' }); continue; }
    const uniq = [...new Set(cands.map((c) => `${c.newTown}${c.newGaiku}-${c.newNo}`))];

    // ⚠️ 登録側に枝番があるのに、対照表のその枝番が無い場合は自動変換しない。
    // 枝番は1つずつ別の新住所に対応するため、別の枝番の行を当てると
    // 「隣の家の住所」になってしまう（河原口1369-3 を 1369-5 の行で変換すると
    // 約950m離れた場所になる例があった）。
    if (parsed.eda !== null) {
        needsCheck.push({
            ...row,
            candidates: cands.map((c) => `${parsed.oaza}${c.oldOya}-${c.oldEda ?? ''} → ${c.newTown}${c.newGaiku}-${c.newNo}`),
            reason: `枝番 -${parsed.eda} が対照表に無い（他の枝番の行はある）`,
        });
        continue;
    }

    if (uniq.length === 1) {
        exact.push({ ...row, newAddress: formatNew(cands[0], parsed.tail), match: '親番地一致（新住所は1つ）' });
    } else {
        needsCheck.push({ ...row, candidates: uniq, reason: `親番地は一致するが新住所が${uniq.length}通り` });
    }
}

fs.writeFileSync('data/old-address-pins.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    exact, needsCheck, skipped,
}, null, 1));

console.log(`海老名市のポスター: ${snap.size}件\n`);
console.log(`■ 変換できるもの: ${exact.length}件`);
for (const r of exact) {
    console.log(`  ${r.removed ? '[撤去済] ' : ''}${r.oldAddress}`);
    console.log(`      → ${r.newAddress}   (${r.match})`);
}
console.log(`\n■ 要確認（新住所が複数通り）: ${needsCheck.length}件`);
for (const r of needsCheck) {
    console.log(`  ${r.oldAddress}  候補: ${r.candidates.join(' / ')}`);
}
console.log(`\n■ 対照表に無い（旧大字名だが対応行なし）: ${skipped.length}件`);
for (const r of skipped.slice(0, 20)) console.log(`  ${r.oldAddress}`);
if (skipped.length > 20) console.log(`  …ほか ${skipped.length - 20}件`);
console.log('\n出力: data/old-address-pins.json');
