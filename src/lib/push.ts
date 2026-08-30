import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * プッシュ通知の受け取り口。
 *
 * 共通仕様では Expo Push を使い、トークンを `User.expoPushToken` に持たせているが、
 * 本アプリはすでに Firebase を使っているため FCM で受ける。
 * iOS も Android も FCM のトークンに揃えたいので、APNs のトークンをそのまま返す
 * 公式の `@capacitor/push-notifications` ではなく `@capacitor-firebase/messaging`
 * を使っている（前者だと iOS 向けに APNs へ直接送る経路を別に作ることになる）。
 *
 * トークンはユーザー文書ではなく `pushTokens` コレクションに1件ずつ置く。
 * `users` は佐藤まさし事務所の管理者しか書けない設計で、そこに例外を増やすより、
 * 「自分の uid が入った文書だけ書ける」独立したコレクションにする方が安全なため。
 * 1人が複数の端末を使う場合にも素直に対応できる。
 */

export const PUSH_TOKENS_COLLECTION = 'pushTokens';

/** Web ではプッシュを扱わない（ブラウザを開いていないと届かず、意味が薄いため） */
export const isPushSupported = (): boolean => Capacitor.isNativePlatform();

const tokenDocId = (token: string): string =>
    // Firestore のドキュメントIDに '/' は使えない。FCM のトークンには通常含まれないが、
    // 将来形式が変わっても壊れないように置き換えておく。
    token.replace(/\//g, '_');

/** 端末のトークンを保存する。同じ端末から再取得しても同じIDに上書きされる。 */
const saveToken = async (uid: string, token: string): Promise<void> => {
    await setDoc(doc(db, PUSH_TOKENS_COLLECTION, tokenDocId(token)), {
        uid,
        token,
        platform: Capacitor.getPlatform(),
        updatedAt: Date.now(),
    });
};

/**
 * 通知の許可を求め、トークンを登録する。
 *
 * 呼ぶのはログインが済んで承認済みメンバーだと分かってから。
 * 起動直後に尋ねると、何のアプリか分からないまま拒否されやすく、
 * iOS では一度拒否されると設定アプリからしか戻せない。
 *
 * @returns 登録できたら true。未対応・拒否・失敗はいずれも false。
 */
export const registerForPush = async (uid: string): Promise<boolean> => {
    if (!isPushSupported()) return false;

    try {
        const { receive } = await FirebaseMessaging.requestPermissions();
        if (receive !== 'granted') return false;

        const { token } = await FirebaseMessaging.getToken();
        if (!token) return false;

        await saveToken(uid, token);

        // トークンは再発行されることがある（アプリの再インストール、長期間の未使用など）。
        // 変わったら黙って古いものが使われ続けないよう、その場で保存し直す。
        await FirebaseMessaging.removeAllListeners();
        await FirebaseMessaging.addListener('tokenReceived', (event) => {
            if (event.token) void saveToken(uid, event.token);
        });

        return true;
    } catch (e) {
        // 通知が使えなくてもアプリ本体は使えるので、失敗しても止めない
        console.warn('プッシュ通知の登録に失敗しました:', e);
        return false;
    }
};

/**
 * ログアウト時にトークンを外す。
 * これをしないと、その端末を次に使う人に前の人あての通知が届く。
 */
export const unregisterFromPush = async (): Promise<void> => {
    if (!isPushSupported()) return;
    try {
        const { token } = await FirebaseMessaging.getToken();
        await FirebaseMessaging.removeAllListeners();
        if (token) await deleteDoc(doc(db, PUSH_TOKENS_COLLECTION, tokenDocId(token)));
    } catch (e) {
        console.warn('プッシュ通知の解除に失敗しました:', e);
    }
};
