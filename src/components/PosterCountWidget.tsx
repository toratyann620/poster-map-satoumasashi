import React, { useMemo } from 'react';
import type { PosterPin } from '../types';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';

interface PosterCountWidgetProps {
    posters: PosterPin[];
}

export const PosterCountWidget: React.FC<PosterCountWidgetProps> = ({ posters }) => {
    const { totalCount, weeklyDiff } = useMemo(() => {
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        // 現在の総枚数
        const total = posters.reduce((sum, p) => sum + (p.quantity || 1), 0);

        // 1週間以内に追加されたポスターの枚数（先週比 = 増加分）
        const newThisWeek = posters
            .filter(p => p.createdAt >= oneWeekAgo)
            .reduce((sum, p) => sum + (p.quantity || 1), 0);

        return { totalCount: total, weeklyDiff: newThisWeek };
    }, [posters]);

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
                        掲示中のポスター
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
