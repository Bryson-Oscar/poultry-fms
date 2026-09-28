// lib/broilerTippingPoint.ts

export interface TippingPointEvaluation {
  currentAgeDays: number;
  liveBirds: number;
  currentAvgWeightG: number;
  costPerKgFinisherKES: number;
  livePricePerKgKES: number;
  observedDailyGainG: number;      // e.g. 50g/day at Day 39
  observedDailyFeedIntakeG: number; // e.g. 185g/day at Day 39
}

export interface HarvestRecommendation {
  status: 'HOLD' | 'HARVEST_NOW';
  marginalRevenueKES: number;
  marginalFeedCostKES: number;
  netDailyProfitPerBirdKES: number;
  totalFlockDailyNetGainKES: number;
  recommendationText: string;
}

export function calculateHarvestTippingPoint(input: TippingPointEvaluation): HarvestRecommendation {
  // Marginal Revenue generated per bird over 24 hrs = (Gain in Kg) * Price/Kg
  const dailyGainKg = input.observedDailyGainG / 1000;
  const marginalRevenue = dailyGainKg * input.livePricePerKgKES;

  // Marginal Cost incurred per bird over 24 hrs = (Feed in Kg) * Cost/Kg
  const dailyFeedKg = input.observedDailyFeedIntakeG / 1000;
  const marginalFeedCost = dailyFeedKg * input.costPerKgFinisherKES;

  const netDailyProfitPerBird = marginalRevenue - marginalFeedCost;
  const totalFlockDailyNetGain = Math.round(netDailyProfitPerBird * input.liveBirds);

  // Economic tipping point occurs when marginal feed cost approaches or surpasses live gain value
  const isPastTippingPoint = netDailyProfitPerBird <= 0.75; // Less than KSh 0.75 net return per bird/day

  return {
    status: isPastTippingPoint ? 'HARVEST_NOW' : 'HOLD',
    marginalRevenueKES: Number(marginalRevenue.toFixed(2)),
    marginalFeedCostKES: Number(marginalFeedCost.toFixed(2)),
    netDailyProfitPerBirdKES: Number(netDailyProfitPerBird.toFixed(2)),
    totalFlockDailyNetGainKES: totalFlockDailyNetGain,
    recommendationText: isPastTippingPoint
      ? `Harvest Tipping Point Reached. Each bird is consuming KSh ${marginalFeedCost.toFixed(2)} in feed while gaining only KSh ${marginalRevenue.toFixed(2)} in live weight. Schedule immediate processor collection to avoid margin decay.`
      : `Optimal Growth Phase. Current growth produces +KSh ${netDailyProfitPerBird.toFixed(2)} per bird/day (+KSh ${totalFlockDailyNetGain.toLocaleString()} flock net/day). Maintain feeding program.`
  };
}
