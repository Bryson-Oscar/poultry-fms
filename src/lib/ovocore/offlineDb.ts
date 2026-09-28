// lib/offlineDb.ts

export interface OfflinePendingLog {
  id?: number;
  farmId: string;
  houseId: string;
  flockId: string;
  logPayload: any;
  createdAt: number;
  syncStatus: 'pending' | 'synced' | 'failed';
}

const DB_NAME = 'OvoCoreOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingLogs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB is only available in browser environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('farmId', 'farmId', { unique: false });
      }
    };
  });
}

export const offlineDb = {
  async addPendingLog(log: Omit<OfflinePendingLog, 'id'>): Promise<number> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(log);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  },

  async getPendingLogs(): Promise<OfflinePendingLog[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('syncStatus');
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result as OfflinePendingLog[]);
      request.onerror = () => reject(request.error);
    });
  },

  async deletePendingLog(id: number): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
