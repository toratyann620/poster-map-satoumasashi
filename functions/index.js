const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// 参照するコレクション。Webとアプリの統合にあたり、両者とも v2 を読み書きする
// ようになったため、日次レポートの集計元も v2 に合わせる。
// 旧コレクション（posters / activityLogs）は切替前のデータとして残してあるが、
// 以降は更新されないため、ここを向けたままだと古い数字を報告し続けることになる。
//
// ⚠️ src/lib/collections.ts の COL と対になっている。片方だけ変更しないこと。
const COL = {
    posters: 'posters_v2',
    activityLogs: 'activityLogs_v2',
};

const SLACK_WEBHOOK_URL = defineSecret('SLACK_WEBHOOK_URL');

// 設置率の対象都市（既存ダッシュボード [DashboardTab.tsx] の getCityCategory と同じ判定基準）
const CITY_LABELS = [
    { match: '厚木市', label: '厚木' },
    { match: '伊勢原市', label: '伊勢原' },
    { match: '海老名市', label: '海老名市' },
];

// 住所を「市区町村＋町名」レベルまで短縮する（都道府県、丁目・番地以降を省略）
// 例: "神奈川県厚木市妻田南1-22-47" → "厚木市妻田南"
const shortenAddress = (address) => {
    if (!address) return '(住所不明)';
    let s = String(address).trim();
    // 先頭の都道府県を除去
    s = s.replace(/^\S*?[都道府県]/, '');
    // 最初に現れる数字（全角/半角）以降（丁目・番地・号等）を除去
    const idx = s.search(/[0-9０-９]/);
    if (idx > 0) s = s.slice(0, idx);
    return s.trim() || address.trim();
};

