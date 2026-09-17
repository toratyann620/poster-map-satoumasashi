import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X, CheckCircle2, Circle, ClipboardList, History, MapPin,
    Users as UsersIcon, CalendarClock, Loader2, Plus, MessageSquare,
    Hourglass, Hand, Undo2,
} from 'lucide-react';
import type { PosterPin, Task, ActivityLog } from '../types';
import { useSession } from '../hooks/useSession';
import { useTasks, isTakenToday } from '../hooks/useTasks';
import { TaskComposer, TaskCompleteDialog } from './TaskComposer';
import { taskAge, TASK_AGE_CLASS } from '../lib/taskAge';

interface Props {
    posters: PosterPin[];
    /** 変更履歴（新しい順）。自分の作業分だけ抜き出して表示する */
    logs: ActivityLog[];
    onClose: () => void;
    /** 依頼に紐づくポスターを地図で開く */
    onOpenPoster: (poster: PosterPin) => void;
}

const fmtDate = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 期限までの残りを、急ぎのものだけ目立つ言い方にする */
const dueLabel = (dueDate?: string): { text: string; urgent: boolean } | null => {
    if (!dueDate) return null;
    const due = new Date(`${dueDate}T23:59:59`).getTime();
    if (Number.isNaN(due)) return null;
    const days = Math.ceil((due - Date.now()) / 86400000);
    if (days < 0) return { text: `期限を${-days}日過ぎています`, urgent: true };
    if (days === 0) return { text: '今日まで', urgent: true };
    if (days === 1) return { text: '明日まで', urgent: true };
    return { text: `あと${days}日`, urgent: false };
};

const KIND_COLOR: Record<string, string> = {
    設置: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    撤去: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    張替え: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    修理: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    その他: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400',
};

