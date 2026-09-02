import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PackageOpen, X } from 'lucide-react';

interface Props {
    address: string;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
}

/** よくある撤去の理由。毎回打たずに済むよう、押すだけで入る */
const QUICK_REASONS = ['掲示板の撤去', '所有者の都合', '建物の解体', '貼り替えのため', '掲示期間の終了'];

/**
 * 撤去の確認と理由の入力。
 *
 * 以前は window.prompt を使っていたが、WebView では動きが環境に左右され、
 * 実際に理由が1件も保存されていなかった。画面内のダイアログにすると
 * 確実に動き、よく使う理由をボタンで選べるようにもできる。
 */
export const RemovalDialog: React.FC<Props> = ({ address, onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');

    return createPortal(
        <>
            <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-4 pointer-events-none">
                <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">
                    <div className="flex items-start justify-between px-6 pt-6 pb-2">
                        <div className="flex items-center gap-2">
                            <PackageOpen className="w-5 h-5 text-orange-500 shrink-0" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">ポスターを撤去する</h2>
                        </div>
                        <button onClick={onCancel} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="px-6 pb-6 space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed break-words">
                            {address || '(住所なし)'}
                            <span className="block text-xs text-gray-500 dark:text-gray-500 mt-1">
                                データは残り、マップから見えなくなります。設定で「撤去のピンを表示する」を
                                ONにすると、理由とあわせて確認できます。
                            </span>
                        </p>

                        <div>
                            <label htmlFor="removal-reason" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                                撤去の理由（任意）
                            </label>
                            <input
                                id="removal-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="例: 掲示板ごと撤去された"
                                className="w-full px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {QUICK_REASONS.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setReason(r)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${reason === r
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                onClick={() => onConfirm(reason.trim())}
                                className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors"
                            >
                                撤去する
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
};
