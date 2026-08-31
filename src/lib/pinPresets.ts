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
    /** ボタンに出す短い名前 */
    label: string;
    type: string;
    status: string[];
    tags: string[];
}

export const emptyPreset = (): PinPreset => ({ label: '', type: '佐藤まさし', status: ['設置済'], tags: [] });

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
                label: String(p.label ?? ''),
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

/** ボタンに出す名前。未入力なら種類で代用する */
export const presetLabel = (preset: PinPreset): string => preset.label.trim() || preset.type;
