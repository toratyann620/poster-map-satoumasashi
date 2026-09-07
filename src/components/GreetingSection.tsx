import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Handshake, Loader2, Undo2, StickyNote } from 'lucide-react';
import type { GreetingRecord } from '../types';

/** 今日の日付を YYYY-MM-DD で返す（input[type=date] の初期値用） */
const today = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const formatDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-');
    return y && m && d ? `${Number(m)}月${Number(d)}日` : ymd;
};

/**
 * 挨拶を記録するダイアログ。
 *
 * 挨拶した人と日付は既定で「操作者・操作日」を入れておくが、どちらも変更できる。
 * 現場で挨拶して事務所に戻ってから入力することがあり、記録した日時をそのまま
 * 挨拶日にすると実態とずれるため。
 */
const GreetingDialog: React.FC<{
    defaultBy: string;
    onSubmit: (input: { by: string; date: string; note: string }) => Promise<void>;
    onCancel: () => void;
}> = ({ defaultBy, onSubmit, onCancel }) => {
    const [by, setBy] = useState(defaultBy);
    const [date, setDate] = useState(today());
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const field = 'w-full px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none';
    const label = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5';

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await onSubmit({ by, date, note });
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[10002] bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="fixed inset-0 z-[10003] flex items-end sm:items-center justify-center p-4 pointer-events-none">
                <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">
                    <div className="px-6 pt-6 pb-2">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Handshake className="w-5 h-5 text-cyan-600" />
                            挨拶を記録する
                        </h2>
                    </div>
                    <div className="px-6 pb-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className={label}>挨拶した人</span>
                                <input value={by} onChange={(e) => setBy(e.target.value)} className={field} maxLength={40} />
                            </label>
                            <label className="block">
                                <span className={label}>挨拶した日</span>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
                            </label>
                        </div>
                        <label className="block">
                            <span className={label}>挨拶備考（任意）</span>
                            <textarea
                                value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                                placeholder="例: ご主人が対応。継続して掲示してよいとのこと"
                                className={`${field} resize-y`}
                            />
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={onCancel}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-300">
                                やめる
                            </button>
                            <button type="button" onClick={save} disabled={saving || !date}
                                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                記録する
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
};

/**
 * 挨拶の記録欄。所有者の特記事項の下に置く。
 *
 * ステータスの1つではなく独立した記録にしてある。挨拶は「済んでいるか」よりも
 * 「誰がいつ挨拶したか」が重要で、2値では次に誰が訪ねればよいか分からないため。
 */
export const GreetingSection: React.FC<{
    greetings: GreetingRecord[];
    currentUserName: string;
    onRecord: (input: { by: string; date: string; note: string }) => Promise<void>;
    onUndo: (greetingId: string) => Promise<void>;
    /** 閲覧のみ（新規追加前のピンなど、まだ記録できない場合） */
    readOnly?: boolean;
    /**
     * 「仮登録」モード。編集・新規登録フォームで使う。
     * true のときは、その場では保存せず親に持たせておき、
     * フォームの「保存する」を押したときにまとめて確定させる。
     * 詳細画面（閲覧モード）では false で、押した時点で即座に保存する。
     */
    pending?: boolean;
    /** 仮登録の一覧（まだ保存されていないぶん） */
    pendingItems?: { by: string; date: string; note: string }[];
    /** 仮登録を1件取り消す */
    onRemovePending?: (index: number) => void;
}> = ({ greetings, currentUserName, onRecord, onUndo, readOnly = false, pending = false, pendingItems = [], onRemovePending }) => {
    const [open, setOpen] = useState(false);
    const [undoing, setUndoing] = useState<string | null>(null);

    // 挨拶した日の新しい順。同じ日なら記録した順
    const sorted = [...greetings].sort((a, b) =>
        a.date === b.date ? b.recordedAt - a.recordedAt : (a.date < b.date ? 1 : -1));

    const undo = async (g: GreetingRecord) => {
        if (!window.confirm(`${g.by} さん（${formatDate(g.date)}）の挨拶の記録を取り消します。よろしいですか？`)) return;
        setUndoing(g.id);
        try { await onUndo(g.id); } finally { setUndoing(null); }
    };

    return (
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">挨拶</p>

            {sorted.length > 0 ? (
                <ul className="space-y-1.5 mb-2">
                    {sorted.map((g) => (
                        <li key={g.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/40">
                            <Handshake className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 dark:text-gray-100">
                                    <span className="font-semibold">{g.by}</span>
                                    <span className="ml-2 text-gray-600 dark:text-gray-400">{formatDate(g.date)}</span>
                                    {g.migrated && (
                                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 align-middle">
                                            旧データ
                                        </span>
                                    )}
                                </p>
                                {g.note && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap flex items-start gap-1">
                                        <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                                        {g.note}
                                    </p>
                                )}
                            </div>
                            {!readOnly && (
                                <button
                                    type="button" onClick={() => undo(g)} disabled={undoing === g.id}
                                    title="この記録を取り消す"
                                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                >
                                    {undoing === g.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Undo2 className="w-4 h-4" />}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            ) : pendingItems.length === 0 ? (
                <p className="text-gray-900 dark:text-gray-100 mb-2">まだ挨拶の記録はありません</p>
            ) : null}

            {/* 仮登録（保存するまで確定しない）。確定済みと見分けが付くよう破線にする */}
            {pendingItems.length > 0 && (
                <ul className="space-y-1.5 mb-2">
                    {pendingItems.map((g, i) => (
                        <li key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-dashed border-amber-300 dark:border-amber-800">
                            <Handshake className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 dark:text-gray-100">
                                    <span className="font-semibold">{g.by}</span>
                                    <span className="ml-2 text-gray-600 dark:text-gray-400">{formatDate(g.date)}</span>
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white align-middle font-bold">
                                        保存前
                                    </span>
                                </p>
                                {g.note && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap flex items-start gap-1">
                                        <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                                        {g.note}
                                    </p>
                                )}
                            </div>
                            <button type="button" onClick={() => onRemovePending?.(i)}
                                title="この仮登録を取り消す"
                                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
                                <Undo2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {pending && pendingItems.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                    「保存する」を押すと確定します。
                </p>
            )}

            {!readOnly && (
                <button
                    type="button" onClick={() => setOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-400 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors text-sm font-bold"
                >
                    <Handshake className="w-4 h-4" />
                    挨拶した
                </button>
            )}

            {open && (
                <GreetingDialog
                    defaultBy={currentUserName}
                    onCancel={() => setOpen(false)}
                    onSubmit={async (input) => { await onRecord(input); setOpen(false); }}
                />
            )}
        </div>
    );
};
