import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

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
export const auth = getAuth(app);

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

// Initialize Analytics if needed (and available in browser context)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
