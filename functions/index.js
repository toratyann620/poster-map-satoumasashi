const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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

    const snap = await db.collection('pushTokens').get();
    const docsByToken = new Map();
    snap.forEach((d) => {
        const token = d.data()?.token;
        if (token) docsByToken.set(token, d.ref);
    });
    const tokens = [...docsByToken.keys()];

    if (tokens.length === 0) {
        logger.info('Push skipped: no registered tokens');
        return;
    }

    const message = {
        notification: {
            title: truncate(announcement.title, 60),
            body: truncate(announcement.body, 160),
        },
        data: { announcementId: event.params.announcementId },
    };

    let sent = 0;
    const dead = [];

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
        const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
        const res = await admin.messaging().sendEachForMulticast({ ...message, tokens: batch });
        sent += res.successCount;
        res.responses.forEach((r, idx) => {
            if (!r.success && DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(batch[idx]);
        });
    }

    // 届かなくなったトークンを残すと、送るたびに失敗が積み上がる
    await Promise.all(dead.map((t) => docsByToken.get(t).delete()));

    logger.info('Announcement push sent', {
        announcementId: event.params.announcementId,
        total: tokens.length,
        sent,
        removed: dead.length,
    });
});
