/**
 * 海老名市の「新旧住所対照表」（Excel）を、1つのJSONに束ねる。
 *
 *   node scripts/build_address_map.mjs
 *   → data/address-map.json を出力
 *
 * 市が公開している対照表は地区ごとにファイルが分かれ、しかも様式が揃っていない。
 * 「大字名／番地」を1列にまとめたもの、親番地と枝番地を分けたもの、
 * 見出しが2〜4行あるものなど4系統ある。ここで違いを吸収し、
 *
 *     旧: { 大字, 親番地, 枝番地 } → 新: { 町名, 街区符号, 住居番号 }
 *
 * という同じ形に正規化する。今後ファイルが増えたら
 * このフォルダに置いて再実行すれば取り込まれる（様式が同じなら追加不要）。
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const SRC_DIR = '新旧住所';
const OUT = 'data/address-map.json';

/** 全角数字・記号を半角へ。表記ゆれを吸収する */
const toHalf = (s) => String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ー−‐―－]/g, '-')
    .replace(/　/g, ' ')
    .trim();

/** 「738-5」のような文字列を親番地・枝番地に割る */
const splitBanchi = (v) => {
    const s = toHalf(v).replace(/\s/g, '');
    if (!s) return null;
    const m = s.match(/^(\d+)(?:-(\d+))?/);
    if (!m) return null;
    return { oya: Number(m[1]), eda: m[2] ? Number(m[2]) : null };
};

const num = (v) => {
    const s = toHalf(v).replace(/\s/g, '');
    if (!s) return null;
    const m = s.match(/^\d+/);
    return m ? Number(m[0]) : null;
};

/**
 * 見出し行を探す。
 *
 * ⚠️ 「旧　住　所 / 新　住　所」という大見出しの行が別にあるファイルがあり、
 * 「住所」だけを手がかりにするとそちらを掴んで列が全部ずれる（実際に3ファイルで
 * 0行になった）。列名そのもの（町名）がある行を見出しとする。
 * 「扇町」様式は列名が2行に割れているので、直前の行に「番地」があれば結合する。
 */
const findHeader = (rows) => {
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
        const cells = rows[i].map((c) => String(c ?? '').replace(/\s/g, ''));
        if (cells.some((c) => c === '町名' || c.includes('町名'))) {
            // 直前の行に列名が残っていれば取り込む（扇町様式）
            if (i > 0) {
                const prev = rows[i - 1].map((c) => String(c ?? '').replace(/\s/g, ''));
                if (prev.some((c) => c.includes('番地') || c.includes('大字名'))) {
                    const merged = cells.map((c, k) => c || prev[k] || '');
                    rows[i] = merged;
                }
            }
            return i;
        }
    }
    return -1;
};

const entries = [];
const stats = [];

for (const file of fs.readdirSync(SRC_DIR).sort()) {
    if (!/\.xlsx?$/i.test(file)) continue;
    const wb = XLSX.readFile(path.join(SRC_DIR, file));
    let fileCount = 0;

    for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        const h = findHeader(rows);
        if (h < 0) continue;
        const header = rows[h].map((c) => String(c ?? '').replace(/\s/g, ''));

        // 列の位置を見出しから決める
        const col = (...names) => header.findIndex((c) => names.some((n) => c.includes(n)));
        const iOaza = col('大字名');
        const iOya = col('親番地');
        const iEda = col('枝番地');
        const iBanchi = col('番地');           // 親/枝が分かれていない様式
        const iTown = col('町名');
        const iGaiku = col('街区符号', '街区番号', '街区');
        const iNo1 = col('住居番号1', '住居番号');
        const iNo2 = col('住居番号2');

        if (iTown < 0) continue;

        // シート名から大字を拾う（大字列が無い「扇町」様式のため）
        const titleRow = rows.slice(0, h).map((r) => r.join('')).join(' ');
        const oazaFromTitle = (titleRow.match(/（旧大字名）\s*([^\s（）]+)/) ?? [])[1]
            ?? (titleRow.match(/旧大字名\s*([^\s]+)/) ?? [])[1] ?? '';

        for (const r of rows.slice(h + 1)) {
            const town = toHalf(r[iTown]);
            if (!town || town.includes('町名')) continue;

            const oaza = toHalf(iOaza >= 0 ? r[iOaza] : oazaFromTitle).replace(/\s/g, '');
            if (!oaza) continue;

            // 旧番地: 親/枝が分かれている様式と、1列の様式の両方に対応
            let oya = null, eda = null;
            if (iOya >= 0) {
                oya = num(r[iOya]);
                eda = iEda >= 0 ? num(r[iEda]) : null;
            } else if (iBanchi >= 0) {
                const b = splitBanchi(r[iBanchi]);
                if (b) { oya = b.oya; eda = b.eda; }
            }
            if (oya === null) continue;

            const gaiku = iGaiku >= 0 ? num(r[iGaiku]) : null;
            const no1 = iNo1 >= 0 ? num(r[iNo1]) : null;
            if (gaiku === null || no1 === null) continue;
            const no2 = iNo2 >= 0 ? num(r[iNo2]) : null;

            entries.push({
                oldOaza: oaza,
                oldOya: oya,
                oldEda: eda,
                newTown: town,
                newGaiku: gaiku,
                newNo: no1,
                // 住居番号2 は建物内の部屋番号にあたる。ポスターの照合には使わないが記録は残す
                newNo2: no2,
                source: `${file}#${sheetName}`,
            });
            fileCount++;
        }
    }
    stats.push({ file, count: fileCount });
}

// 重複を畳む。同じ旧住所が複数行（部屋番号違い等）あるため、
// 「旧住所 → 新住所」の対応としては1件にまとめる
const map = new Map();
for (const e of entries) {
    const key = `${e.oldOaza}|${e.oldOya}|${e.oldEda ?? ''}`;
    if (!map.has(key)) {
        map.set(key, {
            oldOaza: e.oldOaza, oldOya: e.oldOya, oldEda: e.oldEda,
            newTown: e.newTown, newGaiku: e.newGaiku, newNo: e.newNo,
            sources: [e.source],
        });
    } else {
        const cur = map.get(key);
        if (!cur.sources.includes(e.source)) cur.sources.push(e.source);
        // 同じ旧住所が別の新住所に割れている場合は印を付けて後で人が見る
        if (cur.newTown !== e.newTown || cur.newGaiku !== e.newGaiku || cur.newNo !== e.newNo) {
            cur.ambiguous = true;
        }
    }
}

const list = [...map.values()].sort((a, b) =>
    a.oldOaza.localeCompare(b.oldOaza, 'ja') || a.oldOya - b.oldOya || (a.oldEda ?? 0) - (b.oldEda ?? 0));

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
    note: '海老名市の新旧住居表示対照表。scripts/build_address_map.mjs で 新旧住所/*.xlsx から生成。',
    generatedAt: new Date().toISOString(),
    sources: stats,
    count: list.length,
    entries: list,
}, null, 1));

console.log('=== 取り込み結果 ===');
for (const s of stats) console.log(`  ${s.file.padEnd(45)} ${s.count}行`);
console.log(`\n生の行数 : ${entries.length}`);
console.log(`旧住所の種類: ${list.length}件`);
console.log(`複数の新住所に割れているもの: ${list.filter((e) => e.ambiguous).length}件`);
const oazas = [...new Set(list.map((e) => e.oldOaza))];
console.log(`対象の旧大字: ${oazas.join('、')}`);
console.log(`\n出力: ${OUT}`);
