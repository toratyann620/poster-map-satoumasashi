import React, { useState } from 'react';
import { Building2, Plus, Trash2, Loader2 } from 'lucide-react';
import { useBuildingKinds } from '../hooks/useBuildingKinds';

/**
 * 建物ピンの種類（自治会掲示板・自治会館など）を管理する画面。
 *
 * ここで足した種類は、建物の登録画面の選択肢と、地図のマーカーの色に反映される。
 * 書けるのは佐藤まさし事務所の管理者だけ（firestore.rules の settings の規定）。
 * それ以外の人には一覧だけを見せる。
 *
 * ⚠️ 種類を消しても、その種類で登録済みの建物は消えない。地図には
 * 既定色（グレー）で出続ける。消す前に、その種類の建物を付け替えること。
 */

const COLOR_OPTIONS = [
    { label: 'ティール', value: '#0D9488' },
    { label: 'バイオレット', value: '#7C3AED' },
    { label: 'ブルー', value: '#2563EB' },
    { label: 'エメラルド', value: '#059669' },
    { label: 'アンバー', value: '#D97706' },
    { label: 'ローズ', value: '#E11D48' },
    { label: 'シアン', value: '#0891B2' },
    { label: 'スレート', value: '#64748B' },
];

export const BuildingKindEditor: React.FC = () => {
    const { kinds, loading, save, canEdit } = useBuildingKinds();
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_OPTIONS[0].value);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handleAdd = async () => {
        setError('');
        const name = newName.trim();
        if (!name) { setError('種類の名前を入力してください。'); return; }
        if (kinds.some((k) => k.name === name)) { setError('同じ名前の種類がすでにあります。'); return; }
        setBusy(true);
        try {
            await save([...kinds, { name, color: newColor }]);
            setNewName('');
            setNewColor(COLOR_OPTIONS[0].value);
        } catch (e) {
            setError((e as Error)?.message ?? '保存に失敗しました。');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (name: string) => {
        if (!window.confirm(`「${name}」を種類から削除しますか？\n※この種類で登録済みの建物は残ります（地図にはグレーで出ます）。`)) return;
        setError('');
        try {
            await save(kinds.filter((k) => k.name !== name));
        } catch (e) {
            setError((e as Error)?.message ?? '保存に失敗しました。');
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-2 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                建物ピンの種類
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                自治会掲示板・自治会館などの種類を決めます。ここで足したものが登録画面の選択肢になり、
                色は地図のピンの色になります。建物ピンはポスターとは別に記録され、設置率や枚数の集計には入りません。
            </p>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-zinc-800 mb-5">
                    {kinds.map((k) => (
                        <li key={k.name} className="flex items-center gap-2.5 py-2.5">
                            <span className="w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: k.color }} />
                            <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{k.name}</span>
                            {canEdit && kinds.length > 1 && (
                                <button type="button" onClick={() => handleRemove(k.name)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    ))}
                    {kinds.length === 0 && (
                        <li className="py-3 text-sm text-gray-500 dark:text-gray-400">まだ登録されていません。</li>
                    )}
                </ul>
            )}

            {canEdit ? (
                <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-3">
                    <label className="block">
                        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">種類の名前</span>
                        <input value={newName} onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                            placeholder="例: 公民館" />
                    </label>
                    <div>
                        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">地図での色</span>
                        <div className="flex flex-wrap gap-2">
                            {COLOR_OPTIONS.map((c) => (
                                <button key={c.value} type="button" onClick={() => setNewColor(c.value)} title={c.label}
                                    className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${newColor === c.value
                                        ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c.value }} />
                            ))}
                        </div>
                    </div>
                    <button type="button" onClick={handleAdd} disabled={busy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        追加する
                    </button>
                </div>
            ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-zinc-800 pt-4">
                    追加・削除は佐藤まさし事務所の管理者のみ行えます。
                </p>
            )}
        </div>
    );
};
