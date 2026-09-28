import { doc, writeBatch, increment, serverTimestamp, getFirestore, Timestamp } from 'firebase/firestore';
import type { DailyLog } from './firebaseSchema';

export async function submitDailyLog(
  db: ReturnType<typeof getFirestore>,
  {
    farmId,
    houseId,
    flockId,
    feedBatchId,
    logData,
  }: {
    farmId: string;
    houseId: string;
    flockId: string;
    feedBatchId?: string;
    logData: Omit<DailyLog, 'loggedAt'>;
  }
) {
  const batch = writeBatch(db);
  const dailyLogRef = doc(
    db,
    `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs/${logData.date}`
  );
  const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);

  batch.set(dailyLogRef, { 
    ...logData, 
    loggedAt: serverTimestamp(),
    syncStatus: 'synced' // Assuming optimistic setting
  });

  const totalBirdsLost = (logData.mortalityCount || 0) + (logData.cullCount || 0);
  batch.update(flockRef, {
    currentBirdCount: increment(-totalBirdsLost),
    cumulativeMortality: increment(totalBirdsLost),
    cumulativeEggs: increment(logData.eggsCollected?.total || 0),
    cumulativeFeedKg: increment(logData.feedConsumedKg || 0),
    updatedAt: serverTimestamp(),
  });

  if (feedBatchId && logData.feedConsumedKg > 0) {
    const feedBatchRef = doc(db, `farms/${farmId}/feedBatches/${feedBatchId}`);
    batch.update(feedBatchRef, {
      quantityRemainingKg: increment(-logData.feedConsumedKg),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export function computeLogDelta(existingLog: Partial<DailyLog>, newLog: Partial<DailyLog>) {
  const oldLoss = (existingLog.mortalityCount || 0) + (existingLog.cullCount || 0);
  const newLoss = (newLog.mortalityCount || 0) + (newLog.cullCount || 0);
  
  return {
    birdCountDelta: -(newLoss - oldLoss),
    mortalityDelta: newLoss - oldLoss,
    eggsDelta: (newLog.eggsCollected?.total || 0) - (existingLog.eggsCollected?.total || 0),
    feedDelta: (newLog.feedConsumedKg || 0) - (existingLog.feedConsumedKg || 0),
  };
}

export async function submitDailyLogEdit(
    db: ReturnType<typeof getFirestore>,
    {
      farmId,
      houseId,
      flockId,
      feedBatchId,
      existingLog,
      newLog,
    }: {
      farmId: string;
      houseId: string;
      flockId: string;
      feedBatchId?: string;
      existingLog: DailyLog;
      newLog: DailyLog;
    }
  ) {
    const batch = writeBatch(db);
    const dailyLogRef = doc(
      db,
      `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs/${newLog.date}`
    );
    const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);
  
    batch.set(dailyLogRef, { 
      ...newLog, 
      loggedAt: serverTimestamp(),
      syncStatus: 'synced'
    }, { merge: true });
  
    const delta = computeLogDelta(existingLog, newLog);

    batch.update(flockRef, {
      currentBirdCount: increment(delta.birdCountDelta),
      cumulativeMortality: increment(delta.mortalityDelta),
      cumulativeEggs: increment(delta.eggsDelta),
      cumulativeFeedKg: increment(delta.feedDelta),
      updatedAt: serverTimestamp(),
    });
  
    if (feedBatchId && delta.feedDelta !== 0) {
      const feedBatchRef = doc(db, `farms/${farmId}/feedBatches/${feedBatchId}`);
      batch.update(feedBatchRef, {
        quantityRemainingKg: increment(-delta.feedDelta), // Subtracting the feed delta
        updatedAt: serverTimestamp(),
      });
    }
  
    await batch.commit();
}

export async function activateEmergencyProtocol(
  db: ReturnType<typeof getFirestore>,
  farmId: string,
  houseId: string,
  flockId: string
) {
  const batch = writeBatch(db);
  const houseRef = doc(db, `farms/${farmId}/houses/${houseId}`);
  const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);

  batch.update(houseRef, {
    status: 'quarantine_alert',
    updatedAt: serverTimestamp(),
  });

  batch.update(flockRef, {
    status: 'quarantine_alert',
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function resolveEmergencyProtocol(
  db: ReturnType<typeof getFirestore>,
  farmId: string,
  houseId: string,
  flockId: string
) {
  const batch = writeBatch(db);
  const houseRef = doc(db, `farms/${farmId}/houses/${houseId}`);
  const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);

  batch.update(houseRef, {
    status: 'active',
    updatedAt: serverTimestamp(),
  });

  batch.update(flockRef, {
    status: 'active',
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
