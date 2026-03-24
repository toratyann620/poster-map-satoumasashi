// download_backup.mjs
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import Papa from "papaparse";

// Firebaseの接続情報（アプリ側と同じもの）
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

async function downloadBackup() {
    console.log("🚀 Firebase API経由でデータを直接ダウンロードしています...");

    // ==========================================
    // ① ログイン用のメールアドレスとパスワードを設定
    // 例: test@test.com / testtest
    // ==========================================
    const EMAIL = "test@test.com";   // ← ご自身のログインアドレスに書き換えてください
    const PASSWORD = "testtest";     // ← ご自身のログインパスワードに書き換えてください

    try {
        console.log("認証中です...");
        await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);

        console.log("データベースから情報を取得中...");
        const snapshot = await getDocs(collection(db, 'posters'));
        const posters = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            posters.push({
                id: doc.id,
                ...data,
                // type が配列の場合はセミコロン区切りで文字列化
                type: Array.isArray(data.type) ? data.type.join(';') : data.type,
                status: data.status || '設置済',
            });
        });

        if (posters.length === 0) {
            console.log("⚠️ データベースが空のため、ダウンロードを終了します。");
            process.exit(0);
        }

        console.log(`✅ ${posters.length}件のデータを取得しました。CSVファイルを作成します...`);

        // CSV文字列への変換
        const csv = Papa.unparse(posters);

        // ファイル名に現在時刻をつける
        const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
        const filename = `backup_database_${timestamp}.csv`;

        // Excelで文字化けしないようにBOM (Byte Order Mark) をつけて保存
        fs.writeFileSync(filename, Buffer.concat([
            Buffer.from([0xEF, 0xBB, 0xBF]),
            Buffer.from(csv)
        ]));

        console.log(`🎉 バックアップが完了しました！`);
        console.log(`📁 保存先: ${process.cwd()}\\${filename}`);
        process.exit(0);

    } catch (e) {
        if (e.code === 'permission-denied') {
            console.error("❌ セキュリティエラー: Firestoreのデータベース読取権限によってブロックされました。");
        } else if (e.code === 'auth/invalid-credential') {
            console.error("❌ 認証エラー: メールアドレスまたはパスワードが間違っています。");
        } else {
            console.error("❌ 予期せぬエラーが発生しました:", e.message || e);
        }
        process.exit(1);
    }
}

downloadBackup();
