import { useSyncExternalStore } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COL } from '../lib/collections';
import type { Group } from '../types';

/**
 * ログイン中のユーザーと、その所属グループを解決するセッション層。
 *
 * なぜ専用の層が要るのか:
 *
 *  1. **グループが決まるまでクエリを投げられない。**
 *     ポスターの取得クエリには自グループの「市区町村 × 種別」条件を必ず付ける必要があり、
 *     条件の無いクエリは Firestore に丸ごと拒否される。
 *     従来は各フックがそれぞれ認証を待たずにクエリを投げていたため、
 *     起動直後に permission-denied が出ていた（本番でも発生していた既存の不具合）。
 *
 *  2. **リスナーを重複させない。**
 *     モジュールレベルで1つだけ購読し、全コンポーネントで共有する。
 *     Provider を挟まずに済むよう useSyncExternalStore で配る。
 */

export interface Session {
    /** 認証・ユーザー情報・グループの解決がすべて終わったか */
    ready: boolean;
    user: User | null;
    uid: string | null;
    name: string;
    role: 'admin' | 'general';
    groupId: string | null;
    group: Group | null;
    /** 佐藤まさし事務所（allowAll）の管理者。ユーザー・グループ定義を変更できる */
    isSuperAdmin: boolean;
    /** 管理者が発行した初期パスワードのままで、変更を求めるべき状態 */
    mustChangePassword: boolean;
    /** ログイン済みだがグループが解決できない場合の理由（画面に出す） */
    problem: 'no-user-doc' | 'no-group' | null;
}

const EMPTY: Session = {
    ready: false, user: null, uid: null, name: '', role: 'general',
    groupId: null, group: null, isSuperAdmin: false, mustChangePassword: false, problem: null,
};

let state: Session = EMPTY;
const listeners = new Set<() => void>();

const emit = (next: Partial<Session>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
};

// ── 単一の購読を張る ────────────────────────────────────────
let unsubUser: (() => void) | null = null;
let unsubGroup: (() => void) | null = null;

const stopDownstream = () => {
    unsubUser?.(); unsubUser = null;
    unsubGroup?.(); unsubGroup = null;
};

onAuthStateChanged(auth, (user) => {
    stopDownstream();

    if (!user) {
        emit({ ...EMPTY, ready: true });
        return;
    }

    emit({ user, uid: user.uid, ready: false, problem: null });

    // users/{uid} を購読（ロールやグループの変更が即座に反映されるように）
    unsubUser = onSnapshot(
        doc(db, COL.users, user.uid),
        (snap) => {
            if (!snap.exists()) {
                // Authアカウントはあるが承認されていない。ルール側でも全面的に拒否される。
                stopDownstream();
                emit({ ready: true, name: user.email ?? '', role: 'general', groupId: null, group: null, isSuperAdmin: false, mustChangePassword: false, problem: 'no-user-doc' });
                return;
            }
            const d = snap.data();
            const groupId: string | null = d.groupId ?? null;
            emit({
                name: d.name || user.displayName || user.email || 'unknown',
                role: d.role === 'admin' ? 'admin' : 'general',
                groupId,
                // 明示的に true のときだけ求める。フィールドを持たない
                // 既存ユーザーに変更画面を出さないため。
                mustChangePassword: d.mustChangePassword === true,
            });

            if (!groupId) {
                unsubGroup?.(); unsubGroup = null;
                emit({ ready: true, group: null, isSuperAdmin: false, problem: 'no-group' });
                return;
            }

            unsubGroup?.();
            unsubGroup = onSnapshot(
                doc(db, COL.groups, groupId),
                (gsnap) => {
                    if (!gsnap.exists()) {
                        emit({ ready: true, group: null, isSuperAdmin: false, problem: 'no-group' });
                        return;
                    }
                    const g = gsnap.data();
                    const group: Group = {
                        id: gsnap.id,
                        name: g.name ?? gsnap.id,
                        allowAll: !!g.allowAll,
                        cities: Array.isArray(g.cities) ? g.cities : [],
                        types: Array.isArray(g.types) ? g.types : [],
                    };
                    emit({
                        ready: true,
                        group,
                        isSuperAdmin: state.role === 'admin' && group.allowAll,
                        problem: null,
                    });
                },
                () => emit({ ready: true, group: null, isSuperAdmin: false, problem: 'no-group' }),
            );
        },
        () => emit({ ready: true, problem: 'no-user-doc' }),
    );
});

const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
};

const getSnapshot = () => state;

/** ログイン中のユーザーとグループを取得する。Provider は不要。 */
export const useSession = (): Session => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
