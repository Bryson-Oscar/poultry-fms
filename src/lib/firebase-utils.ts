import { Timestamp } from 'firebase/firestore';

/**
 * Standardizes timestamp display across the application.
 * Gracefully handles Firestore Timestamps, ISO strings, and null (serverTimestamp lag).
 */
export function formatFirestoreTimestamp(val: any, fallbackToNow: boolean = true): string {
    if (!val) {
        return fallbackToNow ? new Date().toISOString() : '';
    }

    // Handle Firestore Timestamp objects
    if (typeof val.toDate === 'function') {
        try {
            return val.toDate().toISOString();
        } catch (e) {
            return new Date().toISOString();
        }
    }

    // Handle string or number
    if (typeof val === 'string' || typeof val === 'number') {
        return new Date(val).toISOString();
    }

    return new Date().toISOString();
}

/**
 * Removes undefined values from an object recursively, as Firestore does not support undefined.
 */
export function sanitizeFirestoreData(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item));
  }

  const result: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = sanitizeFirestoreData(value);
    }
  });
  return result;
}
