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
    notify: d.notify === true,
});

export const useTasks = () => {
    const { ready, group, uid, name, isSuperAdmin } = useSession();
    const [fetched, setFetched] = useState<{ items: Task[]; loading: boolean }>({ items: [], loading: true });

    const scopeKey = group ? `${group.id}|${group.allowAll}` : '';

    useEffect(() => {
        if (!ready || !group) return;

        const constraints: QueryConstraint[] = group.allowAll
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

    /** 自分あての依頼。担当者が空のもの（事務所の全員向け）も含める */
    const myTasks = useMemo(
        () => openTasks.filter((t) => !t.assigneeUid || t.assigneeUid === uid),
        [openTasks, uid],
    );

    const createTask = useCallback(async (input: Omit<Task, 'id' | 'status' | 'createdBy' | 'createdAt' | 'groupId'> & { groupId?: string }) => {
        const targetGroup = input.groupId ?? group?.id;
        if (!targetGroup) throw new Error('所属する事務所が確認できませんでした。');
        // 佐藤まさし事務所以外は自分の事務所にしか出せない（ルール側でも拒否される）
        if (!isSuperAdmin && targetGroup !== group?.id) {
            throw new Error('他の事務所への依頼は作成できません。');
        }

        await addDoc(collection(db, COL.tasks), {
            ...input,
            groupId: targetGroup,
            status: 'open',
            createdBy: name,
            createdAt: Date.now(),
        });
    }, [group, isSuperAdmin, name]);

    /** 完了にする。誰が済ませたかを残す（担当者以外が代わりに済ませることがあるため） */
    const completeTask = useCallback(async (taskId: string) => {
        await updateDoc(doc(db, COL.tasks, taskId), {
            status: 'done',
            completedBy: name,
            completedAt: Date.now(),
        });
    }, [name]);

    /** 完了を取り消して未対応へ戻す */
    const reopenTask = useCallback(async (taskId: string) => {
        await updateDoc(doc(db, COL.tasks, taskId), {
            status: 'open',
            completedBy: '',
            completedAt: 0,
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
        loading: ready && group ? fetched.loading : !ready,
        createTask,
        completeTask,
        reopenTask,
        removeTask,
    };
};
