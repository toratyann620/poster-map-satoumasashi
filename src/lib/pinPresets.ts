import { readString, writeString } from './deviceStore';

/**
 * ピン打ちモードで使う「よく使う登録内容」。
 *
 * 現地では、種類・ステータス・タグをその都度選ぶ手間が入力の妨げになる。
 * あらかじめ決めておけば、現在地にボタンひとつでピンを立てられる。
 *
 * 端末ごとに保存する。持ち歩く端末と担当する内容は結びついていることが多く、
 * 同じ人でも「今日は張り替え担当」のように使い分けたいため、
 * アカウントに固定するより端末に置く方が実態に合う。
 */

const KEY = 'pin_presets';

/** マップに並べられる数。これ以上増やすと地図が隠れる */
export const MAX_PRESETS = 3;

export interface PinPreset {
    type: string;
    status: string[];
    tags: string[];
}

export const emptyPreset = (): PinPreset => ({ type: '佐藤まさし', status: ['設置済'], tags: [] });

export const readPresets = (): PinPreset[] => {
    const raw = readString(KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((p): p is PinPreset => !!p && typeof p.type === 'string')
            .slice(0, MAX_PRESETS)
            .map((p) => ({
                type: String(p.type),
                status: Array.isArray(p.status) ? p.status.map(String) : [],
                tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
            }));
    } catch {
        return [];
    }
};

export const writePresets = (presets: PinPreset[]): void => {
    writeString(KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
};

/**
 * ボタンの説明文。ボタン自体は番号だけを出すので、
 * 押し間違いを防ぐための補助（title / 読み上げ）に使う。
 */
export const presetLabel = (preset: PinPreset): string =>
    [preset.type, ...preset.status, ...preset.tags.map((t) => `#${t}`)].join('・');
