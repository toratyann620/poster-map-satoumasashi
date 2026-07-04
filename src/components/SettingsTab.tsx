import React, { useState } from 'react';
import { Settings, ToggleLeft, ToggleRight, Plus, Trash2, Tag } from 'lucide-react';
import { usePinTypes } from '../hooks/usePinTypes';

// カラーパレット（追加時に選べる色）
const COLOR_OPTIONS = [
    { label: 'インディゴ', value: '#6366F1' },
    { label: 'ブルー', value: '#3B82F6' },
    { label: 'シアン', value: '#06B6D4' },
    { label: 'エメラルド', value: '#10B981' },
    { label: 'ライム', value: '#84CC16' },
    { label: 'アンバー', value: '#F59E0B' },
    { label: 'オレンジ', value: '#F97316' },
    { label: 'ローズ', value: '#F43F5E' },
    { label: 'ピンク', value: '#EC4899' },
    { label: 'バイオレット', value: '#8B5CF6' },
    { label: 'ティール', value: '#14B8A6' },
    { label: 'グレー', value: '#6B7280' },
];

interface SettingsTabProps {
    showRemovedPins: boolean;
    onToggleShowRemoved: (val: boolean) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
    showRemovedPins,
    onToggleShowRemoved,
}) => {
    const { pinTypes, loading, addPinType, removePinType } = usePinTypes();
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_OPTIONS[0].value);
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setIsAdding(true);
        try {
            await addPinType(newName.trim(), newColor);
            setNewName('');
            setNewColor(COLOR_OPTIONS[0].value);
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (name: string) => {
        if (!window.confirm(`「${name}」を削除しますか？\n※既存のポスターデータには影響しません。`)) return;
        await removePinType(name);
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">

            {/* ===== 表示設定 ===== */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-5 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    表示設定
                </h2>

                {/* 撤去ピン表示トグル */}
                <div className="flex items-center justify-between py-3">
                    <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                            「撤去」のピンをマップに表示する
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            ONにすると撤去済みピンが薄く（透過）表示されます
                        </p>
                    </div>
                    <button
                        onClick={() => onToggleShowRemoved(!showRemovedPins)}
                        className="flex-shrink-0 ml-4 transition-transform active:scale-95"
                        aria-label="撤去ピン表示トグル"
                    >
                        {showRemovedPins ? (
                            <ToggleRight className="w-10 h-10 text-indigo-500" />
                        ) : (
                            <ToggleLeft className="w-10 h-10 text-gray-300 dark:text-zinc-600" />
                        )}
                    </button>
                </div>
            </div>

            {/* ===== ピン種類管理 ===== */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-800 pb-3 mb-5 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-500" />
                    ピンの種類管理
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                    ここで追加・削除した種類は全ユーザーに即時反映されます。既存ポスターのデータには影響しません。
                </p>

                {/* 現在の種類一覧 */}
                {loading ? (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent" />
                    </div>
                ) : (
                    <div className="space-y-2 mb-6">
                        {pinTypes.map(pt => (
                            <div
                                key={pt.name}
                                className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 group"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white dark:border-zinc-700 shadow-sm"
                                        style={{ backgroundColor: pt.color }}
                                    />
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        {pt.name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleRemove(pt.name)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                    title="削除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 新規追加フォーム */}
                <div className="border-t border-gray-100 dark:border-zinc-800 pt-5">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">新しい種類を追加</p>
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder="例: 山田候補"
                            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newName.trim() || isAdding}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            追加
                        </button>
                    </div>

                    {/* カラーセレクター */}
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">マーカーの色:</p>
                        <div className="flex flex-wrap gap-2">
                            {COLOR_OPTIONS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setNewColor(c.value)}
                                    title={c.label}
                                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                        newColor === c.value
                                            ? 'border-gray-800 dark:border-white scale-110'
                                            : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: c.value }}
                                />
                            ))}
                        </div>
                        {newName && (
                            <div className="mt-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: newColor }} />
                                <span className="text-xs text-gray-500">プレビュー: {newName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
