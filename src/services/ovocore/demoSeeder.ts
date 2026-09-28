import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, Timestamp, getFirestore } from 'firebase/firestore';
import type { Farm, House, Flock, BreedStandard, OvoCoreStaff } from './firebaseSchema';

export async function seedOvoCoreDemoData(db: ReturnType<typeof getFirestore>, userId: string) {
    const batch = writeBatch(db);

    // 1. Breed Standard (Demo Lohmann Brown)
    const breedStandardId = 'lohmann_brown_demo';
    const breedStandardRef = doc(db, 'breedStandards', breedStandardId);
    const performanceCurve: any = {};
    for (let w = 1; w <= 70; w++) {
        performanceCurve[w.toString()] = {
            henDayPercent: Math.min(95, 50 + (w * 2)), // simplified fake curve
            fcr: 1.8,
            cumulativeMortalityPercent: w * 0.1,
            bodyWeightG: 1500 + (w * 10),
            feedIntakeG: 115,
        };
    }
    batch.set(breedStandardRef, {
        name: 'Lohmann Brown (Demo)',
        peakProductionWeek: 25,
        performanceCurve
    });

    // 2. Demo Farm
    const farmId = 'demo_farm_01';
    const farmRef = doc(db, 'farms', farmId);
    const farmData: Farm = {
        name: 'Valley View Layers (Demo)',
        ownerName: 'Demo Owner',
        portfolioId: 'demo_portfolio',
        location: { lat: -1.2921, lng: 36.8219, address: 'Nairobi Region' },
        county: 'Nairobi',
        timezone: 'Africa/Nairobi',
        ownerContact: { name: 'Demo Owner', phone: '+254000000', email: 'demo@example.com' },
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
    batch.set(farmRef, farmData);

    // 3. Demo Staff
    const staffRef = doc(db, `farms/${farmId}/staff`, userId);
    const staffData: OvoCoreStaff = {
        name: 'Demo Admin',
        role: 'farmManager',
        contact: { phone: '', email: '' },
        dateJoined: Timestamp.now(),
        status: 'active'
    };
    batch.set(staffRef, staffData);

    // 4. Demo House
    const houseId = 'house_01';
    const houseRef = doc(db, `farms/${farmId}/houses`, houseId);
    const houseData: House = {
        houseName: 'Shed 1',
        capacityBirds: 5000,
        ventilationType: 'natural',
        dimensions: { lengthM: 100, widthM: 10, heightM: 3 },
        constructionType: 'open-sided',
        status: 'active',
        currentFlockId: 'flock_01',
        createdAt: Timestamp.now()
    };
    batch.set(houseRef, houseData);

    // 5. Demo Flock
    const flockId = 'flock_01';
    const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks`, flockId);
    const flockData: Flock = {
        flockCode: 'H1-2026',
        breed: 'Lohmann Brown',
        breedStandardId,
        category: 'commercial_layers',
        initialAgeWeeks: 18,
        dateHoused: Timestamp.now(),
        initialBirdCount: 5000,
        currentBirdCount: 4950,
        cumulativeMortality: 50,
        cumulativeEggs: 125000,
        cumulativeFeedKg: 15000,
        status: 'active',
        endDate: null,
        farmId,
        houseId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
    batch.set(flockRef, flockData);

    await batch.commit();
    return farmId;
}

export async function clearOvoCoreDemoData(db: ReturnType<typeof getFirestore>, userId: string) {
    const farmId = 'demo_farm_01';
    
    // Simplistic cleanup for demo - in production you'd use a recursive delete or Cloud Function
    const batch = writeBatch(db);
    
    batch.delete(doc(db, `farms/${farmId}/houses/house_01/flocks/flock_01`));
    batch.delete(doc(db, `farms/${farmId}/houses/house_01`));
    batch.delete(doc(db, `farms/${farmId}/staff/${userId}`));
    batch.delete(doc(db, `farms/${farmId}`));
    batch.delete(doc(db, 'breedStandards', 'lohmann_brown_demo'));

    await batch.commit();
}
