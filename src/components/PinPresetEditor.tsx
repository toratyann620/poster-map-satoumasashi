import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, Zap } from 'lucide-react';
import { POSTER_STATUS_OPTIONS } from '../types';
import { MAX_PRESETS, emptyPreset, readPresets, writePresets, type PinPreset } from '../lib/pinPresets';

interface Props {
    pinTypes: { name: string; color: string }[];
    /** 保存のたびに呼ぶ。呼び出し側が持っている一覧を更新するため */
    onChange?: (presets: PinPreset[]) => void;
}

/**
 * ピン打ちモードで使う登録内容の編集。
 *
 * ここを管理画面の中だけに置くと、一般ユーザーが自分で設定できない。
 * ピン打ちモードは現場で使う機能で、使う人の多くは一般ユーザーなので、
 * 地図からも開けるようにしてある。
 */
export const PinPresetEditor: React.FC<Props> = ({ pinTypes, onChange }) => {
    const [presets, setPresets] = useState<PinPreset[]>(() => readPresets());

    const save = (next: PinPreset[]) => {
        setPresets(next);
        writePresets(next);
        onChange?.(next);
    };
    const update = (i: number, patch: Partial<PinPreset>) =>
        save(presets.map((p, k) => (k === i ? { ...p, ...patch } : p)));
    const toggleIn = (list: string[], v: string) =>
        list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

    const field = 'w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';

    return (
        <div className="space-y-4">
            {presets.map((preset, i) => (
                <div key={i} className="border border-gray-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                        </span>
                        <input
                            value={preset.label}
                            onChange={(e) => update(i, { label: e.target.value })}
                            placeholder={`ボタンの名前（未入力なら「${preset.type}」）`}
                            className={field}
                        />
                        <button
                            onClick={() => save(presets.filter((_, k) => k !== i))}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                            aria-label="削除"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">種類</p>
                        <div className="flex flex-wrap gap-1.5">
                            {pinTypes.map((t) => (
                                <button key={t.name} onClick={() => update(i, { type: t.name })}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${preset.type === t.name
                                        ? 'text-white border-transparent'
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}
                                    style={preset.type === t.name ? { backgroundColor: t.color } : undefined}>
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">ステータス（複数可）</p>
                        <div className="flex flex-wrap gap-1.5">
                            {POSTER_STATUS_OPTIONS.map((st) => (
                                <button key={st} onClick={() => update(i, { status: toggleIn(preset.status, st) })}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${preset.status.includes(st)
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}>
                                    {st}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">タグ（カンマ区切り）</p>
                        <input
                            value={preset.tags.join(', ')}
                            onChange={(e) => update(i, {
                                tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                            })}
                            placeholder="例: 高市早苗, 参政党"
                            className={field}
                        />
                    </div>
                </div>
            ))}

            {presets.length < MAX_PRESETS && (
                <button
                    onClick={() => save([...presets, emptyPreset()])}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors w-full justify-center"
                >
                    <Plus className="w-4 h-4" />
                    登録内容を追加（あと{MAX_PRESETS - presets.length}つ）
                </button>
            )}
        </div>
    );
};

/** 地図から開くときの、シート形式の入れ物 */
export const PinPresetSheet: React.FC<Props & { onClose: () => void }> = ({ onClose, ...rest }) => createPortal(
    <>
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 flex flex-col"
            style={{ maxHeight: '88vh' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
            </div>
            <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        ピン打ちの登録内容
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        決めた内容がボタンになり、押すと現在地にピンが立ちます
                    </p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>
            <div className="overflow-y-auto px-4 py-4">
                <PinPresetEditor {...rest} />
            </div>
            <div className="pb-safe shrink-0" />
        </div>
    </>,
    document.body,
);
