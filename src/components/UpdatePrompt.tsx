import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpCircle, X } from 'lucide-react';
import type { VersionGate } from '../hooks/useAppVersionGate';

const DISMISS_KEY = 'dismissedUpdateVersion';

/** 「あとで」を選んでから、再度案内するまでの期間 */
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 1週間

/**
 * 起動時刻を基準にする。レンダーのたびに現在時刻を読むと結果が不安定になるうえ、
 * 判定は「このセッションを開始した時点で1週間経っていたか」で十分なため。
 */
const SESSION_START = Date.now();

export type Dismissal = { version: string; at: number };

/**
 * 案内を出すべきかを判定する。副作用を持たないので単体で検証できる
 * （`npm run test:update-prompt`）。
 *
 * 出さないのは「同じバージョンについて、まだ日が浅いうちに閉じた」場合だけ。
 * バージョンが上がっていれば出すし、閉じてから1週間たっていても出す。
 */
export const shouldShowUpdatePrompt = (
    dismissal: Dismissal | null,
    latestVersion: string,
    now: number,
): boolean => {
    if (!latestVersion) return false;
    if (!dismissal) return true;
    if (dismissal.version !== latestVersion) return true;
    return now - dismissal.at >= REMIND_AFTER_MS;
};

const readDismissal = (): Dismissal | null => {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return null;
        // 旧形式（バージョン文字列のみ）も読めるようにしておく
        if (!raw.startsWith('{')) return { version: raw, at: SESSION_START };
        const parsed = JSON.parse(raw);
        if (typeof parsed?.version !== 'string') return null;
        return { version: parsed.version, at: Number(parsed.at) || 0 };
    } catch {
        // プライベートモード等で localStorage が使えない場合は毎回表示する
        return null;
    }
};

/**
 * 「最新版ではない」ことを知らせるポップアップ。
 *
 * 利用は止めない（止めるのは下限を割ったときだけ）。あくまで気づいてもらうためのもの。
 *
 * 一度閉じたバージョンは記憶し、同じ版について毎回出さない。
 * 起動のたびに同じ案内が出ると読まずに閉じる癖がつき、
 * 本当に必要なときに気づいてもらえなくなるため。
 *
 * ただし記憶は永久ではない。閉じてから1週間たっても更新されていなければ、
 * もう一度案内する。放置され続けると、古い版が残ったままになるため。
 * さらに新しい版が出た場合も、記憶は無効になって再び表示される。
 */
export const UpdatePrompt: React.FC<{ gate: VersionGate }> = ({ gate }) => {
    // 「どのバージョンについて、いつ閉じたか」を持ち、表示可否はレンダー時に判定する。
    // 初期値の読み取りは初回マウント時の一度きり。
    const [dismissal, setDismissal] = useState<Dismissal | null>(readDismissal);

    if (!gate.updateAvailable) return null;
    if (!shouldShowUpdatePrompt(dismissal, gate.latestVersion, SESSION_START)) return null;

    const close = () => {
        const next: Dismissal = { version: gate.latestVersion, at: Date.now() };
        try {
            localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
        } catch {
            // 記憶できなくても閉じられれば支障はない
        }
        setDismissal(next);
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
