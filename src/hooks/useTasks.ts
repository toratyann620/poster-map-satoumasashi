import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    collection, doc, onSnapshot, orderBy, query, where,
    addDoc, updateDoc, deleteDoc, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import { useSession } from './useSession';
import type { Task } from '../types';

/**
 * 作業の依頼（タスク）の購読と更新。
 *
 * 事務所（グループ）単位で分けている。佐藤まさし事務所（allowAll）は
 * 全事務所の依頼を扱えるため、その場合だけ条件を付けずに取得する。
 * セキュリティルール側も同じ分岐になっており、条件の付け方がずれると
 * `permission-denied` になるので、両方をまとめて変えること。
 */

const parseTask = (id: string, d: Record<string, unknown>): Task => ({
    id,
    groupId: String(d.groupId ?? ''),
    title: String(d.title ?? ''),
    body: String(d.body ?? ''),
    kind: (d.kind as Task['kind']) ?? 'その他',
    posterId: d.posterId ? String(d.posterId) : undefined,
    address: d.address ? String(d.address) : undefined,
    assigneeUid: d.assigneeUid ? String(d.assigneeUid) : undefined,
    assigneeName: d.assigneeName ? String(d.assigneeName) : undefined,
    dueDate: d.dueDate ? String(d.dueDate) : undefined,
    status: d.status === 'done' ? 'done' : 'open',
    createdBy: String(d.createdBy ?? ''),
    createdAt: Number(d.createdAt) || 0,
    completedBy: d.completedBy ? String(d.completedBy) : undefined,
    completedAt: d.completedAt ? Number(d.completedAt) : undefined,
    completionNote: d.completionNote ? String(d.completionNote) : undefined,
    notify: d.notify === true,
    takenBy: d.takenBy ? String(d.takenBy) : undefined,
    takenByName: d.takenByName ? String(d.takenByName) : undefined,
    takenAt: d.takenAt ? Number(d.takenAt) : undefined,
    takenDate: d.takenDate ? String(d.takenDate) : undefined,
});

/** 端末の今日（YYYY-MM-DD）。マイタスクの有効期限の判定に使う */
export const todayStr = (now = new Date()): string => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

/** 今日、誰かが取っている依頼か（昨日以前の take は無効＝依頼に戻っている） */
export const isTakenToday = (t: Pick<Task, 'takenBy' | 'takenDate'>): boolean =>
    !!t.takenBy && t.takenDate === todayStr();

/**
 * @param scope 取得範囲。
 *   'group'（既定）… 自分の事務所の依頼だけ。マップ・マイページで使う。
 *     佐藤まさし事務所のメンバーでも自事務所ぶんに絞る（ユーザー指定の仕様）。
 *   'all' … 佐藤まさし事務所は全事務所ぶん。管理画面で使う。
 */
