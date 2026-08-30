import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Wand2 } from 'lucide-react';
import type { Group, PosterPin } from '../types';
import { TARGET_CITIES } from '../types';
import { cityFromAddress } from '../lib/city';
import { isPosterInScope } from '../lib/groups';

interface CityFixTabProps {
    posters: PosterPin[];
    groups: Group[];
    onUpdate: (id: string, updates: Partial<PosterPin>) => Promise<void>;
}

/**
 * 手当てが必要なポスターの一覧。
 * render 内で定義すると再描画のたびに入力欄が再マウントされ、
 * 1文字入力するごとにフォーカスが外れるため、モジュールスコープに置く。
 */
const Section: React.FC<{
    title: string;
    note: string;
    items: PosterPin[];
    drafts: Record<string, string>;
    setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    savingId: string | null;
    onSave: (poster: PosterPin, city: string) => void | Promise<void>;
    scopeLabel: (poster: PosterPin, city: string) => string;
}> = ({ title, note, items, drafts, setDrafts, savingId, onSave, scopeLabel }) => (
    <section className="mb-8">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
            {title} <span className="text-gray-400 font-normal tabular-nums">{items.length.toLocaleString()}件</span>
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed max-w-2xl">{note}</p>

        {items.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <Check className="w-4 h-4" />該当するポスターはありません
            </p>
        ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
                <table className="w-full text-sm min-w-[52rem]">
                    <thead className="bg-gray-50 dark:bg-zinc-900 text-xs text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">所在地</th>
                            <th className="px-3 py-2 text-left font-medium w-28">種別</th>
                            <th className="px-3 py-2 text-left font-medium w-24">現在の値</th>
                            <th className="px-3 py-2 text-left font-medium w-56">市区町村を設定</th>
                            <th className="px-3 py-2 text-left font-medium">設定後に扱える事務所</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {items.map(p => {
                            const suggestion = cityFromAddress(p.address);
                            const draft = drafts[p.id] ?? suggestion ?? '';
                            return (
                                <tr key={p.id}>
                                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                                        {p.address || <span className="text-gray-400">(住所なし)</span>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.type}</td>
                                    <td className="px-3 py-2">
                                        {p.city
                                            ? <span className="text-gray-700 dark:text-gray-300">{p.city}</span>
                                            : <span className="text-amber-700 dark:text-amber-400 font-bold text-xs">未設定</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <input value={draft} list="city-fix-list" placeholder="例: 厚木市"
                                                onChange={(e) => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white w-40" />
                                            <button onClick={() => onSave(p, draft.trim())}
                                                disabled={!draft.trim() || draft.trim() === p.city || savingId === p.id}
                                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white text-xs font-bold transition-colors inline-flex items-center gap-1">
                                                {savingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                保存
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                                        {draft.trim() ? scopeLabel(p, draft.trim()) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
    </section>
);

/**
 * 市区町村（`city`）の手当て。
 *
 * `city` はグループ権限の判定に使う唯一のフィールドなので、
 * 空だったり対象3市以外だったりすると、そのポスターは
 * 佐藤まさし事務所からしか触れなくなる（安全側の既定動作）。
 * 該当データを洗い出して、担当事務所が扱えるように直すための画面。
 */
export const CityFixTab: React.FC<CityFixTabProps> = ({ posters, groups, onUpdate }) => {
    const [savingId, setSavingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkResult, setBulkResult] = useState<string | null>(null);

    // 手当てが必要なポスター: city が空、または対象3市に含まれない
    const needsAttention = useMemo(
        () => posters.filter(p => !p.city || !TARGET_CITIES.includes(p.city as typeof TARGET_CITIES[number])),
        [posters],
    );

    const missing = needsAttention.filter(p => !p.city);
    const outsideTarget = needsAttention.filter(p => p.city);

    // 住所から再判定できる（＝今の city と違う値が出る）ポスター
    const fixable = useMemo(
        () => missing.filter(p => !!cityFromAddress(p.address)),
        [missing],
    );

    const scopeLabel = (poster: PosterPin, city: string) => {
        const owners = groups.filter(g => !g.allowAll && isPosterInScope(g, { ...poster, city }));
        if (owners.length === 0) return '佐藤まさし事務所のみ';
        return owners.map(g => g.name).join('・') + '（＋佐藤まさし事務所）';
    };

    const save = async (poster: PosterPin, city: string) => {
        setSavingId(poster.id);
        try {
            await onUpdate(poster.id, { city });
            setDrafts(prev => { const n = { ...prev }; delete n[poster.id]; return n; });
        } finally {
            setSavingId(null);
        }
    };

    const runBulkDerive = async () => {
        if (!window.confirm(`住所から市区町村を判定できる ${fixable.length} 件を一括で設定します。よろしいですか？`)) return;
        setBulkRunning(true);
        setBulkResult(null);
        let ok = 0, ng = 0;
        for (const p of fixable) {
            try { await onUpdate(p.id, { city: cityFromAddress(p.address) }); ok++; }
            catch { ng++; }
        }
        setBulkRunning(false);
        setBulkResult(`${ok} 件を設定しました${ng ? ` / ${ng} 件は失敗しました` : ''}`);
    };


    return (
        <div className="px-6 py-6 overflow-y-auto h-full">
            <datalist id="city-fix-list">
                {TARGET_CITIES.map(c => <option key={c} value={c} />)}
            </datalist>

            <div className="mb-6 max-w-2xl">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">市区町村の手当て</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    市区町村は、どの事務所がそのポスターを扱えるかを決める唯一の項目です。
                    未設定のポスターや対象3市以外のポスターは、佐藤まさし事務所からしか操作できません。
                </p>
            </div>

            {fixable.length > 0 && (
                <div className="mb-8 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30">
                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-3">
                        未設定のうち <span className="font-bold tabular-nums">{fixable.length}</span> 件は、
                        住所から市区町村を判定できます。
                    </p>
                    <button onClick={runBulkDerive} disabled={bulkRunning}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                        {bulkRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        住所から一括で設定する
                    </button>
                    {bulkResult && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{bulkResult}</p>}
                </div>
            )}

            <Section
                title="市区町村が未設定"
                drafts={drafts} setDrafts={setDrafts} savingId={savingId} onSave={save} scopeLabel={scopeLabel}
                note="住所に市区町村名が含まれていないため判定できなかったポスターです。建物名だけが入力されているケースが典型で、正しい市区町村を入れてください。"
                items={missing}
            />

            <Section
                title="対象3市以外"
                drafts={drafts} setDrafts={setDrafts} savingId={savingId} onSave={save} scopeLabel={scopeLabel}
                note="厚木市・海老名市・伊勢原市のいずれでもない市区町村です。担当する事務所が無いため、佐藤まさし事務所のみが扱えます。新しい事務所を作る場合は「グループ管理」から条件に追加してください。"
                items={outsideTarget}
            />

            {needsAttention.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <Check className="w-4 h-4" />
                    すべてのポスターに対象3市のいずれかが設定されています。
                </p>
            )}

            {missing.length > 0 && (
                <p className="mt-6 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 max-w-2xl">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    未設定のまま放置すると、担当事務所からは「存在しないポスター」として扱われます。
                    現地確認の漏れにつながるため、早めに手当てしてください。
                </p>
            )}
        </div>
    );
};
