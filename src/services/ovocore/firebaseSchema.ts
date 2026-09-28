import { Timestamp } from 'firebase/firestore';

export type BirdCategory = 'commercial_layers' | 'broilers' | 'dual_purpose_kienyeji' | 'breeders_parent_stock' | 'improved_kienyeji';

export type EnterpriseCategory = 'commercial_layers' | 'broilers' | 'improved_kienyeji';
export type KienyejiBreed = 'KALRO_Kienyeji' | 'Kuroiler' | 'Kenbro' | 'Sasso' | 'Rainbow_Rooster';

export interface KienyejiFlockProfile extends Flock {
  category: 'improved_kienyeji';
  kienyejiBreed: KienyejiBreed;
  productionFocus: 'dual_purpose' | 'meat_specialized' | 'fertilized_hatching_eggs';
  housingModel: 'semi_scavenging_run' | 'deep_litter_confinement' | 'slatted_floor';
  
  // Scavenging & Supplementary Feed Tracking
  pastureRunAreaSqM?: number;
  supplementaryFeedRatioPct: number; // e.g., 70% commercial mash, 30% greens/grain scratch
  
  // Dual-Stream Aggregates
  cumulativeFertilizedEggs: number;
  cumulativeTableEggs: number;
  cumulativeLiveCockerelsSold: number;
  cumulativeLiveHensSold: number;
}

export interface KienyejiDailyLog extends DailyLog {
  // Split Egg Streams
  eggsCollected?: {
    total: number;
    gradeA: number;
    gradeB: number;
    gradeC: number;
    cracked: number;
    dirty: number;
    fertilizedHatching?: number; // Premium incubation stock
  };
  
  // Foraging & Dietary Telemetry
  supplementaryGreensKg?: number;
  kitchenScratchGrainKg?: number;
  pastureGrazingHours?: number;
  
  // Health & Phenotype Audits
  combColorCondition?: 'bright_red_healthy' | 'pale_anemic' | 'cyanotic_blue';
  ectoparasiteCheckPassed?: boolean; // Fleas (chiggers), mites, lice
}

