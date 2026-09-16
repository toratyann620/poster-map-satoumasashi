/**
 * 新旧住所の現地確認（2026-09-16）の結果を、ピンの備考に残す。
 *
 *   node scripts/annotate_address_notes.mjs          # 確認のみ
 *   node scripts/annotate_address_notes.mjs --apply  # 書き込む
 *
 *  A. 新住所へ切り替え済みのピン: 備考の「旧住所表記：」を「旧住所：」に揃える
 *  B. 新住所を特定できなかったピン: 備考の末尾に「確認事項：〜」を追記する
 *     （号が不明・地図にない・区画整理で消えた等、現地で確かめた内容をそのまま残す）
 *
 * 備考を上書きせず末尾に足す。既に同じ文が入っていれば二重に付けない（再実行しても増えない）。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');
admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

/** 住所（完全一致）→ 確認事項。同じ住所のピンが複数あれば全部に付ける */
const NOTES = {
    '神奈川県海老名市下今泉950-1': '2008年地図にない。「上郷950-1」では？ であるならば「扇町11-2」',
    '神奈川県海老名市上今泉6-28': '「号」が不明のため新住所を特定できず',
    '神奈川県海老名市上今泉6-49': '「上今泉6-49-23」なら存在するが畑のため、「23号」に建っているかどうか不明',
    '神奈川県海老名市河原口5-1': '「号」が不明のため新住所を特定できず',
    '神奈川県海老名市河原口1369-3': '新住所は「中央4-13-？」（号が不明）',
    '神奈川県海老名市河原口958': '「河原口5丁目」だが詳細不明。「市立図書館前」の信号のあたり',
    '神奈川県海老名市河原口371': '内野会長の会社（内野屋建設）があったところ。区画整理で道がなくなっている',
    '神奈川県海老名市上郷273': '2008年地図にない',
    '神奈川県海老名市上郷742': '2008年地図にない',
    '神奈川県海老名市上郷901': 'ららぽーとに飲み込まれていると思われる',
    '神奈川県海老名市上郷788': '多分「扇町10」見世ビルのあたりだが、道路が変わっていて正確には不明',
    '神奈川県海老名市社家922': '2008年地図にない（社家924までしかなく、東名高速の下あたりが922と思われる）',
};

const toHalf = (s) => String(s ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[ー−‐―－]/g, '-').trim();

console.log(APPLY ? '★ 書き込みます\n' : '確認のみ（書き込みません）\n');
const snap = await db.collection('posters_v2').where('city', '==', '海老名市').get();
const writes = [];

for (const d of snap.docs) {
    const v = d.data();
    const memo = String(v.memo ?? '');
    let next = memo;
    let why = '';

    // A. 表記の統一
    if (memo.includes('旧住所表記：')) {
        next = next.replace(/旧住所表記：/g, '旧住所：');
        why = '表記を「旧住所：」に統一';
    }

    // B. 確認事項の追記
    const note = NOTES[toHalf(v.address)];
    if (note) {
        const line = `確認事項：${note}`;
        if (!next.includes(line)) {
            next = next.trim() ? `${next.trim()}\n${line}` : line;
            why = why ? `${why}＋確認事項を追記` : '確認事項を追記';
        }
    }

    if (next !== memo) writes.push({ ref: d.ref, id: d.id, address: v.address, removed: !!v.removed, before: memo, after: next, why, cur: v });
}

for (const [i, w] of writes.entries()) {
    console.log(`${i + 1}. ${w.address}${w.removed ? '（撤去済）' : ''}  — ${w.why}`);
    console.log(`   備考 → ${JSON.stringify(w.after)}`);
}
console.log(`\n対象: ${writes.length}件`);

if (APPLY) {
    for (const w of writes) {
        const now = Date.now();
        await w.ref.update({ memo: w.after, updatedAt: now, updatedBy: 'システム移行' });
        await db.collection('activityLogs_v2').add({
            action: '更新', posterId: w.id, posterAddress: w.address, city: w.cur.city || '海老名市',
            changedBy: 'システム移行', changedByGroupId: 'admin', changedAt: now,
            diff: `備考: ${w.why}（新旧住所の現地確認 2026-09-16）`,
            posterType: w.cur.type || '', posterStatus: Array.isArray(w.cur.status) ? w.cur.status : [],
            isNeedsRepair: false, isNewRegistration: false, statusAdded: [], statusRemoved: [], removedChangedTo: null,
        });
    }
    console.log('書き込み完了');
} else {
    console.log('--apply を付けると実際に書き込みます。');
}