export const useTasks = (scope: 'group' | 'all' = 'group') => {
    const { ready, group, uid, name, isSuperAdmin } = useSession();
    const [fetched, setFetched] = useState<{ items: Task[]; loading: boolean }>({ items: [], loading: true });

    const scopeKey = group ? `${group.id}|${group.allowAll}|${scope}` : '';

    useEffect(() => {
        if (!ready || !group) return;

        const constraints: QueryConstraint[] = (scope === 'all' && group.allowAll)
            ? []
            : [where('groupId', '==', group.id)];

        const q = query(collection(db, COL.tasks), ...constraints, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snap) => {
            setFetched({ items: snap.docs.map((d) => parseTask(d.id, d.data())), loading: false });
        }, (error) => {
            console.error('依頼の取得に失敗しました:', error);
            setFetched({ items: [], loading: false });
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, scopeKey]);

    const tasks = useMemo(() => (ready && group ? fetched.items : []), [ready, group, fetched.items]);

    const openTasks = useMemo(() => tasks.filter((t) => t.status === 'open'), [tasks]);
    const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks]);

    /**
     * 自分あての依頼。担当者が空のもの（事務所の全員向け）も含める。
     * 今日自分がマイタスクに取ったものは除く（マイタスク側に移る）。
     * 他の人が今日取っているものは残す（誰が対応中かが見えないと二重に動いてしまう）。
     */
    const myTasks = useMemo(
        () => openTasks.filter((t) => (!t.assigneeUid || t.assigneeUid === uid)
            && !(isTakenToday(t) && t.takenBy === uid)),
        [openTasks, uid],
    );

    /** 今日「やる」と取った依頼（マイタスク）。日付が変わると空になる */
    const myTakenTasks = useMemo(
        () => openTasks.filter((t) => isTakenToday(t) && t.takenBy === uid),
        [openTasks, uid],
    );

    const createTask = useCallback(async (input: Omit<Task, 'id' | 'status' | 'createdBy' | 'createdAt' | 'groupId'> & { groupId?: string }) => {
        const targetGroup = input.groupId ?? group?.id;
        if (!targetGroup) throw new Error('所属する事務所が確認できませんでした。');
        // 佐藤まさし事務所以外は自分の事務所にしか出せない（ルール側でも拒否される）
        if (!isSuperAdmin && targetGroup !== group?.id) {
            throw new Error('他の事務所への依頼は作成できません。');
        }

        // Firestore は undefined を受け付けない。対象のポスターや担当者を
        // 決めない依頼では、それらが undefined のまま渡ってきて
        // 「Unsupported field value: undefined」で丸ごと失敗する。
        const clean = Object.fromEntries(
            Object.entries(input).filter(([, v]) => v !== undefined),
        );

        await addDoc(collection(db, COL.tasks), {
            ...clean,
            groupId: targetGroup,
            status: 'open',
            createdBy: name,
            createdAt: Date.now(),
        });
    }, [group, isSuperAdmin, name]);

    /**
     * 完了にする。誰が済ませたかを残す（担当者以外が代わりに済ませることがあるため）。
     * 結果は任意。「張り替えたが1枚破損」のような申し送りを残せるようにしてある。
     */
    const completeTask = useCallback(async (taskId: string, completionNote = '') => {
        await updateDoc(doc(db, COL.tasks, taskId), {
            status: 'done',
            completedBy: name,
            completedAt: Date.now(),
            completionNote,
        });
    }, [name]);

    /**
     * 依頼を今日のマイタスクに取る。
     * 同じ日に別の人が既に取っていれば断る（二人で同じ現場に向かうのを防ぐ）。
     * 昨日以前の take は無効なので上書きしてよい。
     */
    const takeTask = useCallback(async (taskId: string) => {
        const t = tasks.find((x) => x.id === taskId);
        if (!t) throw new Error('依頼が見つかりませんでした。');
        if (isTakenToday(t) && t.takenBy !== uid) {
            throw new Error(`本日は ${t.takenByName || '別の方'} が対応中です。`);
        }
        await updateDoc(doc(db, COL.tasks, taskId), {
            takenBy: uid,
            takenByName: name,
            takenAt: Date.now(),
            takenDate: todayStr(),
        });
    }, [tasks, uid, name]);

    /** マイタスクから外して依頼に戻す（今日中に手放すとき） */
    const releaseTask = useCallback(async (taskId: string) => {
        await updateDoc(doc(db, COL.tasks, taskId), {
            takenBy: '',
            takenByName: '',
            takenAt: 0,
            takenDate: '',
        });
    }, []);

    /** 完了を取り消して未対応へ戻す */
    const reopenTask = useCallback(async (taskId: string) => {
        await updateDoc(doc(db, COL.tasks, taskId), {
            status: 'open',
            completedBy: '',
            completedAt: 0,
            completionNote: '',
        });
    }, []);

    const removeTask = useCallback(async (taskId: string) => {
        await deleteDoc(doc(db, COL.tasks, taskId));
    }, []);

    return {
        tasks,
        openTasks,
        doneTasks,
        myTasks,
        myTakenTasks,
        loading: ready && group ? fetched.loading : !ready,
        createTask,
        completeTask,
        takeTask,
        releaseTask,
        reopenTask,
        removeTask,
    };
};
