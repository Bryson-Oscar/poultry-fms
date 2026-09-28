import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;

if (!getApps().length) {
  try {
    const privateKey = process.env.ADMIN_FIREBASE_PRIVATE_KEY
      ? process.env.ADMIN_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (process.env.ADMIN_FIREBASE_CLIENT_EMAIL && privateKey) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'poultry-fms',
          clientEmail: process.env.ADMIN_FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log('[OvoCore Firebase Admin] Initialized with Service Account.');
    } else {
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'poultry-fms',
      });
    }
  } catch (error) {
    console.warn('[OvoCore Firebase Admin] Initialization skipped:', error);
  }
} else {
  adminApp = getApp();
}

export const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null;
export const adminDb: Firestore | null = adminApp ? getFirestore(adminApp) : null;
export default adminApp;
