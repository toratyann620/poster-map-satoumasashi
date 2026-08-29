import React, { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
    Table2, MapPinOff, Users, Building2, History, LayoutDashboard,
    LineChart, Settings, LogOut, ExternalLink, ShieldAlert, Megaphone,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { useSession } from '../hooks/useSession';
import { usePosterData } from '../hooks/usePosterData';
import { useUsers } from '../hooks/useUsers';
import { useGroups } from '../hooks/useGroups';
import { usePinTypes } from '../hooks/usePinTypes';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { useAllActivityLogs } from '../hooks/useAllActivityLogs';
import { Login } from '../components/Login';
import { DashboardTab } from '../components/DashboardTab';
import { UserAnalyticsTab } from '../components/UserAnalyticsTab';
import { SettingsTab } from '../components/SettingsTab';
import { CsvActions } from '../components/CsvActions';
import { PostersTable } from './PostersTable';
import { CityFixTab } from './CityFixTab';
import { UsersTab } from './UsersTab';
import { GroupsTab } from './GroupsTab';
import { HistoryTab } from './HistoryTab';
import { AnnouncementsTab } from './AnnouncementsTab';
import { useAnnouncements } from '../hooks/useAnnouncements';

type TabId = 'posters' | 'city' | 'users' | 'groups' | 'announcements' | 'history' | 'dashboard' | 'analytics' | 'settings';

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: 'posters', label: 'ポスター管理', Icon: Table2 },
    { id: 'city', label: '市区町村の手当て', Icon: MapPinOff },
    { id: 'users', label: 'ユーザー管理', Icon: Users },
    { id: 'groups', label: 'グループ管理', Icon: Building2 },
    { id: 'announcements', label: 'お知らせ', Icon: Megaphone },
    { id: 'history', label: '変更履歴', Icon: History },
    { id: 'dashboard', label: 'ダッシュボード', Icon: LayoutDashboard },
    { id: 'analytics', label: 'ユーザー分析', Icon: LineChart },
    { id: 'settings', label: '設定', Icon: Settings },
];

const readTabFromHash = (): TabId => {
    const h = window.location.hash.replace('#', '');
    return TABS.some(t => t.id === h) ? (h as TabId) : 'posters';
};

/**
 * PC向けの管理画面。
 *
 * アクセスできるのは佐藤まさし事務所（allowAll のグループ）の管理者のみ。
 * 画面側のガードに加えてセキュリティルールでも同じ条件を課しているため、
 * URLを直接叩かれても他事務所のデータには到達できない。
 */
