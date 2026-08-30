import React, { useMemo, useState } from 'react';
import { PlusCircle, RefreshCw, XCircle, Search, PackageOpen, RefreshCcw, Wrench } from 'lucide-react';
import type { ActivityLog, PosterPin } from '../types';
import { computePosterMetrics } from '../lib/posterMetrics';

interface HistoryTabProps {
    logs: ActivityLog[];
    logsAsc: ActivityLog[];
    posters: PosterPin[];
}

const ACTION_STYLES: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
    '追加': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', Icon: PlusCircle },
    '更新': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400', Icon: RefreshCw },
    '削除': { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-400', Icon: XCircle },
};

const PAGE_SIZE = 100;

export const HistoryTab: React.FC<HistoryTabProps> = ({ logs, logsAsc, posters }) => {
    const [keyword, setKeyword] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [page, setPage] = useState(0);

    // 全期間の4指標。撤去・張替え解除・修理解除は履歴の時系列から再構築する。
    // 上限に現在時刻を使うと再描画のたびに値が変わるため、定数で「全期間」を表す。
    const metrics = useMemo(
        () => computePosterMetrics(posters, logsAsc, 0, Number.MAX_SAFE_INTEGER),
        [posters, logsAsc],
    );

    const removedIds = useMemo(() => new Set(metrics.removedLogs.map(l => l.id)), [metrics]);
    const replaceIds = useMemo(() => new Set(metrics.replaceCancelEvents.map(e => e.id)), [metrics]);
    const repairIds = useMemo(() => new Set(metrics.repairCancelEvents.map(e => e.id)), [metrics]);

    const users = useMemo(
        () => [...new Set(logs.map(l => l.changedBy).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
        [logs],
    );

    const filtered = useMemo(() => {
        const term = keyword.trim().toLowerCase();
        return logs.filter(l => {
            if (actionFilter && l.action !== actionFilter) return false;
            if (userFilter && l.changedBy !== userFilter) return false;
            if (term) {
                const hay = [l.posterAddress, l.city, l.posterType, l.diff, l.changedBy].join(' ').toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [logs, keyword, actionFilter, userFilter]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const selectCls = 'px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white';

    const METRIC_CARDS = [
        { label: '新規', value: metrics.newPosters.length, Icon: PlusCircle, tone: 'text-emerald-700 dark:text-emerald-400' },
        { label: '撤去', value: metrics.removedLogs.length, Icon: PackageOpen, tone: 'text-red-700 dark:text-red-400' },
        { label: '張替え解除', value: metrics.replaceCancelEvents.length, Icon: RefreshCcw, tone: 'text-blue-700 dark:text-blue-400' },
        { label: '修理解除', value: metrics.repairCancelEvents.length, Icon: Wrench, tone: 'text-amber-700 dark:text-amber-400' },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">変更履歴</h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 max-w-3xl">
                    {METRIC_CARDS.map(m => (
                        <div key={m.label} className="p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                            <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <m.Icon className={`w-3.5 h-3.5 ${m.tone}`} />{m.label}
                            </p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                                {m.value.toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                    全期間の累計。撤去は2026年7月20日以降の記録から集計しています。
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-56">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
                            placeholder="住所・種別・変更内容・担当者で検索"
                            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }} className={selectCls}>
                        <option value="">操作: すべて</option>
                        <option value="追加">追加</option>
                        <option value="更新">更新</option>
                        <option value="削除">削除</option>
                    </select>
                    <select value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(0); }} className={selectCls}>
                        <option value="">担当者: すべて</option>
                        {users.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        {filtered.length.toLocaleString()} 件
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-900 text-xs text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium w-40">日時</th>
                            <th className="px-4 py-2 text-left font-medium w-20">操作</th>
                            <th className="px-4 py-2 text-left font-medium">対象</th>
                            <th className="px-4 py-2 text-left font-medium">変更内容</th>
                            <th className="px-4 py-2 text-left font-medium w-28">担当者</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {rows.map(l => {
                            const style = ACTION_STYLES[l.action] ?? ACTION_STYLES['更新'];
                            return (
                                <tr key={l.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                                        {new Date(l.changedAt).toLocaleString('ja-JP')}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${style.bg} ${style.text}`}>
                                            <style.Icon className="w-3 h-3" />{l.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                                        {l.posterAddress || <span className="text-gray-400">(住所なし)</span>}
                                        <span className="ml-2 text-xs text-gray-500">{l.posterType}</span>
                                        {l.city && <span className="ml-1 text-xs text-gray-400">/ {l.city}</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                                        {l.diff || '—'}
                                        <span className="ml-2 inline-flex gap-1">
                                            {removedIds.has(l.id) && <Badge tone="red">撤去</Badge>}
                                            {replaceIds.has(l.id) && <Badge tone="blue">張替え解除</Badge>}
                                            {repairIds.has(l.id) && <Badge tone="amber">修理解除</Badge>}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{l.changedBy || '—'}</td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-400">該当する履歴がありません</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pageCount > 1 && (
                <div className="px-6 py-3 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-center gap-4 text-sm">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                        className="px-3 py-1 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800">前へ</button>
                    <span className="text-gray-600 dark:text-gray-400 tabular-nums">{safePage + 1} / {pageCount}</span>
                    <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
                        className="px-3 py-1 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800">次へ</button>
                </div>
            )}
        </div>
    );
};

const Badge: React.FC<{ tone: 'red' | 'blue' | 'amber'; children: React.ReactNode }> = ({ tone, children }) => {
    const cls = {
        red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
        blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
        amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
    }[tone];
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cls}`}>{children}</span>;
};
