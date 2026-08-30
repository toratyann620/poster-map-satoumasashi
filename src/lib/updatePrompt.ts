/**
 * 更新案内ポップアップの表示判定と、その記憶の読み書き。
 *
 * コンポーネントから切り離しているのは、時間経過が絡む判定を
 * UI操作なしで検証できるようにするため（`npm run test:update-prompt`）。
 */

export const DISMISS_KEY = 'dismissedUpdateVersion';

/** 「あとで」を選んでから、再度案内するまでの期間 */
export const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 1週間

export type Dismissal = { version: string; at: number };

/**
 * 案内を出すべきかを判定する。
 *
 * 出さないのは「同じバージョンについて、まだ日が浅いうちに閉じた」場合だけ。
 * バージョンが上がっていれば出すし、閉じてから1週間たっていても出す
 * （放置され続けると古い版が残ったままになるため）。
 */
export const shouldShowUpdatePrompt = (
    dismissal: Dismissal | null,
    latestVersion: string,
    now: number,
): boolean => {
    if (!latestVersion) return false;
    if (!dismissal) return true;
    if (dismissal.version !== latestVersion) return true;
    return now - dismissal.at >= REMIND_AFTER_MS;
};

/** 保存済みの「閉じた記録」を読む。読めない場合は null（＝案内する）。 */
export const readDismissal = (fallbackAt: number): Dismissal | null => {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return null;
        // 旧形式（バージョン文字列のみ）も読めるようにしておく
        if (!raw.startsWith('{')) return { version: raw, at: fallbackAt };
        const parsed = JSON.parse(raw);
        if (typeof parsed?.version !== 'string') return null;
        return { version: parsed.version, at: Number(parsed.at) || 0 };
    } catch {
        // プライベートモード等で localStorage が使えない場合は毎回表示する
        return null;
    }
};

/** 「閉じた」ことを記録する。保存できなくても支障はない。 */
export const writeDismissal = (dismissal: Dismissal): void => {
    try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissal));
    } catch {
        // 記憶できなくても閉じられれば支障はない
    }
};
