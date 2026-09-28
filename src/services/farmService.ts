// services/farmService.ts
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';

export interface FarmPayload {
  name: string;
  location: string;
  county: string;
  flockType: 'layers' | 'broilers' | 'breeders' | 'dual_purpose';
  targetCapacity: number;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  createdByAdminId: string;
}

export interface FarmInviteRecord {
  code: string;
  farmId: string;
  farmName: string;
  ownerName: string;
  ownerPhone: string;
  role: 'owner' | 'manager' | 'supervisor';
  status: 'pending' | 'accepted' | 'expired';
  createdAt: any;
}

// Generate an 8-character unique alphanumeric invite code
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase() + 
         Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Creates a new farm and an associated WhatsApp invite token
 */
export async function createFarmWithInvite(payload: FarmPayload) {
  const farmRef = doc(collection(db, 'farms'));
  const farmId = farmRef.id;
  const inviteCode = generateInviteCode();

  const farmData = {
    id: farmId,
    name: payload.name,
    location: payload.location,
    county: payload.county,
    flockType: payload.flockType,
    targetCapacity: payload.targetCapacity,
    ownerName: payload.ownerName,
    ownerPhone: payload.ownerPhone,
    ownerEmail: payload.ownerEmail || null,
    createdByAdminId: payload.createdByAdminId,
    activeFlockCount: 0,
    status: 'pending_onboarding',
    createdAt: serverTimestamp(),
  };

  const inviteData: FarmInviteRecord = {
    code: inviteCode,
    farmId: farmId,
    farmName: payload.name,
    ownerName: payload.ownerName,
    ownerPhone: payload.ownerPhone,
    role: 'owner',
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  // Atomic creation of farm and invite token
  await setDoc(farmRef, farmData);
  await setDoc(doc(db, 'farm_invites', inviteCode), inviteData);

  return { farmId, inviteCode };
}

/**
 * Retrieve invite token details
 */
export async function getFarmInvite(inviteCode: string): Promise<FarmInviteRecord | null> {
  const inviteSnap = await getDoc(doc(db, 'farm_invites', inviteCode.toUpperCase()));
  if (!inviteSnap.exists()) return null;
  return inviteSnap.data() as FarmInviteRecord;
}

/**
 * Claim the farm invite when the user signs up
 */
export async function claimFarmInvite(inviteCode: string, userId: string, userEmail: string) {
  const inviteRef = doc(db, 'farm_invites', inviteCode.toUpperCase());
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error('Invalid or non-existent invite code.');
  }

  const inviteData = inviteSnap.data() as FarmInviteRecord;
  if (inviteData.status === 'accepted') {
    return inviteData.farmId; // Already claimed, route through
  }

  // 1. Assign farm to user profile
  await updateDoc(doc(db, 'users', userId), {
    assignedFarmId: inviteData.farmId,
    farmRole: inviteData.role,
    phone: inviteData.ownerPhone,
    updatedAt: serverTimestamp()
  });

  // 2. Assign to farm based on role
  if (inviteData.role === 'owner') {
    // Add user as the primary farm owner and activate farm
    await updateDoc(doc(db, 'farms', inviteData.farmId), {
      ownerUserId: userId,
      ownerEmail: userEmail,
      status: 'active',
      updatedAt: serverTimestamp()
    });
  } else {
    // Add user as an operator in the staff subcollection
    const staffRef = doc(db, `farms/${inviteData.farmId}/staff`, userId);
    await setDoc(staffRef, {
      name: inviteData.ownerName, // Using the name provided during invite
      role: inviteData.role,
      contact: { phone: inviteData.ownerPhone, email: userEmail },
      dateJoined: serverTimestamp(),
      status: 'active'
    });
  }

  // 3. Mark invite code as accepted
  await updateDoc(inviteRef, {
    status: 'accepted',
    claimedByUserId: userId,
    claimedAt: serverTimestamp()
  });

  return inviteData.farmId;
}

export async function generateTeamInvites(
  farmId: string,
  farmName: string,
  invites: Array<{ name: string; phone: string; role: 'owner' | 'manager' | 'supervisor' }>
) {
  const batch = writeBatch(db);
  const generatedLinks: Array<{ name: string; role: string; url: string; phone: string; code: string }> = [];

  for (const inv of invites) {
    const inviteCode = generateInviteCode();
    const inviteRef = doc(db, 'farm_invites', inviteCode);
    const inviteData: FarmInviteRecord = {
      code: inviteCode,
      farmId,
      farmName,
      ownerName: inv.name,
      ownerPhone: inv.phone,
      role: inv.role,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    batch.set(inviteRef, inviteData);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agribuild.co.ke';
    generatedLinks.push({
      name: inv.name,
      role: inv.role,
      phone: inv.phone,
      url: `${origin}/invite/farm?code=${inviteCode}`,
      code: inviteCode,
    });
  }

  // Advance farm status so the onboarding modal stops auto-popping
  batch.update(doc(db, 'farms', farmId), {
    status: 'onboarding_in_progress',
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  return generatedLinks;
}

export async function getFarmTeamStatus(farmId: string) {
  const farmSnap = await getDoc(doc(db, 'farms', farmId));
  if (!farmSnap.exists()) {
    throw new Error('Farm not found');
  }
  const farmData = farmSnap.data();

  let hasOwner = !!farmData.ownerUserId;
  let ownerName = farmData.ownerName || null;

  const qInvites = query(collection(db, 'farm_invites'), where('farmId', '==', farmId));
  const snapInvites = await getDocs(qInvites);

  let pendingOwnerInvite = false;
  let ownerInviteCode = null;
  let operators: any[] = [];

  snapInvites.forEach((docSnap) => {
    const data = docSnap.data() as FarmInviteRecord;
    if (data.role === 'owner') {
       if (data.status === 'pending') {
         pendingOwnerInvite = true;
         ownerInviteCode = data.code;
         if (!ownerName) ownerName = data.ownerName;
       }
    } else if (data.status === 'pending') {
       operators.push({
         name: data.ownerName || 'Pending Invite',
         phone: data.ownerPhone || data.code,
         role: data.role,
         status: 'pending',
         inviteCode: data.code
       });
    }
  });

  const qStaff = query(collection(db, `farms/${farmId}/staff`));
  const snapStaff = await getDocs(qStaff);
  snapStaff.forEach((docSnap) => {
    const data = docSnap.data();
    operators.push({
      id: docSnap.id,
      name: data.name,
      phone: data.contact?.phone || data.contact?.email || 'Registered',
      role: data.role,
      status: data.status || 'active'
    });
  });

  return {
    hasOwner,
    pendingOwnerInvite,
    ownerName,
    ownerInviteCode,
    farmName: farmData.name,
    operators
  };
}
