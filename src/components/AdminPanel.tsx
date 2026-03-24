import React, { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import type { UserData } from '../hooks/useUsers';
import { UserPlus, Trash2, Shield, User, ArrowLeft } from 'lucide-react';

interface AdminPanelProps {
    onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
    const { users, loading, createUser, removeUser } = useUsers();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'general'>('general');
    const [isCreating, setIsCreating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');
        setIsCreating(true);

        try {
            await createUser({ name, email, role }, password);
            setSuccessMsg(`ユーザー「${name}」を正常に作成しました。`);
            setName('');
            setEmail('');
            setPassword('');
            setRole('general');
        } catch (err: any) {
            setErrorMsg(err.message || 'ユーザー作成に失敗しました。');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteUser = async (user: UserData) => {
        if (user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
            alert('最後の一人の管理者は削除できません。');
            return;
        }

        if (window.confirm(`ユーザー「${user.name}」(${user.email}) を削除しますか？\n※Firestore上のデータのみ削除されます。Auth側の完全削除はFirebaseコンソールから行ってください。`)) {
            try {
                await removeUser(user.id);
            } catch (err) {
                alert('削除に失敗しました。');
            }
        }
    };

    return (
        <div className="absolute inset-0 bg-gray-50 dark:bg-zinc-950 z-40 flex flex-col pt-safe">
            <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 p-4 shrink-0 shadow-sm flex items-center gap-3">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 transition-colors"
                    title="マップに戻る"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">管理者パネル - ユーザー管理</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                {/* 新規作成フォーム */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6 max-w-3xl mx-auto">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-indigo-500" />
                        新規ユーザーの発行
                    </h2>

                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100">
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm mb-4 border border-green-200">
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名前（表示名）</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    placeholder="例: 佐藤 スタッフ"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">権限 (Role)</label>
                                <div className="flex gap-4 items-center h-10 mt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" value="general" checked={role === 'general'} onChange={() => setRole('general')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 bg-gray-100 border-gray-300" />
                                        <span className="text-gray-700 dark:text-gray-300">一般 (General)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" value="admin" checked={role === 'admin'} onChange={() => setRole('admin')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 bg-gray-100 border-gray-300" />
                                        <span className="text-gray-700 dark:text-gray-300 font-medium text-red-600 dark:text-red-400">管理者 (Admin)</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ログインメールアドレス</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    placeholder="staff@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">初期パスワード（6文字以上）</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isCreating}
                                className={`w-full md:w-auto px-6 py-2.5 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-colors ${isCreating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                {isCreating ? 'アカウント作成中（少々お待ちください）...' : '新規アカウントを発行して登録'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ユーザー一覧 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6 max-w-5xl mx-auto overflow-hidden">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" />
                        登録済みユーザー一覧
                    </h2>

                    {loading ? (
                        <div className="animate-pulse flex flex-col gap-3">
                            <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl"></div>
                            <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl"></div>
                            <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-zinc-700">
                                    <tr>
                                        <th className="p-4 font-medium">名前</th>
                                        <th className="p-4 font-medium">メールアドレス</th>
                                        <th className="p-4 font-medium">権限</th>
                                        <th className="p-4 font-medium text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                                ユーザーデータがありません。
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="p-4 text-gray-900 dark:text-white font-medium">{user.name}</td>
                                                <td className="p-4 text-gray-600 dark:text-gray-400">{user.email}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.role === 'admin' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                                        {user.role === 'admin' ? '管理者' : '一般'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 p-2 rounded-lg transition-colors"
                                                        title="削除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="h-10"></div> {/* spacer */}
            </div>
        </div>
    );
};
