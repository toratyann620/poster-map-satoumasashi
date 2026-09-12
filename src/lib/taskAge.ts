import type { Task } from '../types';

/**
 * 依頼が立ってから何日放置されているか。
 *
 * 期限（dueDate）とは別の指標。期限を切らない依頼が多く、そのままだと
 * 「いつからあるのか」が一覧で分からず、古い依頼ほど埋もれていく。
 * 未対応の依頼だけを対象にし、完了したものには出さない。
 *
 * 日数は「日付の差」で数える（時刻は見ない）。昨日の夕方に立った依頼は
 * 今朝の時点で「1日経過」。稼働日ベースではなく暦日。
 */
export type TaskAge = {
    days: number;
    text: string;
    /** 目立たせる度合い。3日で注意、7日で警告 */
    level: 'fresh' | 'warn' | 'alert';
};

const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

export const taskAge = (task: Pick<Task, 'status' | 'createdAt'>, now = Date.now()): TaskAge | null => {
    if (task.status !== 'open' || !task.createdAt) return null;
    const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(task.createdAt)) / 86400000));
    const level: TaskAge['level'] = days >= 7 ? 'alert' : days >= 3 ? 'warn' : 'fresh';
    const text = days === 0 ? '今日' : `${days}日経過`;
    return { days, text, level };
};

/** バッジの色。マイページと管理画面で同じ見た目にする */
export const TASK_AGE_CLASS: Record<TaskAge['level'], string> = {
    fresh: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    alert: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};
