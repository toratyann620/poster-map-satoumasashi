import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { POSTER_STATUS_OPTIONS, type PosterPin } from '../types';

export interface BulkEditResult {
    succeeded: number;
    failed: { id: string; reason: string }[];
}

interface BulkEditDialogProps {
    /** 選択されているポスター（件数表示と、変更内容の妥当性チェックに使う） */
    targets: PosterPin[];
    pinTypes: { name: string; color: string }[];
    onClose: () => void;
    onApply: (
        updates: Partial<PosterPin>,
        opts: { tagsAdd: string[]; tagsRemove: string[] },
        onProgress: (done: number, total: number) => void,
    ) => Promise<BulkEditResult>;
}

/**
 * 「この項目を変更する」チェックと入力欄をまとめた行。
 * render 内で定義すると再描画のたびに別コンポーネント扱いになり、
 * 入力欄が再マウントされてフォーカスが飛ぶため、モジュールスコープに置く。
 */
const Row: React.FC<{
    on: boolean;
    setOn: (v: boolean) => void;
    label: string;
    children: React.ReactNode;
}> = ({ on, setOn, label, children }) => (
    <div className={`px-4 py-3 rounded-lg border transition-colors ${on
        ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
        : 'border-gray-200 dark:border-zinc-700'}`}>
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)}
                className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{label}</span>
        </label>
        {on && <div className="mt-3 pl-6">{children}</div>}
    </div>
);

/**
 * 複数ポスターの一括編集。
 *
 * 「触った項目だけを反映する」方式にしている。チェックを入れていない項目は
 * 送信対象に含めないため、意図しない上書き（CSVインポートで一度起きた事故と同種）を防ぐ。
 */
