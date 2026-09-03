import React, { useMemo, useState } from 'react';
import {
    ClipboardList, Plus, Loader2, Trash2, CheckCircle2, RotateCcw,
    Users as UsersIcon, Smartphone, Search, X, MessageSquare,
} from 'lucide-react';
import { TASK_KINDS, type PosterPin, type Task, type TaskKind } from '../types';
import type { UserData } from '../hooks/useUsers';
import type { Group } from '../types';

interface Props {
    tasks: Task[];
    posters: PosterPin[];
    users: UserData[];
    groups: Group[];
    /** 佐藤まさし事務所の管理者は、他事務所あての依頼も出せる */
    isSuperAdmin: boolean;
    myGroupId: string | null;
    onCreate: (input: Omit<Task, 'id' | 'status' | 'createdBy' | 'createdAt' | 'groupId'> & { groupId?: string }) => Promise<void>;
    onComplete: (id: string, note?: string) => Promise<void>;
    onReopen: (id: string) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
}

const fmt = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};

const KIND_COLOR: Record<string, string> = {
    設置: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    撤去: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    張替え: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    修理: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    その他: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400',
};

/**
 * 作業の依頼（タスク）の管理。
 *
 * 担当者を決めずに出すと事務所の全員あてになる。手が空いた人が拾う種類の
 * 依頼を、別の仕組みを足さずに表せるようにしている。
 */
