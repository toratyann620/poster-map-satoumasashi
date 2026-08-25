import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpCircle, X } from 'lucide-react';
import type { VersionGate } from '../hooks/useAppVersionGate';

const DISMISS_KEY = 'dismissedUpdateVersion';

/**
 * 「最新版ではない」ことを知らせるポップアップ。
 *
 * 利用は止めない（止めるのは下限を割ったときだけ）。あくまで気づいてもらうためのもの。
 *
 * 一度閉じたバージョンは記憶し、同じ版について毎回出さない。
 * 起動のたびに同じ案内が出ると読まずに閉じる癖がつき、
 * 本当に必要なときに気づいてもらえなくなるため。
 * さらに新しい版が出れば、記憶は無効になって再び表示される。
 */
export const UpdatePrompt: React.FC<{ gate: VersionGate }> = ({ gate }) => {
    // 「どのバージョンについて閉じたか」だけを持ち、表示可否はレンダー時に判定する。
    // 初期値の読み取りは初回マウント時の一度きり。
    const [dismissedVersion, setDismissedVersion] = useState<string>(() => {
        try {
            return localStorage.getItem(DISMISS_KEY) ?? '';
        } catch {
            // プライベートモード等で localStorage が使えない場合は毎回表示する
            return '';
        }
    });

    if (!gate.updateAvailable || !gate.latestVersion) return null;
    if (dismissedVersion === gate.latestVersion) return null;

    const close = () => {
        try {
            localStorage.setItem(DISMISS_KEY, gate.latestVersion);
        } catch {
            // 記憶できなくても閉じられれば支障はない
        }
        setDismissedVersion(gate.latestVersion);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 pt-6 pb-5 text-center">
                    <ArrowUpCircle className="w-10 h-10 mx-auto text-indigo-600 dark:text-indigo-400 mb-4" />
                    <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        新しいバージョンがあります
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {gate.message || '最新版へ更新すると、追加された機能や修正がご利用いただけます。'}
                    </p>
                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-500 tabular-nums">
                        現在 {gate.currentVersion} ／ 最新 {gate.latestVersion}
                    </p>
                </div>

                <div className="px-6 pb-6 flex flex-col gap-2">
                    {gate.storeUrl ? (
                        <a
                            href={gate.storeUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={close}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold text-center transition-colors"
                        >
                            更新する
                        </a>
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
                            TestFlight または Google Play から最新版を入手してください。
                        </p>
                    )}
                    <button
                        onClick={close}
                        className="w-full py-3 rounded-xl border border-gray-300 dark:border-zinc-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                        <X className="w-4 h-4" />
                        あとで
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
