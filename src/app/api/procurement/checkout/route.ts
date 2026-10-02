// app/api/procurement/checkout/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

interface CheckoutRequest {
  farmId: string;
  siloId: string;
  millerId: string;
  feedType: string;
  quantityTons: number;
  totalAmountKES: number;
  farmerPhone: string;
}

export async function POST(req: Request) {
  try {
    const body: CheckoutRequest = await req.json();
    const { farmId, siloId, millerId, feedType, quantityTons, totalAmountKES, farmerPhone } = body;

    const db = getAdminDb();

    // 1. Calculate Platform Take-Rate (2%) and Miller Payout
    const takeRatePct = 0.02;
    const platformCommissionKES = Math.round(totalAmountKES * takeRatePct);
    const millerPayoutKES = totalAmountKES - platformCommissionKES;

    // 2. Create Escrow Order Document in Firestore
    const orderRef = db.collection(`farms/${farmId}/procurementOrders`).doc();
    const orderId = orderRef.id;

    const orderPayload = {
      orderId,
      farmId,
      siloId,
      millerId,
      feedType,
      quantityTons,
      totalAmountKES,
      platformCommissionKES,
      millerPayoutKES,
      status: 'ESCROW_PENDING', // PENDING -> PAID_ESCROW -> DISPATCHED -> DELIVERED
      farmerPhone,
      createdAt: FieldValue.serverTimestamp(),
      deliveryQrCodeToken: `OVO-DELIV-${orderId.substring(0, 8).toUpperCase()}`
    };

    await orderRef.set(orderPayload);

    // 3. Initiate M-Pesa STK Push / Escrow Holding Logic (Simulated Integration)
    // In production, invoke Safaricom Daraja API STK Push here:
    // const st RESPONSE = await initiateMpesaStkPush({ phone: farmerPhone, amount: totalAmountKES, accountRef: orderId });

    // 4. Update Silo State to mark reorder as processing
    await db.doc(`farms/${farmId}/silos/${siloId}`).update({
      reorderPending: true,
      activeOrderId: orderId,
      updatedAt: FieldValue.serverTimestamp()
    });

    // 5. Broadcast Order to Feed Miller Dashboard Collection
    await db.collection(`mills/${millerId}/incomingOrders`).doc(orderId).set({
      ...orderPayload,
      escrowSecured: true,
      notifiedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      orderId,
      checkoutStatus: 'STK_PUSH_SENT',
      message: `Escrow initialized. STK push sent to ${farmerPhone} for KSh ${totalAmountKES.toLocaleString()}.`
    });

  } catch (err: any) {
    console.error("Procurement Checkout Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
