/**
 * 依頼の Slack 通知で使うメンション先（settings/slackMentions）を登録する。
 *
 *   node scripts/seed_slack_mentions.mjs          # 現状の確認のみ
 *   node scripts/seed_slack_mentions.mjs --apply  # 実際に書き込む
 *
 * 管理画面（設定 →「Slack通知のメンション先」）からも追加・削除できる。
 * これは初回のまとめ登録用。
 *
 * ⚠️ Slack のメンバー一覧はアプリ側から取れない（持っているのは日次レポートと
 * 同じ Incoming Webhook だけで、webhook からは users.list を呼べない）。
 * メンバーIDは Slack のプロフィール →「その他」→「メンバーIDをコピー」で取る。
 */
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const APPLY = process.argv.includes('--apply');
admin.initializeApp({ projectId: 'satoumasashi-poster-map' });
const db = admin.firestore();

const MEMBERS = [
    ['佐藤主迪', 'U0AHT4NHE3F'],
    ['保坂紀子', 'U0AJQPWMM4Y'],
    ['黒川睦夫', 'U0AHES1MCQP'],
    ['郷千鶴子', 'U0AJ044RJQL'],
    ['望月海璃', 'U0AHQ44PMV1'],
    ['長田拓也', 'U0AJQPUK4BS'],
    ['鈴木裕子', 'U0AHUE1E16J'],
    ['内林拓人', 'U0AL4HCTP2B'],
    ['渥美聡子', 'U0AJS3SL80H'],
    ['篠崎直紀', 'U0AK7EJ603S'],
    ['小田桐佐介', 'U0B816GMLHJ'],
    ['浅見莉緒', 'U0BFY0VE0HH'],
    ['柳みこと', 'U0C6DDHJF7G'],
];

// 全員あての2つを先頭に置く（使用頻度が高く、人の名前と混ざらないように）
const targets = [
    { label: '@here（いま見ている人）', mention: '<!here>' },
    { label: '@channel（チャンネル全員）', mention: '<!channel>' },
    ...MEMBERS.map(([label, id]) => ({ label, mention: `<@${id}>` })),
];

const ref = db.collection('settings').doc('slackMentions');
const cur = await ref.get();
console.log(`現在の登録: ${cur.exists ? (cur.data()?.targets?.length ?? 0) : 0}件`);
console.log(`${APPLY ? '登録する' : '登録予定'}: ${targets.length}件`);
for (const t of targets) console.log(`  ${t.label.padEnd(22)} ${t.mention}`);

if (APPLY) {
    await ref.set({ targets, updatedAt: Date.now() }, { merge: true });
    const after = await ref.get();
    console.log(`\n✅ 書き込み完了（${after.data()?.targets?.length}件）`);
} else {
    console.log('\n--apply を付けると実際に書き込みます。');
}
process.exit(0);
