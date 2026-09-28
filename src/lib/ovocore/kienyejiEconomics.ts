// lib/kienyejiEconomics.ts

export interface KienyejiBatchInput {
  currentAgeWeeks: number;
  totalFlockCount: number;
  estimatedCockerelsCount: number;
  estimatedHensCount: number;
  
  // Market Variables (KES)
  liveCockerelMarketPriceKES: number; // e.g. KSh 900 - 1,200 per live bird
  fertilizedEggPriceKES: number;      // e.g. KSh 30 - 40 per egg
  tableEggPriceKES: number;           // e.g. KSh 15 - 18 per egg
  dailyFlockFeedCostKES: number;
  
  // Biological Output over 7 days
  weeklyFertilizedEggs: number;
  weeklyTableEggs: number;
  observedWeeklyGainPerCockerelG: number; // Growth tapers off past 16 weeks
}

export interface KienyejiEconomicVerdict {
  cockerelOfftakeRecommendation: 'HARVEST_COCKERELS_NOW' | 'HOLD_COCKERELS';
  netWeeklyEggRevenueKES: number;
  netFlockWeeklyProfitKES: number;
  recommendedFocus: string;
}

export function evaluateKienyejiEconomics(input: KienyejiBatchInput): KienyejiEconomicVerdict {
  // 1. Cockerel Tipping Analysis
  // After week 14-16, cockerel feed intake stays high (120-140g/day) while gain drops (<25g/wk).
  const isCockerelPastTippingPoint = 
    input.currentAgeWeeks >= 16 || 
    (input.currentAgeWeeks >= 14 && input.observedWeeklyGainPerCockerelG < 40);

  // 2. Revenue Stream Breakdowns
  const weeklyFertEggRev = input.weeklyFertilizedEggs * input.fertilizedEggPriceKES;
  const weeklyTableEggRev = input.weeklyTableEggs * input.tableEggPriceKES;
  const totalWeeklyEggRevenue = weeklyFertEggRev + weeklyTableEggRev;
  
  const weeklyFeedExpense = input.dailyFlockFeedCostKES * 7;
  const netFlockWeeklyProfit = totalWeeklyEggRevenue - weeklyFeedExpense;

  const cockerelVerdict = isCockerelPastTippingPoint ? 'HARVEST_COCKERELS_NOW' : 'HOLD_COCKERELS';
  
  let recommendedFocus = "Flock in juvenile growth phase. Maintain balanced starter/grower feeding.";
  if (isCockerelPastTippingPoint && input.estimatedCockerelsCount > 0) {
    recommendedFocus = `Cockerel Growth Plateau. Harvest/Sell ~${input.estimatedCockerelsCount} live cockerels at KSh ${input.liveCockerelMarketPriceKES.toLocaleString()} to stop feed drain on laying pullets.`;
  } else if (input.currentAgeWeeks >= 20) {
    const fertPct = totalWeeklyEggRevenue > 0 ? (weeklyFertEggRev / totalWeeklyEggRevenue) * 100 : 0;
    recommendedFocus = `Egg Phase: Generating KSh ${totalWeeklyEggRevenue.toLocaleString()}/wk. Fertilized hatching eggs represent ${fertPct.toFixed(0)}% of revenue.`;
  }

  return {
    cockerelOfftakeRecommendation: cockerelVerdict,
    netWeeklyEggRevenueKES: totalWeeklyEggRevenue,
    netFlockWeeklyProfitKES: netFlockWeeklyProfit,
    recommendedFocus
  };
}
