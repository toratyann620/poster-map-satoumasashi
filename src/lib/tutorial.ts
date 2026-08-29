import { readString, writeString, removeKey } from './deviceStore';

/**
 * 初回チュートリアルを見せたかどうかの記録。
 *
 * 共通仕様どおり「一度見せたら以降は出さない」「ログアウト・再インストール後は
 * 再表示する」。後者は記録を端末に置いているため自然に満たされる
 * （アプリを消せば消え、ログアウト時は下の forgetTutorial で消す）。
 *
 * 値にはバージョンを入れている。将来スライドを大きく作り替えたときに
 * TUTORIAL_VERSION を上げれば、既存ユーザーにもう一度見せられる。
 */
const TUTORIAL_SHOWN_KEY = 'tutorial_shown';

/** スライドの内容を作り替えたら上げる */
export const TUTORIAL_VERSION = '1';

export const hasSeenTutorial = (): boolean => readString(TUTORIAL_SHOWN_KEY) === TUTORIAL_VERSION;

export const markTutorialSeen = (): void => writeString(TUTORIAL_SHOWN_KEY, TUTORIAL_VERSION);

/** ログアウト時に呼ぶ。次に別のユーザーがログインしたら最初から案内する。 */
export const forgetTutorial = (): void => removeKey(TUTORIAL_SHOWN_KEY);
