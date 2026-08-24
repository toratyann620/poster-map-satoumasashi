import React, { useState } from 'react';
import { Building2, Plus, Loader2, AlertTriangle, Globe } from 'lucide-react';
import type { Group, PosterPin } from '../types';
import { validateGroupScope, isPosterInScope } from '../lib/groups';
import type { UserData } from '../hooks/useUsers';

interface GroupsTabProps {
    groups: Group[];
    posters: PosterPin[];
    users: UserData[];
    pinTypes: { name: string; color: string }[];
    onSave: (id: string, data: Omit<Group, 'id'>) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
}

const emptyDraft = (): Omit<Group, 'id'> & { id: string } => ({
    id: '', name: '', allowAll: false, cities: [], types: [],
});

/**
 * グループ（事務所）の管理。
 *
 * 条件をコードではなくデータとして持たせているため、新しい事務所の追加は
 * この画面だけで完結する（再デプロイ不要）。
 * 条件を変えると、その事務所が閲覧・編集できるポスターの範囲が即座に変わる。
 */
export const GroupsTab: React.FC<GroupsTabProps> = ({ groups, posters, users, pinTypes, onSave, onRemove }) => {
    const [draft, setDraft] = useState<(Omit<Group, 'id'> & { id: string }) | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // 実データに存在する市区町村（条件の選択肢にする）
    const cityOptions = [...new Set(posters.map(p => p.city || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));

    const countFor = (g: Group) => posters.filter(p => isPosterInScope(g, p)).length;
    const memberCount = (id: string) => users.filter(u => u.groupId === id).length;

    const startEdit = (g: Group) => { setError(''); setDraft({ ...g }); };
    const startNew = () => { setError(''); setDraft(emptyDraft()); };

    const toggleIn = (list: string[], value: string) =>
        list.includes(value) ? list.filter(v => v !== value) : [...list, value];

    const handleSave = async () => {
        if (!draft) return;
        setError('');
        const id = draft.id.trim();
        if (!id) { setError('グループIDを入力してください。'); return; }
        if (!/^[a-z0-9_-]+$/.test(id)) { setError('グループIDは半角英小文字・数字・ハイフン・アンダースコアのみ使えます。'); return; }
        if (!draft.name.trim()) { setError('事務所名を入力してください。'); return; }
        const scopeError = validateGroupScope(draft);
        if (scopeError) { setError(scopeError); return; }

        setSaving(true);
        try {
            await onSave(id, { name: draft.name.trim(), allowAll: draft.allowAll, cities: draft.cities, types: draft.types });
            setDraft(null);
        } catch (e) {
            setError((e as Error)?.message ?? '保存に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (g: Group) => {
        const members = memberCount(g.id);
        if (g.allowAll) {
            window.alert('全ポスターを扱えるグループは削除できません。管理者がデータに触れなくなるためです。');
            return;
        }
        if (!window.confirm(
            `「${g.name}」を削除します。\n\n` +
            (members > 0 ? `⚠️ このグループには ${members} 名が所属しています。削除するとその全員がデータにアクセスできなくなります。\n\n` : '') +
            `よろしいですか？`
        )) return;
        try { await onRemove(g.id); }
        catch (e) { window.alert((e as Error)?.message ?? '削除に失敗しました。'); }
    };

    const chip = (active: boolean) =>
        `px-2.5 py-1 rounded-lg text-xs border transition-colors ${active
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300'}`;

    const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white';

    return (
        <div className="px-6 py-6 overflow-y-auto h-full">
            <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                <div className="max-w-2xl">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">グループ管理</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        事務所ごとに「市区町村 × 種別」で担当範囲を決めます。ここで設定した条件が、
                        アプリで閲覧・編集できるポスターの範囲そのものになります。
                    </p>
                </div>
                <button onClick={startNew}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shrink-0">
                    <Plus className="w-4 h-4" />事務所を追加
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl">
                {groups.map(g => (
                    <div key={g.id} className="p-5 rounded-xl border border-gray-200 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {g.allowAll ? <Globe className="w-4 h-4 text-indigo-600" /> : <Building2 className="w-4 h-4 text-gray-400" />}
                                    {g.name}
                                </h3>
                                <p className="text-xs font-mono text-gray-400 mt-0.5">{g.id}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => startEdit(g)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                    条件を編集
                                </button>
                                {!g.allowAll && (
                                    <button onClick={() => handleRemove(g)}
                                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-900 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                                        削除
                                    </button>
                                )}
                            </div>
                        </div>

                        {g.allowAll ? (
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                すべてのポスターを閲覧・編集できます（制限なし）。
                            </p>
                        ) : (
                            <dl className="text-sm space-y-1.5">
                                <div className="flex gap-2">
                                    <dt className="text-gray-500 dark:text-gray-400 w-20 shrink-0">市区町村</dt>
                                    <dd className="text-gray-800 dark:text-gray-200">{g.cities.join('・') || '—'}</dd>
                                </div>
                                <div className="flex gap-2">
                                    <dt className="text-gray-500 dark:text-gray-400 w-20 shrink-0">種別</dt>
                                    <dd className="text-gray-800 dark:text-gray-200">{g.types.join('・') || '—'}</dd>
                                </div>
                            </dl>
                        )}

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex gap-6 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            <span>担当ポスター <span className="font-bold text-gray-900 dark:text-white">{countFor(g).toLocaleString()}</span> 件</span>
                            <span>所属ユーザー <span className="font-bold text-gray-900 dark:text-white">{memberCount(g.id)}</span> 名</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 編集フォーム ── */}
            {draft && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5">
                            {groups.some(g => g.id === draft.id) ? `「${draft.name}」の条件を編集` : '事務所を追加'}
                        </h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        グループID{groups.some(g => g.id === draft.id) && '（変更不可）'}
                                    </span>
                                    <input value={draft.id} disabled={groups.some(g => g.id === draft.id)}
                                        onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                                        placeholder="例: takahashi"
                                        className={`${field} font-mono disabled:opacity-60`} />
                                </label>
                                <label className="block">
                                    <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">事務所名</span>
                                    <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                        placeholder="例: 高橋事務所" className={field} />
                                </label>
                            </div>

                            <label className="flex items-start gap-2 cursor-pointer select-none p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                                <input type="checkbox" checked={draft.allowAll}
                                    onChange={(e) => setDraft({ ...draft, allowAll: e.target.checked })}
                                    className="w-4 h-4 accent-indigo-600 mt-0.5" />
                                <span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">すべてのポスターを扱える</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        本部相当の権限です。市区町村・種別の条件は無視されます。
                                    </span>
                                </span>
                            </label>

                            {!draft.allowAll && (
                                <>
                                    <div>
                                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">担当する市区町村</span>
                                        <div className="flex flex-wrap gap-2">
                                            {cityOptions.map(c => (
                                                <button key={c} type="button" onClick={() => setDraft({ ...draft, cities: toggleIn(draft.cities, c) })}
                                                    className={chip(draft.cities.includes(c))}>{c}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">担当する種別</span>
                                        <div className="flex flex-wrap gap-2">
                                            {pinTypes.map(t => (
                                                <button key={t.name} type="button" onClick={() => setDraft({ ...draft, types: toggleIn(draft.types, t.name) })}
                                                    className={chip(draft.types.includes(t.name))}>{t.name}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        この条件だと{' '}
                                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                                            {posters.filter(p => isPosterInScope({ ...draft, id: draft.id }, p)).length.toLocaleString()}
                                        </span>{' '}
                                        件のポスターが対象になります。
                                    </p>
                                </>
                            )}

                            {error && (
                                <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                                </p>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setDraft(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                キャンセル
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-colors inline-flex items-center justify-center gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
