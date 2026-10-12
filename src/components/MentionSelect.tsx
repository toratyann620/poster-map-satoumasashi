import React, { useRef, useState } from 'react';
import { AtSign, Check, ChevronDown, X } from 'lucide-react';
import type { SlackMentionTarget } from '../types';

/**
 * Slack のメンション先を選ぶ。選択式（セレクトボックス）だが複数選べる。
 *
 * 以前は候補を全部ボタンで並べていたが、事務所の人数ぶん（15件）並ぶと
 * 依頼のフォームがそれだけで埋まってしまうため、畳んだ状態を既定にした。
 *
 * ⚠️ 展開部分は絶対配置ではなく**その場で下に伸びる**作りにしてある。
 * 依頼のフォームは縦スクロールする入れ物（ボトムシート）の中にあり、
 * 絶対配置にすると親の overflow で切られて下の方が見えなくなるため。
 * 押すとフォームが下へ伸びるが、切れて選べなくなるよりは良い。
 */

interface Props {
    targets: SlackMentionTarget[];
    selected: string[];
    onChange: (next: string[]) => void;
    /** 入力欄の見た目。呼び出し元の既存のスタイルに合わせる */
    className?: string;
}

export const MentionSelect: React.FC<Props> = ({ targets, selected, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    const labelOf = (mention: string) => targets.find((t) => t.mention === mention)?.label ?? mention;
    const toggle = (mention: string) => {
        onChange(selected.includes(mention)
            ? selected.filter((m) => m !== mention)
            : [...selected, mention]);
    };

    // 畳んでいるときの表示。選んだ人数が増えても1行に収める
    const summary = selected.length === 0
        ? '選択しない'
        : selected.length <= 2
            ? selected.map(labelOf).join('、')
            : `${labelOf(selected[0])} ほか${selected.length - 1}人`;

    if (targets.length === 0) {
        return (
            <p className="text-xs text-gray-500 dark:text-gray-400">
                候補がまだ登録されていません。管理画面の「設定」から追加できます。
            </p>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`${className} flex items-center justify-between gap-2 text-left`}
            >
                <span className={`inline-flex items-center gap-1.5 truncate ${selected.length ? '' : 'text-gray-400 dark:text-gray-500'}`}>
                    <AtSign className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate">{summary}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                    {selected.length > 0 && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            {selected.length}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {open && (
                <div ref={listRef}
                    className="mt-1.5 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-800">
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-700/60">
                        {targets.map((t) => {
                            const on = selected.includes(t.mention);
                            return (
                                <button key={t.mention} type="button" onClick={() => toggle(t.mention)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors">
                                    <span className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center ${on
                                        ? 'bg-indigo-600 border-indigo-600'
                                        : 'border-gray-300 dark:border-zinc-600'}`}>
                                        {on && <Check className="w-3 h-3 text-white" />}
                                    </span>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80">
                        <button type="button" onClick={() => onChange([])}
                            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400 disabled:opacity-40"
                            disabled={selected.length === 0}>
                            <X className="w-3 h-3" />すべて解除
                        </button>
                        <button type="button" onClick={() => setOpen(false)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            閉じる
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
