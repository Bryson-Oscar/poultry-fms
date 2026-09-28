import { getFirestore, collection, query, where, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import type { DailyLog, WeeklySummary, BreedStandard } from './firebaseSchema';

export async function generateWeeklySummary(
    db: ReturnType<typeof getFirestore>,
    farmId: string,
    houseId: string,
    flockId: string,
    weekNumber: number,
    breedStandard: BreedStandard,
    startDateStr: string,
    endDateStr: string
) {
    const logsQ = query(
        collection(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs`),
        where('date', '>=', startDateStr),
        where('date', '<=', endDateStr)
    );
    
    const snap = await getDocs(logsQ);
    const logs = snap.docs.map(d => d.data() as DailyLog);

    if (logs.length === 0) return null;

    const totalEggs = logs.reduce((sum, log) => sum + (log.eggsCollected?.total || 0), 0);
    const totalFeedKg = logs.reduce((sum, log) => sum + (log.feedConsumedKg || 0), 0);
    const totalMortality = logs.reduce((sum, log) => sum + (log.mortalityCount || 0) + (log.cullCount || 0), 0);
    
    const avgHenDayPercent = (totalEggs / (logs.length * 5000)) * 100; // Simplified
    const fcrForWeek = totalEggs > 0 ? totalFeedKg / (totalEggs / 12) : 0;
    
    const standardWeek = breedStandard.performanceCurve[weekNumber.toString()];
    const varianceVsBreedStandard = standardWeek ? avgHenDayPercent - standardWeek.henDayPercent : 0;

    const summary: WeeklySummary = {
        weekNumber,
        avgHenDayPercent,
        totalEggs,
        totalMortality,
        totalFeedKg,
        avgBodyWeightG: null,
        fcrForWeek,
        varianceVsBreedStandard,
        computedAt: Timestamp.now()
    };

    const summaryRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}/weeklySummaries/${weekNumber}`);
    await setDoc(summaryRef, summary);

    return summary;
}

// FINANCIAL CALCULATORS

export function calculateFCR(totalFeedKg: number, totalEggs: number) {
    if (totalEggs === 0) return 0;
    // FCR is typically kg of feed per dozen eggs
    return totalFeedKg / (totalEggs / 12);
}

export function calculatePulletAmortizationPerWeek(totalPulletCost: number) {
    // Decision: Straight-line over 52 weeks
    return totalPulletCost / 52;
}

export function calculateCostPerEgg(totalOpex: number, totalFeedCost: number, amortizedPulletCost: number, totalEggs: number) {
    if (totalEggs === 0) return 0;
    return (totalOpex + totalFeedCost + amortizedPulletCost) / totalEggs;
}

export function calculateGrossMargin(eggSalesRevenue: number, totalOpex: number, totalFeedCost: number) {
    return eggSalesRevenue - (totalOpex + totalFeedCost);
}
