import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';

export interface UserData {
    id: string; // auth uid
    name: string;
    email: string;
    role: 'admin' | 'general';
    /** 所属グループID（例: admin / nanba）。未設定のユーザーはデータに一切アクセスできない。 */
    groupId?: string;
    /** 発行された初期パスワードのままで、変更を求めている状態 */
    mustChangePassword?: boolean;
}

export interface ProvisionResult {
    /** created=新規作成 / adopted=残っていたログインアカウントを引き取った / orphan=引き取ってよいか確認が要る */
    status: 'created' | 'adopted' | 'orphan';
    uid: string;
    email?: string;
}

export const useUsers = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    // ユーザー一覧のリアルタイム取得
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserData[];
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching users:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    /**
     * 新規ユーザーを発行する。
     *
     * Auth の作成と users ドキュメントの作成を、Cloud Function 側の1操作にまとめている。
     * 以前はクライアントでセカンダリのFirebaseアプリを立てて2段で行っていたが、
     * 途中で失敗すると**ログインアカウントだけが残り**、そのメールアドレスでは
     * 二度と作り直せない（一覧にも出ない）状態になっていた。
     *
     * 戻り値の `status` が `orphan` のときは、既にログインアカウントだけが
     * 残っている。引き取ってよいか利用者に確かめてから `adopt: true` で呼び直す。
     */
    const createUser = async (
        userData: Omit<UserData, 'id'>,
        password: string,
        options?: { adopt?: boolean },
    ): Promise<ProvisionResult> => {
        const call = httpsCallable<Record<string, unknown>, ProvisionResult>(functions, 'provisionUser');
        const res = await call({
            name: userData.name,
            email: userData.email,
            role: userData.role,
            groupId: userData.groupId ?? '',
            password,
            adopt: options?.adopt === true,
        });
        return res.data;
    };

    // ユーザー情報の更新（ロール・所属グループの変更）
    const updateUser = async (uid: string, updates: Partial<Pick<UserData, 'name' | 'role' | 'groupId'>>) => {
        try {
            await setDoc(doc(db, 'users', uid), updates, { merge: true });
        } catch (error: any) {
            console.error('Error updating user:', error);
            throw new Error(error.message);
        }
    };

    // ユーザー情報の削除 (Firestoreドキュメントの削除のみ。Authアカウント自体を削除するにはAdmin SDKが必要なため)
    /**
     * ユーザーを削除する。
     *
     * ログインアカウント（Auth）の削除はクライアントSDKでは他人に対して行えないため、
     * Cloud Function に委ねる。Firestore のドキュメントも関数側でまとめて消すので、
     * 「権限は消えたがアカウントは残る」という中途半端な状態にならない。
     */
    const removeUser = async (uid: string) => {
        try {
            const call = httpsCallable<{ uid: string }, { ok: boolean }>(functions, 'deleteUserAccount');
            await call({ uid });
        } catch (error: unknown) {
            const message = (error as { message?: string })?.message ?? '削除に失敗しました。';
            console.error('Error deleting user:', error);
            throw new Error(message);
        }
    };

    return {
        users,
        loading,
        createUser,
        updateUser,
        removeUser
    };
};