export interface Farm {
    ownerName?: string;
    id?: string;
    name: string;
    portfolioId: string;
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    county: string;
    timezone: string;
    ownerContact: {
        name: string;
        phone: string;
        email: string;
    };
    status: 'active' | 'inactive' | 'pending_onboarding' | 'onboarding_in_progress';
    targetCapacity?: number;
    flockType?: string;
    lastActiveAt?: Timestamp;
    registeredUsersCount?: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface House {
    id?: string;
    houseName: string;
    capacityBirds: number;
    ventilationType: 'natural' | 'tunnel' | 'mixed';
    dimensions: {
        lengthM: number;
        widthM: number;
        heightM: number;
    };
    constructionType: string;
    status: 'active' | 'empty' | 'maintenance' | 'quarantine_alert';
    currentFlockId: string | null;
    createdAt: Timestamp;
}

export interface Flock {
    initialAgeWeeks: number;
    category: BirdCategory;
    id?: string;
    flockCode: string;
    breed: string;
    breedStandardId: string;
    dateHoused: Timestamp;
    initialBirdCount: number;
    currentBirdCount: number;
    cumulativeMortality: number;
    cumulativeEggs: number;
    cumulativeFeedKg: number;
    status: 'active' | 'culled' | 'sold' | 'quarantine_alert';
    endDate: Timestamp | null;
    farmId: string;
    houseId: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    // Broiler Specific Properties
    hatchery?: string;
    targetHarvestAgeDays?: number;
    targetHarvestWeightG?: number;
    broodingTempTargetC?: number;
    withdrawalWindowActive?: boolean;
    withdrawalEndDate?: Timestamp | null;
    broilerStage?: 'brooding' | 'growing' | 'finishing' | 'depleted';
}

export interface DailyLog {
    id?: string; // e.g. '2026-08-17'
    date: string; // ISO date string
    mortalityCount: number;
    cullCount: number;
    feedConsumedKg: number;
    waterConsumedLiters: number | null;
    eggsCollected?: {
        total: number;
        gradeA: number;
        gradeB: number;
        gradeC: number;
        cracked: number;
        dirty: number;
    };
    avgBodyWeightG: number | null;
    temperatureC: number | null;
    humidityPercent: number | null;
    notes: string | null;
    loggedBy: string;
    recordedByName?: string;
    loggedAt: Timestamp;
    syncStatus: 'synced' | 'pendingSync';
    // Broiler Specific Sampling Properties
    dayOfCycle?: number;
    feedRation?: 'starter' | 'grower' | 'finisher' | 'withdrawal';
    waterToFeedRatio?: number;
    sampleWeights?: number[];
    dailyWeightGainG?: number;
    ambientTempMinC?: number | null;
    ambientTempMaxC?: number | null;
    staticPressurePa?: number | null;
    computedFCR?: number | string;
    computedEPEF?: number;
}

export interface BroilerSale {
    id?: string;
    flockId: string;
    houseId: string;
    buyerName: string;
    buyerPhone?: string | null;
    buyerType?: 'live_bird' | 'dressed_carcass' | 'abattoir_contract';
    birdsLoaded: number;
    totalLiveWeightKg: number;
    avgBirdWeightKg: number;
    pricePerKg: number;
    pricePerBird?: number;
    totalAmount: number;
    amountPaid?: number;
    balanceDue?: number;
    paymentMethod?: 'mpesa' | 'bank_transfer' | 'cash' | 'credit';
    paymentStatus: 'paid' | 'partial' | 'credit';
    doaCount: number;
    carcassYieldPercent?: number | null;
    date: Timestamp;
    createdAt: Timestamp;
}

export interface WeeklySummary {
    id?: string; // weekNumber as string
    weekNumber: number;
    avgHenDayPercent: number;
    totalEggs: number;
    totalMortality: number;
    totalFeedKg: number;
    avgBodyWeightG: number | null;
    fcrForWeek: number;
    varianceVsBreedStandard: number;
    computedAt: Timestamp;
}

export interface HealthEvent {
    id?: string;
    date: Timestamp;
    type: 'vaccination' | 'treatment' | 'diagnosis' | 'investigation';
    product: string;
    dosage: string | null;
    route: string | null;
    administeredBy: string;
    cost: number | null;
    notes: string | null;
    createdAt: Timestamp;
}

export interface FeedBatch {
    id?: string;
    feedType: string;
    supplierId: string;
    quantityReceivedKg: number;
    quantityRemainingKg: number;
    costPerKg: number;
    batchNumber: string | null;
    dateReceived: Timestamp;
    expiryDate?: Timestamp | null;
    updatedAt: Timestamp;
}

export interface OpexEntry {
    id?: string;
    category: 'labour' | 'utilities' | 'medication' | 'maintenance' | 'feed' | 'other';
    amount: number;
    currency: string;
    date: Timestamp;
    description: string;
    relatedFlockId: string | null;
    recordedBy: string;
}

export interface EggSale {
    id?: string;
    date: Timestamp;
    customerId: string;
    customerName?: string;
    customerPhone?: string | null;
    gradeBreakdown: {
        gradeA_trays?: number;
        gradeB_trays?: number;
        gradeC_trays?: number;
        totalEggs?: number;
        [key: string]: any;
    };
    pricePerTray?: {
        gradeA: number;
        gradeB: number;
        gradeC: number;
    };
    totalAmount: number;
    amountPaid?: number;
    balanceDue?: number;
    paymentStatus: 'paid' | 'pending' | 'partial' | 'credit';
    relatedFlockId: string | null;
    relatedHouseName?: string;
    recordedBy: string;
}

export interface ComplianceEvent {
    id?: string;
    date: Timestamp;
    eventType: 'inspection' | 'vaccination' | 'audit' | 'cleaning';
    status: 'completed' | 'missed' | 'pending';
    description: string;
    assignedTo: string;
    completedBy: string | null;
    relatedFlockId: string | null;
    farmId: string;
}

export interface OvoCoreStaff {
    id?: string;
    name: string;
    role: 'farmManager' | 'flockSupervisor' | 'worker' | 'vet' | 'accountant';
    contact: {
        phone: string;
        email: string;
    };
    dateJoined: Timestamp;
    status: 'active' | 'inactive';
}

export interface BreedStandard {
    id?: string;
    name: string;
    // Map of week of lay (1-100) to expected metrics
    performanceCurve: {
        [week: string]: {
            henDayPercent: number;
            fcr: number;
            cumulativeMortalityPercent: number;
            bodyWeightG: number;
            feedIntakeG: number;
        }
    };
    peakProductionWeek: number;
}
