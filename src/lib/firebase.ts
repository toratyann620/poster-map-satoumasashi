import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, initializeAuth, indexedDBLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Capacitor } from "@capacitor/core";
// Analytics は Firebase Installations API / Dynamic Config API を必要とするため、
// GCP APIキー制限との競合を避けるため無効化しています。

// Your web app's Firebase configuration
export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDFVt8w4WjvR7U5xJRCA7-_2FY40hIlWdk",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "satoumasashi-poster-map.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "satoumasashi-poster-map",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "satoumasashi-poster-map.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "390119901860",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:390119901860:web:502bf54b08217df6a33431",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-58L0PSHYQK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Auth を初期化する。
 *
 * ネイティブ（Capacitor）では `getAuth()` を使ってはいけない。`getAuth()` は
 * ブラウザ用のpopup/redirectリゾルバを組み込むが、これは WebView のオリジンが
 * `capacitor://...` のようなカスタムスキームだと初期化に失敗し、
 * **onAuthStateChanged が一度も発火しない**（画面が認証チェックのスピナーのまま固まる）。
 * iOSシミュレータでの実測でこの事象を確認済み。
 *
 * 永続化に IndexedDB を明示指定した `initializeAuth()` を使うと、リゾルバを
 * 組み込まずに初期化できるため正常に動作する。本アプリの認証は
 * メール／パスワードのみで、popup/redirect は使わないため機能上の影響はない。
 */
export const makeAuth = (targetApp: FirebaseApp): Auth => {
    if (!Capacitor.isNativePlatform()) return getAuth(targetApp);
    try {
        return initializeAuth(targetApp, { persistence: indexedDBLocalPersistence });
    } catch {
        // 同じAppに対して既に初期化済みの場合
        return getAuth(targetApp);
    }
};

export const auth = makeAuth(app);

// Initialize Firestore with Long-Polling to bypass corporate firewalls/WebSocket blockers
let firestoreDb;
try {
    firestoreDb = initializeFirestore(app, {
        experimentalForceLongPolling: true
    });
} catch (e) {
    // Fallback if already initialized
    firestoreDb = getFirestore(app);
}
export const db = firestoreDb;
export const storage = getStorage(app);

// Analytics は無効化（Firebase Installations API / Dynamic Config API が GCP で制限されているため）
export const analytics = null;
