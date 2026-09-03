import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, X, Search, Loader2, Smartphone, Users as UsersIcon } from 'lucide-react';
import { TASK_KINDS, type PosterPin, type Task, type TaskKind } from '../types';
import { useGroupMembers } from '../hooks/useGroupMembers';

interface Props {
    posters: PosterPin[];
    /** 最初から対象を決めて開く場合（ピンの詳細から依頼するとき） */
    initialPoster?: PosterPin | null;
    onCreate: (input: Omit<Task, 'id' | 'status' | 'createdBy' | 'createdAt' | 'groupId'>) => Promise<void>;
    onClose: () => void;
}

const KIND_COLOR: Record<string, string> = {
    設置: 'bg-emerald-600', 撤去: 'bg-orange-600', 張替え: 'bg-amber-600',
    修理: 'bg-red-600', その他: 'bg-gray-600',
};

/**
 * 依頼を出す画面。管理画面だけでなく、地図からも開けるようにしてある。
 *
 * 現場で気づいたこと（「この掲示板は張り替えが要る」等）は、その場で
 * 依頼にできた方が早い。管理画面を開き直す前提だと結局メモ止まりになる。
 */
export const TaskComposer: React.FC<Props> = ({ posters, initialPoster, onCreate, onClose }) => {
    const { members } = useGroupMembers();

    const [kind, setKind] = useState<TaskKind>('張替え');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [assigneeUid, setAssigneeUid] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [notify, setNotify] = useState(true);
    const [posterQuery, setPosterQuery] = useState('');
    const [poster, setPoster] = useState<PosterPin | null>(initialPoster ?? null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const field = 'w-full px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';
    const label = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5';

    const matches = useMemo(() => {
        const q = posterQuery.trim();
        if (!q) return [];
        return posters.filter((p) => (p.address ?? '').includes(q) || (p.owner ?? '').includes(q)).slice(0, 6);
    }, [posters, posterQuery]);

    const handleCreate = async () => {
        setError('');
        if (!title.trim()) { setError('依頼の内容を入力してください。'); return; }
        setSaving(true);
        try {
            await onCreate({
                kind,
                title: title.trim(),
                body: body.trim(),
                posterId: poster?.id,
                address: poster?.address ?? undefined,
                assigneeUid: assigneeUid || undefined,
                assigneeName: assigneeUid ? members.find((m) => m.id === assigneeUid)?.name : undefined,
                dueDate: dueDate || undefined,
                notify,
            });
            onClose();
        } catch (e) {
            setError((e as Error)?.message ?? '依頼の作成に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 z-[10001] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 flex flex-col"
                style={{ maxHeight: '90vh' }}>
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-indigo-500" />
                        作業を依頼する
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <div>
                        <span className={label}>種類</span>
                        <div className="flex flex-wrap gap-1.5">
                            {TASK_KINDS.map((k) => (
                                <button key={k} type="button" onClick={() => setKind(k)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${kind === k
                                        ? `${KIND_COLOR[k]} border-transparent text-white`
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}>
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="block">
                        <span className={label}>依頼の内容</span>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field}
                            placeholder="例: セブン向かいの掲示板を張り替えてください" />
                    </label>

                    <label className="block">
                        <span className={label}>補足（任意）</span>
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
                            className={`${field} resize-y`} placeholder="持ち物・注意点など" />
                    </label>

                    <div>
                        <span className={label}>対象のポスター（任意）</span>
                        {poster ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                                <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{poster.address || '(住所なし)'}</span>
                                <button type="button" onClick={() => setPoster(null)} className="p-1 rounded shrink-0">
                                    <X className="w-3.5 h-3.5 text-gray-500" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input value={posterQuery} onChange={(e) => setPosterQuery(e.target.value)}
                                        className={`${field} pl-9`} placeholder="住所や所有者で探す" />
                                </div>
                                {matches.length > 0 && (
                                    <div className="mt-1.5 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
                                        {matches.map((p) => (
                                            <button key={p.id} type="button" onClick={() => { setPoster(p); setPosterQuery(''); }}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                                <span className="block truncate">{p.address || '(住所なし)'}</span>
                                                <span className="block text-xs text-gray-400">{p.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className={label}>担当者</span>
                            <select value={assigneeUid} onChange={(e) => setAssigneeUid(e.target.value)} className={field}>
                                <option value="">指定しない</option>
                                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className={label}>期限（任意）</span>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
                        </label>
                    </div>

                    {!assigneeUid && (
                        <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 -mt-1">
                            <UsersIcon className="w-3.5 h-3.5 mt-px shrink-0" />
                            担当者を決めないと、事務所の全員あての依頼になります
                        </p>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                            プッシュ通知を送る
                        </span>
                    </label>

                    <button type="button" onClick={handleCreate} disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition-colors">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        依頼する
                    </button>
                </div>

                <div className="pb-safe shrink-0" />
            </div>
        </>,
        document.body,
    );
};

// ────────────────────────────────────────────────────────────

/**
 * 完了にするときの確認。結果を任意で残せる。
 *
 * チェックだけだと「やった」しか残らず、後から
 * 「どうだったのか」を辿れない。1行でも書いてもらえると次に活きる。
 */
export const TaskCompleteDialog: React.FC<{
    title: string;
    onConfirm: (note: string) => void;
    onCancel: () => void;
}> = ({ title, onConfirm, onCancel }) => {
    const [note, setNote] = useState('');

    return createPortal(
        <>
            <div className="fixed inset-0 z-[10002] bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="fixed inset-0 z-[10003] flex items-end sm:items-center justify-center p-4 pointer-events-none">
                <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">
                    <div className="px-6 pt-6 pb-2">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">依頼を完了にする</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{title}</p>
                    </div>
                    <div className="px-6 pb-6 space-y-4">
                        <label className="block">
                            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                                完了の結果（任意）
                            </span>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                                placeholder="例: 張り替え済み。1枚破損していたので予備を使いました"
                                className="w-full px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                            />
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={onCancel}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-300">
                                やめる
                            </button>
                            <button type="button" onClick={() => onConfirm(note.trim())}
                                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors">
                                完了にする
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
};