const TaskRow: React.FC<{
    task: Task;
    poster?: PosterPin;
    onComplete: () => void;
    onOpenPoster: (p: PosterPin) => void;
    busy: boolean;
    /** 自分の uid。「誰が取っているか」の表示に使う */
    uid?: string | null;
    /** 依頼タブで「今日やる」と取る */
    onTake?: () => void;
    /** マイタスクから依頼へ戻す */
    onRelease?: () => void;
}> = ({ task, poster, onComplete, onOpenPoster, busy, uid, onTake, onRelease }) => {
    const due = dueLabel(task.dueDate);
    const done = task.status === 'done';
    const age = taskAge(task);
    // 今日、別の人が取っている依頼。取れないことと、誰が動いているかを見せる
    const takenByOther = !done && isTakenToday(task) && task.takenBy !== uid;

    return (
        <div className={`rounded-xl border p-3.5 ${done
            ? 'border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/40'
            : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    onClick={onComplete}
                    disabled={busy || done}
                    className="mt-0.5 shrink-0 disabled:opacity-60"
                    title={done ? '完了済み' : '完了にする'}
                >
                    {busy ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        : done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            : <Circle className="w-5 h-5 text-gray-300 dark:text-zinc-600 hover:text-indigo-500 transition-colors" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${KIND_COLOR[task.kind] ?? KIND_COLOR['その他']}`}>
                            {task.kind}
                        </span>
                        {!task.assigneeUid && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                                <UsersIcon className="w-2.5 h-2.5" />全員
                            </span>
                        )}
                        {due && !done && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${due.urgent
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'}`}>
                                <CalendarClock className="w-2.5 h-2.5" />{due.text}
                            </span>
                        )}
                        {takenByOther && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                                <Hand className="w-2.5 h-2.5" />{task.takenByName || '別の方'}が対応中
                            </span>
                        )}
                        {/* 立ってからの日数。期限が無い依頼でも「いつからあるか」が見えるようにする */}
                        {age && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TASK_AGE_CLASS[age.level]}`}
                                title={`${fmtDate(task.createdAt)} に依頼`}>
                                <Hourglass className="w-2.5 h-2.5" />{age.text}
                            </span>
                        )}
                    </div>

                    <p className={`text-sm font-bold break-words ${done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {task.title}
                    </p>
                    {task.body && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap break-words">{task.body}</p>
                    )}
                    {task.address && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 break-words">{task.address}</p>
                    )}

                    {done && task.completionNote && (
                        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40">
                            <p className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                                <MessageSquare className="w-2.5 h-2.5" />完了の結果
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {task.completionNote}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {poster && (
                            <button
                                type="button"
                                onClick={() => onOpenPoster(poster)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                <MapPin className="w-3 h-3" />地図で見る
                            </button>
                        )}
                        {onTake && !done && (
                            <button
                                type="button"
                                onClick={onTake}
                                disabled={busy || takenByOther}
                                className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title={takenByOther ? '本日は別の方が対応中です' : '今日やる依頼としてマイタスクに入れる'}
                            >
                                <Hand className="w-3 h-3" />今日やる
                            </button>
                        )}
                        {onRelease && !done && (
                            <button
                                type="button"
                                onClick={onRelease}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                                title="マイタスクから外して依頼に戻す"
                            >
                                <Undo2 className="w-3 h-3" />依頼に戻す
                            </button>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {done && task.completedAt
                                ? `${fmtDate(task.completedAt)} ${task.completedBy} が完了`
                                : `${task.createdBy} が依頼`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * マイページ。自分あての依頼と、自分がこれまで行った作業をまとめて見る。
 *
 * 依頼は「自分が担当のもの」と「担当者が決まっていない事務所全体のもの」を
 * どちらも出す。後者を別画面にすると、手が空いた人が拾いに行かなくなるため。
 */
export const MyPage: React.FC<Props> = ({ posters, logs, onClose, onOpenPoster }) => {
    const { uid, name, group, role } = useSession();
    const { myTasks, myTakenTasks, doneTasks, completeTask, createTask, takeTask, releaseTask, loading } = useTasks();
    const [tab, setTab] = useState<'tasks' | 'mine' | 'archive' | 'history'>('tasks');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [composing, setComposing] = useState(false);
    // 完了にする対象。結果を書いてもらってから確定する
    const [completing, setCompleting] = useState<Task | null>(null);

    const posterById = useMemo(() => new Map(posters.map((p) => [p.id, p])), [posters]);

    /** 自分が行った作業。履歴には uid が無いため表示名で突き合わせる */
    const myLogs = useMemo(
        () => logs.filter((l) => l.changedBy === name).slice(0, 100),
        [logs, name],
    );

    /** アーカイブは自分が関わったものに絞る（事務所全体の完了一覧は管理画面で見る） */
    const myArchive = useMemo(
        () => doneTasks.filter((t) => t.assigneeUid === uid || t.completedBy === name || !t.assigneeUid).slice(0, 100),
        [doneTasks, uid, name],
    );

    const handleComplete = async (taskId: string, note: string) => {
        setBusyId(taskId);
        try { await completeTask(taskId, note); }
        catch (e) { window.alert((e as Error)?.message ?? '完了にできませんでした。'); }
        finally { setBusyId(null); setCompleting(null); }
    };

    const run = async (taskId: string, fn: () => Promise<void>, failMsg: string) => {
        setBusyId(taskId);
        try { await fn(); }
        catch (e) { window.alert((e as Error)?.message ?? failMsg); }
        finally { setBusyId(null); }
    };

    const TABS = [
        { id: 'tasks' as const, label: `依頼${myTasks.length > 0 ? ` (${myTasks.length})` : ''}`, Icon: ClipboardList },
        { id: 'mine' as const, label: `マイタスク${myTakenTasks.length > 0 ? ` (${myTakenTasks.length})` : ''}`, Icon: Hand },
        { id: 'archive' as const, label: '完了済み', Icon: CheckCircle2 },
        { id: 'history' as const, label: '作業履歴', Icon: History },
    ];

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div
                className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 flex flex-col"
                style={{ maxHeight: '88vh' }}
            >
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                </div>

                <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{name}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {group?.name ?? '所属未設定'}{role === 'admin' && ' ・管理者'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex gap-1 px-3 pt-2.5 pb-2 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t.id
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                        >
                            <t.Icon className="w-3.5 h-3.5" />{t.label}
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto px-4 py-3.5 space-y-2.5">
                    {loading && <p className="text-sm text-gray-400 text-center py-8">読み込んでいます…</p>}

                    {/* 依頼は管理者だけのものではない。現場で気づいたことを
                        その場で誰かに頼めるよう、ここからも出せるようにしてある */}
                    {tab === 'tasks' && !loading && (
                        <button
                            type="button"
                            onClick={() => setComposing(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            作業を依頼する
                        </button>
                    )}

                    {!loading && tab === 'tasks' && (
                        myTasks.length === 0
                            ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">未対応の依頼はありません</p>
                            : myTasks.map((t) => (
                                <TaskRow key={t.id} task={t} poster={t.posterId ? posterById.get(t.posterId) : undefined}
                                    onComplete={() => setCompleting(t)} onOpenPoster={onOpenPoster} busy={busyId === t.id}
                                    uid={uid}
                                    onTake={() => run(t.id, () => takeTask(t.id), 'マイタスクに入れられませんでした。')} />
                            ))
                    )}

                    {/* 今日やると決めた依頼。日付が変わると自動で依頼タブに戻る */}
                    {!loading && tab === 'mine' && (
                        myTakenTasks.length === 0
                            ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10 leading-relaxed">
                                今日のマイタスクはありません<br />
                                <span className="text-xs">依頼タブの「今日やる」で取ると、ここに入ります（翌日には依頼に戻ります）</span>
                            </p>
                            : myTakenTasks.map((t) => (
                                <TaskRow key={t.id} task={t} poster={t.posterId ? posterById.get(t.posterId) : undefined}
                                    onComplete={() => setCompleting(t)} onOpenPoster={onOpenPoster} busy={busyId === t.id}
                                    uid={uid}
                                    onRelease={() => run(t.id, () => releaseTask(t.id), '依頼に戻せませんでした。')} />
                            ))
                    )}

                    {!loading && tab === 'archive' && (
                        myArchive.length === 0
                            ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">完了した依頼はまだありません</p>
                            : myArchive.map((t) => (
                                <TaskRow key={t.id} task={t} poster={t.posterId ? posterById.get(t.posterId) : undefined}
                                    onComplete={() => { }} onOpenPoster={onOpenPoster} busy={false} />
                            ))
                    )}

                    {tab === 'history' && (
                        myLogs.length === 0
                            ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">作業の記録はまだありません</p>
                            : myLogs.map((l) => (
                                <div key={l.id} className="flex items-start gap-2.5 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 shrink-0 mt-0.5">
                                        {l.action}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{l.posterAddress || '(住所なし)'}</p>
                                        {l.diff && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words line-clamp-2">{l.diff}</p>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 shrink-0 tabular-nums mt-0.5">{fmtDate(l.changedAt)}</span>
                                </div>
                            ))
                    )}
                </div>

                <div className="pb-safe shrink-0" />
            </div>

            {composing && (
                <TaskComposer
                    posters={posters}
                    onCreate={createTask}
                    onClose={() => setComposing(false)}
                />
            )}

            {completing && (
                <TaskCompleteDialog
                    title={completing.title}
                    onCancel={() => setCompleting(null)}
                    onConfirm={(note) => handleComplete(completing.id, note)}
                />
            )}
        </>,
        document.body,
    );
};
