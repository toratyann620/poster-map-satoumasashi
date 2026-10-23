/**
 * 住所が違うのに同じ緯度経度になっているピンを、住所どおりの位置へ置き直す。
 *
 *   node scripts/fix_duplicate_coords.mjs            # 確認のみ（書き込まない）
 *   node scripts/fix_duplicate_coords.mjs --apply    # 実際に書き込む
 *
 * 番地を地図で引けなかったとき、Google は「その大字の代表点」を返す。
 * それをそのまま保存すると、別々の住所のピンが1点に積み重なる。
 *
 * 位置は **国土地理院の住所検索**（msearch.gsi.go.jp）で引き直す。
 * 理由は2つ:
 *  - 旧地番（住居表示の前の「〇〇123番地」）をそのまま引ける。Google は
 *    旧地番だと代表点に落ちることが多い。
 *  - 鍵が要らない。このプロジェクトの Maps の鍵はリファラー制限付きで、
 *    サーバーからは Geocoding API を呼べない。
 *
 * ⚠️ 住所は変えない。座標だけ直す。住所の新旧変換は別の作業
 * （scripts/apply_address_conversion.mjs）で、事務所の確認を取ってから行う。
 *
 * ⚠️ 書き込む前に、DBの住所と座標が想定どおりかを必ず確かめる。
 * 誰かが先に直していたら、その1件は飛ばして人に判断を戻す。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');

/**
 * 直す対象。
 *   address … いまDBに入っている住所（これと違っていたら触らない）
 *   expect  … いま重なっている座標（これと違っていたら触らない＝誰かが先に直した）
 *   query   … 位置を引くときに使う住所
 *   basis   … なぜその住所で引いたか。履歴に残す
 */
const TARGETS = [
    // ── 1回目: 「柏ケ谷」の代表点に4件が重なっていた ──
    { id: 'HuvzO9G7u5sy52OiV5kl', address: '神奈川県海老名市柏ヶ谷865', query: '神奈川県海老名市柏ケ谷865',
        expect: { lat: 35.4642884, lng: 139.4122942 }, basis: '旧地番' },
    { id: 'eYI6NNtKCorOkYfiyXCo', address: '神奈川県海老名市柏ヶ谷412', query: '神奈川県海老名市柏ケ谷412',
        expect: { lat: 35.4642884, lng: 139.4122942 }, basis: '旧地番' },
    { id: 'IM1PtwdmqoCBu59DoK02', address: '神奈川県海老名市柏ヶ谷710-1', query: '神奈川県海老名市柏ケ谷710',
        expect: { lat: 35.4642884, lng: 139.4122942 }, basis: '旧地番（枝番は番地レベルまで）' },
    { id: 'CHVkPAqUDuncunayLxaD', address: '神奈川県海老名市柏ヶ谷750', query: '神奈川県海老名市柏ケ谷750',
        expect: { lat: 35.4642884, lng: 139.4122942 }, basis: '旧地番' },

    // ── 2回目: 「柏ケ谷二丁目」の代表点に3件が重なっていた ──
    // ⚠️ この3件の住所は「新住所の街区 − 旧地番」が連結された形
    //    （例: 柏ケ谷２丁目１２−１０８７−１０ ＝ 二丁目12番 ＋ 旧1087-10）。
    //    街区番号は対照表の新住所と一致するので、どちらから引くかを個別に選んでいる。
    {
        // 街区12は住所検索で解決できず「柏ケ谷二丁目」の代表点に落ちるため、旧地番から引く
        id: 'aEbBKCCRSanAhcu4ZPKY', address: '神奈川県海老名市柏ケ谷２丁目１２−１０８７−１０',
        query: '神奈川県海老名市柏ケ谷1087',
        expect: { lat: 35.4667606, lng: 139.417693 }, basis: '旧地番1087番地（新住所の街区12は住所検索で解決できず）',
    },
    {
        // 対照表で 旧1150-1 → 二丁目21-2 と確定している。新住所の方が細かい
        id: 'WzUuJ2AvZ6MdUqVLP7Rj', address: '神奈川県海老名市柏ケ谷２丁目２１−１１５０−１',
        query: '神奈川県海老名市柏ケ谷二丁目21-2',
        expect: { lat: 35.4667606, lng: 139.417693 }, basis: '新住所 二丁目21-2（対照表で旧1150-1から確定。旧地番で引いた点とも15m差）',
    },
    {
        // 新住所（二丁目11番）と旧地番（1063番地）が同じ点を指す
        id: 'wV1OXSuguBPMwX32WbdN', address: '神奈川県海老名市柏ケ谷２丁目１１−１０６３',
        query: '神奈川県海老名市柏ケ谷二丁目11',
        expect: { lat: 35.4667606, lng: 139.417693 }, basis: '新住所 二丁目11番（旧地番1063番地と同じ点）',
    },
];

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const distance = (a, b) => {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(x)));
};

/** 国土地理院の住所検索。番地レベルの点を返す */
const lookup = async (query) => {
    const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`住所検索に失敗しました（HTTP ${res.status}）`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;
    const [lng, lat] = list[0].geometry.coordinates;
    return { lat, lng, title: list[0].properties.title };
};

admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

console.log(APPLY ? '★ 実際に書き込みます' : '確認のみ（書き込みません）');
console.log(`対象: ${TARGETS.length}件\n`);

let done = 0;
const skipped = [];

for (const t of TARGETS) {
    const ref = db.collection('posters_v2').doc(t.id);
    const snap = await ref.get();
    if (!snap.exists) { skipped.push({ ...t, reason: 'ピンが見つからない' }); continue; }
    const cur = snap.data();

    if (cur.address !== t.address) {
        skipped.push({ ...t, reason: `住所が想定と違う（現在: "${cur.address}"）` });
        continue;
    }
    // すでに誰かが動かしていたら触らない
    if (cur.lat !== t.expect.lat || cur.lng !== t.expect.lng) {
        skipped.push({ ...t, reason: `座標が想定と違う（現在: ${cur.lat},${cur.lng}）。すでに直された可能性` });
        continue;
    }

    const found = await lookup(t.query);
    if (!found) { skipped.push({ ...t, reason: '住所検索で見つからない' }); continue; }

    const moved = distance({ lat: cur.lat, lng: cur.lng }, found);
    console.log(`${done + 1}. ${t.address}`);
    console.log(`   検索結果 : ${found.title}`);
    console.log(`   座標     : ${cur.lat},${cur.lng} → ${found.lat},${found.lng}（${moved}m 移動）`);

    if (APPLY) {
        const now = Date.now();
        await ref.update({ lat: found.lat, lng: found.lng, updatedAt: now, updatedBy: 'システム修正' });
        // ピンの「ログ」タブから経緯を追えるようにする。
        // ⚠️ 日次レポートの4指標には影響しない（新規は createdAt、撤去は removedChangedTo、
        // 張替え・修理は status の変化で数えるため）
        await db.collection('activityLogs_v2').add({
            action: '更新',
            posterId: t.id,
            posterAddress: cur.address,
            city: cur.city || '海老名市',
            changedBy: 'システム修正',
            changedByGroupId: 'admin',
            changedAt: now,
            diff: `位置を修正: 住所の異なるピンが同じ代表点に重なっていたため、`
                + `国土地理院の住所検索（${found.title}／${t.basis}）の位置へ ${moved}m 移動`,
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
for (const s of skipped) console.log(`  スキップ: ${s.address} — ${s.reason}`);
if (!APPLY) console.log('\n--apply を付けると実際に書き込みます。');
process.exit(0);