export const BulkEditDialog: React.FC<BulkEditDialogProps> = ({ targets, pinTypes, onClose, onApply }) => {
    // どの項目を変更するか（チェックが入っている項目だけを送る）
    const [useStatus, setUseStatus] = useState(false);
    const [status, setStatus] = useState<string[]>([]);

    const [useType, setUseType] = useState(false);
    const [type, setType] = useState(pinTypes[0]?.name ?? '佐藤まさし');

    const [useRemoved, setUseRemoved] = useState(false);
    const [removed, setRemoved] = useState(false);

    const [tagsAddText, setTagsAddText] = useState('');
    const [tagsRemoveText, setTagsRemoveText] = useState('');

    const [useQuantity, setUseQuantity] = useState(false);
    const [quantity, setQuantity] = useState(1);

    const [usePlacement, setUsePlacement] = useState(false);
    const [placement, setPlacement] = useState('');

    const [useOwner, setUseOwner] = useState(false);
    const [owner, setOwner] = useState('');

    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<BulkEditResult | null>(null);

    const parseTags = (s: string) => s.split(/[,、\s]+/).map(t => t.trim()).filter(Boolean);
    const tagsAdd = parseTags(tagsAddText);
    const tagsRemove = parseTags(tagsRemoveText);

    const changeCount =
        (useStatus ? 1 : 0) + (useType ? 1 : 0) + (useRemoved ? 1 : 0) +
        (tagsAdd.length ? 1 : 0) + (tagsRemove.length ? 1 : 0) +
        (useQuantity ? 1 : 0) + (usePlacement ? 1 : 0) + (useOwner ? 1 : 0);

    const toggleStatus = (s: string) =>
        setStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

    const handleApply = async () => {
        const updates: Partial<PosterPin> = {};
        if (useStatus) updates.status = status;
        if (useType) updates.type = type;
        if (useRemoved) updates.removed = removed;
        if (useQuantity) updates.quantity = quantity;
        if (usePlacement) updates.placement = placement;
        if (useOwner) updates.owner = owner;

        setProgress({ done: 0, total: targets.length });
        const r = await onApply(updates, { tagsAdd, tagsRemove }, (done, total) => setProgress({ done, total }));
        setProgress(null);
        setResult(r);
    };

    const body = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">一括編集</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            選択中 {targets.length.toLocaleString()} 件
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="閉じる"
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── 結果表示 ── */}
                {result ? (
                    <div className="p-6 overflow-y-auto">
                        <p className="text-base font-bold text-gray-900 dark:text-white mb-3">
                            {result.succeeded.toLocaleString()} 件を更新しました
                        </p>
                        {result.failed.length > 0 && (
                            <div className="mt-4">
                                <p className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {result.failed.length} 件は更新できませんでした
                                </p>
                                <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 divide-y divide-gray-100 dark:divide-zinc-800">
                                    {result.failed.map(f => (
                                        <div key={f.id} className="px-3 py-2 text-xs">
                                            <span className="font-mono text-gray-500">{f.id}</span>
                                            <span className="ml-2 text-gray-700 dark:text-gray-300">{f.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={onClose}
                            className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors">
                            閉じる
                        </button>
                    </div>
                ) : progress ? (
                    <div className="p-10 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-4" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                            {progress.done.toLocaleString()} / {progress.total.toLocaleString()} 件を更新中…
                        </p>
                        <div className="mt-4 h-2 w-full bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 transition-all"
                                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                チェックを入れた項目だけが変更されます。チェックしていない項目は元の値を保ちます。
                            </p>

                            <Row on={useStatus} setOn={setUseStatus} label="設置状況">
                                <div className="flex flex-wrap gap-2">
                                    {POSTER_STATUS_OPTIONS.map(s => (
                                        <button key={s} type="button" onClick={() => toggleStatus(s)}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${status.includes(s)
                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300'}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    選んだ状態に置き換えます（元の状態は保持されません）。
                                </p>
                            </Row>

                            <Row on={useType} setOn={setUseType} label="種別">
                                <select value={type} onChange={(e) => setType(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white">
                                    {pinTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                </select>
                                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                    種別を変えると、担当できる事務所も変わります。
                                </p>
                            </Row>

                            <Row on={useRemoved} setOn={setUseRemoved} label="撤去フラグ">
                                <div className="flex gap-2">
                                    {[{ v: true, l: '撤去済にする' }, { v: false, l: '撤去を解除する' }].map(o => (
                                        <button key={String(o.v)} type="button" onClick={() => setRemoved(o.v)}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${removed === o.v
                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300'}`}>
                                            {o.l}
                                        </button>
                                    ))}
                                </div>
                            </Row>

                            <div className="px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">タグ</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">追加するタグ</span>
                                        <input value={tagsAddText} onChange={(e) => setTagsAddText(e.target.value)}
                                            placeholder="例: 高市, 重点"
                                            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">削除するタグ</span>
                                        <input value={tagsRemoveText} onChange={(e) => setTagsRemoveText(e.target.value)}
                                            placeholder="例: 旧タグ"
                                            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white" />
                                    </label>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    カンマまたは空白で区切ります。記入した分だけが対象で、それ以外の既存タグは残ります。
                                </p>
                            </div>

                            <Row on={useQuantity} setOn={setUseQuantity} label="枚数">
                                <input type="number" min={0} value={quantity}
                                    onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
                                    className="w-28 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white tabular-nums" />
                            </Row>

                            <Row on={usePlacement} setOn={setUsePlacement} label="設置方法">
                                <input value={placement} onChange={(e) => setPlacement(e.target.value)}
                                    placeholder="例: 針金、フェンス"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white" />
                            </Row>

                            <Row on={useOwner} setOn={setUseOwner} label="所有者">
                                <input value={owner} onChange={(e) => setOwner(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white" />
                            </Row>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {changeCount === 0 ? '変更する項目を選んでください' : `${changeCount} 項目を変更します`}
                            </p>
                            <div className="flex gap-3">
                                <button onClick={onClose}
                                    className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                    キャンセル
                                </button>
                                <button onClick={handleApply} disabled={changeCount === 0 || targets.length === 0}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                                    {targets.length.toLocaleString()} 件に適用
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(body, document.body);
};
