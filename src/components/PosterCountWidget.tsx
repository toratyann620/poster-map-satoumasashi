import React, { useMemo } from 'react';
import type { PosterPin, ActivityLog } from '../types';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';

interface PosterCountWidgetProps {
    posters: PosterPin[];
    activityLogs?: ActivityLog[];
}

export const PosterCountWidget: React.FC<PosterCountWidgetProps> = ({ posters, activityLogs = [] }) => {
    const { totalCount, weeklyDiff } = useMemo(() => {
        // 「佐藤まさし」ポスターのみ集計
        const satoPosters = posters.filter(p => p.type === '佐藤まさし');

        // 現在の総枚数
        const total = satoPosters.reduce((sum, p) => sum + (p.quantity || 1), 0);

        // 過去7日間の活動ログから「佐藤まさし」の純増減枚数を集計
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const parseQuantityFromDiff = (diff: string | undefined): number => {
            if (!diff) return 1;
            const match = diff.match(/枚数:\s*(\d+)枚/);
            return match ? parseInt(match[1], 10) : 1;
        };

        let satoWeeklyDiff = 0;
        activityLogs.forEach(log => {
            if (log.changedAt >= oneWeekAgo && log.posterType === '佐藤まさし') {
                const qty = parseQuantityFromDiff(log.diff);
                if (log.action === '追加') {
                    satoWeeklyDiff += qty;
                } else if (log.action === '削除') {
                    satoWeeklyDiff -= qty;
                }
            }
        });

        return { totalCount: total, weeklyDiff: satoWeeklyDiff };
    }, [posters, activityLogs]);

    const TrendIcon = weeklyDiff > 0 ? TrendingUp : weeklyDiff < 0 ? TrendingDown : Minus;
    const trendColor =
        weeklyDiff > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : weeklyDiff < 0
            ? 'text-red-500 dark:text-red-400'
            : 'text-gray-400 dark:text-gray-500';

    const trendLabel =
        weeklyDiff > 0
            ? `先週比 +${weeklyDiff}枚`
            : weeklyDiff < 0
            ? `先週比 ${weeklyDiff}枚`
            : '先週と同じ';

    return (
        <div className="absolute bottom-6 right-4 z-10">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3 min-w-[160px]">
                {/* アイコン */}
                <div className="bg-indigo-50 dark:bg-indigo-950 p-2 rounded-xl">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>

                {/* テキスト */}
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-none mb-0.5">
                        佐藤まさし ポスター
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                        {totalCount.toLocaleString()}
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">枚</span>
                    </p>
                    <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${trendColor}`}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        <span>{trendLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
