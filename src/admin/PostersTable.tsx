import React, { useMemo, useState } from 'react';
import { Search, ArrowUp, ArrowDown, Pencil, ChevronLeft, ChevronRight, ListChecks, X } from 'lucide-react';
import type { PosterPin } from '../types';
import { POSTER_STATUS_OPTIONS } from '../types';
import { BulkEditDialog, type BulkEditResult } from './BulkEditDialog';
import { PosterEditDrawer } from './PosterEditDrawer';

interface PostersTableProps {
    posters: PosterPin[];
    pinTypes: { name: string; color: string }[];
    onUpdate: (id: string, updates: Partial<PosterPin>) => Promise<void>;
    onDelete: (id: string, address: string) => Promise<void>;
    onBulkUpdate: (
        ids: string[],
        updates: Partial<PosterPin>,
        opts: { tagsAdd: string[]; tagsRemove: string[]; onProgress: (done: number, total: number) => void },
    ) => Promise<BulkEditResult>;
}

type SortKey = 'address' | 'city' | 'type' | 'quantity' | 'owner' | 'updatedAt';
const PAGE_SIZE = 100;

/**
 * 並べ替えができる見出しセル。
 * render 内で定義すると再描画のたびに別コンポーネント扱いになるため、
 * モジュールスコープに置いて現在の並び順を props で受け取る。
 */
