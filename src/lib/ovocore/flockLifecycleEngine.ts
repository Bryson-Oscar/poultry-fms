// lib/flockLifecycleEngine.ts

export type BirdCategory = 'commercial_layers' | 'broilers' | 'dual_purpose_kienyeji' | 'breeders_parent_stock';

export interface LifecyclePhase {
  stageName: string;
  minWeek: number;
  maxWeek: number;
  operationalStatus: string;
  feedType: string;
  targetIntakeGramsPerBirdDay: number;
  waterIntakeMlPerBirdDay: number;
  lightHours: number;
  targetTempCelsius: string;
  biosecurityCheck: string;
  isLayingPhase: boolean;
}

export interface BirdSpec {
  category: BirdCategory;
  defaultBreeds: string[];
  totalCycleWeeks: number; // Standard culled/harvest age from day 0
  phases: LifecyclePhase[];
}

export const POULTRY_STRAIN_STANDARDS: Record<BirdCategory, BirdSpec> = {
  commercial_layers: {
    category: 'commercial_layers',
    defaultBreeds: ['Lohmann Brown', 'ISA Brown', 'Hy-Line Brown', 'Bovans Brown'],
    totalCycleWeeks: 80, // Standard lifetime: 0 to ~80 weeks (or 90 for extended lay)
    phases: [
      {
        stageName: 'Brooding & Starter',
        minWeek: 0,
        maxWeek: 4,
        operationalStatus: 'Intensive Brooding & Thermoregulation',
        feedType: 'Chick Starter Mash / Crumbs (CP 20%)',
        targetIntakeGramsPerBirdDay: 25,
        waterIntakeMlPerBirdDay: 50,
        lightHours: 20,
        targetTempCelsius: '32°C - 35°C (reducing 3°C weekly)',
        biosecurityCheck: 'Gumboro & Newcastle 1st/2nd dose protocol',
        isLayingPhase: false
      },
      {
        stageName: 'Pullet Rearing & Skeletal Dev',
        minWeek: 5,
        maxWeek: 15,
        operationalStatus: 'Frame & Skeletal Development',
        feedType: 'Grower Mash (CP 16%)',
        targetIntakeGramsPerBirdDay: 65,
        waterIntakeMlPerBirdDay: 130,
        lightHours: 12,
        targetTempCelsius: '20°C - 22°C (ambient natural)',
        biosecurityCheck: 'Fowl Typhoid, Deworming & Coryza inoculation',
        isLayingPhase: false
      },
      {
        stageName: 'Pre-Lay & Calcium Loading',
        minWeek: 16,
        maxWeek: 18,
        operationalStatus: 'Point of Lay (Medullary Bone Mineralization)',
        feedType: 'Pre-Lay Mash (CP 17.5%, Ca 2.5%)',
        targetIntakeGramsPerBirdDay: 90,
        waterIntakeMlPerBirdDay: 180,
        lightHours: 14,
        targetTempCelsius: '20°C - 22°C',
        biosecurityCheck: 'Transfer to production battery cages / laying nest boxes',
        isLayingPhase: false
      },
      {
        stageName: 'Peak Production',
        minWeek: 19,
        maxWeek: 45,
        operationalStatus: 'Peak Egg Laying (>90% Production)',
        feedType: 'Layers Complete Mash Phase 1 (CP 17.5%, Ca 3.8%)',
        targetIntakeGramsPerBirdDay: 118,
        waterIntakeMlPerBirdDay: 240,
        lightHours: 16,
        targetTempCelsius: '18°C - 24°C (Tunnel/curtain airflow mandatory)',
        biosecurityCheck: 'Weekly egg quality, shell thickness & FCR logging',
        isLayingPhase: true
      },
      {
        stageName: 'Extended Lay & Shell Maintenance',
        minWeek: 46,
        maxWeek: 80,
        operationalStatus: 'Sustained Lay (Post-Peak Shell Optimization)',
        feedType: 'Layers Complete Mash Phase 2 (CP 16%, Ca 4.2%)',
        targetIntakeGramsPerBirdDay: 122,
        waterIntakeMlPerBirdDay: 250,
        lightHours: 16,
        targetTempCelsius: '18°C - 24°C',
        biosecurityCheck: 'Coarse limestone grit top-dressing; terminal culling audit',
        isLayingPhase: true
      }
    ]
  },
  broilers: {
    category: 'broilers',
    defaultBreeds: ['Cobb 500', 'Ross 308', 'Hubbard'],
    totalCycleWeeks: 6, // 38 - 42 days harvest
    phases: [
      {
        stageName: 'Brooding Starter',
        minWeek: 0,
        maxWeek: 2,
        operationalStatus: 'Accelerated Skeletal Growth',
        feedType: 'Broiler Starter Crumbs (CP 22%)',
        targetIntakeGramsPerBirdDay: 40,
        waterIntakeMlPerBirdDay: 85,
        lightHours: 23,
        targetTempCelsius: '33°C down to 28°C',
        biosecurityCheck: 'Strict thermal bedding checks & Newcastle C2',
        isLayingPhase: false
      },
      {
        stageName: 'Grower Stage',
        minWeek: 3,
        maxWeek: 4,
        operationalStatus: 'Muscle & Flesh Accretion',
        feedType: 'Broiler Grower Pellets (CP 20%)',
        targetIntakeGramsPerBirdDay: 110,
        waterIntakeMlPerBirdDay: 220,
        lightHours: 20,
        targetTempCelsius: '24°C - 26°C',
        biosecurityCheck: 'Ventilation rate adjustment to purge ammonia',
        isLayingPhase: false
      },
      {
        stageName: 'Finisher & Depletion',
        minWeek: 5,
        maxWeek: 6,
        operationalStatus: 'Target Market Weight (1.8kg - 2.2kg)',
        feedType: 'Broiler Finisher Pellets (CP 18%)',
        targetIntakeGramsPerBirdDay: 165,
        waterIntakeMlPerBirdDay: 330,
        lightHours: 20,
        targetTempCelsius: '20°C - 22°C',
        biosecurityCheck: 'Drug withdrawal window prior to processing/slaughter',
        isLayingPhase: false
      }
    ]
  },
  dual_purpose_kienyeji: {
    category: 'dual_purpose_kienyeji',
    defaultBreeds: ['KARI Improved Kienyeji', 'Kuroiler', 'Kenbro', 'Rainbow Rooster'],
    totalCycleWeeks: 72,
    phases: [
      {
        stageName: 'Brooding & Hardening',
        minWeek: 0,
        maxWeek: 4,
        operationalStatus: 'Hardening & Early Feathering',
        feedType: 'Chick Starter (CP 19%)',
        targetIntakeGramsPerBirdDay: 30,
        waterIntakeMlPerBirdDay: 60,
        lightHours: 18,
        targetTempCelsius: '32°C stepping to 25°C',
        biosecurityCheck: 'Mareks & Newcastle Lasota immunization',
        isLayingPhase: false
      },
      {
        stageName: 'Semi-Free Range Rearing',
        minWeek: 5,
        maxWeek: 19,
        operationalStatus: 'Free-Range Foraging / Grower Development',
        feedType: 'Kienyeji Grower Mash / Whole Grains (CP 15%)',
        targetIntakeGramsPerBirdDay: 75,
        waterIntakeMlPerBirdDay: 150,
        lightHours: 12,
        targetTempCelsius: 'Ambient',
        biosecurityCheck: 'Regular routine internal and external parasite control',
        isLayingPhase: false
      },
      {
        stageName: 'Egg Laying & Dual Meat Cycle',
        minWeek: 20,
        maxWeek: 72,
        operationalStatus: 'Active Dual-Purpose Production',
        feedType: 'Kienyeji Layer Mash / Green Forage (CP 16%)',
        targetIntakeGramsPerBirdDay: 125,
        waterIntakeMlPerBirdDay: 250,
        lightHours: 14,
        targetTempCelsius: 'Ambient',
        biosecurityCheck: 'Periodic nest box fumigation and lice inspection',
        isLayingPhase: true
      }
    ]
  },
  breeders_parent_stock: {
    category: 'breeders_parent_stock',
    defaultBreeds: ['Cobb 500 Parent Stock', 'Ross Parent Stock'],
    totalCycleWeeks: 65,
    phases: [
      {
        stageName: 'Controlled Growth & Weight Control',
        minWeek: 0,
        maxWeek: 20,
        operationalStatus: 'Restricted Feeding & Uniformity Index',
        feedType: 'Breeder Pullet Mash (CP 15%)',
        targetIntakeGramsPerBirdDay: 85,
        waterIntakeMlPerBirdDay: 170,
        lightHours: 10,
        targetTempCelsius: '20°C',
        biosecurityCheck: 'Strict weekly sample body weighing (target uniformity >85%)',
        isLayingPhase: false
      },
      {
        stageName: 'Breeding & Hatching Egg Output',
        minWeek: 21,
        maxWeek: 65,
        operationalStatus: 'Hatching Egg Production & Fertility Management',
        feedType: 'Breeder Layer Feed (CP 17%, Vitamin E & Organic Se)',
        targetIntakeGramsPerBirdDay: 155,
        waterIntakeMlPerBirdDay: 300,
        lightHours: 15,
        targetTempCelsius: '20°C - 22°C',
        biosecurityCheck: 'Fertility candling audits & hatchery hygiene monitoring',
        isLayingPhase: true
      }
    ]
  }
};

