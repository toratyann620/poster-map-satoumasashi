import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * 外から渡されたリンクを受けて、該当の依頼・ピンを開くための読み取り口。
 *
 *   https://poster-map-app.vercel.app/task/<id>     → その依頼を開く（Slack の通知）
 *   https://poster-map-app.vercel.app/poster/<id>   → そのピンを地図で開く（変更履歴など）
 *
 * 経路は2つある。どちらか片方だけでは取りこぼす。
 *  1. ブラウザ版、および「アプリが起動していない状態でリンクを踏んだ」場合
 *     → 起動時の URL（`location.pathname`）に入っている
 *  2. ネイティブで「アプリが既に起動している状態でリンクを踏んだ」場合
 *     → 画面は作り直されないので URL は変わらず、Capacitor の `appUrlOpen` で届く
 *
 * アプリが入っていない端末では、同じURLがブラウザ版を開いて同じものを表示する
 * （Universal Links / App Links が無くても通る、いちばん確実な経路）。
 */

/** Firestore の自動IDを想定した形 */
const ID = '[A-Za-z0-9_-]{6,64}';
const TASK_PATH = new RegExp(`/task/(${ID})`);
const POSTER_PATH = new RegExp(`/poster/(${ID})`);

/** 受け取れるリンクの種類 */
export type DeepLink =
    | { kind: 'task'; id: string }
    | { kind: 'poster'; id: string };

const idFrom = (url: string, path: RegExp, query: string): string | null => {
    try {
        // 相対パスでも絶対URLでも扱えるようにベースを与える
        const u = new URL(url, 'https://poster-map-app.vercel.app');
        const fromQuery = u.searchParams.get(query);
        if (fromQuery && new RegExp(`^${ID}$`).test(fromQuery)) return fromQuery;
        return u.pathname.match(path)?.[1] ?? null;
    } catch {
        return url.match(path)?.[1] ?? null;
    }
};

/** `/task/<id>` `?task=<id>` / `/poster/<id>` `?poster=<id>` を見分けて返す */
export const parseDeepLink = (url: string): DeepLink | null => {
    const taskId = idFrom(url, TASK_PATH, 'task');
    if (taskId) return { kind: 'task', id: taskId };
    const posterId = idFrom(url, POSTER_PATH, 'poster');
    if (posterId) return { kind: 'poster', id: posterId };
    return null;
};

/** 起動時のURLに含まれているリンク。無ければ null */
export const readInitialDeepLink = (): DeepLink | null =>
    parseDeepLink(window.location.pathname + window.location.search);

/**
 * 起動中にリンクを踏まれたときの通知を受ける。戻り値を呼ぶと購読をやめる。
 * ネイティブ以外では何もしない（ブラウザは毎回ページを読み直すため不要）。
 */
export const onDeepLink = (handler: (link: DeepLink) => void): (() => void) => {
    if (!Capacitor.isNativePlatform()) return () => { };
    const sub = CapApp.addListener('appUrlOpen', ({ url }) => {
        const link = parseDeepLink(url);
        if (link) handler(link);
    });
    return () => { void sub.then((s) => s.remove()); };
};

/**
 * 開き終わったら、URL から `/task/<id>` `/poster/<id>` を外して地図のURLに戻す。
 *
 * これをしないと、ブラウザ版を再読み込みするたびに同じものが開き直す。
 * ネイティブでは履歴を触らない（WebView の履歴を書き換えると
 * Android の戻るキーの挙動が読みにくくなるため）。
 */
export const clearDeepLinkFromUrl = (): void => {
    if (Capacitor.isNativePlatform()) return;
    const { pathname, search } = window.location;
    const hasLink = TASK_PATH.test(pathname) || POSTER_PATH.test(pathname)
        || search.includes('task=') || search.includes('poster=');
    if (!hasLink) return;
    window.history.replaceState(null, '', '/');
};

/** 変更履歴などから渡す、ピンへのリンク */
export const posterLink = (posterId: string): string =>
    `https://poster-map-app.vercel.app/poster/${posterId}`;
