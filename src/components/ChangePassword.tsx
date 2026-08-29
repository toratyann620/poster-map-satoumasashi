import React, { useState } from 'react';
import { updatePassword, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { KeyRound } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { INITIAL_PASSWORD_LENGTH } from '../lib/password';

/**
 * 初期パスワードのままログインしたユーザーに、変更を求める画面。
 *
 * 管理者が発行する初期パスワードは口頭やメモで渡す前提の短いもので、
 * そのまま使い続けられると渡した経路がそのまま弱点になる。
 * 共通仕様の `mustChangePassword` に相当する扱いで、
 * 変更するまで地図には進めない。
 */

/** 初期パスワードより短いものへ変えられては意味が無い */
const MIN_LENGTH = 8;

export const ChangePassword: React.FC<{ uid: string }> = ({ uid }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < MIN_LENGTH) {
            setError(`パスワードは${MIN_LENGTH}文字以上にしてください。`);
            return;
        }
        if (password !== confirm) {
            setError('確認用のパスワードが一致しません。');
            return;
        }

        setSaving(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('ログイン状態が確認できませんでした。');

            await updatePassword(user, password);
            // 変更できてから記録する。順序が逆だと、記録だけ残って
            // 初期パスワードのまま使い続けられる状態になりうる。
            await updateDoc(doc(db, COL.users, uid), { mustChangePassword: false });
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === 'auth/requires-recent-login') {
                // ログインから時間が経つと Firebase 側が再認証を要求する
                setError('確認のため、いったんログインし直してください。');
            } else if (code === 'auth/weak-password') {
                setError('パスワードが簡単すぎます。別のものにしてください。');
            } else {
                setError((err as Error)?.message ?? 'パスワードの変更に失敗しました。');
            }
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-base';

    return (
        <div className="min-h-dvh w-screen bg-gray-100 dark:bg-zinc-950 flex flex-col justify-center items-center py-12 px-6">
            <div className="w-full sm:max-w-md">
                <div className="flex justify-center text-indigo-600 dark:text-indigo-400">
                    <KeyRound className="w-12 h-12" />
                </div>
                <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900 dark:text-white">
                    パスワードを変更してください
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    管理者が発行した{INITIAL_PASSWORD_LENGTH}文字の初期パスワードのままです。<br />
                    ご自分のパスワードに変更してからお使いください。
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
                            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                新しいパスワード
                            </label>
                            <div className="mt-1">
                                {/* new-password を伝えると、パスワードマネージャーが
                                    強いパスワードを提案し、そのまま保存してくれる */}
                                <input
                                    id="new-password"
                                    name="new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    minLength={MIN_LENGTH}
                                    className={inputCls}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={`${MIN_LENGTH}文字以上`}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                確認のためもう一度
                            </label>
                            <div className="mt-1">
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    className={inputCls}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold transition-colors disabled:opacity-50"
                        >
                            {saving ? '変更中...' : '変更する'}
                        </button>

                        <button
                            type="button"
                            onClick={() => signOut(auth)}
                            className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            ログアウト
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
