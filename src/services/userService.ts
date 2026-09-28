import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

export interface UserProfileData {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber?: string | null;
  companyName?: string | null;
  role?: 'farmer' | 'owner' | 'manager' | 'supervisor' | 'admin' | 'super_admin';
  assignedFarmId?: string | null;
  flockFocus?: string | null;
  onboarded?: boolean;
  plan?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Automatically creates or syncs the user document in the `users` collection upon sign-up or login.
 */
export async function ensureUserDocument(
  user: User,
  customFields?: Partial<UserProfileData>
): Promise<UserProfileData> {
  if (!user || !user.uid) {
    throw new Error('Valid authenticated user required');
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const defaultProfile: UserProfileData = {
      uid: user.uid,
      email: user.email,
      displayName: customFields?.displayName || user.displayName || 'Poultry Farmer',
      phoneNumber: customFields?.phoneNumber || user.phoneNumber || null,
      companyName: customFields?.companyName || null,
      role: customFields?.role || 'farmer',
      assignedFarmId: customFields?.assignedFarmId || null,
      flockFocus: customFields?.flockFocus || 'layers',
      onboarded: customFields?.onboarded !== undefined ? customFields.onboarded : true,
      plan: customFields?.plan || 'trial',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(userRef, defaultProfile);
    console.log(`[OvoCore Auth] Created new user document in 'users' collection for UID: ${user.uid}`);
    return defaultProfile;
  } else {
    // Existing user document: sync any missing profile information
    const existingData = userSnap.data() as UserProfileData;
    const updates: Partial<UserProfileData> = {
      updatedAt: serverTimestamp()
    };

    if (!existingData.email && user.email) updates.email = user.email;
    if (!existingData.displayName && (customFields?.displayName || user.displayName)) {
      updates.displayName = customFields?.displayName || user.displayName;
    }
    if (customFields?.assignedFarmId && !existingData.assignedFarmId) {
      updates.assignedFarmId = customFields.assignedFarmId;
    }

    await updateDoc(userRef, updates);
    return { ...existingData, ...updates };
  }
}

export async function updateUserOnboardingStatus(userId: string, onboarded: boolean = true) {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    onboarded,
    updatedAt: serverTimestamp(),
  });
}

export interface FarmAccessResult {
  hasAccess: boolean;
  isAdmin: boolean;
  assignedFarmId: string | null;
  reason?: string;
  farmData?: any;
}

/**
 * Checks whether a user has permission to access a specific farm.
 * - Admin users have overall visibility to ALL farms.
 * - Non-admin users are strictly isolated to their own specific farm(s).
 */
export async function checkUserFarmAccess(
  user: User | null,
  targetFarmId: string
): Promise<FarmAccessResult> {
  if (!user) {
    return {
      hasAccess: false,
      isAdmin: false,
      assignedFarmId: null,
      reason: 'User is not logged in.'
    };
  }

  // 1. Fetch User Document
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? (userSnap.data() as UserProfileData) : null;

  // 2. Determine Admin Privilege (via ID token claim or Firestore role)
  let isAdmin = false;
  try {
    const idToken = await user.getIdTokenResult();
    if (idToken.claims.role === 'admin' || idToken.claims.role === 'super_admin') {
      isAdmin = true;
    }
  } catch (e) {
    // Fallback to Firestore role
  }

  if (userData?.role === 'admin' || userData?.role === 'super_admin') {
    isAdmin = true;
  }

  // Admin has overall visibility to all farms
  if (isAdmin) {
    const farmSnap = await getDoc(doc(db, 'farms', targetFarmId));
    return {
      hasAccess: true,
      isAdmin: true,
      assignedFarmId: userData?.assignedFarmId || targetFarmId,
      farmData: farmSnap.exists() ? farmSnap.data() : null
    };
  }

  // 3. Non-Admin Isolation Checks: Check if targetFarmId belongs to user
  const farmSnap = await getDoc(doc(db, 'farms', targetFarmId));
  if (!farmSnap.exists()) {
    return {
      hasAccess: false,
      isAdmin: false,
      assignedFarmId: userData?.assignedFarmId || null,
      reason: 'Farm document does not exist.'
    };
  }

  const farmData = farmSnap.data();

  // Check ownership / assignment criteria
  const isAssigned = userData?.assignedFarmId === targetFarmId;
  const isOwner = farmData.ownerUserId === user.uid;
  const isOwnerEmail = farmData.ownerContact?.email === user.email || farmData.ownerEmail === user.email;
  const isCreator = farmData.createdByAdminId === user.uid;

  if (isAssigned || isOwner || isOwnerEmail || isCreator) {
    return {
      hasAccess: true,
      isAdmin: false,
      assignedFarmId: userData?.assignedFarmId || targetFarmId,
      farmData
    };
  }

  // Check if user is registered in farm staff subcollection
  try {
    const staffSnap = await getDoc(doc(db, `farms/${targetFarmId}/staff`, user.uid));
    if (staffSnap.exists()) {
      return {
        hasAccess: true,
        isAdmin: false,
        assignedFarmId: userData?.assignedFarmId || targetFarmId,
        farmData
      };
    }
  } catch (e) {
    // Ignore staff query error
  }

  // Access denied for non-admin on unassigned farm
  return {
    hasAccess: false,
    isAdmin: false,
    assignedFarmId: userData?.assignedFarmId || null,
    reason: 'Non-admin user does not have permission for this isolated farm.',
    farmData
  };
}
