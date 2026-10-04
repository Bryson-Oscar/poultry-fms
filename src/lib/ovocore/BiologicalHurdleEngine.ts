// lib/ovocore/BiologicalHurdleEngine.ts

export type EnterpriseType = 'broilers' | 'layers' | 'improved_kienyeji';

export interface BiologicalPerformanceInput {
  farmId: string;
  flockId: string;
  enterpriseType: EnterpriseType;
  initialBirdCount: number;
  finalBirdCount: number;
  totalFeedConsumedKg: number;
  // Broiler specific
  totalHarvestWeightKg?: number;
  // Layer specific
  totalEggsProduced?: number;
  flockCycleDays: number;
  averageFeedCostPerKgKES: number;
  averageProductSalePriceKES: number; // Price per Kg (broiler) or Price per Egg
}

export interface HurdleBenchmarks {
  targetFCR: number;
  targetMortalityPct: number;
  targetLayingPct?: number; // Layers only
}

export interface PerformanceAlphaReport {
  farmId: string;
  flockId: string;
  clearedHurdle: boolean;
  actualFCR: number;
  actualMortalityPct: number;
  actualLayingPct?: number;
  // The economic value generated ABOVE the industry benchmark
  alphaGeneratedKES: number; 
  // OvoCore's carried interest (e.g., 10% of the Alpha)
  platformCarriedInterestKES: number; 
  summaryMessage: string;
}

const INDUSTRY_BENCHMARKS: Record<EnterpriseType, HurdleBenchmarks> = {
  broilers: { targetFCR: 1.65, targetMortalityPct: 4.0 },
  layers: { targetFCR: 2.1, targetMortalityPct: 5.0, targetLayingPct: 85.0 },
  improved_kienyeji: { targetFCR: 2.8, targetMortalityPct: 6.0, targetLayingPct: 70.0 }
};

const PLATFORM_CARRY_PCT = 0.10; // 10% of value generated above the benchmark

export function calculateBiologicalAlpha(input: BiologicalPerformanceInput): PerformanceAlphaReport {
  const benchmark = INDUSTRY_BENCHMARKS[input.enterpriseType];
  const actualMortalityPct = ((input.initialBirdCount - input.finalBirdCount) / input.initialBirdCount) * 100;
  
  let actualFCR = 0;
  let actualLayingPct = 0;
  let alphaGeneratedKES = 0;
  let clearedHurdle = false;

  if (input.enterpriseType === 'broilers' && input.totalHarvestWeightKg) {
    actualFCR = input.totalFeedConsumedKg / input.totalHarvestWeightKg;
    
    // Did they beat the hurdle? Lower FCR and lower mortality is better.
    clearedHurdle = actualFCR <= benchmark.targetFCR && actualMortalityPct <= benchmark.targetMortalityPct;
    
    if (clearedHurdle) {
      // Calculate feed saved relative to benchmark
      const benchmarkFeedRequiredKg = input.totalHarvestWeightKg * benchmark.targetFCR;
      const feedSavedKg = benchmarkFeedRequiredKg - input.totalFeedConsumedKg;
      
      // Calculate extra birds saved relative to benchmark
      const benchmarkMaxDead = input.initialBirdCount * (benchmark.targetMortalityPct / 100);
      const actualDead = input.initialBirdCount - input.finalBirdCount;
      const extraBirdsSaved = Math.max(0, benchmarkMaxDead - actualDead);
      const averageWeightPerBird = input.totalHarvestWeightKg / input.finalBirdCount;
      const extraMeatYieldKg = extraBirdsSaved * averageWeightPerBird;

      alphaGeneratedKES = (feedSavedKg * input.averageFeedCostPerKgKES) + (extraMeatYieldKg * input.averageProductSalePriceKES);
    }

  } else if (input.enterpriseType === 'layers' && input.totalEggsProduced) {
    // FCR in layers is often calculated as kg feed per kg egg mass or per dozen eggs. 
    // We'll use a simplified feed per egg calculation for alpha baseline.
    const standardFeedPerEggKg = 0.120; // 120g per egg benchmark
    actualFCR = input.totalFeedConsumedKg / input.totalEggsProduced; // Actual feed per egg
    
    const possibleHenDays = input.initialBirdCount * input.flockCycleDays;
    actualLayingPct = (input.totalEggsProduced / possibleHenDays) * 100;

    clearedHurdle = actualLayingPct >= (benchmark.targetLayingPct || 85) && actualMortalityPct <= benchmark.targetMortalityPct;

    if (clearedHurdle) {
      const benchmarkEggs = possibleHenDays * ((benchmark.targetLayingPct || 85) / 100);
      const extraEggsGenerated = Math.max(0, input.totalEggsProduced - benchmarkEggs);
      
      alphaGeneratedKES = extraEggsGenerated * input.averageProductSalePriceKES;
    }
  }

  // Ensure alpha is not negative for billing purposes
  alphaGeneratedKES = Math.max(0, alphaGeneratedKES);
  const platformCarriedInterestKES = alphaGeneratedKES * PLATFORM_CARRY_PCT;

  return {
    farmId: input.farmId,
    flockId: input.flockId,
    clearedHurdle,
    actualFCR: Number(actualFCR.toFixed(2)),
    actualMortalityPct: Number(actualMortalityPct.toFixed(2)),
    actualLayingPct: actualLayingPct ? Number(actualLayingPct.toFixed(1)) : undefined,
    alphaGeneratedKES: Number(alphaGeneratedKES.toFixed(2)),
    platformCarriedInterestKES: Number(platformCarriedInterestKES.toFixed(2)),
    summaryMessage: clearedHurdle 
      ? `Hurdle Cleared! Alpha Generated: KSh ${alphaGeneratedKES.toLocaleString(undefined, {maximumFractionDigits: 0})}. OvoCore Performance Fee (10%): KSh ${platformCarriedInterestKES.toLocaleString(undefined, {maximumFractionDigits: 0})}` 
      : `Hurdle Not Cleared. Actual Mortality: ${actualMortalityPct.toFixed(1)}%. No performance fee charged. Initiating corrective advisory.`
  };
}
