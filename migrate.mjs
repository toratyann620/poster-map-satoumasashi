// migrate.mjs
// 既存Firestoreデータを新スキーマに一括移行するワンタイムスクリプト
//
// 実行方法: node migrate.mjs
//
// 処理内容:
//   1. `type` フィールドを文字列から配列に変換 (sato→['佐藤まさし'], goto→['ごとう祐一'])
//   2. `status` フィールドを新規追加 (デフォルト '設置済')
//   3. 不要な `tags` フィールドを削除

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, writeBatch, doc, deleteField } from "firebase/firestore";

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

const LEGACY_MAP = { sato: '佐藤まさし', goto: 'ごとう祐一' };

async function migrate() {
    // ==========================================
    // ↓ ご自身のログイン情報に書き換えてください
    // ==========================================
    const EMAIL = "test@test.com";
    const PASSWORD = "testtest";

    console.log("🚀 マイグレーション開始...");

    try {
        await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
        console.log("✅ 認証成功");

        const snapshot = await getDocs(collection(db, 'posters'));
        console.log(`📦 ${snapshot.size} 件のドキュメントを取得しました`);

        let needsMigration = 0;
        let alreadyMigrated = 0;

        // Firestoreのバッチ書き込みは500件が上限なので分割する
        const BATCH_LIMIT = 400;
        let batch = writeBatch(db);
        let batchCount = 0;
        let totalUpdated = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // すでに配列になっている場合はスキップ
            if (Array.isArray(data.type) && data.status !== undefined) {
                alreadyMigrated++;
                continue;
            }

            needsMigration++;

            // type を配列に変換
            let newType;
            if (Array.isArray(data.type)) {
                newType = data.type;
            } else if (typeof data.type === 'string') {
                newType = [LEGACY_MAP[data.type] || data.type || '佐藤まさし'];
            } else {
                newType = ['佐藤まさし'];
            }

            const updateData = {
                type: newType,
            };

            // status が未設定なら追加
            if (!data.status) {
                updateData.status = '設置済';
            }

            // tags フィールドが存在すれば削除
            if ('tags' in data) {
                updateData.tags = deleteField();
            }

            const ref = doc(db, 'posters', docSnap.id);
            batch.update(ref, updateData);
            batchCount++;
            totalUpdated++;

            // バッチ上限に達したらコミット
            if (batchCount >= BATCH_LIMIT) {
                await batch.commit();
                console.log(`  → ${batchCount} 件バッチコミット完了`);
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        // 残りをコミット
        if (batchCount > 0) {
            await batch.commit();
            console.log(`  → ${batchCount} 件バッチコミット完了`);
        }

        console.log(`\n🎉 マイグレーション完了！`);
        console.log(`   更新: ${totalUpdated} 件 / スキップ（既移行）: ${alreadyMigrated} 件`);
        process.exit(0);

    } catch (e) {
        console.error("❌ エラー:", e.message || e);
        process.exit(1);
    }
}

migrate();
