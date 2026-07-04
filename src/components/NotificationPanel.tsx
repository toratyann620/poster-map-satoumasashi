import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, AlertTriangle, PlusCircle, FileEdit } from 'lucide-react';
import { useDailyNotifications } from '../hooks/useDailyNotifications';
import type { DailyNotificationLog } from '../hooks/useDailyNotifications';

interface Props {
    userId: string | null;
}

const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const formatYesterdayDate = (dateStr: string) => {
    if (!dateStr) return '昨日';
    const [y, m, d] = dateStr.split('-');
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
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

export const NotificationPanel: React.FC<Props> = ({ userId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const { logs, isUnread, urgentCount, loading, markAsRead, yesterdayDateStr } = useDailyNotifications(userId);

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
        setIsOpen(true);
    };

    const handleMarkAsRead = async () => {
        await markAsRead();
    };

    return (
        <>
            {/* ベルボタン */}
            <button
                onClick={handleOpen}
                className="relative bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                title="デイリー通知"
            >
                <Bell className="w-5 h-5" />
                {isUnread && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-pulse">
                        {logs.length > 99 ? '99+' : logs.length}
                    </span>
                )}
            </button>

            {/* オーバーレイ */}
            {isOpen && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" />
            )}

            {/* スライドパネル */}
            <div
                ref={panelRef}
                className={`fixed bottom-0 left-0 right-0 z-[70] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-y-0' : 'translate-y-full'
                    } md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8`}
                style={{ maxHeight: '80vh' }}
            >
                {/* ハンドル */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                </div>

                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-500" />
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">デイリー通知</h2>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatYesterdayDate(yesterdayDateStr)}の更新
                            </p>
                        </div>
                        {urgentCount > 0 && (
                            <span className="ml-2 flex items-center gap-1 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                要注意 {urgentCount}件
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

                {/* コンテンツ */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
                    <div className="px-4 py-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                                <Bell className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm font-medium">昨日の更新はありません</p>
                            </div>
                        ) : (
                            <>
                                {/* 要注意ログを上に表示 */}
                                {logs.filter(l => l.isNeedsRepair || l.isNewRegistration).map(log => (
                                    <LogItem key={log.id} log={log} />
                                ))}
                                {/* 通常ログ */}
                                {logs.filter(l => !l.isNeedsRepair && !l.isNewRegistration).map(log => (
                                    <LogItem key={log.id} log={log} />
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* フッター：既読ボタン */}
                {logs.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                        {isUnread ? (
                            <button
                                onClick={handleMarkAsRead}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                <CheckCheck className="w-4 h-4" />
                                既読にする
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 py-2">
                                <CheckCheck className="w-4 h-4" />
                                <span className="text-sm font-medium">既読済み</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};
