import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { MapPin, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('メールアドレスまたはパスワードが間違っています。');
            } else if (err.code === 'auth/too-many-requests') {
                setError('試行回数が上限に達しました。しばらく時間をおいてからお試しください。');
            } else {
                setError(err.message || '認証エラーが発生しました。');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh w-screen bg-gray-100 dark:bg-zinc-950 flex flex-col justify-center items-center py-12 px-6 lg:px-8">
            <div className="w-full sm:max-w-md">
                <div className="flex justify-center text-indigo-600 dark:text-indigo-400">
                    <MapPin className="w-12 h-12" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                    ポスター配置管理マップ
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    スタッフ専用システム
                </p>
            </div>

            <div className="mt-8 w-full sm:max-w-md">
                <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-xl rounded-2xl sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                メールアドレス
                            </label>
                            <div className="mt-1">
                                {/* id / name / autoComplete は、iCloudキーチェーンや
                                    Googleパスワードマネージャーに「どの欄が何か」を伝えるために要る。
                                    揃っていないと保存も自動入力も提案されない。 */}
                                <input
                                    id="login-email"
                                    name="username"
                                    type="email"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                パスワード
                            </label>
                            <div className="mt-1">
                                <input
                                    id="login-password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? '処理中...' : (
                                    <>
                                        <LogIn className="w-5 h-5 mr-2" />
                                        ログイン
                                    </>
                                )}
                            </button>
                        </div>

                        {/* アカウントは管理者が発行する運用のため、自己登録は提供しない */}
                        <p className="text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            アカウントは管理者が発行します。<br />
                            ログインできない場合は管理者にお問い合わせください。
                        </p>

                        {/* ログイン前から参照できるようにしておく（ストア審査でも確認される）。
                            リンク先は実ファイル名にする。ネイティブアプリではVercelのリライトが
                            効かず、同梱された privacy.html を直接開く必要があるため。 */}
                        <p className="text-center text-xs">
                            <a
                                href="/privacy.html"
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-400 dark:text-gray-500 underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                プライバシーポリシー
                            </a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};
