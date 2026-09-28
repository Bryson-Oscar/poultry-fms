// lib/layerAmortization.ts

export interface PulletAmortizationInput {
  initialPulletCount: number;
  costPerPulletKES: number;          // e.g. KSh 850 at 18 weeks
  expectedProductiveWeeks: number;    // Standard: 52 weeks (Week 18 to 70)
  currentAgeWeeks: number;
  currentBirdCount: number;
  weeklyEggsProduced: number;
  weeklyFeedCostKES: number;
  weeklyOverheadCostKES: number;     // Labor, energy, medication
}

export interface UnitEggEconomics {
  weeklyPulletAmortizationKES: number;
  cumulativeAmortizedToDateKES: number;
  remainingAssetValueKES: number;
  totalProductionCostPerEggKES: number;
  feedShareCostPerEggKES: number;
  pulletCapitalCostPerEggKES: number;
  overheadCostPerEggKES: number;
}

export function computeUnitEggEconomics(input: PulletAmortizationInput): UnitEggEconomics {
  const totalCapitalInvestmentKES = input.initialPulletCount * input.costPerPulletKES;
  
  // Weekly straight-line amortization
  const weeklyAmortization = totalCapitalInvestmentKES / input.expectedProductiveWeeks;

  // Weeks in lay (assuming onset of lay at Week 18)
  const weeksInProduction = Math.max(0, input.currentAgeWeeks - 18);
  const cumulativeAmortized = Math.min(totalCapitalInvestmentKES, weeklyAmortization * weeksInProduction);
  const remainingAssetValue = Math.max(0, totalCapitalInvestmentKES - cumulativeAmortized);

  const eggs = Math.max(1, input.weeklyEggsProduced);
  
  // Unit cost breakdowns per egg
  const feedCostPerEgg = input.weeklyFeedCostKES / eggs;
  const pulletCostPerEgg = weeklyAmortization / eggs;
  const overheadCostPerEgg = input.weeklyOverheadCostKES / eggs;
  const totalCostPerEgg = feedCostPerEgg + pulletCostPerEgg + overheadCostPerEgg;

  return {
    weeklyPulletAmortizationKES: Math.round(weeklyAmortization),
    cumulativeAmortizedToDateKES: Math.round(cumulativeAmortized),
    remainingAssetValueKES: Math.round(remainingAssetValue),
    totalProductionCostPerEggKES: Number(totalCostPerEgg.toFixed(2)),
    feedShareCostPerEggKES: Number(feedCostPerEgg.toFixed(2)),
    pulletCapitalCostPerEggKES: Number(pulletCostPerEgg.toFixed(2)),
    overheadCostPerEggKES: Number(overheadCostPerEgg.toFixed(2)),
  };
}