export const TasksTab: React.FC<Props> = ({
    tasks, posters, users, groups, isSuperAdmin, myGroupId,
    onCreate, onComplete, onReopen, onRemove,
}) => {
    const [kind, setKind] = useState<TaskKind>('設置');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [assigneeUid, setAssigneeUid] = useState('');
    const [groupId, setGroupId] = useState(myGroupId ?? '');
    const [dueDate, setDueDate] = useState('');
    const [notify, setNotify] = useState(true);
    const [posterQuery, setPosterQuery] = useState('');
    const [poster, setPoster] = useState<PosterPin | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [showArchive, setShowArchive] = useState(false);

    const field = 'w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';
    const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1';

    // 依頼先の事務所に所属する人だけを担当者の候補にする。
    // 他事務所の人を担当にしても、その依頼も対象のポスターも見えない。
    const assignees = useMemo(
        () => users.filter((u) => u.groupId === (groupId || myGroupId)),
        [users, groupId, myGroupId],
    );

    const posterMatches = useMemo(() => {
        const q = posterQuery.trim();
        if (!q) return [];
        return posters
            .filter((p) => (p.address ?? '').includes(q) || (p.owner ?? '').includes(q))
            .slice(0, 8);
    }, [posters, posterQuery]);

    const open = tasks.filter((t) => t.status === 'open');
    const done = tasks.filter((t) => t.status === 'done');

    const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
    const userName = (uid?: string) => users.find((u) => u.id === uid)?.name ?? '';

    const handleCreate = async () => {
        setError('');
        if (!title.trim()) { setError('依頼の内容（タイトル）を入力してください。'); return; }
        setSaving(true);
        try {
            await onCreate({
                kind,
                title: title.trim(),
                body: body.trim(),
                posterId: poster?.id,
                address: poster?.address ?? undefined,
                assigneeUid: assigneeUid || undefined,
                assigneeName: assigneeUid ? userName(assigneeUid) : undefined,
                dueDate: dueDate || undefined,
                notify,
                groupId: isSuperAdmin ? (groupId || undefined) : undefined,
            });
            setTitle(''); setBody(''); setAssigneeUid(''); setDueDate('');
            setPoster(null); setPosterQuery('');
        } catch (e) {
            setError((e as Error)?.message ?? '依頼の作成に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const run = async (id: string, fn: () => Promise<void>) => {
        setBusyId(id);
        try { await fn(); }
        catch (e) { window.alert((e as Error)?.message ?? '処理に失敗しました。'); }
        finally { setBusyId(null); }
    };

    const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
        <div className="py-3.5 flex items-start gap-3 border-b border-gray-100 dark:border-zinc-800 last:border-0">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${KIND_COLOR[task.kind] ?? KIND_COLOR['その他']}`}>
                        {task.kind}
                    </span>
                    {task.assigneeUid ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                            {task.assigneeName || userName(task.assigneeUid) || '担当者'}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                            <UsersIcon className="w-2.5 h-2.5" />全員
                        </span>
                    )}
                    {isSuperAdmin && (
                        <span className="text-[10px] text-gray-400">{groupName(task.groupId)}</span>
                    )}
                    {task.dueDate && <span className="text-[10px] text-gray-400">期限 {task.dueDate}</span>}
                </div>

                <p className={`text-sm font-bold break-words ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                    {task.title}
                </p>
                {task.body && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap break-words">{task.body}</p>}
                {task.address && <p className="text-xs text-gray-500 mt-1 break-words">{task.address}</p>}
                {task.completionNote && (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40">
                        <p className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                            <MessageSquare className="w-2.5 h-2.5" />完了の結果
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                            {task.completionNote}
                        </p>
                    </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1.5">
                    {fmt(task.createdAt)} {task.createdBy} が依頼
                    {task.status === 'done' && task.completedAt && ` ／ ${fmt(task.completedAt)} ${task.completedBy} が完了`}
                </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                {task.status === 'open' ? (
                    <button type="button" onClick={() => run(task.id, () => onComplete(task.id))} disabled={busyId === task.id}
                        title="完了にする"
                        className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                        {busyId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    </button>
                ) : (
                    <button type="button" onClick={() => run(task.id, () => onReopen(task.id))} disabled={busyId === task.id}
                        title="未対応に戻す"
                        className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                        {busyId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    </button>
                )}
                <button type="button"
                    onClick={() => { if (window.confirm(`「${task.title}」を削除します。よろしいですか？`)) run(task.id, () => onRemove(task.id)); }}
                    title="削除"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                    作業の依頼
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    担当者を決めずに出すと、事務所の全員あての依頼になります。
                    依頼はマイページに届き、本人が完了にできます。
                </p>
            </div>

            {/* 新規作成 */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">新しい依頼</h3>

                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <span className={labelCls}>種類</span>
                        <div className="flex flex-wrap gap-1.5">
                            {TASK_KINDS.map((k) => (
                                <button key={k} type="button" onClick={() => setKind(k)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${kind === k
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400'}`}>
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="block">
                        <span className={labelCls}>期限（任意）</span>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
                    </label>
                </div>

                <label className="block">
                    <span className={labelCls}>依頼の内容</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className={field}
                        placeholder="例: 妻田南のセブン向かいの掲示板を張り替えてください" />
                </label>

                <label className="block">
                    <span className={labelCls}>補足（任意）</span>
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className={`${field} resize-y`}
                        placeholder="持ち物・連絡先・注意点など。改行はそのまま表示されます。" />
                </label>

                {/* 対象のポスター */}
                <div>
                    <span className={labelCls}>対象のポスター（任意）</span>
                    {poster ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                            <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{poster.address || '(住所なし)'}</span>
                            <button type="button" onClick={() => setPoster(null)} className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800">
                                <X className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input value={posterQuery} onChange={(e) => setPosterQuery(e.target.value)}
                                    className={`${field} pl-9`} placeholder="住所や所有者で探す（新規設置なら空のままで可）" />
                            </div>
                            {posterMatches.length > 0 && (
                                <div className="mt-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
                                    {posterMatches.map((p) => (
                                        <button key={p.id} type="button" onClick={() => { setPoster(p); setPosterQuery(''); }}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                            <span className="block truncate">{p.address || '(住所なし)'}</span>
                                            <span className="block text-xs text-gray-400">{p.type}{p.owner ? ` ・ ${p.owner}` : ''}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isSuperAdmin && (
                        <label className="block">
                            <span className={labelCls}>依頼先の事務所</span>
                            <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setAssigneeUid(''); }} className={field}>
                                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="block">
                        <span className={labelCls}>担当者</span>
                        <select value={assigneeUid} onChange={(e) => setAssigneeUid(e.target.value)} className={field}>
                            <option value="">指定しない（事務所の全員あて）</option>
                            {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </label>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-indigo-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 font-medium">
                            <Smartphone className="w-3.5 h-3.5 text-indigo-500" />プッシュ通知を送る
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            担当者を指定していればその方だけに、指定していなければ事務所の全員に届きます。
                        </span>
                    </span>
                </label>

                <button type="button" onClick={handleCreate} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    依頼する
                </button>
            </div>

            {/* 未対応 */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">未対応（{open.length}件）</h3>
                {open.length === 0
                    ? <p className="text-sm text-gray-400 py-6 text-center">未対応の依頼はありません。</p>
                    : <div>{open.map((t) => <TaskCard key={t.id} task={t} />)}</div>}
            </div>

            {/* 完了済み（アーカイブ） */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
                <button type="button" onClick={() => setShowArchive((v) => !v)}
                    className="w-full flex items-center justify-between text-sm font-bold text-gray-800 dark:text-gray-200">
                    <span>完了済み（{done.length}件）</span>
                    <span className="text-xs font-normal text-gray-400">{showArchive ? '閉じる' : '開く'}</span>
                </button>
                {showArchive && (
                    done.length === 0
                        ? <p className="text-sm text-gray-400 py-6 text-center">完了した依頼はまだありません。</p>
                        : <div className="mt-2">{done.map((t) => <TaskCard key={t.id} task={t} />)}</div>
                )}
            </div>
        </div>
    );
};
