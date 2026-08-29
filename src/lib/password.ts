/**
 * 管理者がユーザーを新規作成する際に配る初期パスワードの生成。
 *
 * 口頭やメモで受け渡すことを前提に、読み違えの起きにくさを優先している:
 *  - 大文字の O と数字の 0、小文字の l と大文字の I と数字の 1 は使わない
 *  - 英大文字・英小文字・数字をそれぞれ必ず1文字以上含める
 *
 * 長さは共通仕様の6文字に合わせている。総当たりへの耐性は
 * Firebase Auth 側の試行回数制限（auth/too-many-requests）と、
 * 初回ログイン時のパスワード変更の強制で担保する。
 */

const UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // O を除外
const LOWER_CHARS = 'abcdefghijkmnopqrstuvwxyz'; // l を除外
const DIGIT_CHARS = '23456789';                  // 0, 1 を除外
const ALL_CHARS = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS;

export const INITIAL_PASSWORD_LENGTH = 6;

/** 0 以上 max 未満の整数を、偏りなく返す */
const randomInt = (max: number): number => {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let v: number;
    do {
        crypto.getRandomValues(buf);
        v = buf[0];
    } while (v >= limit); // 端数の範囲を捨てて一様性を保つ
    return v % max;
};

const randomFrom = (chars: string): string => chars[randomInt(chars.length)];

export const generateInitialPassword = (): string => {
    const chars = [
        randomFrom(UPPER_CHARS),
        randomFrom(LOWER_CHARS),
        randomFrom(DIGIT_CHARS),
    ];
    for (let i = chars.length; i < INITIAL_PASSWORD_LENGTH; i++) {
        chars.push(randomFrom(ALL_CHARS));
    }
    // Fisher-Yates。先頭3文字が必ず大文字・小文字・数字の順になるのを崩す
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
};
