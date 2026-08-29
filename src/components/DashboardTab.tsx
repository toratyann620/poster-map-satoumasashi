import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, MapPin, CheckCircle, Activity, Clock, AlertTriangle,
    PlusCircle, PackageOpen, RefreshCcw, Wrench,
} from 'lucide-react';
import type { PosterPin } from '../types';
import { POSTER_PERSONS, PERSON_COLORS } from '../types';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAllActivityLogs } from '../hooks/useAllActivityLogs';
import { computePosterMetrics } from '../lib/posterMetrics';

interface DashboardTabProps {
    posters: PosterPin[];
    pinTypes?: { name: string, color: string }[];
}

// ──────────────────────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────────────────────
const toInputDate = (date: Date) => date.toISOString().split('T')[0];

const getDefault30DaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
};

const parseQuantityFromDiff = (diff: string | undefined): number => {
    if (!diff) return 1;
    const match = diff.match(/枚数:\s*(\d+)枚/);
    return match ? parseInt(match[1], 10) : 1;
};

// ──────────────────────────────────────────────────────────
// カスタム SVG バーチャート
// ──────────────────────────────────────────────────────────
interface DailyData {
    date: string;
    added: number;
    updated: number;
    deleted: number;
}

/**
 * 要素の実際の横幅を測る。
 *
 * グラフは固定ピクセル幅（560px）で描いていたため、集計期間が短いと
 * 右側が空いたままになっていた。SVGに viewBox を持たせて拡大する方法だと
 * 文字まで引き伸ばされるので、描画領域の実寸を測ってその幅で組み立てる。
 */
const useElementWidth = <T extends HTMLElement>(fallback = 560) => {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(fallback);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect.width;
            if (w && w > 0) setWidth(Math.floor(w));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width] as const;
};