// 件数を住所（短縮後）ごとに集計し、多い順に並べる
const tally = (items, addressGetter) => {
    const map = new Map();
    items.forEach(item => {
        const key = shortenAddress(addressGetter(item));
        map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
};

const formatSection = (title, breakdown) => {
    if (breakdown.length === 0) return `・${title}\n(該当なし)`;
    return `・${title}\n` + breakdown.map(([addr, count]) => `${addr}　${count}箇所`).join('\n');
};

// 張替え予定／要修理フラグが「外れた」イベントを、ポスターごとの時系列ログから再構築する。
// 2026-07-20のusePosterData.ts改修より前のログにはstatusRemovedが記録されていないため、
// その場合は直前のログのposterStatus（更新後のステータス配列）と比較して差分を推定する。
const reconstructStatusRemovedEvents = (allLogsAsc) => {
    const logsByPoster = new Map();
    allLogsAsc.forEach(l => {
        if (!l.posterId) return;
        if (!logsByPoster.has(l.posterId)) logsByPoster.set(l.posterId, []);
        logsByPoster.get(l.posterId).push(l);
    });

    const replaceCancelEvents = [];
    const repairCancelEvents = [];

    logsByPoster.forEach((logsForPoster, posterId) => {
        let prevStatus = null; // このポスターの直前の既知ステータス（まだ無ければnull）
        logsForPoster.forEach((log) => {
            if (Array.isArray(log.statusRemoved)) {
                // 新方式: 記録済みの差分をそのまま利用
                if (log.statusRemoved.includes('張替え予定')) {
                    replaceCancelEvents.push({ posterId, changedAt: log.changedAt, posterAddress: log.posterAddress });
                }
                if (log.statusRemoved.includes('要修理')) {
                    repairCancelEvents.push({ posterId, changedAt: log.changedAt, posterAddress: log.posterAddress });
                }
            } else if (prevStatus !== null && Array.isArray(log.posterStatus)) {
                // 旧方式（statusRemoved未記録）: 直前のposterStatusとの差分から推定
                if (prevStatus.includes('張替え予定') && !log.posterStatus.includes('張替え予定')) {
                    replaceCancelEvents.push({ posterId, changedAt: log.changedAt, posterAddress: log.posterAddress });
                }
                if (prevStatus.includes('要修理') && !log.posterStatus.includes('要修理')) {
                    repairCancelEvents.push({ posterId, changedAt: log.changedAt, posterAddress: log.posterAddress });
                }
            }
            if (Array.isArray(log.posterStatus)) prevStatus = log.posterStatus;
        });
    });

    return { replaceCancelEvents, repairCancelEvents };
};

async function buildReport() {
    const rangeEnd = Date.now();
    const rangeStart = rangeEnd - 24 * 60 * 60 * 1000;

    // 張替え解除・修理解除の過去分再構築には、対象ポスターの過去の全履歴が必要なため、
    // activityLogsは全件を時系列順に取得する
    const [postersSnap, allLogsSnap] = await Promise.all([
        db.collection(COL.posters).get(),
        db.collection(COL.activityLogs).orderBy('changedAt', 'asc').get(),
    ]);

    const posters = [];
    postersSnap.forEach(d => posters.push({ id: d.id, ...d.data() }));

    const allLogsAsc = [];
    allLogsSnap.forEach(d => allLogsAsc.push({ id: d.id, ...d.data() }));

    const logsInRange = allLogsAsc.filter(l => l.changedAt >= rangeStart && l.changedAt < rangeEnd);

    // Slackへのポスター作業成果報告は「佐藤まさし」のポスターのみを対象とする
    const TARGET_TYPE = '佐藤まさし';
    const satoPosterIds = new Set(posters.filter(p => p.type === TARGET_TYPE).map(p => p.id));

    // 新規: この期間に作成された「佐藤まさし」のポスター
    const newPosters = posters.filter(p => p.type === TARGET_TYPE && typeof p.createdAt === 'number' && p.createdAt >= rangeStart && p.createdAt < rangeEnd);

    // 撤去: この期間に撤去フラグがONになった「佐藤まさし」の更新（usePosterData.ts の updatePoster が記録する removedChangedTo を利用）
    // ※ removedフィールドは2026-07-20の改修以前は記録されておらず、過去分の再構築はできない
    const removedLogs = logsInRange.filter(l => l.removedChangedTo === true && satoPosterIds.has(l.posterId));

    // 張替え解除・修理解除: 過去分も含めて時系列から再構築し、期間内かつ「佐藤まさし」のイベントのみ抽出
    const { replaceCancelEvents, repairCancelEvents } = reconstructStatusRemovedEvents(allLogsAsc);
    const replaceCancelLogs = replaceCancelEvents.filter(e => e.changedAt >= rangeStart && e.changedAt < rangeEnd && satoPosterIds.has(e.posterId));
    const repairCancelLogs = repairCancelEvents.filter(e => e.changedAt >= rangeStart && e.changedAt < rangeEnd && satoPosterIds.has(e.posterId));

    const newBreakdown = tally(newPosters, p => p.address);
    const removedBreakdown = tally(removedLogs, l => l.posterAddress);
    const replaceCancelBreakdown = tally(replaceCancelLogs, e => e.posterAddress);
    const repairCancelBreakdown = tally(repairCancelLogs, e => e.posterAddress);

    // 設置率（佐藤まさし、市区町村別・既存ダッシュボードと同じ算出方法: 設置済枚数 / 全体枚数）
    const satoPosters = posters.filter(p => p.type === TARGET_TYPE);
    const qtyOf = (p) => (typeof p.quantity === 'number' && p.quantity > 0) ? p.quantity : 1;
    const isInstalled = (p) => (Array.isArray(p.status) ? p.status : [p.status]).includes('設置済');

    const cityRates = CITY_LABELS.map(({ match, label }) => {
        const inCity = satoPosters.filter(p => (p.address || '').includes(match));
        const totalQty = inCity.reduce((s, p) => s + qtyOf(p), 0);
        const installedQty = inCity.filter(isInstalled).reduce((s, p) => s + qtyOf(p), 0);
        const rate = totalQty > 0 ? Math.round((installedQty / totalQty) * 100) : 0;
        return { label, rate };
    });

    const overallTotalQty = satoPosters.reduce((s, p) => s + qtyOf(p), 0);
    const overallInstalledQty = satoPosters.filter(isInstalled).reduce((s, p) => s + qtyOf(p), 0);
    const overallRate = overallTotalQty > 0 ? Math.round((overallInstalledQty / overallTotalQty) * 100) : 0;

    const dateLabel = new Intl.DateTimeFormat('ja-JP', {
        month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
    }).format(new Date(rangeEnd));

    const message = [
        `◆ポスター作業成果_${dateLabel}（${TARGET_TYPE}・単位は箇所）`,
        `新規：${newPosters.length}箇所`,
        `撤去：${removedLogs.length}箇所`,
        `張替え完了：${replaceCancelLogs.length}箇所`,
        `修理完了：${repairCancelLogs.length}箇所`,
        '```',
        '<内訳>',
        formatSection('新規', newBreakdown),
        '',
        formatSection('撤去', removedBreakdown),
        '',
        formatSection('張替え完了', replaceCancelBreakdown),
        '',
        formatSection('修理完了', repairCancelBreakdown),
        '```',
        `設置率：${overallRate}%(${cityRates.map(c => `${c.label}${c.rate}%`).join('/')})`,
    ].join('\n');

    // 新規・撤去・張替え・修理のいずれも該当が無ければ通知不要と判定する
    const totalCount = newPosters.length + removedLogs.length + replaceCancelLogs.length + repairCancelLogs.length;

    return { message, totalCount };
}

async function postToSlack(text) {
    const webhookUrl = SLACK_WEBHOOK_URL.value();
    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Slack webhook returned ${res.status}: ${body}`);
    }
}

exports.dailyPosterReport = onSchedule({
    schedule: '0 18 * * *',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: [SLACK_WEBHOOK_URL],
}, async () => {
    const { message, totalCount } = await buildReport();
    if (totalCount === 0) {
        logger.info('Daily poster report skipped: no activity in range');
        return;
    }
    logger.info('Daily poster report generated', { message });
    await postToSlack(message);
});

// ═══════════════════════════════════════════════════════════
// お知らせのプッシュ通知
// ═══════════════════════════════════════════════════════════

/**
 * 管理画面から「プッシュ通知も送る」で配信されたお知らせを、
 * 登録済みの全端末へ送る。
 *
 * 実際に送るのは環境変数 PUSH_NOTIFICATIONS_ENABLED が 'true' のときだけ。
 * 開発中の誤送信は取り消せないため、既定では送らない側に倒している。
 */

/** FCM の1リクエストあたりの上限 */
const FCM_BATCH_SIZE = 500;

/** 本文は通知領域に収まる長さに切る（全文はアプリ内のお知らせで読める） */
const truncate = (text, max) => {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim();
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
};

/** 端末が消えた・アプリが消された場合に返るコード。該当トークンは消す。 */
const DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
]);

exports.sendAnnouncementPush = onDocumentCreated({
    document: 'announcements/{announcementId}',
    region: 'asia-northeast1',
}, async (event) => {
    const announcement = event.data?.data();
    if (!announcement || announcement.sendPush !== true) return;

    if (process.env.PUSH_NOTIFICATIONS_ENABLED !== 'true') {
        logger.info('Push skipped: PUSH_NOTIFICATIONS_ENABLED is not set to "true"', {
            announcementId: event.params.announcementId,
        });
        return;
    }

    await sendPush({
        title: truncate(announcement.title, 60),
        body: truncate(announcement.body, 160),
        data: { announcementId: event.params.announcementId },
        label: 'announcement',
    });
});

/**
 * 登録済みの端末へ通知を送る。
 *
 * `uids` を渡すとその人の端末だけに送る。省略すると全端末へ送る。
 * 届かなくなったトークンはその場で消す。残すと送るたびに失敗が積み上がる。
 */
async function sendPush({ title, body, data = {}, uids = null, label = 'push' }) {
    const snap = await db.collection('pushTokens').get();
    const docsByToken = new Map();
    snap.forEach((d) => {
        const v = d.data();
        if (!v?.token) return;
        if (uids && !uids.has(v.uid)) return;
        docsByToken.set(v.token, d.ref);
    });
    const tokens = [...docsByToken.keys()];

    if (tokens.length === 0) {
        logger.info(`Push skipped: no matching tokens (${label})`);
        return { total: 0, sent: 0, removed: 0 };
    }

    let sent = 0;
    const dead = [];
    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
        const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
        const res = await admin.messaging().sendEachForMulticast({
            notification: { title, body }, data, tokens: batch,
        });
        sent += res.successCount;
        res.responses.forEach((r, idx) => {
            if (!r.success && DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(batch[idx]);
        });
    }
    await Promise.all(dead.map((t) => docsByToken.get(t).delete()));

    logger.info(`Push sent (${label})`, { total: tokens.length, sent, removed: dead.length });
    return { total: tokens.length, sent, removed: dead.length };
}

// ═══════════════════════════════════════════════════════════
// 作業依頼（タスク）のプッシュ通知
// ═══════════════════════════════════════════════════════════

/**
 * 依頼が作られたときに、担当者へ通知する。
 * 担当者が決まっていない依頼は、その事務所の全員へ送る。
 */
exports.sendTaskPush = onDocumentCreated({
    document: 'tasks/{taskId}',
    region: 'asia-northeast1',
}, async (event) => {
    const task = event.data?.data();
    if (!task || task.notify !== true) return;

    if (process.env.PUSH_NOTIFICATIONS_ENABLED !== 'true') {
        logger.info('Task push skipped: PUSH_NOTIFICATIONS_ENABLED is not "true"', { taskId: event.params.taskId });
        return;
    }

    let uids = null;
    if (task.assigneeUid) {
        uids = new Set([task.assigneeUid]);
    } else {
        // 担当者未指定は事務所の全員あて。所属で絞らないと他事務所にも届く
        const members = await db.collection('users').where('groupId', '==', task.groupId).get();
        uids = new Set(members.docs.map((d) => d.id));
    }

    const where = task.address ? `（${truncate(task.address, 40)}）` : '';
    await sendPush({
        title: task.assigneeUid ? `${task.kind}の依頼が届きました` : `${task.kind}の依頼があります`,
        body: truncate(`${task.title}${where}`, 160),
        data: { taskId: event.params.taskId },
        uids,
        label: 'task',
    });
});

// ═══════════════════════════════════════════════════════════
// ユーザーアカウントの削除
// ═══════════════════════════════════════════════════════════

/**
 * ログインアカウントごとユーザーを削除する。
 *
 * Auth の削除はクライアントSDKでは他人に対して行えないため、ここで受ける。
 * 呼べるのは佐藤まさし事務所（allowAll）の管理者だけ。
 * users ドキュメントの削除と条件を揃えており、片方だけ通ることはない。
 */
exports.deleteUserAccount = onCall({ region: 'asia-northeast1' }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const caller = await db.collection('users').doc(callerUid).get();
    if (!caller.exists) throw new HttpsError('permission-denied', '利用が承認されていません。');
    const callerData = caller.data();
    if (callerData.role !== 'admin') throw new HttpsError('permission-denied', '管理者のみ実行できます。');

    const callerGroup = await db.collection('groups').doc(callerData.groupId ?? '__none__').get();
    if (!callerGroup.exists || callerGroup.data().allowAll !== true) {
        throw new HttpsError('permission-denied', '佐藤まさし事務所の管理者のみ実行できます。');
    }

    const targetUid = String(request.data?.uid ?? '');
    if (!targetUid) throw new HttpsError('invalid-argument', '対象のユーザーが指定されていません。');
    if (targetUid === callerUid) throw new HttpsError('failed-precondition', '自分自身は削除できません。');

    // 端末のトークンを先に消す。アカウントが消えた後だと持ち主を辿れなくなる
    const tokens = await db.collection('pushTokens').where('uid', '==', targetUid).get();
    await Promise.all(tokens.docs.map((d) => d.ref.delete()));

    await db.collection('users').doc(targetUid).delete();

    try {
        await admin.auth().deleteUser(targetUid);
    } catch (e) {
        // Authに無い場合（既に消えている等）は、権限の剥奪が済んでいれば目的は果たしている
        if (e?.code !== 'auth/user-not-found') throw e;
        logger.warn('Auth user was already absent', { targetUid });
    }

    logger.info('User account deleted', { targetUid, by: callerUid });
    return { ok: true };
});

// ═══════════════════════════════════════════════════════════
// アカウント発行の申請（accountRequests）
// ═══════════════════════════════════════════════════════════

/**
 * 申請の受付と承認は、すべてこの関数群を通す。
 *
 * Firestore のルールで `accountRequests` への書き込みを直接許可すると、
 * ログイン前＝未認証からの書き込みを開けることになり、外部から
 * 際限なく書き込める口ができてしまう。Admin SDK 経由に限定して、
 * 検証・重複確認・流量制限をサーバ側で必ず通るようにしている。
 */

const nodemailer = require('nodemailer');

/**
 * メール送信の接続情報。
 *
 * SMTP の URI を1本だけ持たせる形にしてあるので、Gmail(Workspace) でも
 * SendGrid でも Resend でも、送信元を変えるときに関数の書き換えが要らない。
 *   例: smtps://user%40example.com:APP_PASSWORD@smtp.gmail.com:465
 *
 * 未設定（`unset` のまま）のときは送信せず、発行した初期パスワードを
 * 管理画面に返す。メールの手配が済むまで運用が止まらないようにするため。
 */
const SMTP_URL = defineSecret('SMTP_URL');
const MAIL_FROM = defineSecret('MAIL_FROM');

/** ログイン画面のURL。メールの案内文に載せる */
const APP_URL = 'https://poster-map-app.vercel.app/';

const isMailConfigured = () => {
    const url = SMTP_URL.value();
    return !!url && url !== 'unset' && url.startsWith('smtp');
};

const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** 制御文字を落として1行にする。メールのヘッダに改行を差し込まれるのを防ぐ */
const oneLine = (s, max = 100) => String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

async function sendMail({ to, subject, text, html }) {
    if (!isMailConfigured()) {
        logger.warn('Mail skipped: SMTP_URL is not configured');
        return { sent: false, reason: 'not-configured' };
    }
    const transporter = nodemailer.createTransport(SMTP_URL.value());
    const configuredFrom = MAIL_FROM.value();
    const from = configuredFrom && configuredFrom !== 'unset' ? configuredFrom : undefined;
    await transporter.sendMail({ from, to, subject: oneLine(subject, 150), text, html });
    logger.info('Mail sent', { to });
    return { sent: true };
}

/** 見間違えやすい文字（0/O, 1/l/I）を除いた英数字。口頭でも伝えられるようにする */
const PW_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generatePassword = (length = 10) => {
    const { randomBytes } = require('node:crypto');
    return [...randomBytes(length)].map((b) => PW_ALPHABET[b % PW_ALPHABET.length]).join('');
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 呼び出し元が佐藤まさし事務所（allowAll）の管理者であることを確かめる */
async function requireSuperAdmin(request) {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const caller = await db.collection('users').doc(callerUid).get();
    if (!caller.exists) throw new HttpsError('permission-denied', '利用が承認されていません。');
    const callerData = caller.data();
    if (callerData.role !== 'admin') throw new HttpsError('permission-denied', '管理者のみ実行できます。');

    const callerGroup = await db.collection('groups').doc(callerData.groupId ?? '__none__').get();
    if (!callerGroup.exists || callerGroup.data().allowAll !== true) {
        throw new HttpsError('permission-denied', '佐藤まさし事務所の管理者のみ実行できます。');
    }
    return { uid: callerUid, name: callerData.name ?? '管理者' };
}

/**
 * ログイン画面からの新規登録の申請を受け付ける。
 *
 * 未ログインから呼ばれる唯一の関数なので、外から叩かれる前提で作ってある。
 *  - 入力の長さと形式を必ず検証する
 *  - 同じメールアドレスからの連投と、未処理の申請の総数に上限を設ける
 *  - 「そのメールアドレスは既に登録済み」かどうかを申請者には返さない
 *    （在籍者を外から総当たりで調べられてしまうため）。
 *    代わりに申請へ印を付け、管理画面側にだけ分かるようにする。
 */
exports.submitAccountRequest = onCall({
    region: 'asia-northeast1',
    // 未ログインから呼べる関数なので、外から叩かれ続けたときの上限を決めておく。
    // 申請は1日に数件あれば多い方で、同時実行が要る性質のものではない。
    maxInstances: 5,
}, async (request) => {
    const name = oneLine(request.data?.name, 50);
    const email = oneLine(request.data?.email, 120).toLowerCase();
    const groupId = oneLine(request.data?.groupId, 40);
    const note = oneLine(request.data?.note, 300);

    if (!name) throw new HttpsError('invalid-argument', '氏名を入力してください。');
    if (!EMAIL_RE.test(email)) throw new HttpsError('invalid-argument', 'メールアドレスの形式が正しくありません。');
    if (!groupId) throw new HttpsError('invalid-argument', 'グループIDを入力してください。');

    // グループの存在確認。存在しないIDでも同じ文言を返し、
    // 有効なグループIDを外から総当たりで探れないようにする
    const group = await db.collection('groups').doc(groupId).get();
    if (!group.exists) {
        throw new HttpsError('invalid-argument', 'グループIDが確認できませんでした。事務所から共有されたIDをご確認ください。');
    }

    const now = Date.now();
    const requests = db.collection('accountRequests');

    // 同じメールアドレスからの連投を防ぐ。
    // メールアドレスの一致だけで引いて、時刻の判定はここで行う。
    // where を2つ重ねると accountRequests に複合インデックスが要るうえ、
    // インデックスが未作成だとこの関数ごと失敗する（実際に踏んだ）。
    // 1つのアドレスに対する申請はごく少数なので、全件引いても差し支えない。
    const sameEmail = await requests.where('email', '==', email).get();
    const withinHour = sameEmail.docs.some((d) => Number(d.data().createdAt) > now - 60 * 60 * 1000);
    if (withinHour) {
        throw new HttpsError('already-exists', 'このメールアドレスの申請は受付済みです。承認をお待ちください。');
    }

    // 未処理の申請が溜まりすぎている場合は受け付けない（書き込みの踏み台にされないため）
    const pending = await requests.where('status', '==', 'pending').count().get();
    if (pending.data().count >= 200) {
        throw new HttpsError('resource-exhausted', '現在申請を受け付けられません。事務所へ直接お問い合わせください。');
    }

    // 既にアカウントがあるかは申請者に返さず、管理画面側にだけ分かるようにする
    let emailInUse = false;
    try {
        await admin.auth().getUserByEmail(email);
        emailInUse = true;
    } catch (e) {
        if (e?.code !== 'auth/user-not-found') throw e;
    }

    const ref = await requests.add({
        name, email, groupId, note,
        groupName: group.data().name ?? groupId,
        emailInUse,
        status: 'pending',
        createdAt: now,
    });

    logger.info('Account request received', { requestId: ref.id, groupId, emailInUse });

    // 管理者に気づいてもらう。承認されるまで申請者は何もできないため、
    // 放置されるのがいちばん困る
    if (process.env.PUSH_NOTIFICATIONS_ENABLED === 'true') {
        try {
            const admins = await db.collection('users')
                .where('role', '==', 'admin')
                .where('groupId', '==', 'admin')
                .get();
            if (!admins.empty) {
                await sendPush({
                    title: '新規登録の申請が届きました',
                    body: truncate(`${name}（${group.data().name ?? groupId}）`, 160),
                    data: { accountRequestId: ref.id },
                    uids: new Set(admins.docs.map((d) => d.id)),
                    label: 'account-request',
                });
            }
        } catch (e) {
            // 通知の失敗で申請そのものを失敗させない
            logger.warn('Account request push failed', { error: String(e) });
        }
    }

    return { ok: true };
});

/**
 * 申請を承認／却下する。
 *
 * 承認するとログインアカウントを作り、初期パスワードをメールで送る。
 * Auth アカウントの作成はクライアントSDKでもできるが、それだと
 * 権限の確認をクライアントに委ねることになるためここで行う。
 *
 * メールが未設定・送信失敗のときは初期パスワードを戻り値で返す。
 * 管理画面に表示して口頭で伝えられるようにしておき、
 * メールの手配待ちやSMTP障害で運用が止まらないようにする。
 */
exports.reviewAccountRequest = onCall({
    region: 'asia-northeast1',
    secrets: [SMTP_URL, MAIL_FROM],
}, async (request) => {
    const caller = await requireSuperAdmin(request);

    const requestId = oneLine(request.data?.requestId, 60);
    const approve = request.data?.approve === true;
    if (!requestId) throw new HttpsError('invalid-argument', '対象の申請が指定されていません。');

    const ref = db.collection('accountRequests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', '申請が見つかりませんでした。');
    const req = snap.data();
    if (req.status !== 'pending') throw new HttpsError('failed-precondition', 'この申請はすでに処理済みです。');

    // ── 却下 ──────────────────────────────────────────────
    if (!approve) {
        const rejectReason = oneLine(request.data?.rejectReason, 200);
        await ref.update({
            status: 'rejected', rejectReason,
            reviewedBy: caller.name, reviewedAt: Date.now(),
        });
        logger.info('Account request rejected', { requestId, by: caller.uid });
        return { ok: true, approved: false };
    }

    // ── 承認 ──────────────────────────────────────────────
    const role = request.data?.role === 'admin' ? 'admin' : 'general';
    const groupId = oneLine(request.data?.groupId, 40) || req.groupId;

    const group = await db.collection('groups').doc(groupId).get();
    if (!group.exists) throw new HttpsError('invalid-argument', 'グループが見つかりませんでした。');

    const password = generatePassword();
    let uid;
    try {
        const created = await admin.auth().createUser({
            email: req.email, password, displayName: req.name,
        });
        uid = created.uid;
    } catch (e) {
        if (e?.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'このメールアドレスのアカウントは既に存在します。ユーザー管理から確認してください。');
        }
        throw e;
    }

    await db.collection('users').doc(uid).set({
        name: req.name,
        email: req.email,
        role,
        groupId,
        // 発行した初期パスワードのままなので、初回ログイン時に変更を求める
        mustChangePassword: true,
    });

    await ref.update({
        status: 'approved', role, groupId, createdUid: uid,
        reviewedBy: caller.name, reviewedAt: Date.now(),
    });

    const groupName = group.data().name ?? groupId;
    const roleLabel = role === 'admin' ? '管理者' : '一般ユーザー';
    const subject = 'ポスターマップ｜アカウント発行のご案内';
    const text = [
        `${req.name} 様`, '',
        'ポスターマップへの登録が承認されました。',
        '下記のIDと初期パスワードでログインしてください。', '',
        `  ログインURL          : ${APP_URL}`,
        `  ID（メールアドレス） : ${req.email}`,
        `  初期パスワード       : ${password}`,
        `  所属                 : ${groupName}`,
        `  権限                 : ${roleLabel}`, '',
        '※ 初回ログイン時にパスワードの変更をお願いします。',
        '※ このメールにはパスワードが記載されています。確認後は削除してください。', '',
        'ご不明な点は事務所までお問い合わせください。',
    ].join('\n');
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#111">
<p>${escapeHtml(req.name)} 様</p>
<p>ポスターマップへの登録が承認されました。<br>下記のIDと初期パスワードでログインしてください。</p>
<table style="border-collapse:collapse;margin:16px 0">
<tr><td style="padding:4px 16px 4px 0;color:#666">ログインURL</td><td style="padding:4px 0"><a href="${APP_URL}">${APP_URL}</a></td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#666">ID（メールアドレス）</td><td style="padding:4px 0"><b>${escapeHtml(req.email)}</b></td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#666">初期パスワード</td><td style="padding:4px 0"><b style="font-family:monospace;font-size:16px">${escapeHtml(password)}</b></td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#666">所属</td><td style="padding:4px 0">${escapeHtml(groupName)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#666">権限</td><td style="padding:4px 0">${roleLabel}</td></tr>
</table>
<p style="color:#666;font-size:13px">※ 初回ログイン時にパスワードの変更をお願いします。<br>
※ このメールにはパスワードが記載されています。確認後は削除してください。</p>
<p>ご不明な点は事務所までお問い合わせください。</p>
</div>`;

    let mail = { sent: false, reason: 'not-configured' };
    try {
        mail = await sendMail({ to: req.email, subject, text, html });
    } catch (e) {
        // メールが送れなくてもアカウントは発行済み。ここで失敗にすると
        // 「アカウントはあるのに申請が未処理のまま」というずれが残る
        logger.error('Account mail failed', { requestId, error: String(e) });
        mail = { sent: false, reason: String(e?.message ?? e) };
    }
    await ref.update({ mailSent: mail.sent, mailError: mail.sent ? '' : String(mail.reason ?? '') });

    logger.info('Account request approved', {
        requestId, uid, role, groupId, mailSent: mail.sent, by: caller.uid,
    });

    // メールが送れていない場合に限り、口頭で伝えられるよう初期パスワードを返す
    return {
        ok: true, approved: true, uid,
        email: req.email,
        password: mail.sent ? '' : password,
        mailSent: mail.sent,
        mailError: mail.sent ? '' : String(mail.reason ?? ''),
    };
});

/**
 * 管理画面からのユーザー発行。
 *
 * 以前はクライアントで「セカンダリのFirebaseアプリを作って
 * createUserWithEmailAndPassword → users ドキュメントを書く」という2段構えだった。
 * これには2つ問題があった。
 *
 *  1. 既存のメールアドレスだと `auth/email-already-in-use` が英語のまま画面に出て、
 *     何が起きたのか・どうすればよいのかが分からない。
 *  2. Auth の作成に成功して users の書き込みに失敗すると、
 *     **ログインアカウントだけが残る**。そのユーザーは一覧に出ないのに
 *     同じメールアドレスでは作り直せず、管理画面から復旧できなくなる。
 *
 * サーバ側の1操作にまとめ、取り残しが起きたときは
 * 「そのログインアカウントを引き取って登録し直す」経路を用意した。
 */
exports.provisionUser = onCall({ region: 'asia-northeast1' }, async (request) => {
    const caller = await requireSuperAdmin(request);

    const name = oneLine(request.data?.name, 50);
    const email = oneLine(request.data?.email, 120).toLowerCase();
    const role = request.data?.role === 'admin' ? 'admin' : 'general';
    const groupId = oneLine(request.data?.groupId, 40);
    const password = String(request.data?.password ?? '');
    // 取り残されたログインアカウントを引き取ってよい、という管理者の明示的な同意
    const adopt = request.data?.adopt === true;

    if (!name) throw new HttpsError('invalid-argument', '氏名を入力してください。');
    if (!EMAIL_RE.test(email)) throw new HttpsError('invalid-argument', 'メールアドレスの形式が正しくありません。');
    if (password.length < 6) throw new HttpsError('invalid-argument', 'パスワードは6文字以上にしてください。');

    const group = await db.collection('groups').doc(groupId).get();
    if (!group.exists) throw new HttpsError('invalid-argument', '所属グループが見つかりませんでした。');

    let existing = null;
    try {
        existing = await admin.auth().getUserByEmail(email);
    } catch (e) {
        if (e?.code !== 'auth/user-not-found') throw e;
    }

    let uid;
    let status;

    if (existing) {
        const doc = await db.collection('users').doc(existing.uid).get();
        if (doc.exists) {
            // 本当の重複。一覧に出ているはずなので、そちらで直してもらう
            const who = doc.data().name || email;
            throw new HttpsError(
                'already-exists',
                `このメールアドレスは既に「${who}」さんが使っています。`
                + '下のユーザー一覧から権限や所属を変更するか、パスワードの再発行を行ってください。',
            );
        }
        // ログインアカウントだけが残っている状態。引き取ってよいか管理者に確かめる
        if (!adopt) {
            return { status: 'orphan', uid: existing.uid, email };
        }
        await admin.auth().updateUser(existing.uid, { password, displayName: name });
        uid = existing.uid;
        status = 'adopted';
    } else {
        try {
            const created = await admin.auth().createUser({ email, password, displayName: name });
            uid = created.uid;
        } catch (e) {
            if (e?.code === 'auth/invalid-password') {
                throw new HttpsError('invalid-argument', 'パスワードが条件を満たしていません。6文字以上にしてください。');
            }
            throw e;
        }
        status = 'created';
    }

    await db.collection('users').doc(uid).set({
        name, email, role, groupId,
        // 発行した初期パスワードのままなので、初回ログイン時に変更を求める
        mustChangePassword: true,
    });

    logger.info('User provisioned', { uid, email, role, groupId, status, by: caller.uid });
    return { status, uid };
});
