import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface SiloTelemetryPayload {
  deviceSecret: string;
  farmId: string;
  siloId: string;
  currentMassKg: number;
  internalHumidityPct: number;
  internalTempC: number;
}

export async function POST(req: Request) {
  try {
    const payload: SiloTelemetryPayload = await req.json();
    const { deviceSecret, farmId, siloId, currentMassKg, internalHumidityPct, internalTempC } = payload;

    // 1. Authenticate Hardware Node
    const farmRef = doc(db, 'farms', farmId);
    const farmSnap = await getDoc(farmRef);
    if (!farmSnap.exists() || farmSnap.data().apiSecret !== deviceSecret) {
      return NextResponse.json({ error: 'Unauthorized hardware node' }, { status: 401 });
    }

    // 2. Fetch Silo & Historical Burn Rate Data
    const siloRef = doc(db, `farms/${farmId}/silos`, siloId);
    const siloSnap = await getDoc(siloRef);
    if (!siloSnap.exists()) {
      return NextResponse.json({ error: 'Silo target not found' }, { status: 404 });
    }

    const siloData = siloSnap.data();
    const previousMassKg = siloData.quantityRemainingKg || currentMassKg;
    const lastPingTime = siloData.lastPing?.toMillis() || Date.now();
    
    // Calculate consumption velocity (Kg consumed per hour)
    const hoursElapsed = Math.max(0.1, (Date.now() - lastPingTime) / (1000 * 60 * 60));
    const massDeltaKg = Math.max(0, previousMassKg - currentMassKg);
    const consumptionRateKgPerHour = massDeltaKg / hoursElapsed;
    
    // Estimate daily demand and runway days
    const dailyDemandKg = consumptionRateKgPerHour * 24;
    const daysOfFeedRunway = dailyDemandKg > 0 ? Number((currentMassKg / dailyDemandKg).toFixed(1)) : 99;

    // 3. Mold / Aflatoxin Risk Evaluation (Humidity > 75% & Temp > 28°C inside silo cone)
    const isMoldRisk = internalHumidityPct > 75.0 && internalTempC > 28.0;

    // 4. Commit Telemetry Record
    await addDoc(collection(db, `farms/${farmId}/silos/${siloId}/telemetryLogs`), {
      currentMassKg,
      internalHumidityPct,
      internalTempC,
      moldRiskDetected: isMoldRisk,
      computedDaysRunway: daysOfFeedRunway,
      recordedAt: Timestamp.now()
    });

    // 5. Update Silo State Document
    await updateDoc(siloRef, {
      quantityRemainingKg: currentMassKg,
      estimatedDaysRunway: daysOfFeedRunway,
      dailyBurnRateKg: Math.round(dailyDemandKg),
      moldRiskActive: isMoldRisk,
      lastPing: serverTimestamp()
    });

    // 6. Trigger Autonomous Reorder Warning if Runway <= 3 Days
    let reorderTriggered = false;
    if (daysOfFeedRunway <= 3 && !siloData.reorderPending) {
      reorderTriggered = true;
      await updateDoc(siloRef, { reorderPending: true });
      // Hook into WhatsApp Advisor Dispatcher for automated re-order link
    }

    return NextResponse.json({
      success: true,
      daysOfFeedRunway,
      dailyDemandKg: Math.round(dailyDemandKg),
      moldRiskDetected: isMoldRisk,
      reorderTriggered
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