const ActivityBarChart: React.FC<{ data: DailyData[] }> = ({ data }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; item: DailyData } | null>(null);
    const [wrapRef, wrapW] = useElementWidth<HTMLDivElement>();

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
                この期間にアクティビティはありません
            </div>
        );
    }

    const maxTotal = Math.max(...data.map(d => d.added + d.updated + d.deleted), 1);
    const chartH = 160;
    // 描画領域の実寸に合わせて棒の幅と間隔を決め、期間が短くても横幅一杯に広げる
    const gap = Math.max(2, Math.min(8, Math.floor(wrapW / (data.length * 6)) || 2));
    const barW = Math.max(4, Math.floor((wrapW - 24) / data.length) - gap);
    const totalW = data.length * (barW + gap);
    const labelInterval = Math.max(1, Math.ceil(data.length / Math.max(4, Math.floor(wrapW / 70))));

    return (
        <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setTooltip(null)}>
            <svg
                width={totalW + 24}
                height={chartH + 32}
                className="w-full"
            >
                {/* グリッド線 */}
                {[0.25, 0.5, 0.75, 1.0].map(ratio => (
                    <g key={ratio}>
                        <line
                            x1={20} y1={chartH * (1 - ratio)}
                            x2={Math.max(totalW, 560)} y2={chartH * (1 - ratio)}
                            stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4,3"
                            className="text-gray-400"
                        />
                        <text x={14} y={chartH * (1 - ratio) + 3} textAnchor="end" fontSize={9} className="fill-gray-400 dark:fill-gray-500">
                            {Math.round(maxTotal * ratio)}
                        </text>
                    </g>
                ))}

                {/* バー群 */}
                {data.map((d, i) => {
                    const x = 22 + i * (barW + gap);
                    const total = d.added + d.updated + d.deleted;
                    const hAdded = (d.added / maxTotal) * chartH;
                    const hUpdated = (d.updated / maxTotal) * chartH;
                    const hDeleted = (d.deleted / maxTotal) * chartH;

                    return (
                        <g
                            key={i}
                            onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, item: d })}
                            style={{ cursor: 'default' }}
                        >
                            {/* 削除（下） */}
                            {hDeleted > 0 && (
                                <rect x={x} y={chartH - hDeleted} width={barW} height={hDeleted} fill="#F87171" rx={2} />
                            )}
                            {/* 更新（中） */}
                            {hUpdated > 0 && (
                                <rect x={x} y={chartH - hDeleted - hUpdated} width={barW} height={hUpdated} fill="#60A5FA" rx={2} />
                            )}
                            {/* 追加（上） */}
                            {hAdded > 0 && (
                                <rect x={x} y={chartH - hDeleted - hUpdated - hAdded} width={barW} height={hAdded} fill="#34D399" rx={2} />
                            )}
                            {/* 合計ラベル */}
                            {total > 0 && barW >= 14 && (
                                <text
                                    x={x + barW / 2} y={chartH - hDeleted - hUpdated - hAdded - 3}
                                    textAnchor="middle" fontSize={8}
                                    className="fill-gray-500 dark:fill-gray-400"
                                >
                                    {total}
                                </text>
                            )}
                            {/* X軸ラベル */}
                            {i % labelInterval === 0 && (
                                <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={9} className="fill-gray-400 dark:fill-gray-500">
                                    {d.date}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* ツールチップ */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-xl rounded-xl px-3.5 py-2.5 text-xs"
                    style={{ left: tooltip.x + 14, top: tooltip.y - 80 }}
                >
                    <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{tooltip.item.date}</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-gray-300">追加: <strong>{tooltip.item.added}</strong>件</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-gray-300">更新: <strong>{tooltip.item.updated}</strong>件</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                            <span className="text-gray-600 dark:text-gray-300">削除: <strong>{tooltip.item.deleted}</strong>件</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ──────────────────────────────────────────────────────────
// 種類別ピン数推移 折れ線グラフ（SVG）
// ──────────────────────────────────────────────────────────
interface TypeTrendLineChartProps {
    data: Array<{ date: string; [type: string]: string | number }>;
    types: string[];
}

const TypeTrendLineChart: React.FC<TypeTrendLineChartProps> = ({ data, types }) => {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const [wrapRef, wrapW] = useElementWidth<HTMLDivElement>();

    if (data.length === 0) return null;

    const chartH = 180;
    // 描画領域の実寸に合わせる（期間が短くても横幅一杯に伸ばす）
    const chartW = wrapW;
    const padLeft = 28;
    const padRight = 10;
    const padTop = 12;
    const padBottom = 24;
    const innerW = chartW - padLeft - padRight;
    const innerH = chartH - padTop - padBottom;

    const maxVal = Math.max(...data.flatMap(d => types.map(t => Number(d[t] || 0))), 1);
    const labelInterval = Math.max(1, Math.ceil(data.length / Math.max(4, Math.floor(chartW / 70))));

    // (x, y) 座標を計算
    const getX = (i: number) => padLeft + (i / Math.max(data.length - 1, 1)) * innerW;
    const getY = (val: number) => padTop + innerH - (val / maxVal) * innerH;

    return (
        <div
            ref={wrapRef}
            className="relative w-full"
            onMouseLeave={() => { setHoveredIdx(null); setMousePos(null); }}
        >
            <svg
                width={chartW}
                height={chartH}
                className="w-full"
                onMouseMove={(e) => {
                    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                    const relX = e.clientX - rect.left - padLeft;
                    const idx = Math.round((relX / innerW) * (data.length - 1));
                    setHoveredIdx(Math.max(0, Math.min(data.length - 1, idx)));
                    setMousePos({ x: e.clientX, y: e.clientY });
                }}
            >
                {/* グリッド線 */}
                {[0.25, 0.5, 0.75, 1.0].map(ratio => (
                    <g key={ratio}>
                        <line
                            x1={padLeft} y1={padTop + innerH * (1 - ratio)}
                            x2={chartW - padRight} y2={padTop + innerH * (1 - ratio)}
                            stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4,3"
                            className="text-gray-400"
                        />
                        <text x={padLeft - 4} y={padTop + innerH * (1 - ratio) + 3} textAnchor="end" fontSize={9} className="fill-gray-400 dark:fill-gray-500">
                            {Math.round(maxVal * ratio)}
                        </text>
                    </g>
                ))}

                {/* 各種類の折れ線 */}
                {types.map(type => {
                    const color = PERSON_COLORS[type as keyof typeof PERSON_COLORS] || '#6B7280';
                    const points = data.map((d, i) =>
                        `${getX(i)},${getY(Number(d[type] || 0))}`
                    ).join(' ');

                    return (
                        <g key={type}>
                            {/* 塗りつぶしエリア */}
                            <polyline
                                points={`${padLeft},${padTop + innerH} ${points} ${getX(data.length - 1)},${padTop + innerH}`}
                                fill={color}
                                fillOpacity={0.08}
                                stroke="none"
                            />
                            {/* 折れ線 */}
                            <polyline
                                points={points}
                                fill="none"
                                stroke={color}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </g>
                    );
                })}

                {/* ホバー縦線 + 点 */}
                {hoveredIdx !== null && (
                    <g>
                        <line
                            x1={getX(hoveredIdx)} y1={padTop}
                            x2={getX(hoveredIdx)} y2={padTop + innerH}
                            stroke="currentColor" strokeOpacity={0.3}
                            className="text-gray-500"
                        />
                        {types.map(type => {
                            const color = PERSON_COLORS[type as keyof typeof PERSON_COLORS] || '#6B7280';
                            const val = Number(data[hoveredIdx][type] || 0);
                            return (
                                <circle
                                    key={type}
                                    cx={getX(hoveredIdx)} cy={getY(val)}
                                    r={4} fill={color} stroke="white" strokeWidth={1.5}
                                />
                            );
                        })}
                    </g>
                )}

                {/* X軸ラベル */}
                {data.map((d, i) => i % labelInterval === 0 && (
                    <text key={i} x={getX(i)} y={chartH - 4} textAnchor="middle" fontSize={9} className="fill-gray-400 dark:fill-gray-500">
                        {d.date}
                    </text>
                ))}
            </svg>

            {/* ツールチップ */}
            {hoveredIdx !== null && mousePos && (
                <div
                    className="fixed z-50 pointer-events-none bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-xl rounded-xl px-3.5 py-2.5 text-xs"
                    style={{ left: mousePos.x + 14, top: mousePos.y - 30 - types.length * 18 }}
                >
                    <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{data[hoveredIdx].date}</p>
                    <div className="space-y-1">
                        {types.map(type => (
                            <div key={type} className="flex items-center gap-2">
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: PERSON_COLORS[type as keyof typeof PERSON_COLORS] || '#6B7280' }}
                                />
                                <span className="text-gray-600 dark:text-gray-300">
                                    {type}: <strong>{Number(data[hoveredIdx][type] || 0)}</strong>件
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

type CityCategory = '全体' | '厚木市' | '海老名市' | '伊勢原市' | 'それ以外';
const CITY_CATEGORIES: CityCategory[] = ['全体', '厚木市', '海老名市', '伊勢原市', 'それ以外'];

const getCityCategory = (address: string): '厚木市' | '海老名市' | '伊勢原市' | 'それ以外' => {
    if (!address) return 'それ以外';
    if (address.includes('厚木市')) return '厚木市';
    if (address.includes('海老名市')) return '海老名市';
    if (address.includes('伊勢原市')) return '伊勢原市';
    return 'それ以外';
};

// ──────────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────────
export const DashboardTab: React.FC<DashboardTabProps> = ({ posters, pinTypes = [] }) => {
    const [dateFromStr, setDateFromStr] = useState(toInputDate(getDefault30DaysAgo()));
    const [dateToStr, setDateToStr] = useState(toInputDate(new Date()));
    // 空配列 = すべての種類を対象にする
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState<CityCategory>('全体');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const { logs, loading } = useDashboardData(dateFromStr, dateToStr);

    // 4指標の再構築に使う全履歴（絞り込みは後段で行う）
    const { logsAsc: allLogsAsc } = useAllActivityLogs();

    // 全ポスターから使用されているユニークなタグ一覧を生成
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        posters.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [posters]);

    // 撤去済みのポスターは枚数・新規数の集計から除く。
    // 「撤去した」という事実は変更履歴側（撤去カード）で数えており、
    // 現在の掲示状況を表す数値に含めると実態より多く見えるため。
    const activePosters = useMemo(() => posters.filter(p => !p.removed), [posters]);

    // 画面に出す種類の選択肢は、実際に存在するポスターから作る
    const availableTypes = useMemo(() => {
        const set = new Set<string>();
        posters.forEach(p => { if (p.type) set.add(p.type); });
        const ordered = POSTER_PERSONS.filter(t => set.has(t));
        const extra = [...set].filter(t => !POSTER_PERSONS.includes(t as typeof POSTER_PERSONS[number])).sort();
        return [...ordered, ...extra];
    }, [posters]);

    // ──── 4条件（期間・市区町村・種類・タグ）の判定 ────
    const matchesType = useMemo(() => {
        const set = new Set(selectedTypes);
        return (type: string | undefined) => set.size === 0 || set.has(type ?? '');
    }, [selectedTypes]);

    const matchesTag = useMemo(() => {
        const set = new Set(selectedTags);
        return (tags: string[] | undefined) => set.size === 0 || (tags ?? []).some(t => set.has(t));
    }, [selectedTags]);

    const matchesCity = useMemo(() =>
        (address: string | undefined) => selectedCity === '全体' || getCityCategory(address ?? '') === selectedCity,
    [selectedCity]);

    // タグはポスター側にしか無いため、履歴を絞るときはポスターIDで引く
    const taggedPosterIds = useMemo(() => {
        if (selectedTags.length === 0) return null;
        return new Set(posters.filter(p => matchesTag(p.tags)).map(p => p.id));
    }, [posters, selectedTags, matchesTag]);

    // 4条件をすべて適用したポスター（撤去済みは除外済み）
    const scopedPosters = useMemo(() =>
        activePosters.filter(p => matchesTag(p.tags) && matchesCity(p.address) && matchesType(p.type)),
    [activePosters, matchesTag, matchesCity, matchesType]);

    // 4条件をすべて適用した履歴（期間は取得時点で絞られている）
    const scopeLogs = useMemo(() => (list: typeof logs) =>
        list.filter(l =>
            matchesCity(l.posterAddress)
            && matchesType(l.posterType)
            && (taggedPosterIds === null || taggedPosterIds.has(l.posterId))),
    [matchesCity, matchesType, taggedPosterIds]);

    const scopedLogs = useMemo(() => scopeLogs(logs), [scopeLogs, logs]);

    // ──── 新規／撤去／張替え解除／修理解除の4指標 ────
    // 対象ポスターは scopedPosters（撤去済みを除外し、市区町村・種類・タグを適用済み）、
    // 履歴も同じ条件で絞ってから、期間内のイベントを数える。
    const posterMetrics = useMemo(() => {
        const rangeStart = new Date(dateFromStr + 'T00:00:00').getTime();
        const rangeEnd = new Date(dateToStr + 'T23:59:59').getTime() + 1;
        return computePosterMetrics(scopedPosters, scopeLogs(allLogsAsc), rangeStart, rangeEnd);
    }, [scopedPosters, scopeLogs, allLogsAsc, dateFromStr, dateToStr]);

    // 旧名を維持している箇所のための別名
    const filteredPostersByCity = scopedPosters;
    const filteredLogsByCity = scopedLogs;

    // ──── 「全体」選択時のカード内ホバー内訳データ ────
    // いずれも選択中の種類・タグに追従する（撤去済みは除外済み）
    const qtyByCity = useMemo(() => {
        const cities: ('厚木市' | '海老名市' | '伊勢原市' | 'それ以外')[] = ['厚木市', '海老名市', '伊勢原市', 'それ以外'];
        return cities.map(city => {
            const postersInCity = activePosters.filter(p =>
                matchesTag(p.tags) && matchesType(p.type) && getCityCategory(p.address) === city);
            const totalQty = postersInCity.reduce((sum, p) => sum + (p.quantity || 1), 0);

            let change = 0;
            scopeLogs(logs).forEach(l => {
                if (getCityCategory(l.posterAddress) === city) {
                    const qty = parseQuantityFromDiff(l.diff);
                    if (l.action === '追加') change += qty;
                    if (l.action === '削除') change -= qty;
                }
            });

            return { city, totalQty, change };
        });
    }, [activePosters, logs, matchesTag, matchesType, scopeLogs]);

    const installRateByCity = useMemo(() => {
        const cities: ('厚木市' | '海老名市' | '伊勢原市' | 'それ以外')[] = ['厚木市', '海老名市', '伊勢原市', 'それ以外'];
        return cities.map(city => {
            const postersInCity = activePosters.filter(p =>
                matchesTag(p.tags) && matchesType(p.type) && getCityCategory(p.address) === city);
            const totalQty = postersInCity.reduce((sum, p) => sum + (p.quantity || 1), 0);
            const installedQty = postersInCity.filter(p => {
                const statuses = Array.isArray(p.status) ? p.status : [p.status];
                return statuses.includes('設置済');
            }).reduce((sum, p) => sum + (p.quantity || 1), 0);
            const rate = totalQty > 0 ? Math.round((installedQty / totalQty) * 100) : 0;
            return { city, totalQty, installedQty, rate };
        });
    }, [activePosters, matchesTag, matchesType]);

    const actionsByCity = useMemo(() => {
        const cities: ('厚木市' | '海老名市' | '伊勢原市' | 'それ以外')[] = ['厚木市', '海老名市', '伊勢原市', 'それ以外'];
        return cities.map(city => {
            const cityLogs = scopedLogs.filter(l => getCityCategory(l.posterAddress) === city);
            const total = cityLogs.length;
            const added = cityLogs.filter(l => l.action === '追加').length;
            const updated = cityLogs.filter(l => l.action === '更新').length;
            const deleted = cityLogs.filter(l => l.action === '削除').length;
            return { city, total, added, updated, deleted };
        });
    }, [scopedLogs]);

    const lastUpdateByCity = useMemo(() => {
        const cities: ('厚木市' | '海老名市' | '伊勢原市' | 'それ以外')[] = ['厚木市', '海老名市', '伊勢原市', 'それ以外'];
        return cities.map(city => {
            const cityLogs = scopedLogs.filter(l => getCityCategory(l.posterAddress) === city);
            const lastTs = cityLogs.length > 0 ? cityLogs[0].changedAt : null;
            return { city, lastTs };
        });
    }, [scopedLogs]);

    // ──── KPI 計算（条件設定に連動）────
    // 対象は scopedPosters（期間以外の3条件を適用済み、撤去済みは除外済み）
    const scopedTotalQty = useMemo(() =>
        scopedPosters.reduce((sum, p) => sum + (p.quantity || 1), 0),
    [scopedPosters]);

    const scopedInstalledQty = useMemo(() =>
        scopedPosters.filter(p => {
            const statuses = Array.isArray(p.status) ? p.status : [p.status];
            return statuses.includes('設置済');
        }).reduce((sum, p) => sum + (p.quantity || 1), 0),
    [scopedPosters]);

    const scopedInstalledRate = scopedTotalQty > 0
        ? Math.round((scopedInstalledQty / scopedTotalQty) * 100)
        : 0;

    const scopedNetChange = useMemo(() => {
        let change = 0;
        scopedLogs.forEach(l => {
            const qty = parseQuantityFromDiff(l.diff);
            if (l.action === '追加') change += qty;
            if (l.action === '削除') change -= qty;
        });
        return change;
    }, [scopedLogs]);

    /** 選択中の種類を表す見出し文言 */
    const typeLabel = selectedTypes.length === 0
        ? 'すべての種類'
        : selectedTypes.length <= 2
            ? selectedTypes.join('・')
            : `${selectedTypes.length}種類`;

    const uninstalledCountQty = useMemo(() =>
        filteredPostersByCity.filter(p => {
            const statuses = Array.isArray(p.status) ? p.status : [p.status];
            return statuses.includes('未設置');
        }).reduce((sum, p) => sum + (p.quantity || 1), 0),
    [filteredPostersByCity]);

    const installedRate = scopedInstalledRate;

    // 種類別サマリーの純増減に使う枚数。追加・削除のログは diff に必ず
    // 「枚数: N枚」を含むため合算できる（更新は含まないことがあり合算できない）。
    const periodAddedQty = useMemo(() => {
        return filteredLogsByCity.filter(l => l.action === '追加')
            .reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0);
    }, [filteredLogsByCity]);

    // 期間アクションカードは操作の件数で表す（上の dailyData と同じ理由）
    const periodActionCounts = useMemo(() => ({
        added: scopedLogs.filter(l => l.action === '追加').length,
        updated: scopedLogs.filter(l => l.action === '更新').length,
        deleted: scopedLogs.filter(l => l.action === '削除').length,
    }), [scopedLogs]);

    const periodDeletedQty = useMemo(() => {
        return filteredLogsByCity.filter(l => l.action === '削除')
            .reduce((sum, l) => sum + parseQuantityFromDiff(l.diff), 0);
    }, [filteredLogsByCity]);

    const netChange = periodAddedQty - periodDeletedQty;
    const lastActionTs = filteredLogsByCity.length > 0 ? filteredLogsByCity[0].changedAt : null;

    // ──── 最もアクティブな曜日 ────
    const mostActiveDow = useMemo(() => {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const counts = Array(7).fill(0);
        filteredLogsByCity.forEach(l => counts[new Date(l.changedAt).getDay()]++);
        const maxCount = Math.max(...counts);
        return maxCount > 0 ? days[counts.indexOf(maxCount)] : null;
    }, [filteredLogsByCity]);

    const activeTypes = useMemo(() => {
        if (pinTypes && pinTypes.length > 0) {
            return pinTypes.map(pt => pt.name);
        }
        return [...POSTER_PERSONS];
    }, [pinTypes]);

    // ──── 種類別サマリー ────
    const typeSummary = useMemo(() =>
        activeTypes.map(type => {
            const allOfType = filteredPostersByCity.filter(p => p.type === type);

            const currentAllQty = allOfType.reduce((sum, p) => sum + (p.quantity || 1), 0);
            const currentQty = currentAllQty;

            const installedOfTypeQty = allOfType.filter(p => {
                const statuses = Array.isArray(p.status) ? p.status : [p.status];
                return statuses.includes('設置済');
            }).reduce((sum, p) => sum + (p.quantity || 1), 0);

            const installRate = currentAllQty > 0
                ? Math.round((installedOfTypeQty / currentAllQty) * 100)
                : 0;

            let added = 0;
            let deleted = 0;
            filteredLogsByCity.forEach(l => {
                if (l.posterType === type) {
                    const qty = parseQuantityFromDiff(l.diff);
                    if (l.action === '追加') added += qty;
                    if (l.action === '削除') deleted += qty;
                }
            });

            return {
                type,
                current: currentQty,
                currentAll: currentAllQty,
                installRate,
                added,
                deleted,
                net: added - deleted,
            };
        }).filter(s => s.currentAll > 0 || s.added > 0),
    [filteredPostersByCity, filteredLogsByCity]);

    // ──── 日別アクティビティデータ ────
    const dailyData = useMemo((): DailyData[] => {
        const result: DailyData[] = [];
        const cursor = new Date(dateFromStr + 'T00:00:00');
        const end = new Date(dateToStr + 'T23:59:59');

        while (cursor <= end) {
            const dayStart = new Date(cursor).setHours(0, 0, 0, 0);
            const dayEnd = new Date(cursor).setHours(23, 59, 59, 999);
            const dayLogs = filteredLogsByCity.filter(l => l.changedAt >= dayStart && l.changedAt <= dayEnd);

            // 操作の件数で数える。更新ログの diff にある「枚数: N枚」は変更後の値ではなく
            // その時点の枚数の記録なので、合算しても意味のある枚数にならない
            // （同じピンを3回更新すれば3回足される）。枚数の増減は種類別ピン数推移で見る。
            let added = 0;
            let updated = 0;
            let deleted = 0;
            dayLogs.forEach(l => {
                if (l.action === '追加') added++;
                else if (l.action === '更新') updated++;
                else if (l.action === '削除') deleted++;
            });

            result.push({
                date: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
                added,
                updated,
                deleted,
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return result;
    }, [filteredLogsByCity, dateFromStr, dateToStr]);

    // ──── 種類別 累積追加数（折れ線グラフ用） ────
    interface TypeTrendPoint {
        date: string;
        [type: string]: string | number;
    }

    const typeTrendData = useMemo((): TypeTrendPoint[] => {
        const logsWithType = filteredLogsByCity.filter(l => l.posterType);
        if (logsWithType.length === 0) return [];

        const typeCounts: Record<string, number> = {};
        logsWithType.forEach(l => {
            if (l.action === '追加') {
                const qty = parseQuantityFromDiff(l.diff);
                typeCounts[l.posterType!] = (typeCounts[l.posterType!] || 0) + qty;
            }
        });
        const activeTypes = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([t]) => t);

        if (activeTypes.length === 0) return [];

        const result: TypeTrendPoint[] = [];
        const cursor = new Date(dateFromStr + 'T00:00:00');
        const end = new Date(dateToStr + 'T23:59:59');
        const cumulative: Record<string, number> = {};
        activeTypes.forEach(t => { cumulative[t] = 0; });

        while (cursor <= end) {
            const dayStart = new Date(cursor).setHours(0, 0, 0, 0);
            const dayEnd = new Date(cursor).setHours(23, 59, 59, 999);
            const dayLogs = logsWithType.filter(l => l.changedAt >= dayStart && l.changedAt <= dayEnd);

            dayLogs.forEach(l => {
                if (!l.posterType || !activeTypes.includes(l.posterType)) return;
                const qty = parseQuantityFromDiff(l.diff);
                if (l.action === '追加') cumulative[l.posterType] = (cumulative[l.posterType] || 0) + qty;
                if (l.action === '削除') cumulative[l.posterType] = Math.max(0, (cumulative[l.posterType] || 0) - qty);
            });

            const point: TypeTrendPoint = { date: `${cursor.getMonth() + 1}/${cursor.getDate()}` };
            activeTypes.forEach(t => { point[t] = cumulative[t]; });
            result.push(point);
            cursor.setDate(cursor.getDate() + 1);
        }
        return result;
    }, [filteredLogsByCity, dateFromStr, dateToStr]);

    // 折れ線グラフで描画するアクティブな種類
    const trendTypes = useMemo(() => {
        if (typeTrendData.length === 0) return [];
        const sample = typeTrendData[typeTrendData.length - 1];
        return Object.keys(sample).filter(k => k !== 'date');
    }, [typeTrendData]);

    // ──── 時間差フォーマット ────
    const formatRelative = (ts: number) => {
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'たった今';
        if (m < 60) return `${m}分前`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}時間前`;
        return `${Math.floor(h / 24)}日前`;
    };

    const toggleType = (t: string) => {
        setSelectedTypes(prev =>
            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
        );
    };

    // 集計期間の日数。既定が30日のため、短い期間を見ているつもりで
    // 既定のままだと数値が想定と合わない。何日分を見ているかを常に画面へ出す。
    const rangeDays = useMemo(() => {
        const from = new Date(dateFromStr + 'T00:00:00').getTime();
        const to = new Date(dateToStr + 'T00:00:00').getTime();
        if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
        return Math.round((to - from) / 86400000) + 1;
    }, [dateFromStr, dateToStr]);

    /** 集計期間を「本日から遡ってdays日間」に設定する */
    const applyRangePreset = (days: number) => {
        const from = new Date();
        from.setDate(from.getDate() - (days - 1));
        setDateFromStr(toInputDate(from));
        setDateToStr(toInputDate(new Date()));
    };

    const totalCurrentFiltered = typeSummary.reduce((sum, s) => sum + s.current, 0);
    const totalAdded = typeSummary.reduce((sum, s) => sum + s.added, 0);
    const totalDeleted = typeSummary.reduce((sum, s) => sum + s.deleted, 0);

    return (
        <div className="space-y-5">

            {/* ───── コントロールバー ───── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4">
                <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                    {/* 日付レンジ */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">集計期間</span>
                        <input
                            type="date" value={dateFromStr}
                            onChange={e => setDateFromStr(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-gray-400">〜</span>
                        <input
                            type="date" value={dateToStr}
                            onChange={e => setDateToStr(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {rangeDays !== null && (
                            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 rounded-full px-2.5 py-1 whitespace-nowrap">
                                {rangeDays}日間
                            </span>
                        )}
                        {[7, 30].map(d => (
                            <button
                                key={d} type="button" onClick={() => applyRangePreset(d)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                    rangeDays === d
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400 bg-gray-50 dark:bg-zinc-800/50'
                                }`}
                            >
                                直近{d}日
                            </button>
                        ))}
                    </div>

                    {/* 市区町村フィルター */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">市区町村</span>
                        <select
                            value={selectedCity}
                            onChange={e => setSelectedCity(e.target.value as CityCategory)}
                            className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {CITY_CATEGORIES.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    {/* 種類フィルター */}
                    <div className="flex items-center gap-3 flex-wrap w-full border-t border-gray-100 dark:border-zinc-800 pt-3">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">種類</span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                            <button
                                type="button"
                                onClick={() => setSelectedTypes([])}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                    selectedTypes.length === 0
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400 bg-gray-50 dark:bg-zinc-800/50'
                                }`}
                            >
                                すべて
                            </button>
                            {availableTypes.map(type => {
                                const active = selectedTypes.includes(type);
                                const color = PERSON_COLORS[type as keyof typeof PERSON_COLORS] || '#6B7280';
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => toggleType(type)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                            active
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400 bg-gray-50 dark:bg-zinc-800/50'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* タグフィルター */}
                    {allTags.length > 0 && (
                        <div className="flex items-center gap-3 flex-wrap w-full border-t border-gray-100 dark:border-zinc-800 pt-3">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">タグ</span>
                            <div className="flex flex-wrap gap-1.5">
                                {allTags.map(tag => {
                                    const active = selectedTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => {
                                                setSelectedTags(prev =>
                                                    prev.includes(tag)
                                                        ? prev.filter(t => t !== tag)
                                                        : [...prev, tag]
                                                );
                                            }}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                                active
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                    : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-gray-50 dark:bg-zinc-800/50'
                                            }`}
                                        >
                                            #{tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-gray-100 dark:bg-zinc-800 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <>
                    {/* ───── KPI カード ───── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* ポスター枚数（選択中の種類）*/}
                        <div className="relative group bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">{typeLabel} ポスター枚数</span>
                                <MapPin className="w-4 h-4 text-indigo-300" />
                            </div>
                            <div className="text-3xl font-bold">{scopedTotalQty.toLocaleString()}</div>
                            <div className="text-xs text-indigo-200 mt-0.5">撤去済みを除く</div>
                            <div className="mt-2 flex items-center gap-1 text-sm">
                                {scopedNetChange >= 0 ? (
                                    <><TrendingUp className="w-3.5 h-3.5 text-emerald-300" /><span className="text-emerald-300 font-medium">+{scopedNetChange}</span></>
                                ) : (
                                    <><TrendingDown className="w-3.5 h-3.5 text-red-300" /><span className="text-red-300 font-medium">{scopedNetChange}</span></>
                                )}
                                <span className="text-indigo-300 text-xs">期間純増減</span>
                            </div>

                            {/* ツールチップ (全体選択時のみ) */}
                            {selectedCity === '全体' && (
                                <div className="absolute top-full left-0 right-0 mt-2 hidden group-hover:block bg-zinc-950/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-md z-20 border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <p className="font-semibold border-b border-zinc-800 pb-1 mb-1.5 text-zinc-300">市区町村別内訳（{typeLabel}・撤去済みを除く）</p>
                                    <div className="space-y-1.5">
                                        {qtyByCity.map(item => (
                                            <div key={item.city} className="flex justify-between items-center">
                                                <span className="text-zinc-400">{item.city}</span>
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <span>{item.totalQty.toLocaleString()}枚</span>
                                                    <span className={`text-[10px] ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {item.change >= 0 ? `+${item.change}` : item.change}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 設置率（選択中の種類）*/}
                        <div className="relative group bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">{typeLabel} 設置率</span>
                                <CheckCircle className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div className="text-3xl font-bold">{scopedInstalledRate}%</div>
                            <div className="mt-2 bg-emerald-600/50 rounded-full h-1.5">
                                <div
                                    className="bg-white rounded-full h-1.5 transition-all duration-700"
                                    style={{ width: `${scopedInstalledRate}%` }}
                                />
                            </div>
                            <div className="mt-1.5 text-xs text-emerald-100">
                                設置済: {scopedInstalledQty.toLocaleString()} / {scopedTotalQty.toLocaleString()}枚（撤去済みを除く）
                            </div>

                            {/* ツールチップ (全体選択時のみ) */}
                            {selectedCity === '全体' && (
                                <div className="absolute top-full left-0 right-0 mt-2 hidden group-hover:block bg-zinc-950/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-md z-20 border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <p className="font-semibold border-b border-zinc-800 pb-1 mb-1.5 text-zinc-300">市区町村別内訳 (設置率)</p>
                                    <div className="space-y-1.5">
                                        {installRateByCity.map(item => (
                                            <div key={item.city} className="flex justify-between items-center">
                                                <span className="text-zinc-400">{item.city}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-12 bg-zinc-800 rounded-full h-1">
                                                        <div className="bg-emerald-400 rounded-full h-1" style={{ width: `${item.rate}%` }} />
                                                    </div>
                                                    <span className="font-medium w-8 text-right">{item.rate}%</span>
                                                    <span className="text-[10px] text-zinc-500">({item.installedQty}/{item.totalQty}枚)</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 期間アクション数 */}
                        <div className="relative group bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-violet-200 uppercase tracking-wide">期間アクション</span>
                                <Activity className="w-4 h-4 text-violet-300" />
                            </div>
                            <div className="text-3xl font-bold">
                                {scopedLogs.length.toLocaleString()}<span className="text-sm font-normal ml-1">件</span>
                            </div>
                            <div className="mt-1.5 flex gap-2.5 text-xs text-violet-200">
                                <span className="text-emerald-300 font-medium">追加 {periodActionCounts.added}</span>
                                <span className="text-blue-300">更新 {periodActionCounts.updated}</span>
                                <span className="text-red-300">削除 {periodActionCounts.deleted}</span>
                            </div>
                            <div className="mt-1.5 text-[10px] leading-snug text-violet-200/90">
                                操作の件数です。掲示した箇所の数は下の「期間内の作業成果」をご覧ください。
                            </div>

                            {/* ツールチップ (全体選択時のみ) */}
                            {selectedCity === '全体' && (
                                <div className="absolute top-full left-0 right-0 mt-2 hidden group-hover:block bg-zinc-950/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-md z-20 border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <p className="font-semibold border-b border-zinc-800 pb-1 mb-1.5 text-zinc-300">市区町村別内訳 (アクション数)</p>
                                    <div className="space-y-1.5">
                                        {actionsByCity.map(item => (
                                            <div key={item.city} className="flex justify-between items-center">
                                                <span className="text-zinc-400">{item.city}</span>
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <span>{item.total.toLocaleString()}件</span>
                                                    <span className="text-[10px] text-zinc-500">(追加{item.added} 更新{item.updated} 削除{item.deleted})</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 最終更新 */}
                        <div className="relative group bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-amber-200 uppercase tracking-wide">最終更新</span>
                                <Clock className="w-4 h-4 text-amber-300" />
                            </div>
                            <div className="text-2xl font-bold">
                                {lastActionTs ? formatRelative(lastActionTs) : '—'}
                            </div>
                            {mostActiveDow && (
                                <div className="mt-1 text-xs text-amber-200">最活発: <strong>{mostActiveDow}曜日</strong></div>
                            )}
                            {uninstalledCountQty > 0 && (
                                <div className="mt-2 flex items-center gap-1 bg-amber-600/40 rounded-lg px-2 py-0.5 text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    未設置: {uninstalledCountQty}枚
                                </div>
                            )}

                            {/* ツールチップ (全体選択時のみ) */}
                            {selectedCity === '全体' && (
                                <div className="absolute top-full left-0 right-0 mt-2 hidden group-hover:block bg-zinc-950/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-md z-20 border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <p className="font-semibold border-b border-zinc-800 pb-1 mb-1.5 text-zinc-300">市区町村別内訳 (最終更新)</p>
                                    <div className="space-y-1.5">
                                        {lastUpdateByCity.map(item => (
                                            <div key={item.city} className="flex justify-between items-center">
                                                <span className="text-zinc-400">{item.city}</span>
                                                <span className="font-medium text-[11px]">
                                                    {item.lastTs ? formatRelative(item.lastTs) : '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ───── 新規／撤去／張替え解除／修理解除（重要指標） ───── */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
                            期間内の作業成果（新規・撤去・張替え完了・修理完了）
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 mb-4">
                            条件設定（期間・市区町村・種類・タグ）に連動します。単位はすべて<span className="font-medium">箇所（ピンの数）</span>で、
                            上のカードの「枚数」とは数え方が異なります。
                            <span className="font-medium">「新規」は期間内に登録され、現在も掲示しているポスターの箇所数</span>で、撤去済みは含みません。
                            「張替え完了」「修理完了」は、予定フラグが外れた＝作業が終わった箇所数です。
                        </p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: '新規', count: posterMetrics.newCount, breakdown: posterMetrics.newBreakdown, Icon: PlusCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                                { label: '撤去', count: posterMetrics.removedCount, breakdown: posterMetrics.removedBreakdown, Icon: PackageOpen, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                                { label: '張替え完了', count: posterMetrics.replaceCancelCount, breakdown: posterMetrics.replaceCancelBreakdown, Icon: RefreshCcw, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                                { label: '修理完了', count: posterMetrics.repairCancelCount, breakdown: posterMetrics.repairCancelBreakdown, Icon: Wrench, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                            ].map(item => (
                                <div key={item.label} className={`relative group rounded-xl p-4 ${item.bg}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-xs font-semibold uppercase tracking-wide ${item.color}`}>{item.label}</span>
                                        <item.Icon className={`w-4 h-4 ${item.color}`} />
                                    </div>
                                    <div className={`text-2xl font-bold ${item.color}`}>{item.count.toLocaleString()}<span className="text-sm font-normal ml-1">箇所</span></div>

                                    {item.breakdown.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 hidden group-hover:block bg-zinc-950/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-md z-20 border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150 max-h-56 overflow-y-auto">
                                            <p className="font-semibold border-b border-zinc-800 pb-1 mb-1.5 text-zinc-300">内訳（住所別）</p>
                                            <div className="space-y-1">
                                                {item.breakdown.map(([addr, count]) => (
                                                    <div key={addr} className="flex justify-between items-center gap-3">
                                                        <span className="text-zinc-400 truncate">{addr}</span>
                                                        <span className="font-medium shrink-0">{count}箇所</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                            「撤去」は2026-07-20の記録開始以降のみ集計可能です。それより前の期間を選択した場合は実際より少なく表示される場合があります。
                        </p>
                    </div>

                    {/* ───── グラフ2枚（PCでは横並び）───── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* ───── 種類別ピン数 折れ線グラフ ───── */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                                    種類別 ピン数推移（累積追加数・枚）
                                </h3>
                                {trendTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-3 text-xs">
                                        {trendTypes.map(type => (
                                            <span key={type} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                                <span className="w-4 h-0.5 inline-block rounded" style={{ backgroundColor: PERSON_COLORS[type as keyof typeof PERSON_COLORS] || '#6B7280' }} />
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {trendTypes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400 dark:text-gray-500 text-sm">
                                    <span className="text-2xl">📊</span>
                                    <p>まだデータがありません</p>
                                    <p className="text-xs text-center">ポスターの追加・削除操作を行うと、ここに種類別のピン数推移が表示されます（B案ログから集計）</p>
                                </div>
                            ) : (
                                <TypeTrendLineChart data={typeTrendData} types={trendTypes} />
                            )}
                        </div>

                        {/* ───── 日別アクション推移グラフ ───── */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                                    日別アクション推移<span className="ml-1.5 font-normal normal-case text-gray-400">（件）</span>
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />追加
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />更新
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />削除
                                    </span>
                                </div>
                            </div>
                            <ActivityBarChart data={dailyData} />
                        </div>
                    </div>

                    {/* ───── 種類別サマリーテーブル ───── */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
                            種類別サマリー<span className="ml-1.5 font-normal normal-case text-gray-400">（枚）</span>
                        </h3>

                        {typeSummary.length === 0 ? (
                            <div className="text-center text-gray-400 dark:text-gray-500 py-10">
                                データがありません
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-zinc-800">
                                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">種類</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">現在数</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">設置率</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">+追加</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">−削除</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">純増減</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/80">
                                        {typeSummary.map(s => (
                                            <tr key={s.type} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: PERSON_COLORS[s.type as keyof typeof PERSON_COLORS] || '#6B7280' }}
                                                        />
                                                        <span className="font-medium text-gray-800 dark:text-gray-200">{s.type}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                    {s.current.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-gray-100 dark:bg-zinc-700 rounded-full h-1.5">
                                                            <div
                                                                className="bg-emerald-400 rounded-full h-1.5 transition-all"
                                                                style={{ width: `${s.installRate}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right">
                                                            {s.installRate}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {s.added > 0 ? `+${s.added}` : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold text-red-500 dark:text-red-400">
                                                    {s.deleted > 0 ? `−${s.deleted}` : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <span className={`font-bold text-sm ${
                                                        s.net > 0 ? 'text-emerald-600 dark:text-emerald-400'
                                                        : s.net < 0 ? 'text-red-500 dark:text-red-400'
                                                        : 'text-gray-400 dark:text-zinc-500'
                                                    }`}>
                                                        {s.net > 0 ? `+${s.net}` : s.net === 0 ? '±0' : s.net}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60">
                                            <td className="py-3 px-3 font-bold text-gray-700 dark:text-gray-300">合計</td>
                                            <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                {totalCurrentFiltered.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs text-gray-500">
                                                {installedRate}%
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                +{totalAdded}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-red-500 dark:text-red-400">
                                                −{totalDeleted}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className={`font-bold ${netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    {netChange >= 0 ? '+' : ''}{netChange}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="h-4" />
        </div>
    );
};
