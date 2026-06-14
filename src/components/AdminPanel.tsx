import React, { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import type { UserData } from '../hooks/useUsers';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { usePosterData } from '../hooks/usePosterData';
import { DashboardTab } from './DashboardTab';
import { UserAnalyticsTab } from './UserAnalyticsTab';
import {
    UserPlus, Trash2, Shield, User, ArrowLeft, History, PlusCircle, RefreshCw, XCircle,
    LayoutDashboard, Users,
} from 'lucide-react';

interface AdminPanelProps {
    onClose: () => void;
}

type Tab = 'users' | 'history' | 'dashboard' | 'analytics';

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string; Icon: React.ElementType }> = {
    '追加': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', label: '追加', Icon: PlusCircle },
    '更新': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400', label: '更新', Icon: RefreshCw },
    '削除': { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-400', label: '削除', Icon: XCircle },
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
    const { users, loading: usersLoading, createUser, removeUser } = useUsers();
    const { logs, loading: logsLoading } = useActivityLogs(200);
    const { userRole, posters } = usePosterData();
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'general'>('general');
    const [isCreating, setIsCreating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // 一般ユーザーが何らかの方法でこの画面を表示しようとした場合の防御策
    if (userRole !== 'admin') {
        return (
            <div className="absolute inset-0 bg-gray-50 dark:bg-zinc-950 z-50 flex flex-col items-center justify-center p-4">
                <p className="text-red-500 font-bold text-lg mb-4">アクセス権限がありません。</p>
                <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">
                    マップに戻る
                </button>
            </div>
        );
    }

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

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="absolute inset-0 bg-gray-50 dark:bg-zinc-950 z-40 flex flex-col pt-safe">
            {/* ヘッダー */}
            <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 p-4 shrink-0 shadow-sm flex items-center gap-3">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 transition-colors"
                    title="マップに戻る"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">管理者パネル</h1>
            </div>

            {/* タブ */}
            <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 flex gap-1 shrink-0 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'dashboard'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    ダッシュボード
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'analytics'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    ユーザー分析
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'users'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <User className="w-4 h-4" />
                    ユーザー管理
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <History className="w-4 h-4" />
                    変更履歴
                    {logs.length > 0 && (
                        <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                            {logs.length}
                        </span>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">

                {/* ===== ダッシュボードタブ ===== */}
                {activeTab === 'dashboard' && (
                    <DashboardTab posters={posters} />
                )}

                {/* ===== ユーザー分析タブ ===== */}
                {activeTab === 'analytics' && (
                    <UserAnalyticsTab posters={posters} users={users} />
                )}

                {/* ===== ユーザー管理タブ ===== */}
                {activeTab === 'users' && (
                    <>
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

                            {usersLoading ? (
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
                    </>
                )}

                {/* ===== 変更履歴タブ ===== */}
                {activeTab === 'history' && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6 max-w-5xl mx-auto">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4 flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-500" />
                            変更履歴（最新200件）
                        </h2>

                        {logsLoading ? (
                            <div className="animate-pulse flex flex-col gap-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
                                ))}
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">まだ変更履歴がありません</p>
                                <p className="text-sm mt-1">ポスターの追加・更新・削除を行うと、ここに表示されます。</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {logs.map((log) => {
                                    const style = ACTION_STYLES[log.action] || ACTION_STYLES['更新'];
                                    const Icon = style.Icon;
                                    return (
                                        <div
                                            key={log.id}
                                            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            {/* アクションバッジ */}
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${style.bg} ${style.text}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {style.label}
                                            </div>

                                            {/* 内容 */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                                    {log.posterAddress || '（住所なし）'}
                                                </p>
                                                {log.diff && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                        {log.diff}
                                                    </p>
                                                )}
                                            </div>

                                            {/* 操作者・日時 */}
                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                    {log.changedBy}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                    {formatDate(log.changedAt)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="h-10"></div> {/* spacer */}
            </div>
        </div>
    );
};
