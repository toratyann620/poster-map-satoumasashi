import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, firebaseConfig } from '../lib/firebase';

export interface UserData {
    id: string; // auth uid
    name: string;
    email: string;
    role: 'admin' | 'general';
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

    // 新規ユーザー追加（セカンダリアプリを使用して現在の管理者のログインを維持）
    const createUser = async (userData: Omit<UserData, 'id'>, password: string) => {
        // 一時的なセカンダリアプリインスタンスを作成
        const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);

        try {
            // 新規ユーザーを Auth に作成
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
            const newUid = userCredential.user.uid;

            // Firestoreの users コレクションに書き込み
            await setDoc(doc(db, 'users', newUid), {
                name: userData.name,
                email: userData.email,
                role: userData.role
            });

            return { success: true, uid: newUid };
        } catch (error: any) {
            console.error('Error creating user:', error);
            throw new Error(error.message);
        } finally {
            // セカンダリアプリを確実に破棄（サインアウトしてアプリを削除）
            await secondaryAuth.signOut();
            await deleteApp(secondaryApp);
        }
    };

    // ユーザー情報の削除 (Firestoreドキュメントの削除のみ。Authアカウント自体を削除するにはAdmin SDKが必要なため)
    const removeUser = async (uid: string) => {
        try {
            await deleteDoc(doc(db, 'users', uid));
        } catch (error: any) {
            console.error('Error deleting user:', error);
            throw new Error(error.message);
        }
    };

    return {
        users,
        loading,
        createUser,
        removeUser
    };
};
