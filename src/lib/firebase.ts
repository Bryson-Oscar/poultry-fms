import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCyorf6PmvohEtYNs0a3IiBYvPOU6q4m74",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "poultry-fms.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "poultry-fms",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "poultry-fms.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "214482975515",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:214482975515:web:cc97a766604016978cf1be"
};

// Initialize Firebase App safely
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Log active connection parameters in browser console for verification
if (typeof window !== 'undefined') {
  console.log(`[OvoCore Firebase] Connected to Project: ${firebaseConfig.projectId} (${firebaseConfig.authDomain})`);
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export default app;
