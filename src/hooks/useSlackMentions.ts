import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import type { SlackMentionTarget } from '../types';
import { useSession } from './useSession';

/**
 * 依頼を Slack に流すときのメンション先の一覧（`settings/slackMentions`）。
 *
 * Slack のメンバー一覧は取れない。このアプリが持っているのは日次レポートと
 * 同じ Incoming Webhook だけで、webhook からは users.list を呼べないため
 * （Bot トークンが必要で、それはこのアプリの管轄外）。
 * そのため候補は管理画面から手で登録する運用にしている。
 *
 * 読めるのはメンバー全員、書けるのは佐藤まさし事務所の管理者だけ
 * （firestore.rules の settings の規定どおり）。
 */
const SETTINGS_DOC = doc(db, COL.settings, 'slackMentions');

/**
 * 最初から選べるようにしておく分。人のメンバーIDは環境ごとに違うので持てないが、
 * この2つは Slack 共通の記法なので既定値として置ける。
 */
const DEFAULT_TARGETS: SlackMentionTarget[] = [
    { label: '@here（いま見ている人）', mention: '<!here>' },
    { label: '@channel（チャンネル全員）', mention: '<!channel>' },
];

/** 同じメンションを二重に登録させない */
const dedupe = (list: SlackMentionTarget[]): SlackMentionTarget[] => {
    const seen = new Set<string>();
    return list.filter((t) => {
        if (!t?.mention || seen.has(t.mention)) return false;
        seen.add(t.mention);
        return true;
    });
};

/**
 * 入力されたものを Slack の記法に直す。
 *
 * 現場では「U0ABCDEF」とIDだけ貼られることも、「<@U0ABCDEF>」と記法のまま
 * 貼られることもある。どちらでも通るようにしておかないと、
 * 記法が崩れたまま保存され、Slack に生の文字列が出てしまう。
 */
export const normalizeMention = (raw: string): string | null => {
    const v = raw.trim();
    if (!v) return null;
    // すでに記法になっているもの
    if (/^<[@!#][^<>]*>$/.test(v)) return v;
    // @here / @channel / here / channel
    const bare = v.replace(/^@/, '').toLowerCase();
    if (bare === 'here' || bare === 'channel') return `<!${bare}>`;
    // メンバーID（U… / W…）とユーザーグループID（S…）
    if (/^[UW][A-Z0-9]{6,}$/i.test(v)) return `<@${v.toUpperCase()}>`;
    if (/^S[A-Z0-9]{6,}$/i.test(v)) return `<!subteam^${v.toUpperCase()}>`;
    return null;
};

export const useSlackMentions = () => {
    const { ready, user, isSuperAdmin } = useSession();
    const [targets, setTargets] = useState<SlackMentionTarget[]>(DEFAULT_TARGETS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 認証が確定してから購読する。ログイン前に読むと必ず拒否され、
        // 既定値のまま黙って動いてしまう（pinTypes で踏んだのと同じ罠）。
        if (!ready || !user) return;
        const unsub = onSnapshot(
            SETTINGS_DOC,
            (snap) => {
                const list = snap.exists() ? snap.data()?.targets : null;
                setTargets(Array.isArray(list) && list.length > 0 ? dedupe(list as SlackMentionTarget[]) : DEFAULT_TARGETS);
                setLoading(false);
            },
            () => setLoading(false),
        );
        return () => unsub();
    }, [ready, user]);

    /** 一覧をまるごと置き換える。書けるのは佐藤まさし事務所の管理者だけ */
    const save = useCallback(async (next: SlackMentionTarget[]) => {
        if (!isSuperAdmin) throw new Error('メンション先の変更は佐藤まさし事務所の管理者のみ行えます。');
        await setDoc(SETTINGS_DOC, { targets: dedupe(next), updatedAt: Date.now() }, { merge: true });
    }, [isSuperAdmin]);

    return { targets, loading, save, canEdit: isSuperAdmin };
};
