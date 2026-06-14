import React, { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, MapPin, CheckCircle, Activity, Clock, AlertTriangle,
} from 'lucide-react';
import type { PosterPin } from '../types';
import { POSTER_PERSONS, POSTER_STATUS_OPTIONS, PERSON_COLORS } from '../types';
import { useDashboardData } from '../hooks/useDashboardData';

interface DashboardTabProps {
    posters: PosterPin[];
}

// ──────────────────────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────────────────────
const toInputDate = (date: Date) => date.toISOString().split('T')[0];

const getDefault30DaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
};

// ──────────────────────────────────────────────────────────
// カスタム SVG バーチャート
// ──────────────────────────────────────────────────────────
interface DailyData {
    date: string;
    added: number;
    updated: number;
    deleted: number;
}

const ActivityBarChart: React.FC<{ data: DailyData[] }> = ({ data }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; item: DailyData } | null>(null);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
                この期間にアクティビティはありません
            </div>
        );
    }

    const maxTotal = Math.max(...data.map(d => d.added + d.updated + d.deleted), 1);
    const chartH = 160;
    const barW = Math.max(6, Math.min(28, Math.floor(560 / data.length) - 3));
    const gap = 3;
    const totalW = data.length * (barW + gap);
    const labelInterval = Math.max(1, Math.ceil(data.length / 8));

    return (
        <div className="relative overflow-x-auto" onMouseLeave={() => setTooltip(null)}>
            <svg
                width={Math.max(totalW + 24, 560)}
                height={chartH + 32}
                className="min-w-full"
            >
                {/* グリッド線 */}
                {[0.25, 0.5, 0.75, 1.0].map(ratio => (
                    <g key={ratio}>
                        <line
                            x1={20} y1={chartH * (1 - ratio)}
                            x2={Math.max(totalW, 560)} y2={chartH * (1 - ratio)}
                            stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4,3"
                            className="text-gray-400"
                        />
                        <text x={14} y={chartH * (1 - ratio) + 3} textAnchor="end" fontSize={9} className="fill-gray-400 dark:fill-gray-500">
                            {Math.round(maxTotal * ratio)}
                        </text>
                    </g>
                ))}

                {/* バー群 */}
                {data.map((d, i) => {
                    const x = 22 + i * (barW + gap);
                    const total = d.added + d.updated + d.deleted;
                    const hAdded = (d.added / maxTotal) * chartH;
                    const hUpdated = (d.updated / maxTotal) * chartH;
                    const hDeleted = (d.deleted / maxTotal) * chartH;

                    return (
                        <g
                            key={i}
                            onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, item: d })}
                            style={{ cursor: 'default' }}
                        >
                            {/* 削除（下） */}
                            {hDeleted > 0 && (
                                <rect x={x} y={chartH - hDeleted} width={barW} height={hDeleted} fill="#F87171" rx={2} />
                            )}
                            {/* 更新（中） */}
                            {hUpdated > 0 && (
                                <rect x={x} y={chartH - hDeleted - hUpdated} width={barW} height={hUpdated} fill="#60A5FA" rx={2} />
                            )}
                            {/* 追加（上） */}
                            {hAdded > 0 && (
                                <rect x={x} y={chartH - hDeleted - hUpdated - hAdded} width={barW} height={hAdded} fill="#34D399" rx={2} />
                            )}
                            {/* 合計ラベル */}
                            {total > 0 && barW >= 14 && (
                                <text
                                    x={x + barW / 2} y={chartH - hDeleted - hUpdated - hAdded - 3}
                                    textAnchor="middle" fontSize={8}
                                    className="fill-gray-500 dark:fill-gray-400"
                                >
                                    {total}
                                </text>
                            )}
                            {/* X軸ラベル */}
                            {i % labelInterval === 0 && (
                                <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={9} className="fill-gray-400 dark:fill-gray-500">
                                    {d.date}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* ツールチップ */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-xl rounded-xl px-3.5 py-2.5 text-xs"
                    style={{ left: tooltip.x + 14, top: tooltip.y - 80 }}
                >
                    <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{tooltip.item.date}</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-gray-300">追加: <strong>{tooltip.item.added}</strong>件</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-gray-300">更新: <strong>{tooltip.item.updated}</strong>件</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-gray-300">削除: <strong>{tooltip.item.deleted}</strong>件</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ──────────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────────
export const DashboardTab: React.FC<DashboardTabProps> = ({ posters }) => {
    const [dateFromStr, setDateFromStr] = useState(toInputDate(getDefault30DaysAgo()));
    const [dateToStr, setDateToStr] = useState(toInputDate(new Date()));
    const [statusFilter, setStatusFilter] = useState<string[]>([...POSTER_STATUS_OPTIONS]);

    const { logs, loading } = useDashboardData(dateFromStr, dateToStr);

    // ──── フィルター済みポスター（ステータスで絞り込み） ────
    const filteredPosters = useMemo(() => {
        if (statusFilter.length === 0) return [];
        if (statusFilter.length === POSTER_STATUS_OPTIONS.length) return posters;
        return posters.filter(p => {
            const statuses = Array.isArray(p.status) ? p.status : [p.status];
            return statusFilter.some(s => statuses.includes(s));
        });
    }, [posters, statusFilter]);

    // ──── KPI 計算 ────
    const installedPosters = useMemo(() =>
        posters.filter(p => {
            const statuses = Array.isArray(p.status) ? p.status : [p.status];
            return statuses.includes('設置済');
        }).length,
    [posters]);

    const uninstalledCount = useMemo(() =>
        posters.filter(p => {
            const statuses = Array.isArray(p.status) ? p.status : [p.status];
            return statuses.includes('未設置');
        }).length,
    [posters]);

    const installedRate = posters.length > 0
        ? Math.round((installedPosters / posters.length) * 100)
        : 0;

    const periodAdded = logs.filter(l => l.action === '追加').length;
    const periodUpdated = logs.filter(l => l.action === '更新').length;
    const periodDeleted = logs.filter(l => l.action === '削除').length;
    const netChange = periodAdded - periodDeleted;
    const lastActionTs = logs.length > 0 ? logs[0].changedAt : null;

    // ──── 最もアクティブな曜日 ────
    const mostActiveDow = useMemo(() => {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const counts = Array(7).fill(0);
        logs.forEach(l => counts[new Date(l.changedAt).getDay()]++);
        const maxCount = Math.max(...counts);
        return maxCount > 0 ? days[counts.indexOf(maxCount)] : null;
    }, [logs]);

    // ──── 種類別サマリー ────
    const typeSummary = useMemo(() =>
        POSTER_PERSONS.map(type => {
            const allOfType = posters.filter(p => p.type === type);
            const filteredOfType = filteredPosters.filter(p => p.type === type);
            const installedOfType = allOfType.filter(p => {
                const statuses = Array.isArray(p.status) ? p.status : [p.status];
                return statuses.includes('設置済');
            }).length;
            const installRate = allOfType.length > 0
                ? Math.round((installedOfType / allOfType.length) * 100)
                : 0;
            const added = logs.filter(l => l.action === '追加' && l.posterType === type).length;
            const deleted = logs.filter(l => l.action === '削除' && l.posterType === type).length;
            return {
                type,
                current: filteredOfType.length,
                currentAll: allOfType.length,
                installRate,
                added,
                deleted,
                net: added - deleted,
            };
        }).filter(s => s.currentAll > 0 || s.added > 0),
    [posters, filteredPosters, logs]);

    // ──── 日別アクティビティデータ ────
    const dailyData = useMemo((): DailyData[] => {
        const result: DailyData[] = [];
        const cursor = new Date(dateFromStr + 'T00:00:00');
        const end = new Date(dateToStr + 'T23:59:59');

        while (cursor <= end) {
            const dayStart = new Date(cursor).setHours(0, 0, 0, 0);
            const dayEnd = new Date(cursor).setHours(23, 59, 59, 999);
            const dayLogs = logs.filter(l => l.changedAt >= dayStart && l.changedAt <= dayEnd);
            result.push({
                date: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
                added: dayLogs.filter(l => l.action === '追加').length,
                updated: dayLogs.filter(l => l.action === '更新').length,
                deleted: dayLogs.filter(l => l.action === '削除').length,
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return result;
    }, [logs, dateFromStr, dateToStr]);

    // ──── 時間差フォーマット ────
    const formatRelative = (ts: number) => {
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'たった今';
        if (m < 60) return `${m}分前`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}時間前`;
        return `${Math.floor(h / 24)}日前`;
    };

    const toggleStatus = (s: string) => {
        setStatusFilter(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
        );
    };

    const totalCurrentFiltered = typeSummary.reduce((sum, s) => sum + s.current, 0);
    const totalAdded = typeSummary.reduce((sum, s) => sum + s.added, 0);
    const totalDeleted = typeSummary.reduce((sum, s) => sum + s.deleted, 0);

    return (
        <div className="space-y-5">

            {/* ───── コントロールバー ───── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4">
                <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                    {/* 日付レンジ */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">集計期間</span>
                        <input
                            type="date" value={dateFromStr}
                            onChange={e => setDateFromStr(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-gray-400">〜</span>
                        <input
                            type="date" value={dateToStr}
                            onChange={e => setDateToStr(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {/* ステータスフィルター */}
                    <div className="flex items-center gap-3 flex-wrap sm:ml-auto">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ステータス</span>
                        {POSTER_STATUS_OPTIONS.map(s => (
                            <label key={s} className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={statusFilter.includes(s)}
                                    onChange={() => toggleStatus(s)}
                                    className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                                />
                                <span className="text-xs text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                    {s}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-gray-100 dark:bg-zinc-800 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <>
                    {/* ───── KPI カード ───── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* 総ピン数 */}
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">総ピン数</span>
                                <MapPin className="w-4 h-4 text-indigo-300" />
                            </div>
                            <div className="text-3xl font-bold">{filteredPosters.length.toLocaleString()}</div>
                            <div className="text-xs text-indigo-200 mt-0.5">全体: {posters.length.toLocaleString()}件</div>
                            <div className="mt-2 flex items-center gap-1 text-sm">
                                {netChange >= 0 ? (
                                    <><TrendingUp className="w-3.5 h-3.5 text-emerald-300" /><span className="text-emerald-300 font-medium">+{netChange}</span></>
                                ) : (
                                    <><TrendingDown className="w-3.5 h-3.5 text-red-300" /><span className="text-red-300 font-medium">{netChange}</span></>
                                )}
                                <span className="text-indigo-300 text-xs">期間純増減</span>
                            </div>
                        </div>

                        {/* 設置済み率 */}
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">設置済み率</span>
                                <CheckCircle className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div className="text-3xl font-bold">{installedRate}%</div>
                            <div className="mt-2 bg-emerald-600/50 rounded-full h-1.5">
                                <div
                                    className="bg-white rounded-full h-1.5 transition-all duration-700"
                                    style={{ width: `${installedRate}%` }}
                                />
                            </div>
                            <div className="mt-1.5 text-xs text-emerald-100">
                                設置済: {installedPosters.toLocaleString()} / {posters.length.toLocaleString()}枚
                            </div>
                        </div>

                        {/* 期間アクション数 */}
                        <div className="bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-violet-200 uppercase tracking-wide">期間アクション</span>
                                <Activity className="w-4 h-4 text-violet-300" />
                            </div>
                            <div className="text-3xl font-bold">{logs.length.toLocaleString()}</div>
                            <div className="mt-1.5 flex gap-2.5 text-xs text-violet-200">
                                <span className="text-emerald-300 font-medium">+{periodAdded}</span>
                                <span className="text-blue-300">○{periodUpdated}</span>
                                <span className="text-red-300">−{periodDeleted}</span>
                            </div>
                        </div>

                        {/* 最終更新 */}
                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-amber-200 uppercase tracking-wide">最終更新</span>
                                <Clock className="w-4 h-4 text-amber-300" />
                            </div>
                            <div className="text-2xl font-bold">
                                {lastActionTs ? formatRelative(lastActionTs) : '—'}
                            </div>
                            {mostActiveDow && (
                                <div className="mt-1 text-xs text-amber-200">最活発: <strong>{mostActiveDow}曜日</strong></div>
                            )}
                            {uninstalledCount > 0 && (
                                <div className="mt-2 flex items-center gap-1 bg-amber-600/40 rounded-lg px-2 py-0.5 text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    未設置: {uninstalledCount}件
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ───── 日別アクション推移グラフ ───── */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                                日別アクション推移
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />追加
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />更新
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />削除
                                </span>
                            </div>
                        </div>
                        <ActivityBarChart data={dailyData} />
                    </div>

                    {/* ───── 種類別サマリーテーブル ───── */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
                            種類別サマリー
                        </h3>

                        {typeSummary.length === 0 ? (
                            <div className="text-center text-gray-400 dark:text-gray-500 py-10">
                                データがありません
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-zinc-800">
                                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">種類</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">現在数</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">設置率</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">+追加</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">−削除</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">純増減</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/80">
                                        {typeSummary.map(s => (
                                            <tr key={s.type} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: PERSON_COLORS[s.type as keyof typeof PERSON_COLORS] || '#6B7280' }}
                                                        />
                                                        <span className="font-medium text-gray-800 dark:text-gray-200">{s.type}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                    {s.current.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-gray-100 dark:bg-zinc-700 rounded-full h-1.5">
                                                            <div
                                                                className="bg-emerald-400 rounded-full h-1.5 transition-all"
                                                                style={{ width: `${s.installRate}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right">
                                                            {s.installRate}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {s.added > 0 ? `+${s.added}` : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold text-red-500 dark:text-red-400">
                                                    {s.deleted > 0 ? `−${s.deleted}` : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <span className={`font-bold text-sm ${
                                                        s.net > 0 ? 'text-emerald-600 dark:text-emerald-400'
                                                        : s.net < 0 ? 'text-red-500 dark:text-red-400'
                                                        : 'text-gray-400 dark:text-zinc-500'
                                                    }`}>
                                                        {s.net > 0 ? `+${s.net}` : s.net === 0 ? '±0' : s.net}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60">
                                            <td className="py-3 px-3 font-bold text-gray-700 dark:text-gray-300">合計</td>
                                            <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                {totalCurrentFiltered.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs text-gray-500">
                                                {installedRate}%
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                +{totalAdded}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-red-500 dark:text-red-400">
                                                −{totalDeleted}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className={`font-bold ${netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    {netChange >= 0 ? '+' : ''}{netChange}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="h-4" />
        </div>
    );
};
