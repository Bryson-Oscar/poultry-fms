// services/anomalyDetectionService.ts
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export interface TelemetryCheckInput {
  farmId: string;
  houseId: string;
  flockId: string;
  flockType: 'layers' | 'broilers';
  ageDays: number;
  todayWaterLiters: number;
  threeDayAvgWaterLiters: number;
  todayFeedKg: number;
  expectedBreedFeedKg: number;
  cropFillSample100Count?: number; // 0 to 100 chicks checked
  crackedEggsCount?: number;
  totalEggsCount?: number;
  weightSamplesG?: number[];
}

export async function runBiologicalEarlyWarningAudits(input: TelemetryCheckInput) {
  const alerts: Array<{
    alertType: 'WATER_ANOMALY' | 'CROP_FILL_FAILURE' | 'WEIGHT_UNIFORMITY_DRIFT' | 'EGG_QUALITY_DROP' | 'FEED_DEPRESSION';
    severity: 'warning' | 'critical';
    headline: string;
    detail: string;
    recommendedSopAction: string;
  }> = [];

  // 1. Water Intake Anomaly (>15% Drop or >30% Surge)
  if (input.threeDayAvgWaterLiters > 0 && input.todayWaterLiters > 0) {
    const variance = (input.todayWaterLiters - input.threeDayAvgWaterLiters) / input.threeDayAvgWaterLiters;
    if (variance < -0.15) {
      alerts.push({
        alertType: 'WATER_ANOMALY',
        severity: 'critical',
        headline: 'Water Intake Depression (-' + Math.round(Math.abs(variance) * 100) + '%)',
        detail: `Water intake dropped from 3-day baseline of ${input.threeDayAvgWaterLiters}L to ${input.todayWaterLiters}L.`,
        recommendedSopAction: 'Check pressure regulators immediately for line airlocks, and inspect flock for early bacterial enteritis.'
      });
    } else if (variance > 0.30) {
      alerts.push({
        alertType: 'WATER_ANOMALY',
        severity: 'warning',
        headline: 'Drinker Line Leak / Water Surge (+' + Math.round(variance * 100) + '%)',
        detail: `Water consumption surged abnormal to baseline (${input.todayWaterLiters}L vs ${input.threeDayAvgWaterLiters}L).`,
        recommendedSopAction: 'Walk nipple lines to locate failed valves or split pipes causing wet bedding.'
      });
    }
  }

  // 2. Day 1 Crop-Fill Failure (<85% at 24h)
  if (input.ageDays <= 2 && input.cropFillSample100Count !== undefined) {
    if (input.cropFillSample100Count < 85) {
      alerts.push({
        alertType: 'CROP_FILL_FAILURE',
        severity: 'critical',
        headline: 'Early Crop-Fill Failure (' + input.cropFillSample100Count + '% filled)',
        detail: 'Chicks have failed to find starter crumbs and water within the first 24 hours of placement.',
        recommendedSopAction: 'Increase light lux to 40, lower drinker nipple lines, and distribute supplementary feed on chick paper.'
      });
    }
  }

  // 3. Catch-Pen Weight Uniformity Drift (Coefficient of Variation > 10%)
  if (input.weightSamplesG && input.weightSamplesG.length >= 20) {
    const n = input.weightSamplesG.length;
    const mean = input.weightSamplesG.reduce((a, b) => a + b, 0) / n;
    const variance = input.weightSamplesG.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cvPct = (stdDev / mean) * 100;

    if (cvPct > 10.0) {
      alerts.push({
        alertType: 'WEIGHT_UNIFORMITY_DRIFT',
        severity: 'warning',
        headline: `Flock Uniformity Drift (CV: ${cvPct.toFixed(1)}%)`,
        detail: `Sample weight variation is elevated (Mean: ${Math.round(mean)}g, StDev: ${Math.round(stdDev)}g).`,
        recommendedSopAction: 'Sort lower-weight quartile birds into separate partition pens and check feeder pan distribution speeds.'
      });
    }
  }

  // 4. Egg Shell Quality Degradation (>1.8% cracked)
  if (input.flockType === 'layers' && input.totalEggsCount && input.crackedEggsCount) {
    const crackRate = (input.crackedEggsCount / input.totalEggsCount) * 100;
    if (crackRate > 1.8) {
      alerts.push({
        alertType: 'EGG_QUALITY_DROP',
        severity: 'warning',
        headline: `High Shell Damage Rate (${crackRate.toFixed(2)}% Cracks)`,
        detail: `${input.crackedEggsCount} cracked eggs out of ${input.totalEggsCount} collected.`,
        recommendedSopAction: 'Inspect egg elevator transitions, calibrate belt speeds, and audit calcium/vitamin D3 formulation in feed.'
      });
    }
  }

  // Commit Discovered Alerts to Firestore
  for (const a of alerts) {
    await addDoc(collection(db, `farms/${input.farmId}/houses/${input.houseId}/alerts`), {
      ...a,
      flockId: input.flockId,
      detectedAt: Timestamp.now(),
      acknowledged: false
    });
  }

  return alerts;
}
