import React, { useState, useMemo } from 'react';
import { Users, FileText, TrendingUp, Award, BarChart2 } from 'lucide-react';
import type { PosterPin } from '../types';
import type { UserData } from '../hooks/useUsers';
import { PERSON_COLORS } from '../types';
import { useDashboardData } from '../hooks/useDashboardData';

interface UserAnalyticsTabProps {
    posters: PosterPin[];
    users: UserData[];
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

const parseQuantityFromDiff = (diff: string | undefined): number => {
    if (!diff) return 1;
    const match = diff.match(/枚数:\s*(\d+)枚/);
    return match ? parseInt(match[1], 10) : 1;
};

const ACTION_BADGE: Record<string, string> = {
    '追加': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    '更新': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    '削除': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const RANK_COLORS = [
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',  // 1位
    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',           // 2位
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',   // 3位
];

// アバター文字色（名前の頭文字から決定）
const AVATAR_COLORS = [
    'from-indigo-400 to-indigo-600',
    'from-violet-400 to-purple-600',
    'from-emerald-400 to-teal-600',
    'from-amber-400 to-orange-500',
    'from-pink-400 to-rose-600',
    'from-cyan-400 to-blue-500',
];

const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ──────────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────────
export const UserAnalyticsTab: React.FC<UserAnalyticsTabProps> = ({ posters, users }) => {
    const [dateFromStr, setDateFromStr] = useState(toInputDate(getDefault30DaysAgo()));
    const [dateToStr, setDateToStr] = useState(toInputDate(new Date()));
    const [selectedUser, setSelectedUser] = useState<string | null>(null);

    const { logs, loading } = useDashboardData(dateFromStr, dateToStr);

    // ──── ユーザー別集計 ────
    const userStats = useMemo(() => {
        // ログ上のユーザー名 + 登録ユーザー名 を合算してユニーク化
        const nameSet = new Set<string>([
            ...logs.map(l => l.changedBy),
            ...users.map(u => u.name || ''),
        ]);
        nameSet.delete('');
        nameSet.delete('unknown');

        return [...nameSet].map(name => {
            const userLogs = logs.filter(l => l.changedBy === name);
            const added = userLogs.filter(l => l.action === '追加').reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0);
            const updated = userLogs.filter(l => l.action === '更新').reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0);
            const deleted = userLogs.filter(l => l.action === '削除').reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0);

            // 種類別の追加数（posterType が記録されているログのみ、枚数で集計）
            const byType: Record<string, number> = {};
            userLogs
                .filter(l => l.action === '追加' && l.posterType)
                .forEach(l => {
                    const qty = parseQuantityFromDiff(l.diff);
                    byType[l.posterType!] = (byType[l.posterType!] || 0) + qty;
                });
            const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            const ownedPosters = posters.filter(p => p.createdBy === name).reduce((sum, p) => sum + (p.quantity || 1), 0);
            const lastActivity = userLogs.length > 0 ? userLogs[0].changedAt : null;

            return { name, added, updated, deleted, totalActions: added + updated + deleted, ownedPosters, lastActivity, topType };
        }).sort((a, b) => b.totalActions - a.totalActions);
    }, [logs, users, posters]);

    const maxActions = Math.max(...userStats.map(u => u.totalActions), 1);

    // ──── 選択ユーザーのログ ────
    const selectedUserLogs = useMemo(
        () => (selectedUser ? logs.filter(l => l.changedBy === selectedUser) : []),
        [logs, selectedUser]
    );

    const formatDateTime = (ts: number) =>
        new Date(ts).toLocaleString('ja-JP', {
            month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    return (
        <div className="space-y-5">

            {/* ───── コントロールバー ───── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-3 flex-wrap">
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
                    {selectedUser && (
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="ml-auto text-xs px-3 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                            ✕ 絞り込み解除
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3 animate-pulse">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 dark:bg-zinc-800 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <>
                    {/* ───── 概要 KPI ───── */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">アクティブユーザー</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {userStats.filter(u => u.totalActions > 0).length}
                                    <span className="text-sm font-normal text-gray-400 ml-1">人</span>
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                                <BarChart2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">期間総アクション</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {logs.reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0).toLocaleString()}
                                    <span className="text-sm font-normal text-gray-400 ml-1">枚分</span>
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">平均アクション/人</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {userStats.filter(u => u.totalActions > 0).length > 0
                                        ? Math.round(logs.reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0) / userStats.filter(u => u.totalActions > 0).length)
                                        : 0}
                                    <span className="text-sm font-normal text-gray-400 ml-1">枚分</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ───── ユーザーランキング ───── */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-500" />
                            アクティビティランキング
                            <span className="text-xs font-normal text-gray-400 ml-1">（クリックで変更ログを表示）</span>
                        </h3>

                        {userStats.length === 0 ? (
                            <div className="text-center text-gray-400 dark:text-gray-500 py-10">
                                この期間にアクティビティはありません
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {userStats.map((u, idx) => (
                                    <button
                                        key={u.name}
                                        onClick={() => setSelectedUser(u.name === selectedUser ? null : u.name)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
                                            u.name === selectedUser
                                                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm'
                                                : 'border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:border-gray-200 dark:hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* アバター */}
                                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarColor(u.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                                                {u.name.charAt(0)}
                                            </div>

                                            {/* 順位 */}
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                                RANK_COLORS[idx] || 'bg-gray-50 text-gray-500 dark:bg-zinc-800 dark:text-gray-500'
                                            }`}>
                                                {idx + 1}
                                            </div>

                                            {/* 名前 + アクティビティバー */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">{u.name}</span>
                                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 ml-2 flex-shrink-0">
                                                        {u.totalActions}<span className="text-xs font-normal text-gray-400 ml-0.5">枚分</span>
                                                    </span>
                                                </div>

                                                {/* 貢献バー */}
                                                <div className="w-full bg-gray-100 dark:bg-zinc-700 rounded-full h-1.5 mb-1.5">
                                                    <div
                                                        className="bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full h-1.5 transition-all duration-700"
                                                        style={{ width: `${(u.totalActions / maxActions) * 100}%` }}
                                                    />
                                                </div>

                                                {/* 詳細バッジ群 */}
                                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    {u.added > 0 && (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{u.added}枚 追加</span>
                                                    )}
                                                    {u.updated > 0 && (
                                                        <span className="text-blue-600 dark:text-blue-400 font-medium">○{u.updated}枚 更新</span>
                                                    )}
                                                    {u.deleted > 0 && (
                                                        <span className="text-red-500 dark:text-red-400 font-medium">−{u.deleted}枚 削除</span>
                                                    )}
                                                    {u.ownedPosters > 0 && (
                                                        <span className="ml-auto text-gray-400">登録ポスター {u.ownedPosters}枚</span>
                                                    )}
                                                    {u.topType && (
                                                        <span className="flex items-center gap-1">
                                                            <span
                                                                className="w-1.5 h-1.5 rounded-full inline-block"
                                                                style={{ backgroundColor: PERSON_COLORS[u.topType as keyof typeof PERSON_COLORS] || '#6B7280' }}
                                                            />
                                                            主: {u.topType}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ───── 選択ユーザーの変更ログ ───── */}
                    {selectedUser && (
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                {selectedUser} の変更ログ
                                <span className="ml-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {selectedUserLogs.length}件
                                </span>
                            </h3>

                            {selectedUserLogs.length === 0 ? (
                                <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                                    この期間の変更ログがありません
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
                                    {selectedUserLogs.map(log => (
                                        <div
                                            key={log.id}
                                            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            {/* アクションバッジ */}
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${ACTION_BADGE[log.action] || ACTION_BADGE['更新']}`}>
                                                {log.action}
                                            </span>

                                            {/* 内容 */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                                    {log.posterAddress || '（住所なし）'}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-0.5">
                                                    {log.posterType && (
                                                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                            <span
                                                                className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                                                                style={{ backgroundColor: PERSON_COLORS[log.posterType as keyof typeof PERSON_COLORS] || '#6B7280' }}
                                                            />
                                                            {log.posterType}
                                                        </span>
                                                    )}
                                                    {log.diff && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{log.diff}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 日時 */}
                                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                                                {formatDateTime(log.changedAt)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <div className="h-4" />
        </div>
    );
};
