import React from 'react';
import { PlusCircle, RefreshCw, XCircle, History, Loader2 } from 'lucide-react';
import { usePosterLogs } from '../hooks/usePosterLogs';

const ACTION_STYLE: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
    追加: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', Icon: PlusCircle },
    更新: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400', Icon: RefreshCw },
    削除: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-400', Icon: XCircle },
};

const formatDateTime = (ms: number) => {
    if (!ms) return '-';
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * 1つのピンの変更履歴。詳細画面の「ログ」タブ。
 *
 * 誰が・いつ・何をしたかを新しい順に並べる。
 * 差分は「その時点の状態」の写しなので、「◯◯から△△へ変えた」ではなく
 * 「そのとき何になっていたか」として読むのが正しい。
 */
export const PinLogTab: React.FC<{ posterId: string }> = ({ posterId }) => {
    const { logs, loading } = usePosterLogs(posterId);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                読み込み中...
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                <History className="w-6 h-6" />
                このピンの変更履歴はまだありません
            </div>
        );
    }

    return (
        <ul className="space-y-2 py-2">
            {logs.map((log) => {
                const style = ACTION_STYLE[log.action] ?? ACTION_STYLE.更新;
                return (
                    <li key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-zinc-800">
                        <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${style.bg}`}>
                            <style.Icon className={`w-4 h-4 ${style.text}`} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                                <span className={`font-bold ${style.text}`}>{log.action}</span>
                                <span className="ml-2 font-medium">{log.changedBy || '（記録なし）'}</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                                {formatDateTime(log.changedAt)}
                            </p>
                            {log.diff && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words whitespace-pre-wrap">
                                    {log.diff}
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};
