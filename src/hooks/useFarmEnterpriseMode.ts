// hooks/useFarmEnterpriseMode.ts
"use client";

import { useMemo } from 'react';
import type { Farm, House, Flock } from '@/services/ovocore/firebaseSchema';

export type EnterpriseMode =
  | 'layers'
  | 'broilers'
  | 'dual_purpose'
  | 'improved_kienyeji'
  | 'mixed';

export interface FeedRationOption {
  id: string;
  label: string;
  category: 'broiler' | 'layer' | 'kienyeji' | 'universal';
}

export interface FarmEnterpriseState {
  /** Resolved operational mode */
  mode: EnterpriseMode;

  /** Primary mode flags */
  isBroilerMode: boolean;
  isLayerMode: boolean;
  isDualPurposeMode: boolean;
  isKienyejiMode: boolean;
  isMixedMode: boolean;

  /** Active flock presence flags */
  hasLayerFlock: boolean;
  hasBroilerFlock: boolean;
  hasKienyejiFlock: boolean;

  /** Numerical flock breakdown */
  layerFlockCount: number;
  broilerFlockCount: number;
  kienyejiFlockCount: number;
  totalActiveFlocks: number;

  /** Transaction permissions & action gate flags */
  canSellEggs: boolean;
  canHarvestBroilers: boolean;
  canSellKienyeji: boolean;

  /** Metric display preferences */
  trackHenDay: boolean;
  trackFCR: boolean;
  trackBiomass: boolean;
  trackFertilizedEggs: boolean;

  /** Available feed programs */
  activeFeedRations: FeedRationOption[];
}

// Industry Feed Program Configurations
const BROILER_RATIONS: FeedRationOption[] = [
  { id: 'starter', label: 'Broiler Starter Crumbs (Day 0 - 10)', category: 'broiler' },
  { id: 'grower', label: 'Broiler Grower Pellets (Day 11 - 24)', category: 'broiler' },
  { id: 'finisher', label: 'Broiler Finisher Pellets (Day 25 - 35)', category: 'broiler' },
  { id: 'withdrawal', label: 'Withdrawal Diet (Zero Meds, Day 35+)', category: 'broiler' },
];

const LAYER_RATIONS: FeedRationOption[] = [
  { id: 'chick_starter', label: 'Chick Starter Mash (Week 0 - 8)', category: 'layer' },
  { id: 'pullet_grower', label: 'Pullet Grower Mash (Week 9 - 16)', category: 'layer' },
  { id: 'pre_lay', label: 'Pre-Lay Developer Mash (Week 17 - 18)', category: 'layer' },
  { id: 'layer_phase_1', label: 'Layer Phase 1 Mash - Peak (Week 19 - 45)', category: 'layer' },
  { id: 'layer_phase_2', label: 'Layer Phase 2 Mash - End (Week 46+)', category: 'layer' },
];

const KIENYEJI_RATIONS: FeedRationOption[] = [
  { id: 'kienyeji_starter', label: 'Kienyeji Starter Crumbs (Week 0 - 6)', category: 'kienyeji' },
  { id: 'kienyeji_grower', label: 'Kienyeji Grower Mash (Week 7 - 16)', category: 'kienyeji' },
  { id: 'cockerel_finisher', label: 'Cockerel Finisher Energy Diet (Week 12 - 16)', category: 'kienyeji' },
  { id: 'kienyeji_breeder_mash', label: 'Kienyeji Layer/Breeder Mash (Week 17+)', category: 'kienyeji' },
  { id: 'pasture_supplement', label: 'Pasture Greens & Kitchen Scratch', category: 'kienyeji' },
];