export interface FlockCycleComputation {
  entryAgeWeeks: number;
  totalCycleWeeks: number;
  remainingCycleWeeks: number;
  targetEndDate: Date;
  activePhase: LifecyclePhase;
  dailyFarmFeedNeedKg: (birdCount: number) => number;
  dailyFarmWaterNeedLiters: (birdCount: number) => number;
  entryAgeClassification: 'Day-Old Chicks (DOC)' | 'Point of Lay (POL)' | 'Established Layer Flock' | 'Growers / Pullets';
}

/**
 * Automatically computes target cycle duration, remaining weeks, and operational requirements
 */
export function computeFlockRequirements(
  category: BirdCategory,
  currentAgeWeeks: number,
  placementDate: Date = new Date()
): FlockCycleComputation {
  const spec = POULTRY_STRAIN_STANDARDS[category] || POULTRY_STRAIN_STANDARDS.commercial_layers;
  const totalWeeks = spec.totalCycleWeeks;
  
  // Remaining weeks in the production house
  const remainingWeeks = Math.max(1, totalWeeks - currentAgeWeeks);

  // Compute target harvest / end-of-cycle calendar date
  const targetEndDate = new Date(placementDate.getTime());
  targetEndDate.setDate(targetEndDate.getDate() + (remainingWeeks * 7));

  // Identify matching lifecycle phase
  const activePhase = spec.phases.find(
    (p) => currentAgeWeeks >= p.minWeek && currentAgeWeeks <= p.maxWeek
  ) || spec.phases[spec.phases.length - 1];

  // Age classification
  let entryAgeClassification: FlockCycleComputation['entryAgeClassification'] = 'Growers / Pullets';
  if (currentAgeWeeks <= 1) {
    entryAgeClassification = 'Day-Old Chicks (DOC)';
  } else if (currentAgeWeeks >= 16 && currentAgeWeeks <= 20) {
    entryAgeClassification = 'Point of Lay (POL)';
  } else if (currentAgeWeeks > 20) {
    entryAgeClassification = 'Established Layer Flock';
  }

  return {
    entryAgeWeeks: currentAgeWeeks,
    totalCycleWeeks: totalWeeks,
    remainingCycleWeeks: remainingWeeks,
    targetEndDate,
    activePhase,
    entryAgeClassification,
    dailyFarmFeedNeedKg: (birdCount: number) => 
      Math.round((birdCount * activePhase.targetIntakeGramsPerBirdDay) / 1000),
    dailyFarmWaterNeedLiters: (birdCount: number) => 
      Math.round((birdCount * activePhase.waterIntakeMlPerBirdDay) / 1000)
  };
}
