import React, { useEffect, useState } from 'react';
import { X, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { POSTER_STATUS_OPTIONS, TARGET_CITIES, type PosterPin } from '../types';

interface PosterEditDrawerProps {
    poster: PosterPin;
    pinTypes: { name: string; color: string }[];
    onClose: () => void;
    onSave: (id: string, updates: Partial<PosterPin>) => Promise<void>;
    onDelete: (id: string, address: string) => Promise<void>;
}

/**
 * ポスター1件の編集パネル（PC向け）。
 *
 * モバイルの `PinBottomSheet` は地図操作・写真アップロードと密結合しているため、
 * 管理画面では表から開く軽量な編集面を別に用意している。
 */
export const PosterEditDrawer: React.FC<PosterEditDrawerProps> = ({ poster, pinTypes, onClose, onSave, onDelete }) => {
    const [form, setForm] = useState<PosterPin>(poster);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { setForm(poster); }, [poster]);

    const set = <K extends keyof PosterPin>(key: K, value: PosterPin[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const toggleStatus = (s: string) =>
        set('status', form.status?.includes(s) ? form.status.filter(x => x !== s) : [...(form.status ?? []), s]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(poster.id, {
                type: form.type,
                status: form.status,
                address: form.address,
                city: form.city,
                placement: form.placement,
                quantity: form.quantity,
                owner: form.owner,
                contact: form.contact,
                memo: form.memo,
                specialNote: form.specialNote,
                tags: form.tags ?? [],
                removed: !!form.removed,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`このポスターを削除します。\n\n${form.address || '(住所なし)'}\n\n元に戻せません。よろしいですか？`)) return;
        setDeleting(true);
        try {
            await onDelete(poster.id, form.address);
            onClose();
        } finally {
            setDeleting(false);
        }
    };

    const label = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
    const input = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

    return (
        <aside className="w-[26rem] shrink-0 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
                <h3 className="font-bold text-gray-900 dark:text-white">ポスターの編集</h3>
                <button onClick={onClose} aria-label="閉じる"
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                    <span className={label}>種別</span>
                    <select value={form.type} onChange={(e) => set('type', e.target.value)} className={input}>
                        {pinTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                        {!pinTypes.some(t => t.name === form.type) && <option value={form.type}>{form.type}（一覧外）</option>}
                    </select>
                </div>

                <div>
                    <span className={label}>設置状況</span>
                    <div className="flex flex-wrap gap-2">
                        {POSTER_STATUS_OPTIONS.map(s => (
                            <button key={s} type="button" onClick={() => toggleStatus(s)}
                                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${form.status?.includes(s)
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <span className={label}>所在地</span>
                    <input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} className={input} />
                </div>

                <div>
                    <span className={label}>
                        市区町村 <span className="text-amber-700 dark:text-amber-400">（担当事務所の判定に使われます）</span>
                    </span>
                    <input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} list="admin-city-list" className={input} />
                    <datalist id="admin-city-list">
                        {TARGET_CITIES.map(c => <option key={c} value={c} />)}
                    </datalist>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className={label}>枚数</span>
                        <input type="number" min={0} value={form.quantity ?? 1}
                            onChange={(e) => set('quantity', Math.max(0, Number(e.target.value) || 0))}
                            className={`${input} tabular-nums`} />
                    </div>
                    <div>
                        <span className={label}>設置方法</span>
                        <input value={form.placement ?? ''} onChange={(e) => set('placement', e.target.value)} className={input} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className={label}>所有者</span>
                        <input value={form.owner ?? ''} onChange={(e) => set('owner', e.target.value)} className={input} />
                    </div>
                    <div>
                        <span className={label}>連絡先</span>
                        <input value={form.contact ?? ''} onChange={(e) => set('contact', e.target.value)} className={input} />
                    </div>
                </div>

                <div>
                    <span className={label}>備考</span>
                    <textarea rows={2} value={form.memo ?? ''} onChange={(e) => set('memo', e.target.value)} className={input} />
                </div>

                <div>
                    <span className={label}>特記事項</span>
                    <textarea rows={2} value={form.specialNote ?? ''} onChange={(e) => set('specialNote', e.target.value)} className={input} />
                </div>

                <div>
                    <span className={label}>タグ（カンマ区切り）</span>
                    <input value={(form.tags ?? []).join(', ')}
                        onChange={(e) => set('tags', e.target.value.split(/[,、]/).map(t => t.trim()).filter(Boolean))}
                        className={input} />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={!!form.removed} onChange={(e) => set('removed', e.target.checked)}
                        className="w-4 h-4 accent-indigo-600" />
                    <span className="text-sm text-gray-800 dark:text-gray-200">撤去済（地図に表示しない）</span>
                </label>

                {(form.imageUrls?.length ?? 0) > 0 && (
                    <div>
                        <span className={label}>写真 {form.imageUrls!.length}枚</span>
                        <div className="flex flex-wrap gap-2">
                            {form.imageUrls!.map((u, i) => (
                                <a key={i} href={u} target="_blank" rel="noreferrer"
                                    className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 block">
                                    <img src={u} alt={`写真${i + 1}`} className="w-full h-full object-cover" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1 border-t border-gray-100 dark:border-zinc-800">
                    <p className="pt-3">緯度経度: <span className="tabular-nums">{form.lat?.toFixed(6)}, {form.lng?.toFixed(6)}</span></p>
                    <p>
                        <a href={`https://www.google.com/maps?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1">
                            Googleマップで開く <ExternalLink className="w-3 h-3" />
                        </a>
                    </p>
                    <p>登録: {form.createdBy || '不明'} / {new Date(form.createdAt).toLocaleString('ja-JP')}</p>
                    <p>更新: {form.updatedBy || '不明'} / {new Date(form.updatedAt).toLocaleString('ja-JP')}</p>
                    <p className="font-mono text-[10px] text-gray-400 break-all">{form.id}</p>
                </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-zinc-800 flex items-center gap-3">
                <button onClick={handleDelete} disabled={deleting || saving} aria-label="削除"
                    className="p-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
                <button onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                    キャンセル
                </button>
                <button onClick={handleSave} disabled={saving || deleting}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    保存
                </button>
            </div>
        </aside>
    );
};
