import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export function getAdminDb() {
  return admin.firestore();
}

export function getAdminAuth() {
  return admin.auth();
}
