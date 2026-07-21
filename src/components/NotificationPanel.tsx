import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, AlertTriangle, PlusCircle, FileEdit, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDailyNotifications, getDayRange } from '../hooks/useDailyNotifications';
import type { DailyNotificationLog } from '../hooks/useDailyNotifications';
import { useAllActivityLogs } from '../hooks/useAllActivityLogs';
import { computePosterMetrics } from '../lib/posterMetrics';
import type { PosterPin } from '../types';

interface Props {
    userId: string | null;
    posters: PosterPin[];
}

const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (dateStr: string, offsetDays: number) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    let relativeStr = '';
    if (offsetDays === 0) {
        relativeStr = ' (今日)';
    } else if (offsetDays === -1) {
        relativeStr = ' (昨日)';
    } else {
        relativeStr = ` (${Math.abs(offsetDays)}日前)`;
    }
    return `${y}年${parseInt(m)}月${parseInt(d)}日${relativeStr}`;
};

const LogItem: React.FC<{ log: DailyNotificationLog }> = ({ log }) => {
    const isUrgent = log.isNeedsRepair || log.isNewRegistration;

    const actionIcon = () => {
        if (log.isNewRegistration) return <PlusCircle className="w-4 h-4 shrink-0" />;
        if (log.action === '削除') return <X className="w-4 h-4 shrink-0" />;
        return <FileEdit className="w-4 h-4 shrink-0" />;
    };

    const urgentLabel = () => {
        if (log.isNeedsRepair && log.isNewRegistration) return '🚨 新規登録・要修理';
        if (log.isNeedsRepair) return '🚨 要修理';
        if (log.isNewRegistration) return '🚨 新規登録';
        return null;
    };

    return (
        <div className={`rounded-xl p-3 mb-2 ${isUrgent
            ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900'
            : 'bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50'
            }`}>
            <div className="flex items-start gap-2">
                <span className={`mt-0.5 ${isUrgent ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                    {actionIcon()}
                </span>
                <div className="flex-1 min-w-0">
                    {urgentLabel() && (
                        <span className="inline-block text-xs font-bold text-red-600 dark:text-red-400 mb-1">
                            {urgentLabel()}
                        </span>
                    )}
                    <p className={`text-sm font-semibold truncate ${isUrgent
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-gray-800 dark:text-gray-200'
                        }`}>
                        {log.posterAddress || '住所未設定'}
                    </p>
                    {log.posterType && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{log.posterType}</p>
                    )}
                    {log.diff && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{log.diff}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {log.changedBy}
                        </span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTime(log.changedAt)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const NotificationPanel: React.FC<Props> = ({ userId, posters }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [offsetDays, setOffsetDays] = useState(-1); // 初期値は昨日
    const panelRef = useRef<HTMLDivElement>(null);

    // スワイプ判定用
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // ベルの未読バッジ用（常に昨日分）
    const { logs: badgeLogs, isUnread: isBadgeUnread } = useDailyNotifications(userId, -1);

    // パネル表示用
    const { logs, isUnread, urgentCount, loading, markAsRead, targetDateStr } = useDailyNotifications(userId, offsetDays);

    // 新規／撤去／張替え解除／修理解除の日次指標（表示中の日付分）
    const { logsAsc: allLogsAsc } = useAllActivityLogs();
    const dayMetrics = useMemo(() => {
        const range = getDayRange(offsetDays);
        return computePosterMetrics(posters, allLogsAsc, range.start, range.end + 1);
    }, [posters, allLogsAsc, offsetDays]);

    // パネル外クリックで閉じる
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleOpen = () => {
        setOffsetDays(-1); // 開くときは昨日をデフォルトにする
        setIsOpen(true);
    };

    const handleMarkAsRead = async () => {
        await markAsRead();
    };

    const goPreviousDay = () => {
        setOffsetDays(prev => prev - 1);
    };

    const goNextDay = () => {
        setOffsetDays(prev => {
            if (prev >= 0) return prev; // 今日が最大値
            return prev + 1;
        });
    };

    // タッチ開始
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    // タッチ終了（スワイプ判定）
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - touchStartRef.current.x;
        const diffY = touch.clientY - touchStartRef.current.y;

        // 横スワイプかつ、縦スワイプが小さめの時だけ発火させる
        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) {
            if (diffX > 0) {
                // 右スワイプ: 1日前（過去）に戻る
                goPreviousDay();
            } else {
                // 左スワイプ: 1日後（未来）に進む
                goNextDay();
            }
        }
        touchStartRef.current = null;
    };

    // Portalで最前面に配置するモーダル部分
    const modalContent = isOpen ? (
        <>
            {/* オーバーレイ - 重ね順をz-[9998]に上げました */}
            <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300" />

            {/* スライドパネル - 重ね順をz-[9999]に上げ、Portalでbody直下に配置します */}
            <div
                ref={panelRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 select-none"
                style={{ maxHeight: '85vh', height: 'auto' }}
            >
                {/* ハンドル */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse" />
                </div>

                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                        <Bell className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">デイリー通知</h2>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                {formatDateLabel(targetDateStr, offsetDays)}
                            </p>
                        </div>
                        {urgentCount > 0 && (
                            <span className="ml-1 flex items-center gap-0.5 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {urgentCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* 日付ナビゲーションバー（ボタンでも切り替え可能） */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50/80 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800/80">
                    <button
                        onClick={goPreviousDay}
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-500 py-1 px-2.5 rounded-lg active:bg-gray-100 dark:active:bg-zinc-800 transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        1日前
                    </button>
                    <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500">
                        左右スワイプで日付切り替え
                    </span>
                    <button
                        onClick={goNextDay}
                        disabled={offsetDays >= 0}
                        className={`flex items-center gap-1 text-xs py-1 px-2.5 rounded-lg transition-all ${
                            offsetDays >= 0
                                ? 'opacity-30 cursor-not-allowed text-gray-300 dark:text-gray-700'
                                : 'text-gray-500 dark:text-gray-400 hover:text-indigo-500 active:bg-gray-100 dark:active:bg-zinc-800'
                        }`}
                    >
                        1日後
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* 新規／撤去／張替え解除／修理解除サマリー */}
                <div className="grid grid-cols-4 gap-1.5 px-4 pt-3">
                    <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-lg py-1.5">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{dayMetrics.newCount}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">新規</p>
                    </div>
                    <div className="text-center bg-orange-50 dark:bg-orange-900/20 rounded-lg py-1.5">
                        <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{dayMetrics.removedCount}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">撤去</p>
                    </div>
                    <div className="text-center bg-amber-50 dark:bg-amber-900/20 rounded-lg py-1.5">
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{dayMetrics.replaceCancelCount}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">張替え</p>
                    </div>
                    <div className="text-center bg-red-50 dark:bg-red-900/20 rounded-lg py-1.5">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{dayMetrics.repairCancelCount}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">修理</p>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: '50vh', minHeight: '150px' }}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mb-2" />
                            <span className="text-xs text-gray-400">読み込み中...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            <Bell className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm font-medium">この日の更新履歴はありません</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {/* 要注意ログを上に表示 */}
                            {logs.filter(l => l.isNeedsRepair || l.isNewRegistration).map(log => (
                                <LogItem key={log.id} log={log} />
                            ))}
                            {/* 通常ログ */}
                            {logs.filter(l => !l.isNeedsRepair && !l.isNewRegistration).map(log => (
                                <LogItem key={log.id} log={log} />
                            ))}
                        </div>
                    )}
                </div>

                {/* フッター：既読ボタン */}
                {logs.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                        {isUnread ? (
                            <button
                                onClick={handleMarkAsRead}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors active:scale-[0.98] shadow-md"
                            >
                                <CheckCheck className="w-4 h-4" />
                                この日の通知を既読にする
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400 py-2.5 font-semibold text-sm">
                                <CheckCheck className="w-4 h-4" />
                                既読済み
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    ) : null;

    return (
        <>
            {/* ベルボタン */}
            <button
                onClick={handleOpen}
                className="relative bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                title="デイリー通知"
            >
                <Bell className="w-5 h-5" />
                {isBadgeUnread && badgeLogs.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-pulse">
                        {badgeLogs.length > 99 ? '99+' : badgeLogs.length}
                    </span>
                )}
            </button>

            {/* Portal で body 直下に挿入する */}
            {createPortal(modalContent, document.body)}
        </>
    );
};
