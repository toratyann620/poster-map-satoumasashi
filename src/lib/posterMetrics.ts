import type { ActivityLog, PosterPin } from '../types';

// 市区町村別の設置率などで使う対象都市（DashboardTab.tsx の getCityCategory と同じ判定基準）
export const CITY_LABELS = [
    { match: '厚木市', label: '厚木' },
    { match: '伊勢原市', label: '伊勢原' },
    { match: '海老名市', label: '海老名市' },
] as const;

// 住所を「市区町村＋町名」レベルまで短縮する（都道府県、丁目・番地以降を省略）
// 例: "神奈川県厚木市妻田南1-22-47" → "厚木市妻田南"
export const shortenAddress = (address: string | undefined): string => {
    if (!address) return '(住所不明)';
    let s = String(address).trim();
    s = s.replace(/^\S*?[都道府県]/, '');
    const idx = s.search(/[0-9０-９]/);
    if (idx > 0) s = s.slice(0, idx);
    return s.trim() || address.trim();
};

// 件数を住所（短縮後）ごとに集計し、多い順に並べる
export const tallyByAddress = <T,>(items: T[], addressGetter: (item: T) => string | undefined): [string, number][] => {
    const map = new Map<string, number>();
    items.forEach(item => {
        const key = shortenAddress(addressGetter(item));
        map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
};

export interface StatusFlagEvent {
    id: string;
    changedAt: number;
    posterId: string;
    posterAddress: string;
    changedBy: string;
}

/**
 * 「張替え予定」「要修理」フラグが外れたイベントを、ポスターごとの時系列ログから再構築する。
 * activityLogsに statusRemoved が記録されている場合はそれを優先し、
 * 記録されていない古いログについては直前のログの posterStatus と比較して差分を推定する。
 * （Cloud Functions [functions/index.js] の reconstructStatusRemovedEvents と同一ロジック）
 */
export const reconstructStatusRemovedEvents = (allLogsAsc: ActivityLog[]) => {
    const logsByPoster = new Map<string, ActivityLog[]>();
    allLogsAsc.forEach(l => {
        if (!l.posterId) return;
        if (!logsByPoster.has(l.posterId)) logsByPoster.set(l.posterId, []);
        logsByPoster.get(l.posterId)!.push(l);
    });

    const replaceCancelEvents: StatusFlagEvent[] = [];
    const repairCancelEvents: StatusFlagEvent[] = [];

    logsByPoster.forEach((logsForPoster) => {
        let prevStatus: string[] | null = null;
        logsForPoster.forEach((log) => {
            const event: StatusFlagEvent = {
                id: log.id,
                changedAt: log.changedAt,
                posterId: log.posterId,
                posterAddress: log.posterAddress,
                changedBy: log.changedBy,
            };
            if (Array.isArray(log.statusRemoved)) {
                if (log.statusRemoved.includes('張替え予定')) replaceCancelEvents.push(event);
                if (log.statusRemoved.includes('要修理')) repairCancelEvents.push(event);
            } else if (prevStatus !== null && Array.isArray(log.posterStatus)) {
                if (prevStatus.includes('張替え予定') && !log.posterStatus.includes('張替え予定')) replaceCancelEvents.push(event);
                if (prevStatus.includes('要修理') && !log.posterStatus.includes('要修理')) repairCancelEvents.push(event);
            }
            if (Array.isArray(log.posterStatus)) prevStatus = log.posterStatus;
        });
    });

    return { replaceCancelEvents, repairCancelEvents };
};

export interface PosterMetrics {
    newPosters: PosterPin[];
    removedLogs: ActivityLog[];
    replaceCancelEvents: StatusFlagEvent[];
    repairCancelEvents: StatusFlagEvent[];
    newCount: number;
    removedCount: number;
    replaceCancelCount: number;
    repairCancelCount: number;
    newBreakdown: [string, number][];
    removedBreakdown: [string, number][];
    replaceCancelBreakdown: [string, number][];
    repairCancelBreakdown: [string, number][];
}

/**
 * 指定期間の「新規／撤去／張替え解除／修理解除」の4指標を算出する。
 * - 新規: posters.createdAt が期間内にある、現在も存在するポスター（新規でIDが発行された件数）
 * - 撤去: activityLogs.removedChangedTo === true の更新（2026-07-20の記録開始以前は遡って集計不可）
 * - 張替え解除・修理解除: 全履歴から再構築し、期間内のイベントのみ抽出
 *
 * allLogsAsc には、reconstructStatusRemovedEvents の精度を保つため、期間内だけでなく
 * 全履歴（時系列昇順）を渡すこと。
 */
export const computePosterMetrics = (
    posters: PosterPin[],
    allLogsAsc: ActivityLog[],
    rangeStart: number,
    rangeEnd: number,
): PosterMetrics => {
    const logsInRange = allLogsAsc.filter(l => l.changedAt >= rangeStart && l.changedAt < rangeEnd);

    const newPosters = posters.filter(p => typeof p.createdAt === 'number' && p.createdAt >= rangeStart && p.createdAt < rangeEnd);
    const removedLogs = logsInRange.filter(l => l.removedChangedTo === true);

    const { replaceCancelEvents: allReplaceCancel, repairCancelEvents: allRepairCancel } = reconstructStatusRemovedEvents(allLogsAsc);
    const replaceCancelEvents = allReplaceCancel.filter(e => e.changedAt >= rangeStart && e.changedAt < rangeEnd);
    const repairCancelEvents = allRepairCancel.filter(e => e.changedAt >= rangeStart && e.changedAt < rangeEnd);

    return {
        newPosters,
        removedLogs,
        replaceCancelEvents,
        repairCancelEvents,
        newCount: newPosters.length,
        removedCount: removedLogs.length,
        replaceCancelCount: replaceCancelEvents.length,
        repairCancelCount: repairCancelEvents.length,
        newBreakdown: tallyByAddress(newPosters, p => p.address),
        removedBreakdown: tallyByAddress(removedLogs, l => l.posterAddress),
        replaceCancelBreakdown: tallyByAddress(replaceCancelEvents, e => e.posterAddress),
        repairCancelBreakdown: tallyByAddress(repairCancelEvents, e => e.posterAddress),
    };
};