const AdminApp: React.FC = () => {
    const session = useSession();
    const [tab, setTab] = useState<TabId>(readTabFromHash);

    // タブ状態をURLのハッシュに残す（リロードや共有に耐えるようにするため。ルータは入れない）
    useEffect(() => {
        const onHashChange = () => setTab(readTabFromHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const goTab = (id: TabId) => { window.location.hash = id; setTab(id); };

    if (!session.ready) {
        return (
            <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (!session.user) return <Login />;

    // 佐藤まさし事務所の管理者以外は入れない
    if (!session.isSuperAdmin) {
        const reason = session.problem === 'no-user-doc'
            ? 'このアカウントはまだ利用が承認されていません。'
            : session.problem === 'no-group'
                ? 'このアカウントにはグループ（事務所）が割り当てられていません。'
                : session.role !== 'admin'
                    ? '管理画面を利用できるのは管理者権限のアカウントのみです。'
                    : '管理画面を利用できるのは佐藤まさし事務所の管理者のみです。';
        return (
            <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950 px-6">
                <div className="max-w-sm text-center">
                    <ShieldAlert className="w-10 h-10 mx-auto text-amber-500 mb-4" />
                    <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">管理画面を開けません</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{reason}</p>
                    <p className="text-xs text-gray-500 mb-6">
                        {session.user.email}
                        {session.group && ` ／ ${session.group.name}`}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <a href="/"
                            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                            地図へ戻る
                        </a>
                        <button onClick={() => signOut(auth)}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
                            ログアウト
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <AdminShell tab={tab} goTab={goTab} sessionName={session.name} uid={session.uid} />;
};

/**
 * 権限確認を通ったあとの本体。
 * データ取得フックはここで初めて呼ぶ（権限の無いユーザーで無駄なクエリを投げないため）。
 */
const AdminShell: React.FC<{
    tab: TabId;
    goTab: (id: TabId) => void;
    sessionName: string;
    uid: string | null;
}> = ({ tab, goTab, sessionName, uid }) => {
    const { posters, updatePoster, bulkUpdatePosters, deletePoster, setPosters, loading } = usePosterData();
    const { users, createUser, updateUser, removeUser } = useUsers();
    const { groups, saveGroup, removeGroup } = useGroups();
    const { pinTypes } = usePinTypes();
    const { logs } = useActivityLogs(1000);
    const { logsAsc } = useAllActivityLogs();
    const { announcements } = useAnnouncements();

    // モバイル側と同じ保存先（localStorage）を使う
    const [showRemovedPins, setShowRemovedPins] = useState(
        () => localStorage.getItem('showRemovedPins') === 'true',
    );
    const toggleShowRemoved = (val: boolean) => {
        setShowRemovedPins(val);
        localStorage.setItem('showRemovedPins', String(val));
    };

    const cityIssues = posters.filter(p => !p.city).length;

    return (
        <div className="h-dvh w-screen flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
            {/* ── サイドバー ── */}
            <nav className="w-60 shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex flex-col">
                <div className="px-5 py-5 border-b border-gray-200 dark:border-zinc-800">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">ポスターマップ</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">管理画面</p>
                </div>

                <ul className="flex-1 py-3 overflow-y-auto">
                    {TABS.map(t => (
                        <li key={t.id}>
                            <button onClick={() => goTab(t.id)}
                                className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-left transition-colors ${tab === t.id
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border-r-2 border-indigo-600'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
                                <t.Icon className="w-4 h-4 shrink-0" />
                                <span className="flex-1">{t.label}</span>
                                {t.id === 'city' && cityIssues > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold tabular-nums">
                                        {cityIssues}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="px-5 py-4 border-t border-gray-200 dark:border-zinc-800 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sessionName}</p>
                    <a href="/" className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />地図画面を開く
                    </a>
                    <button onClick={() => signOut(auth)}
                        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        <LogOut className="w-3.5 h-3.5" />ログアウト
                    </button>
                </div>
            </nav>

            {/* ── コンテンツ ── */}
            <main className="flex-1 min-w-0 flex flex-col">
                {loading && posters.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" />
                    </div>
                ) : (
                    <>
                        {tab === 'posters' && (
                            <div className="flex flex-col h-full min-h-0">
                                <div className="px-6 pt-5 flex items-center justify-between gap-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">ポスター管理</h2>
                                    {/* CsvActions はモバイルのFAB用に縦並びの丸ボタンで作られているため、
                                        管理画面では横並び・小さめに見えるようここで上書きする */}
                                    <div className="flex items-center gap-2 [&>div]:flex-row [&>div]:gap-2 [&_button]:w-10 [&_button]:h-10 [&_button]:shadow-sm">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">CSV</span>
                                        <CsvActions posters={posters} setPosters={setPosters} />
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <PostersTable
                                        posters={posters}
                                        pinTypes={pinTypes}
                                        onUpdate={updatePoster}
                                        onDelete={deletePoster}
                                        onBulkUpdate={(ids, updates, opts) => bulkUpdatePosters(ids, updates, opts)}
                                    />
                                </div>
                            </div>
                        )}

                        {tab === 'city' && (
                            <CityFixTab posters={posters} groups={groups} onUpdate={updatePoster} />
                        )}

                        {tab === 'users' && (
                            <UsersTab
                                users={users}
                                groups={groups}
                                currentUid={uid}
                                onCreate={createUser}
                                onUpdate={updateUser}
                                onRemove={removeUser}
                            />
                        )}

                        {tab === 'groups' && (
                            <GroupsTab
                                groups={groups}
                                posters={posters}
                                users={users}
                                pinTypes={pinTypes}
                                onSave={saveGroup}
                                onRemove={removeGroup}
                            />
                        )}

                        {tab === 'announcements' && (
                            <div className="overflow-y-auto h-full">
                                <AnnouncementsTab announcements={announcements} authorName={sessionName} />
                            </div>
                        )}

                        {tab === 'history' && (
                            <HistoryTab logs={logs} logsAsc={logsAsc} posters={posters} />
                        )}

                        {tab === 'dashboard' && (
                            <div className="overflow-y-auto h-full">
                                <DashboardTab posters={posters} pinTypes={pinTypes} />
                            </div>
                        )}

                        {tab === 'analytics' && (
                            <div className="overflow-y-auto h-full">
                                <UserAnalyticsTab posters={posters} users={users} />
                            </div>
                        )}

                        {tab === 'settings' && (
                            <div className="overflow-y-auto h-full">
                                <SettingsTab showRemovedPins={showRemovedPins} onToggleShowRemoved={toggleShowRemoved} />
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default AdminApp;
