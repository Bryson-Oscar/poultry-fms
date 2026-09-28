// lib/universalDensityStandards.ts

export const TRI_ENTERPRISE_DENSITY = {
  commercial_layers: {
    natural: { min: 6, recommended: 7, max: 8 },
    tunnel: { min: 8, recommended: 10, max: 12 },
    cages: { min: 14, recommended: 18, max: 22 }
  },
  broilers: {
    natural: { min: 10, recommended: 12, max: 14 },
    tunnel: { min: 14, recommended: 16, max: 18 },
    cages: { min: 18, recommended: 20, max: 24 }
  },
  improved_kienyeji: {
    // Indoor Night Shed + Outdoor Range Standards
    deep_litter_indoor: { min: 4, recommended: 5, max: 6 },
    pasture_run_outdoor: { min: 1, recommended: 2, max: 3 } // 1-2 birds/m² outdoor run
  }
};
