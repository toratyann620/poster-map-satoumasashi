import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Slack の通知に付けた `https://poster-map-app.vercel.app/task/<id>` を受けて、
 * その依頼を開くための読み取り口。
 *
 * 経路は2つある。どちらか片方だけでは取りこぼす。
 *  1. ブラウザ版、および「アプリが起動していない状態でリンクを踏んだ」場合
 *     → 起動時の URL（`location.pathname`）に入っている
 *  2. ネイティブで「アプリが既に起動している状態でリンクを踏んだ」場合
 *     → 画面は作り直されないので URL は変わらず、Capacitor の `appUrlOpen` で届く
 *
 * アプリが入っていない端末では、同じURLがブラウザ版を開いて同じ依頼を表示する
 * （Universal Links / App Links が無くても通る、いちばん確実な経路）。
 */

/** `/task/<id>` と `?task=<id>` の両方を受ける。IDは Firestore の自動IDを想定 */
const TASK_PATH = /\/task\/([A-Za-z0-9_-]{6,64})/;

export const parseTaskId = (url: string): string | null => {
    try {
        // 相対パスでも絶対URLでも扱えるようにベースを与える
        const u = new URL(url, 'https://poster-map-app.vercel.app');
        const fromQuery = u.searchParams.get('task');
        if (fromQuery && /^[A-Za-z0-9_-]{6,64}$/.test(fromQuery)) return fromQuery;
        return u.pathname.match(TASK_PATH)?.[1] ?? null;
    } catch {
        return url.match(TASK_PATH)?.[1] ?? null;
    }
};

/** 起動時のURLに含まれている依頼ID。無ければ null */
export const readInitialTaskId = (): string | null =>
    parseTaskId(window.location.pathname + window.location.search);

/**
 * 起動中にリンクを踏まれたときの通知を受ける。戻り値を呼ぶと購読をやめる。
 * ネイティブ以外では何もしない（ブラウザは毎回ページを読み直すため不要）。
 */
export const onTaskDeepLink = (handler: (taskId: string) => void): (() => void) => {
    if (!Capacitor.isNativePlatform()) return () => { };
    const sub = CapApp.addListener('appUrlOpen', ({ url }) => {
        const id = parseTaskId(url);
        if (id) handler(id);
    });
    return () => { void sub.then((s) => s.remove()); };
};

/**
 * 依頼を開き終わったら、URL から `/task/<id>` を外して地図のURLに戻す。
 *
 * これをしないと、ブラウザ版を再読み込みするたびに同じ依頼が開き直す。
 * ネイティブでは履歴を触らない（WebView の履歴を書き換えると
 * Android の戻るキーの挙動が読みにくくなるため）。
 */
export const clearTaskFromUrl = (): void => {
    if (Capacitor.isNativePlatform()) return;
    if (!TASK_PATH.test(window.location.pathname) && !window.location.search.includes('task=')) return;
    window.history.replaceState(null, '', '/');
};
