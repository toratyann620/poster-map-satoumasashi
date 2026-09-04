import React, { useState } from 'react';
import { httpsCallable, type FunctionsError } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { UserPlus, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * ログイン画面からの新規登録の申請。
 *
 * ここではアカウントは作らない。申請を送るだけで、実際の発行は
 * 管理者が承認したときに Cloud Function が行う。ログイン画面から
 * 直接アカウントが作れると、誰でもポスターデータに触れる口ができてしまう。
 *
 * 送信先は Cloud Function（未認証から呼べる唯一の関数）。Firestore への
 * 直接書き込みにしていないのは、未認証の書き込みを開けずに済ませるため。
 *
 * グループはIDを入力してもらう形にしている。事務所名を一覧で出すと、
 * ログイン前の誰にでも「どの事務所が使っているか」が見えてしまうため。
 */
export const AccountRequestForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [groupId, setGroupId] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const inputClass = 'appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base';
    const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const call = httpsCallable(functions, 'submitAccountRequest');
            await call({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                groupId: groupId.trim(),
                note: note.trim(),
            });
            setDone(true);
        } catch (err) {
            // 関数が返した文言はそのまま出す（何を直せばよいかが書いてある）。
            // 通信断など文言が無い場合だけ、こちらで補う
            const fe = err as FunctionsError;
            setError(fe?.message || '申請の送信に失敗しました。通信状況をご確認ください。');
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="bg-white dark:bg-zinc-900 py-10 px-6 shadow-xl rounded-2xl sm:px-10 text-center">
                <div className="flex justify-center text-emerald-500">
                    <CheckCircle2 className="w-14 h-14" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">申請を送信しました</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    管理者が承認すると、ご入力のメールアドレスへ<br />
                    IDと初期パスワードをお送りします。
                </p>
                <button
                    type="button"
                    onClick={onBack}
                    className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                >
                    ログイン画面へ戻る
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-xl rounded-2xl sm:px-10">
            <form className="space-y-5" onSubmit={handleSubmit}>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-500" />
                    新規登録の申請
                </h3>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="req-name" className={labelClass}>氏名</label>
                    <input
                        id="req-name" name="name" type="text" autoComplete="name" required
                        maxLength={50} className={`mt-1 ${inputClass}`}
                        value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="山田 太郎"
                    />
                </div>

                <div>
                    <label htmlFor="req-email" className={labelClass}>メールアドレス</label>
                    <input
                        id="req-email" name="email" type="email" autoComplete="email"
                        autoCapitalize="none" autoCorrect="off" spellCheck={false} required
                        maxLength={120} className={`mt-1 ${inputClass}`}
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="yamada@example.com"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        このアドレスがログインIDになります。
                    </p>
                </div>

                <div>
                    <label htmlFor="req-group" className={labelClass}>グループID</label>
                    <input
                        id="req-group" name="organization" type="text"
                        autoCapitalize="none" autoCorrect="off" spellCheck={false} required
                        maxLength={40} className={`mt-1 ${inputClass}`}
                        value={groupId} onChange={(e) => setGroupId(e.target.value)}
                        placeholder="nanba"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        所属する事務所から共有されたIDを入力してください。
                    </p>
                </div>

                <div>
                    <label htmlFor="req-note" className={labelClass}>
                        連絡事項 <span className="text-gray-400 font-normal">（任意）</span>
                    </label>
                    <textarea
                        id="req-note" name="note" rows={2} maxLength={300}
                        className={`mt-1 ${inputClass} resize-y`}
                        value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="担当エリアや紹介者など"
                    />
                </div>

                <button
                    type="submit" disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <UserPlus className="w-5 h-5 mr-2" />}
                    {loading ? '送信中...' : '申請を送る'}
                </button>

                <p className="text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    申請の時点ではまだログインできません。<br />
                    管理者の承認後、メールでIDと初期パスワードをお送りします。
                </p>

                <button
                    type="button" onClick={onBack}
                    className="w-full flex justify-center items-center py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    ログイン画面へ戻る
                </button>
            </form>
        </div>
    );
};
