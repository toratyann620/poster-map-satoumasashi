import type { PosterPin } from '../types';
import { shortenAddress } from './posterMetrics';

/**
 * 広域表示のときに、ポスターのピンを町域（市区町村＋町名）ごとにまとめる。
 *
 * 従来は距離ベースの MarkerClusterer を使っていたが、まとまり方が
 * 画面上の見え方に依存するため「同じ場所なのに縮尺で件数が変わる」状態だった。
 * 町域という意味のある単位でまとめると、件数がそのまま「この地区に何枚あるか」になる。
 *
 * 事前集計テーブルは作らず、その都度まとめている。ポスターは1,500件程度で、
 * 全件がすでに手元にあるため、集計は一瞬で終わる。
 * 事前集計には「加算・減算の取りこぼしで実数とずれる」という弱点があり、
 * 1万件を超えるまでは都度集計の方が安全で単純に保てる。
 */

/** 集計ピンと個別ピンを切り替えるズーム。これ未満なら集計ピン */
export const AGGREGATE_ZOOM = 15;

/**
 * 集計ピンの上限。画面に出して意味のある数で切る。
 * 対象3市の町域は200程度なので、通常この上限には当たらない。
 */
export const AGGREGATE_LIMIT = 1000;

export interface TownAggregate {
    key: string;
    /** 表示名（例: 厚木市妻田南） */
    town: string;
    /** 代表座標。この町域に属するピンの平均 */
    lat: number;
    lng: number;
    count: number;
    posters: PosterPin[];
}

/**
 * まとめる単位のキーを作る。
 *
 * 住所から「市区町村＋町名」を取り出す（ダッシュボードの集計と同じ `shortenAddress`）。
 * 住所が建物名だけ等で町域を取り出せない場合は、約1km四方の区画で代用する。
 * 全部を「住所不明」でひとまとめにすると、離れた場所のピンが1本にまとまって
 * 代表座標がどこでもない海の上に立つことがあるため。
 */
const townKeyOf = (p: PosterPin): { key: string; label: string } => {
    const label = shortenAddress(p.address);
    if (label && label !== '(住所不明)') return { key: `t:${label}`, label };

    const gridLat = Math.floor(p.lat * 100) / 100;
    const gridLng = Math.floor(p.lng * 100) / 100;
    return { key: `g:${gridLat}_${gridLng}`, label: '住所未入力' };
};

/**
 * 町域ごとにまとめる。件数の多い順に返し、上限を超えた分は捨てる。
 *
 * 渡す配列は、画面のフィルターを適用した「実際に表示する対象」であること。
 * まとめてから絞ると件数が実態と合わなくなる。
 */
export const aggregateByTown = (
    posters: PosterPin[],
    limit = AGGREGATE_LIMIT,
): TownAggregate[] => {
    const groups = new Map<string, { label: string; items: PosterPin[] }>();

    posters.forEach((p) => {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
        const { key, label } = townKeyOf(p);
        const g = groups.get(key);
        if (g) g.items.push(p);
        else groups.set(key, { label, items: [p] });
    });

    const result: TownAggregate[] = [];
    groups.forEach(({ label, items }, key) => {
        // 代表座標は該当ピンの平均。事前に決めた代表点より、
        // いま表示している集団の重心に近い位置へピンが立つ。
        const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
        const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
        result.push({ key, town: label, lat, lng, count: items.length, posters: items });
    });

    result.sort((a, b) => b.count - a.count);
    return result.slice(0, limit);
};