export function useFarmEnterpriseMode(
  farm: Farm | null | undefined,
  houses: (House & { activeFlock?: Flock | null })[] = []
): FarmEnterpriseState {
  return useMemo(() => {
    const rawFarmType = (farm?.flockType || 'layers').toLowerCase();

    // 1. Audit active flocks in all houses
    let layerFlockCount = 0;
    let broilerFlockCount = 0;
    let kienyejiFlockCount = 0;

    houses.forEach((h) => {
      const flock = h.activeFlock;
      if (!flock) return;

      const cat = (flock.category || '').toLowerCase();
      const breed = (flock.breed || '').toLowerCase();

      if (cat === 'broilers' || breed.includes('cobb') || breed.includes('ross')) {
        broilerFlockCount++;
      } else if (
        cat === 'improved_kienyeji' ||
        cat === 'dual_purpose_kienyeji' ||
        breed.includes('kari') ||
        breed.includes('kuroiler') ||
        breed.includes('kenbro')
      ) {
        kienyejiFlockCount++;
      } else if (cat === 'commercial_layers' || breed.includes('lohmann') || breed.includes('isa') || breed.includes('hy-line')) {
        layerFlockCount++;
      } else {
        // Fallback categorization based on farm profile default
        if (rawFarmType.includes('broiler')) broilerFlockCount++;
        else if (rawFarmType.includes('kienyeji') || rawFarmType.includes('dual')) kienyejiFlockCount++;
        else layerFlockCount++;
      }
    });

    const hasLayerFlock = layerFlockCount > 0;
    const hasBroilerFlock = broilerFlockCount > 0;
    const hasKienyejiFlock = kienyejiFlockCount > 0;
    const totalActiveFlocks = layerFlockCount + broilerFlockCount + kienyejiFlockCount;

    // Detect multi-category flock presence
    const detectedCategoriesCount = [hasLayerFlock, hasBroilerFlock, hasKienyejiFlock].filter(Boolean).length;
    const isMultiCategoryFarm = detectedCategoriesCount > 1 || rawFarmType === 'mixed';

    // 2. Resolve final operational mode
    let mode: EnterpriseMode = 'layers';

    if (isMultiCategoryFarm) {
      mode = 'mixed';
    } else if (rawFarmType.includes('broiler')) {
      mode = hasLayerFlock || hasKienyejiFlock ? 'mixed' : 'broilers';
    } else if (rawFarmType.includes('dual_purpose') || rawFarmType.includes('kienyeji')) {
      mode = hasBroilerFlock ? 'mixed' : (rawFarmType.includes('dual_purpose') ? 'dual_purpose' : 'improved_kienyeji');
    } else {
      mode = hasBroilerFlock || hasKienyejiFlock ? 'mixed' : 'layers';
    }

    const isBroilerMode = mode === 'broilers';
    const isLayerMode = mode === 'layers';
    const isDualPurposeMode = mode === 'dual_purpose';
    const isKienyejiMode = mode === 'improved_kienyeji' || isDualPurposeMode;
    const isMixedMode = mode === 'mixed';

    // 3. Operational Action & Off-take Permissions
    const canSellEggs = isLayerMode || isKienyejiMode || isMixedMode || hasLayerFlock || hasKienyejiFlock;
    const canHarvestBroilers = isBroilerMode || isMixedMode || hasBroilerFlock;
    const canSellKienyeji = isKienyejiMode || isMixedMode || hasKienyejiFlock;

    // 4. Telemetry & Analytics Dashboard Metric Flags
    const trackHenDay = canSellEggs;
    const trackFCR = canHarvestBroilers || isBroilerMode || isMixedMode;
    const trackBiomass = canHarvestBroilers || isKienyejiMode;
    const trackFertilizedEggs = isKienyejiMode || (isMixedMode && hasKienyejiFlock);

    // 5. Active Silo & Feeder Rations Resolution
    let activeFeedRations: FeedRationOption[];
    if (isMixedMode) {
      // Merge unique rations across the active categories present
      const combined = [
        ...(hasBroilerFlock || rawFarmType.includes('broiler') ? BROILER_RATIONS : []),
        ...(hasLayerFlock || rawFarmType.includes('layer') ? LAYER_RATIONS : []),
        ...(hasKienyejiFlock || rawFarmType.includes('kienyeji') ? KIENYEJI_RATIONS : [])
      ];
      activeFeedRations = combined.length > 0 ? combined : [...BROILER_RATIONS, ...LAYER_RATIONS];
    } else if (isBroilerMode) {
      activeFeedRations = BROILER_RATIONS;
    } else if (isKienyejiMode) {
      activeFeedRations = KIENYEJI_RATIONS;
    } else {
      activeFeedRations = LAYER_RATIONS;
    }

    return {
      mode,
      isBroilerMode,
      isLayerMode,
      isDualPurposeMode,
      isKienyejiMode,
      isMixedMode,
      hasLayerFlock,
      hasBroilerFlock,
      hasKienyejiFlock,
      layerFlockCount,
      broilerFlockCount,
      kienyejiFlockCount,
      totalActiveFlocks,
      canSellEggs,
      canHarvestBroilers,
      canSellKienyeji,
      trackHenDay,
      trackFCR,
      trackBiomass,
      trackFertilizedEggs,
      activeFeedRations,
    };
  }, [farm, houses]);
}