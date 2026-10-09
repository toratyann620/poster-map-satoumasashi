import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, X, Loader2, Trash2, Navigation } from 'lucide-react';
import type { BuildingPin } from '../types';
import type { BuildingKind } from '../hooks/useBuildings';

/**
 * 建物ピン（自治会掲示板・自治会館など）の登録・編集。
 *
 * ポスターの入力画面（PinBottomSheet）とは別にしてある。
 * あちらはステータス・枚数・挨拶・写真・依頼・ログと機能が多く、
 * 建物に要らないものばかりなので、混ぜると両方が読みにくくなるため。
 */

interface Props {
    /** 既存の建物を開く場合。新規登録では null */
    building: BuildingPin | null;
    /** 新規登録で置く場所。地図のタップで決まった座標と、逆引きした住所 */
    draft?: { lat: number; lng: number; address: string; city: string } | null;
    kinds: BuildingKind[];
    onSave: (input: Omit<BuildingPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => Promise<void>;
    onUpdate: (id: string, patch: Partial<BuildingPin>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onClose: () => void;
}

export const BuildingSheet: React.FC<Props> = ({ building, draft, kinds, onSave, onUpdate, onDelete, onClose }) => {
    const isNew = !building;
    const base = building ?? draft;

    const [kind, setKind] = useState(building?.kind ?? kinds[0]?.name ?? 'その他');
    const [name, setName] = useState(building?.name ?? '');
    const [address, setAddress] = useState(building?.address ?? draft?.address ?? '');
    const [memo, setMemo] = useState(building?.memo ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const field = 'w-full px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none';
    const label = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5';

    const handleSave = async () => {
        setError('');
        if (!base) { setError('場所が決まっていません。'); return; }
        setSaving(true);
        try {
            if (isNew) {
                await onSave({
                    kind, name: name.trim(), address: address.trim(), memo: memo.trim(),
                    lat: base.lat, lng: base.lng, city: base.city,
                });
            } else {
                await onUpdate(building.id, { kind, name: name.trim(), address: address.trim(), memo: memo.trim() });
            }
            onClose();
        } catch (e) {
            setError((e as Error)?.message ?? '保存に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!building) return;
        if (!window.confirm(`「${building.name || building.kind}」を削除します。よろしいですか？`)) return;
        setSaving(true);
        try {
            await onDelete(building.id);
            onClose();
        } catch (e) {
            setError((e as Error)?.message ?? '削除に失敗しました。');
            setSaving(false);
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 z-[10001] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 flex flex-col"
                style={{ maxHeight: '90vh' }}>
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-teal-600" />
                        {isNew ? '建物を登録する' : '建物の情報'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2 leading-relaxed">
                        建物ピンはポスターとは別に記録します。設置率や枚数の集計には入りません。
                    </p>

                    <div>
                        <span className={label}>種類</span>
                        <div className="flex flex-wrap gap-1.5">
                            {kinds.map((k) => (
                                <button key={k.name} type="button" onClick={() => setKind(k.name)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${kind === k.name
                                        ? 'border-transparent text-white'
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}
                                    style={kind === k.name ? { backgroundColor: k.color } : undefined}>
                                    {k.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="block">
                        <span className={label}>名称（任意）</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} className={field}
                            placeholder="例: 中荻野自治会館" />
                    </label>

                    <label className="block">
                        <span className={label}>所在地</span>
                        <input value={address} onChange={(e) => setAddress(e.target.value)} className={field}
                            placeholder="住所" />
                    </label>

                    <label className="block">
                        <span className={label}>備考（任意）</span>
                        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3}
                            className={`${field} resize-y`} placeholder="掲示できる枚数、連絡先、鍵の管理者など" />
                    </label>

                    {base && (
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${base.lat},${base.lng}&travelmode=driving`}
                            target="_blank" rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-300"
                        >
                            <Navigation className="w-4 h-4" />
                            ナビ開始
                        </a>
                    )}

                    <button type="button" onClick={handleSave} disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold transition-colors">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isNew ? '登録する' : '保存する'}
                    </button>

                    {!isNew && (
                        <button type="button" onClick={handleDelete} disabled={saving}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                            <Trash2 className="w-4 h-4" />
                            この建物を削除する
                        </button>
                    )}
                </div>

                <div className="pb-safe shrink-0" />
            </div>
        </>,
        document.body,
    );
};
