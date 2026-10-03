import React, { useState } from 'react';
import { AtSign, Plus, Trash2, Loader2, Hash } from 'lucide-react';
import { useSlackMentions, normalizeMention } from '../hooks/useSlackMentions';

/**
 * 依頼を Slack に流すときのメンション先を登録する画面。
 *
 * Slack のメンバー一覧はアプリ側から取れない（持っているのは日次レポートと
 * 同じ Incoming Webhook だけで、webhook では users.list を呼べない）ため、
 * メンバーIDを手で登録する。IDは Slack のプロフィールを開いて
 * 「その他」→「メンバーIDをコピー」で取れる。
 *
 * 書けるのは佐藤まさし事務所の管理者だけ（firestore.rules の settings の規定）。
 * それ以外の人には一覧だけを見せる。
 */
export const SlackMentionEditor: React.FC = () => {
    const { targets, loading, save, canEdit } = useSlackMentions();
    const [label, setLabel] = useState('');
    const [raw, setRaw] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const field = 'w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';

    const handleAdd = async () => {
        setError('');
        const mention = normalizeMention(raw);
        if (!label.trim()) { setError('表示名を入力してください。'); return; }
        if (!mention) {
            setError('メンバーID（U から始まる文字列）、@here、@channel のいずれかを入力してください。');
            return;
        }
        if (targets.some((t) => t.mention === mention)) { setError('同じメンション先がすでに登録されています。'); return; }
        setBusy(true);
        try {
            await save([...targets, { label: label.trim(), mention }]);
            setLabel('');
            setRaw('');
        } catch (e) {
            setError((e as Error)?.message ?? '保存に失敗しました。');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (mention: string, name: string) => {
        if (!window.confirm(`「${name}」をメンション先から外しますか？`)) return;
        setError('');
        try {
            await save(targets.filter((t) => t.mention !== mention));
        } catch (e) {
            setError((e as Error)?.message ?? '保存に失敗しました。');
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-2 flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-500" />
                Slack通知のメンション先
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                依頼を出すときに「Slackで通知」を選ぶと、ここで登録した相手をメンションできます。
                投稿先は <span className="font-medium">#13_地元ポスター掲示物</span> です。
                メンバーIDは Slack でその人のプロフィールを開き、「その他」→「メンバーIDをコピー」で取れます。
            </p>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-zinc-800 mb-5">
                    {targets.map((t) => (
                        <li key={t.mention} className="flex items-center gap-2 py-2.5">
                            <AtSign className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{t.label}</span>
                            <code className="text-[11px] text-gray-400 shrink-0">{t.mention}</code>
                            {canEdit && (
                                <button type="button" onClick={() => handleRemove(t.mention, t.label)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    ))}
                    {targets.length === 0 && (
                        <li className="py-3 text-sm text-gray-500 dark:text-gray-400">まだ登録されていません。</li>
                    )}
                </ul>
            )}

            {canEdit ? (
                <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="block">
                            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">表示名</span>
                            <input value={label} onChange={(e) => setLabel(e.target.value)} className={field} placeholder="例: 望月海璃" />
                        </label>
                        <label className="block">
                            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">メンバーID / @here</span>
                            <input value={raw} onChange={(e) => setRaw(e.target.value)} className={field} placeholder="例: U0AHES1MCQP" />
                        </label>
                    </div>
                    <button type="button" onClick={handleAdd} disabled={busy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        追加する
                    </button>
                </div>
            ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-zinc-800 pt-4">
                    追加・削除は佐藤まさし事務所の管理者のみ行えます。
                </p>
            )}
        </div>
    );
};
