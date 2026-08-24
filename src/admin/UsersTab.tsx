import React, { useState } from 'react';
import { UserPlus, Trash2, Shield, User as UserIcon, Loader2, Info } from 'lucide-react';
import type { UserData } from '../hooks/useUsers';
import type { Group } from '../types';

interface UsersTabProps {
    users: UserData[];
    groups: Group[];
    currentUid: string | null;
    onCreate: (data: Omit<UserData, 'id'>, password: string) => Promise<unknown>;
    onUpdate: (uid: string, updates: Partial<Pick<UserData, 'name' | 'role' | 'groupId'>>) => Promise<void>;
    onRemove: (uid: string) => Promise<void>;
}

export const UsersTab: React.FC<UsersTabProps> = ({ users, groups, currentUid, onCreate, onUpdate, onRemove }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'general'>('general');
    const [groupId, setGroupId] = useState(groups[0]?.id ?? 'admin');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busyUid, setBusyUid] = useState<string | null>(null);

    const groupName = (id?: string) => groups.find(g => g.id === id)?.name ?? (id ? `${id}（存在しないグループ）` : '未割当');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (!groupId) { setError('所属グループを選んでください。'); return; }
        setCreating(true);
        try {
            await onCreate({ name, email, role, groupId }, password);
            setSuccess(`${name} さんのアカウントを作成しました（${groupName(groupId)}）`);
            setName(''); setEmail(''); setPassword(''); setRole('general');
        } catch (err) {
            setError((err as Error)?.message ?? 'アカウントの作成に失敗しました。');
        } finally {
            setCreating(false);
        }
    };

    const change = async (uid: string, updates: Partial<Pick<UserData, 'role' | 'groupId'>>) => {
        setBusyUid(uid);
        try { await onUpdate(uid, updates); }
        catch (e) { window.alert((e as Error)?.message ?? '変更に失敗しました。'); }
        finally { setBusyUid(null); }
    };

    const remove = async (u: UserData) => {
        if (!window.confirm(
            `${u.name} さんのアクセス権を削除します。\n\n` +
            `ログイン用のアカウント自体は残りますが、データには一切アクセスできなくなります。\n` +
            `よろしいですか？`
        )) return;
        setBusyUid(u.id);
        try { await onRemove(u.id); }
        catch (e) { window.alert((e as Error)?.message ?? '削除に失敗しました。'); }
        finally { setBusyUid(null); }
    };

    const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white';
    const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

    return (
        <div className="px-6 py-6 overflow-y-auto h-full">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">ユーザー管理</h2>

            {/* ── 新規作成 ── */}
            <form onSubmit={handleCreate}
                className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60 max-w-4xl">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />アカウントを発行する
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <label className="block">
                        <span className={labelCls}>名前</span>
                        <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
                    </label>
                    <label className="block">
                        <span className={labelCls}>メールアドレス</span>
                        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                    </label>
                    <label className="block">
                        <span className={labelCls}>初期パスワード</span>
                        <input required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="6文字以上" className={field} />
                    </label>
                    <label className="block">
                        <span className={labelCls}>所属グループ</span>
                        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field}>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className={labelCls}>権限</span>
                        <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'general')} className={field}>
                            <option value="general">一般</option>
                            <option value="admin">管理者</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 flex items-center gap-4">
                    <button type="submit" disabled={creating}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-colors inline-flex items-center gap-2">
                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}発行する
                    </button>
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    {success && <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}
                </div>

                <p className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 max-w-2xl">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    管理者権限は「佐藤まさし事務所」の場合のみ、ユーザーとグループを変更できます。
                    他の事務所の管理者は、自分の担当範囲のポスターを扱えるだけです。
                </p>
            </form>

            {/* ── 一覧 ── */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800 max-w-5xl">
                <table className="w-full text-sm min-w-[46rem]">
                    <thead className="bg-gray-50 dark:bg-zinc-900 text-xs text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-medium">名前</th>
                            <th className="px-4 py-2.5 text-left font-medium">メールアドレス</th>
                            <th className="px-4 py-2.5 text-left font-medium w-48">所属グループ</th>
                            <th className="px-4 py-2.5 text-left font-medium w-32">権限</th>
                            <th className="px-4 py-2.5 w-16" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {users.map(u => {
                            const isSelf = u.id === currentUid;
                            const busy = busyUid === u.id;
                            const orphanGroup = !!u.groupId && !groups.some(g => g.id === u.groupId);
                            return (
                                <tr key={u.id} className={busy ? 'opacity-50' : ''}>
                                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                                        {u.name}
                                        {isSelf && <span className="ml-2 text-xs text-gray-400">(自分)</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.email}</td>
                                    <td className="px-4 py-2.5">
                                        <select value={u.groupId ?? ''} disabled={busy}
                                            onChange={(e) => change(u.id, { groupId: e.target.value })}
                                            className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white w-full">
                                            <option value="">未割当（アクセス不可）</option>
                                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            {orphanGroup && <option value={u.groupId}>{u.groupId}（存在しないグループ）</option>}
                                        </select>
                                        {!u.groupId && (
                                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                                グループが無いためデータを閲覧できません
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <button disabled={busy || isSelf}
                                            onClick={() => change(u.id, { role: u.role === 'admin' ? 'general' : 'admin' })}
                                            title={isSelf ? '自分の権限は変更できません' : '権限を切り替える'}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${u.role === 'admin'
                                                ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'}`}>
                                            {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                            {u.role === 'admin' ? '管理者' : '一般'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <button onClick={() => remove(u)} disabled={busy || isSelf} aria-label="アクセス権を削除"
                                            title={isSelf ? '自分は削除できません' : 'アクセス権を削除'}
                                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
                削除すると、そのユーザーはログインできてもデータには一切アクセスできなくなります。
                ログイン用のアカウント自体を消すには管理コンソールでの操作が必要です（今後、この画面から行えるようにする予定です）。
            </p>
        </div>
    );
};
