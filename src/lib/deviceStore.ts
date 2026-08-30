/**
 * 端末ごとに覚えておきたい小さな状態（チュートリアルを見たか、
 * どのお知らせを表示したか等）の読み書き。
 *
 * 共通仕様では SecureStore を使っているが、これは React Native に
 * localStorage が無いためで、機密情報だからではない。本アプリは
 * Capacitor（WKWebView / WebView）で動くので localStorage がそのまま使え、
 * 「その端末にだけ残る」という同じ性質が得られる。
 *
 * プライベートモードやサイトデータの制限で例外を投げる環境があるため、
 * 読み書きは必ず try/catch で包み、失敗しても機能が止まらないようにする。
 * 失敗時は「まだ何も記録していない」とみなす。チュートリアルやお知らせは
 * 二度出ても実害が無く、逆に出ないと気づけないため。
 */

export const readString = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

export const writeString = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // 記録できなくても操作自体は完了させる
    }
};

export const removeKey = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch {
        // 同上
    }
};

/** 文字列の配列として読む。壊れていた場合は空配列を返す。 */
export const readStringList = (key: string): string[] => {
    const raw = readString(key);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
        return [];
    }
};

/**
 * 文字列の配列として書く。
 * 際限なく伸びないよう、新しいものを優先して maxLength 件までに切り詰める。
 */
export const writeStringList = (key: string, list: string[], maxLength = 200): void => {
    writeString(key, JSON.stringify(list.slice(-maxLength)));
};