const SortHeader: React.FC<{
    k: SortKey;
    sortKey: SortKey;
    sortAsc: boolean;
    onSort: (k: SortKey) => void;
    children: React.ReactNode;
    className?: string;
}> = ({ k, sortKey, sortAsc, onSort, children, className = '' }) => (
    <th className={`px-3 py-2 text-left font-medium ${className}`}>
        <button onClick={() => onSort(k)}
            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            {children}
            {sortKey === k && (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        </button>
    </th>
);

export const PostersTable: React.FC<PostersTableProps> = ({ posters, pinTypes, onUpdate, onDelete, onBulkUpdate }) => {
    const [keyword, setKeyword] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [removedFilter, setRemovedFilter] = useState<'all' | 'active' | 'removed'>('active');
    const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
    const [sortAsc, setSortAsc] = useState(false);
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<PosterPin | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);

    // 市区町村の選択肢は実データから作る（3市以外の値が入っていても拾えるように）
    const cityOptions = useMemo(
        () => [...new Set(posters.map(p => p.city || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
        [posters],
    );

    const filtered = useMemo(() => {
        const term = keyword.trim().toLowerCase();
        return posters.filter(p => {
            if (removedFilter === 'active' && p.removed) return false;
            if (removedFilter === 'removed' && !p.removed) return false;
            if (cityFilter && (p.city || '') !== cityFilter) return false;
            if (typeFilter && p.type !== typeFilter) return false;
            if (statusFilter && !p.status?.includes(statusFilter)) return false;
            if (term) {
                const hay = [p.address, p.city, p.owner, p.contact, p.memo, p.specialNote, ...(p.tags ?? [])]
                    .join(' ').toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [posters, keyword, cityFilter, typeFilter, statusFilter, removedFilter]);

    const sorted = useMemo(() => {
        const dir = sortAsc ? 1 : -1;
        return [...filtered].sort((a, b) => {
            if (sortKey === 'quantity' || sortKey === 'updatedAt') {
                return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * dir;
            }
            return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'ja') * dir;
        });
    }, [filtered, sortKey, sortAsc]);

    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const rows = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const totalSheets = useMemo(() => filtered.reduce((s, p) => s + (p.quantity || 0), 0), [filtered]);

    const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0); };

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(key === 'address' || key === 'city' || key === 'type' || key === 'owner'); }
    };

    const toggleRow = (id: string) =>
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const pageAllSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
    const togglePage = () =>
        setSelected(prev => {
            const next = new Set(prev);
            if (pageAllSelected) rows.forEach(r => next.delete(r.id));
            else rows.forEach(r => next.add(r.id));
            return next;
        });

    const selectAllFiltered = () => setSelected(new Set(sorted.map(p => p.id)));
    const clearSelection = () => setSelected(new Set());

    const selectedPosters = useMemo(
        () => posters.filter(p => selected.has(p.id)),
        [posters, selected],
    );

    const selectCls = 'px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white';

    return (
        <div className="flex h-full min-h-0">
            <div className="flex-1 min-w-0 flex flex-col">
                {/* ── ツールバー ── */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-56">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={keyword} onChange={(e) => resetPage(setKeyword)(e.target.value)}
                                placeholder="住所・所有者・備考・タグを横断検索"
                                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white" />
                        </div>
                        <select value={cityFilter} onChange={(e) => resetPage(setCityFilter)(e.target.value)} className={selectCls}>
                            <option value="">市区町村: すべて</option>
                            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={typeFilter} onChange={(e) => resetPage(setTypeFilter)(e.target.value)} className={selectCls}>
                            <option value="">種別: すべて</option>
                            {pinTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                        </select>
                        <select value={statusFilter} onChange={(e) => resetPage(setStatusFilter)(e.target.value)} className={selectCls}>
                            <option value="">状況: すべて</option>
                            {POSTER_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={removedFilter} onChange={(e) => resetPage(setRemovedFilter)(e.target.value as typeof removedFilter)} className={selectCls}>
                            <option value="active">撤去を除く</option>
                            <option value="removed">撤去済のみ</option>
                            <option value="all">撤去を含む</option>
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <p className="text-gray-600 dark:text-gray-400 tabular-nums">
                            <span className="font-bold text-gray-900 dark:text-white">{filtered.length.toLocaleString()}</span> 件
                            <span className="text-gray-400 dark:text-gray-500"> / 全 {posters.length.toLocaleString()} 件</span>
                            <span className="ml-3">合計 {totalSheets.toLocaleString()} 枚</span>
                        </p>

                        {selected.size > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="text-indigo-700 dark:text-indigo-400 font-bold tabular-nums">
                                    {selected.size.toLocaleString()} 件を選択中
                                </span>
                                {selected.size < sorted.length && (
                                    <button onClick={selectAllFiltered}
                                        className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">
                                        絞り込み結果の全 {sorted.length.toLocaleString()} 件を選択
                                    </button>
                                )}
                                <button onClick={clearSelection}
                                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                    <X className="w-3.5 h-3.5" />解除
                                </button>
                                <button onClick={() => setBulkOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors">
                                    <ListChecks className="w-4 h-4" />一括編集
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                行のチェックを入れると一括編集できます
                            </p>
                        )}
                    </div>
                </div>

                {/* ── テーブル ── */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-900 text-xs text-gray-500 dark:text-gray-400 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                            <tr>
                                <th className="w-10 px-3 py-2">
                                    <input type="checkbox" checked={pageAllSelected} onChange={togglePage}
                                        aria-label="このページをすべて選択" className="w-4 h-4 accent-indigo-600" />
                                </th>
                                <SortHeader sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} k="address">所在地</SortHeader>
                                <SortHeader sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} k="city" className="w-28">市区町村</SortHeader>
                                <SortHeader sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} k="type" className="w-32">種別</SortHeader>
                                <th className="px-3 py-2 text-left font-medium w-44">設置状況</th>
                                <SortHeader sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} k="quantity" className="w-16">枚数</SortHeader>
                                <SortHeader sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} k="owner" className="w-28">所有者</SortHeader>
                                <SortHeader sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} k="updatedAt" className="w-40">最終更新</SortHeader>
                                <th className="w-12 px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {rows.map(p => {
                                const color = pinTypes.find(t => t.name === p.type)?.color ?? '#6B7280';
                                return (
                                    <tr key={p.id}
                                        className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors ${selected.has(p.id) ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''} ${p.removed ? 'opacity-55' : ''}`}>
                                        <td className="px-3 py-2">
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleRow(p.id)}
                                                aria-label={`${p.address} を選択`} className="w-4 h-4 accent-indigo-600" />
                                        </td>
                                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                                            <button onClick={() => setEditing(p)} className="text-left hover:underline">
                                                {p.address || <span className="text-gray-400">(住所なし)</span>}
                                            </button>
                                            {(p.tags?.length ?? 0) > 0 && (
                                                <span className="ml-2 text-xs text-gray-400">#{p.tags!.join(' #')}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {p.city
                                                ? <span className="text-gray-700 dark:text-gray-300">{p.city}</span>
                                                : <span className="text-amber-700 dark:text-amber-400 text-xs font-bold">未設定</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                                {p.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                                {p.status?.join('・') || '—'}
                                            </span>
                                            {p.removed && <span className="ml-1 text-xs font-bold text-red-600 dark:text-red-400">撤去</span>}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{p.quantity ?? 0}</td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-28">{p.owner || '—'}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                                            {new Date(p.updatedAt).toLocaleDateString('ja-JP')}
                                            <span className="ml-1 text-gray-400">{p.updatedBy}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <button onClick={() => setEditing(p)} aria-label="編集"
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-16 text-center text-gray-400 dark:text-gray-500">
                                        条件に一致するポスターがありません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── ページ送り ── */}
                {pageCount > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-center gap-4 text-sm">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="前のページ">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-gray-600 dark:text-gray-400 tabular-nums">
                            {safePage + 1} / {pageCount} ページ
                        </span>
                        <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
                            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="次のページ">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {editing && (
                <PosterEditDrawer
                    poster={editing}
                    pinTypes={pinTypes}
                    onClose={() => setEditing(null)}
                    onSave={onUpdate}
                    onDelete={onDelete}
                />
            )}

            {bulkOpen && (
                <BulkEditDialog
                    targets={selectedPosters}
                    pinTypes={pinTypes}
                    onClose={() => { setBulkOpen(false); clearSelection(); }}
                    onApply={(updates, opts, onProgress) =>
                        onBulkUpdate([...selected], updates, { ...opts, onProgress })}
                />
            )}
        </div>
    );
};
