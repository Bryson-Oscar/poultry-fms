// services/syncService.ts
import { offlineDb } from '@/lib/ovocore/offlineDb';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export async function dispatchDailyLog(farmId: string, houseId: string, flockId: string, payload: any) {
  // Check online status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await offlineDb.addPendingLog({
      farmId,
      houseId,
      flockId,
      logPayload: payload,
      createdAt: Date.now(),
      syncStatus: 'pending'
    });
    return { status: 'queued_offline' };
  }

  // Submit directly if online
  try {
    const targetCol = collection(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs`);
    await addDoc(targetCol, {
      ...payload,
      recordedAt: Timestamp.now(),
      syncStatus: 'synced'
    });
    return { status: 'synced' };
  } catch (err) {
    // If online write fails due to dropped signal, queue to IndexedDB
    await offlineDb.addPendingLog({
      farmId,
      houseId,
      flockId,
      logPayload: payload,
      createdAt: Date.now(),
      syncStatus: 'pending'
    });
    return { status: 'queued_offline' };
  }
}

export async function processOfflineQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    const pending = await offlineDb.getPendingLogs();
    for (const item of pending) {
      try {
        const targetCol = collection(db, `farms/${item.farmId}/houses/${item.houseId}/flocks/${item.flockId}/dailyLogs`);
        await addDoc(targetCol, {
          ...item.logPayload,
          recordedAt: Timestamp.fromDate(new Date(item.createdAt)),
          syncStatus: 'synced_from_offline'
        });
        if (item.id !== undefined) {
          await offlineDb.deletePendingLog(item.id);
        }
      } catch (e) {
        console.warn("Could not sync offline item:", item.id, e);
      }
    }
  } catch (err) {
    console.warn("Error reading offline queue:", err);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOfflineQueue();
  });
}
