// delete_all.mjs
// Firestoreの posters コレクションを全件削除するワンタイムスクリプト
//
// 実行方法: node delete_all.mjs

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDFVt8w4WjvR7U5xJRCA7-_2FY40hIlWdk",
    authDomain: "satoumasashi-poster-map.firebaseapp.com",
    projectId: "satoumasashi-poster-map",
    storageBucket: "satoumasashi-poster-map.firebasestorage.app",
    messagingSenderId: "390119901860",
    appId: "1:390119901860:web:502bf54b08217df6a33431"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// ↓ ご自身のログイン情報
// ==========================================
const EMAIL = "test@test.com";
const PASSWORD = "testtest";

async function deleteAll() {
    console.log("🗑️  Firestoreの全データ削除スクリプトを開始します...");

    try {
        await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
        console.log("✅ 認証成功");

        const snapshot = await getDocs(collection(db, 'posters'));
        const total = snapshot.size;
        console.log(`📦 ${total} 件のドキュメントを取得しました`);

        if (total === 0) {
            console.log("⚠️  削除するデータがありません。");
            process.exit(0);
        }

        // バッチ削除（500件上限のため分割）
        const BATCH_LIMIT = 400;
        let batch = writeBatch(db);
        let count = 0;
        let deleted = 0;

        for (const docSnap of snapshot.docs) {
            batch.delete(doc(db, 'posters', docSnap.id));
            count++;
            deleted++;

            if (count >= BATCH_LIMIT) {
                await batch.commit();
                console.log(`  → ${count} 件削除完了`);
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`  → ${count} 件削除完了`);
        }

        console.log(`\n🎉 合計 ${deleted} 件のデータをすべて削除しました。`);
        process.exit(0);

    } catch (e) {
        console.error("❌ エラー:", e.message || e);
        process.exit(1);
    }
}

deleteAll();
