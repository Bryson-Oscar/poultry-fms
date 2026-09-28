// lib/broilerEngine.ts

export interface BroilerTelemetryInput {
  currentAgeDays: number;
  liveBirds: number;
  initialBirds: number;
  cumulativeFeedKg: number;
  todayFeedKg: number;
  todayWaterLiters: number;
  sampleWeightsG: number[];
  docPriceKES?: number;
  feedPricePerKgKES?: number;
  otherExpensesKES?: number;
}

export interface BroilerTelemetryMetrics {
  avgWeightG: number;
  liveBiomassKg: number;
  livabilityPct: number;
  currentFCR: number;
  currentFCRFormatted: string;
  epef: number;
  adgGramsPerDay: number;
  waterToFeedRatio: number;
  waterToFeedStatus: 'optimal' | 'low' | 'heat_stress_warning';
  estimatedCostPerKgKES: number;
}

/**
 * Computes precision meat-bird metrics for commercial broiler production
 */
export function calculateBroilerTelemetry(input: BroilerTelemetryInput): BroilerTelemetryMetrics {
  const {
    currentAgeDays = 35,
    liveBirds = 0,
    initialBirds = 0,
    cumulativeFeedKg = 0,
    todayFeedKg = 0,
    todayWaterLiters = 0,
    sampleWeightsG = [],
    docPriceKES = 100,
    feedPricePerKgKES = 75,
    otherExpensesKES = 0,
  } = input;

  // 1. Average Body Weight (grams)
  const validSamples = sampleWeightsG.filter(w => !isNaN(w) && w > 0);
  const avgWeightG = validSamples.length > 0 
    ? Math.round(validSamples.reduce((a, b) => a + b, 0) / validSamples.length)
    : 0;

  // 2. Live Biomass (kg)
  const liveBiomassKg = (liveBirds * avgWeightG) / 1000;

  // 3. Livability (%)
  const livabilityPct = initialBirds > 0 
    ? Number(((liveBirds / initialBirds) * 100).toFixed(1)) 
    : 100.0;

  // 4. Feed Conversion Ratio (FCR)
  const totalFeedKg = cumulativeFeedKg + todayFeedKg;
  const currentFCR = liveBiomassKg > 0 ? Number((totalFeedKg / liveBiomassKg).toFixed(2)) : 0;
  const currentFCRFormatted = currentFCR > 0 ? currentFCR.toFixed(2) : "0.00";

  // 5. European Production Efficiency Factor (EPEF)
  // Formula: (Livability % * Live Weight kg / (Age in Days * FCR)) * 100
  const avgWeightKg = avgWeightG / 1000;
  const epef = (currentFCR > 0 && currentAgeDays > 0)
    ? Math.round((livabilityPct * avgWeightKg * 100) / (currentAgeDays * currentFCR))
    : 0;

  // 6. Average Daily Gain (ADG in g/bird/day, Day-Old Chick baseline 40g)
  const adgGramsPerDay = currentAgeDays > 0
    ? Number(((avgWeightG - 40) / currentAgeDays).toFixed(1))
    : 0;

  // 7. Water-to-Feed Ratio (Liters : Feed Kg)
  const waterToFeedRatio = todayFeedKg > 0 
    ? Number((todayWaterLiters / todayFeedKg).toFixed(2)) 
    : 0;

  let waterToFeedStatus: 'optimal' | 'low' | 'heat_stress_warning' = 'optimal';
  if (waterToFeedRatio > 2.2) {
    waterToFeedStatus = 'heat_stress_warning';
  } else if (waterToFeedRatio < 1.5 && todayFeedKg > 0) {
    waterToFeedStatus = 'low';
  }

  // 8. Estimated Cost per Kg Live Weight (KES)
  const totalDocCost = initialBirds * docPriceKES;
  const totalFeedCost = totalFeedKg * feedPricePerKgKES;
  const totalCostKES = totalDocCost + totalFeedCost + otherExpensesKES;
  const estimatedCostPerKgKES = liveBiomassKg > 0 ? Math.round(totalCostKES / liveBiomassKg) : 0;

  return {
    avgWeightG,
    liveBiomassKg,
    livabilityPct,
    currentFCR,
    currentFCRFormatted,
    epef,
    adgGramsPerDay,
    waterToFeedRatio,
    waterToFeedStatus,
    estimatedCostPerKgKES,
  };
}
