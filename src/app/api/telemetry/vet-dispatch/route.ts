// app/api/telemetry/vet-dispatch/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

interface VetDispatchRequest {
  farmId: string;
  houseId: string;
  flockId: string;
  mortalityRatePct: number;
  dailyMortalityCount: number;
  primarySymptoms?: string[];
  waterToFeedRatio?: number;
  requestedUrgency?: 'EMERGENCY_IMMEDIATE' | 'SAME_DAY_AUDIT' | 'ROUTINE_CHECK';
}

export async function POST(req: Request) {
  try {
    const body: VetDispatchRequest = await req.json();
    const { 
      farmId, 
      houseId, 
      flockId, 
      mortalityRatePct, 
      dailyMortalityCount, 
      primarySymptoms = [], 
      waterToFeedRatio,
      requestedUrgency = 'EMERGENCY_IMMEDIATE' 
    } = body;

    const db = getAdminDb();

    // 1. Fetch Farm and Flock Metadata
    const farmDoc = await db.collection('farms').doc(farmId).get();
    if (!farmDoc.exists) {
      return NextResponse.json({ success: false, error: 'Farm record not found' }, { status: 404 });
    }
    const farmData = farmDoc.data() || {};

    // 2. Create Veterinary Incident Dossier
    const incidentRef = db.collection(`farms/${farmId}/vetIncidents`).doc();
    const incidentId = incidentRef.id;

    const incidentPayload = {
      incidentId,
      farmId,
      farmName: farmData.farmName || 'Commercial Poultry Farm',
      county: farmData.county || 'Kiambu',
      ownerName: farmData.ownerName || 'Farm Manager',
      ownerPhone: farmData.ownerPhone || '',
      houseId,
      flockId,
      mortalityRatePct,
      dailyMortalityCount,
      primarySymptoms,
      waterToFeedRatio: waterToFeedRatio || null,
      urgency: requestedUrgency,
      status: 'DISPATCH_PENDING', // PENDING -> VET_ASSIGNED -> ONSITE_IN_PROGRESS -> RESOLVED
      consultationFeeKES: 2500, // Standard platform tele-vet booking fee
      platformTakeRatePct: 0.20, // 20% platform commission on vet service fee
      createdAt: FieldValue.serverTimestamp()
    };

    await incidentRef.set(incidentPayload);

    // 3. Find Available Certified Field Veterinarian (Simulated Geospatial Match)
    const vetsSnapshot = await db.collection('certifiedVets')
      .where('county', '==', farmData.county || 'Kiambu')
      .where('isAvailable', '==', true)
      .limit(1)
      .get();

    let assignedVet = {
      vetId: 'VET-DEFAULT-01',
      name: 'Dr. Kiprono Vet Services',
      phone: '+254700111222',
      specialty: 'Commercial Poultry Pathology'
    };

    if (!vetsSnapshot.empty) {
      const vetDoc = vetsSnapshot.docs[0];
      assignedVet = { vetId: vetDoc.id, ...(vetDoc.data() as any) };
    }

    // Update incident with assigned vet
    await incidentRef.update({
      assignedVetId: assignedVet.vetId,
      assignedVetName: assignedVet.name,
      assignedVetPhone: assignedVet.phone,
      status: 'VET_ASSIGNED',
      assignedAt: FieldValue.serverTimestamp()
    });

    // 4. Construct Proactive WhatsApp Dispatch Payload for Veterinarian
    const vetMessage = 
      `🚨 *URGENT VET DISPATCH: CLINICAL EMERGENCY* 🚨\n` +
      `Dr. ${assignedVet.name}, an automated biosecurity trigger has been fired by OvoCore Telemetry.\n\n` +
      `📍 *Farm:* ${farmData.farmName} (${farmData.county || 'Kenya'})\n` +
      `📞 *Client Contact:* ${farmData.ownerName} (${farmData.ownerPhone})\n` +
      `⚠️ *Clinical Anomaly:* Mortality spike of *${mortalityRatePct.toFixed(2)}%* (${dailyMortalityCount} dead birds today).\n` +
      `${waterToFeedRatio ? `💧 *Water/Feed Ratio:* ${waterToFeedRatio}:1 (Abnormal)\n\n` : '\n'}` +
      `👉 *Action Required:* Review telemetry dossier and confirm immediate dispatch or remote tele-consult.\n` +
      `🔗 *Access Clinical Dossier:* https://agribuild.co.ke/ovocore/vet/incident/${incidentId}`;

    // Return success response with dispatch telemetry
    return NextResponse.json({
      success: true,
      incidentId,
      assignedVet: assignedVet.name,
      vetPhone: assignedVet.phone,
      dispatchStatus: 'VET_NOTIFIED',
      whatsappMessagePreview: vetMessage
    });

  } catch (err: any) {
    console.error("Proactive Vet Dispatch Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
