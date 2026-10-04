"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import {
  doc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  Unsubscribe
} from 'firebase/firestore';
import type { Flock, DailyLog, FeedBatch, House } from '@/services/ovocore/firebaseSchema';
import { submitDailyLog } from '@/services/ovocore/flockService';
import { EmergencyMortalityProtocol } from '@/components/ovocore/EmergencyMortalityProtocol';
import {
  Loader2,
  ArrowLeft,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Info,
  Calendar,
  Layers,
  Wheat,
  Scale,
  Egg,
  HeartPulse,
  Droplets,
  Activity,
  Syringe,
  Sparkles,
  SunMedium,
  TrendingUp,
  Eye,
  ShieldCheck,
  Clock
} from 'lucide-react';

export type EnterpriseType = 'commercial_layers' | 'broilers' | 'improved_kienyeji' | 'breeders';

interface DiagnosticResult {
  type: 'warning' | 'critical' | 'success';
  title: string;
  message: string;
}

export default function UniversalDailyLogCapture() {
  const params = useParams();
  const router = useRouter();
  const farmId = params?.farmId as string;
  const houseId = params?.houseId as string;
  const flockId = params?.flockId as string;

  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [flock, setFlock] = useState<(Flock & { id: string }) | null>(null);
  const [house, setHouse] = useState<(House & { id: string }) | null>(null);
  const [feedBatches, setFeedBatches] = useState<(FeedBatch & { id: string })[]>([]);
  const [selectedFeedBatchId, setSelectedFeedBatchId] = useState<string>('');
  const [recentLogs, setRecentLogs] = useState<(DailyLog & { id: string; isPending?: boolean })[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [isEmergencyAcknowledged, setIsEmergencyAcknowledged] = useState(false);

  // Form State covering all enterprise requirements
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    mortalityCount: 0,
    cullCount: 0,
    feedConsumedKg: 0,
    waterConsumedLiters: 0,
    ambientTempC: 24,
    humidityPercent: 65,

    // Layer-Specific Fields
    eggsGradeA: 0,
    eggsGradeB: 0,
    eggsGradeC: 0,
    cracked: 0,
    dirty: 0,

    // Broiler-Specific Fields
    feedRationType: 'grower',
    sampleWeightsString: '', // e.g. "1450, 1420, 1490, 1410"

    // Kienyeji-Specific Fields
    fertilizedHatchingEggs: 0,
    kienyejiTableEggs: 0,
    supplementaryGreensKg: 0,
    pastureGrazingHours: 4,
    combCondition: 'bright_red_healthy' as 'bright_red_healthy' | 'pale_anemic' | 'cyanotic_blue',

    notes: '',
  });

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!farmId || !houseId || !flockId) return;

    let unsubFlock: Unsubscribe;
    let unsubHouse: Unsubscribe;
    let unsubLogs: Unsubscribe;
    let unsubFeed: Unsubscribe;

    // 1. Subscribe to Flock
    const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);
    unsubFlock = onSnapshot(flockRef, { includeMetadataChanges: true }, (docSnap) => {
      if (docSnap.exists()) {
        setFlock({ id: docSnap.id, ...(docSnap.data() as Flock) });
        setIsPendingSync(docSnap.metadata.hasPendingWrites);
      }
      setIsLoading(false);
    });

    // 2. Subscribe to House
    const houseRef = doc(db, `farms/${farmId}/houses/${houseId}`);
    unsubHouse = onSnapshot(houseRef, (docSnap) => {
      if (docSnap.exists()) {
        setHouse({ id: docSnap.id, ...(docSnap.data() as House) });
      }
    });

    // 3. Subscribe to Recent Daily Logs (Top 10)
    const logsRef = collection(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs`);
    const logsQ = query(logsRef, orderBy('date', 'desc'), limit(10));
    unsubLogs = onSnapshot(logsQ, { includeMetadataChanges: true }, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DailyLog),
        isPending: d.metadata.hasPendingWrites,
      }));
      setRecentLogs(docs);
    });

    // 4. Subscribe to Active Feed Silos
    const feedRef = collection(db, `farms/${farmId}/feedBatches`);
    unsubFeed = onSnapshot(feedRef, (snap) => {
      const batches = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as FeedBatch) }))
        .filter((b) => (b.quantityRemainingKg || 0) > 0);
      setFeedBatches(batches);
      if (batches.length > 0 && !selectedFeedBatchId) {
        setSelectedFeedBatchId(batches[0].id);
      }
    });

    return () => {
      if (unsubFlock) unsubFlock();
      if (unsubHouse) unsubHouse();
      if (unsubLogs) unsubLogs();
      if (unsubFeed) unsubFeed();
    };
  }, [farmId, houseId, flockId]);

  // Determine Resolved Enterprise Category
  const enterpriseType = useMemo((): EnterpriseType => {
    if (!flock) return 'commercial_layers';
    const cat = (flock.category || '').toLowerCase();
    const breed = (flock.breed || '').toLowerCase();

    if (cat.includes('broiler') || breed.includes('cobb') || breed.includes('ross')) {
      return 'broilers';
    }
    if (cat.includes('kienyeji') || breed.includes('kari') || breed.includes('kuroiler') || breed.includes('kenbro')) {
      return 'improved_kienyeji';
    }
    if (cat.includes('breeder') || breed.includes('breeder')) {
      return 'breeders';
    }
    return 'commercial_layers';
  }, [flock]);

  // Derived Chronological Metrics
  const { flockAgeDays, flockAgeWeeks } = useMemo(() => {
    if (!flock?.dateHoused) return { flockAgeDays: 0, flockAgeWeeks: 1 };
    const housedDate = flock.dateHoused.toDate ? flock.dateHoused.toDate() : new Date(flock.dateHoused as any);
    const logDate = new Date(formData.date);
    const diffMs = logDate.getTime() - housedDate.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const initialWeeks = flock.initialAgeWeeks || 0;
    const weeks = initialWeeks + Math.floor(days / 7);
    return { flockAgeDays: days, flockAgeWeeks: weeks };
  }, [flock, formData.date]);

  // Broiler Sample Weight & FCR Metrics
  const broilerStats = useMemo(() => {
    const raw = formData.sampleWeightsString.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const avgWeightG = raw.length > 0 ? Math.round(raw.reduce((a, b) => a + b, 0) / raw.length) : 0;
    const currentLive = Math.max(1, (flock?.currentBirdCount || 1) - Number(formData.mortalityCount) - Number(formData.cullCount));
    const liveBiomassKg = (currentLive * avgWeightG) / 1000;
    const feedTotal = (flock?.cumulativeFeedKg || 0) + Number(formData.feedConsumedKg);
    const fcr = liveBiomassKg > 0 ? (feedTotal / liveBiomassKg).toFixed(2) : "0.00";
    return { avgWeightG, fcr, sampleCount: raw.length };
  }, [formData.sampleWeightsString, formData.feedConsumedKg, formData.mortalityCount, formData.cullCount, flock]);

  // Layer & Kienyeji Egg Sums
  const layerEggTotals = useMemo(() => {
    return (
      Number(formData.eggsGradeA) +
      Number(formData.eggsGradeB) +
      Number(formData.eggsGradeC) +
      Number(formData.cracked) +
      Number(formData.dirty)
    );
  }, [formData.eggsGradeA, formData.eggsGradeB, formData.eggsGradeC, formData.cracked, formData.dirty]);

  const kienyejiEggTotals = useMemo(() => {
    return Number(formData.fertilizedHatchingEggs) + Number(formData.kienyejiTableEggs) + Number(formData.cracked);
  }, [formData.fertilizedHatchingEggs, formData.kienyejiTableEggs, formData.cracked]);

  // Enterprise ROI & Breed Benchmark Forecast Engine
  const benchmarkStats = useMemo(() => {
    const initialCount = flock?.initialBirdCount || 5000;
    const currentCount = flock?.currentBirdCount || initialCount;

    if (enterpriseType === 'broilers') {
      const targetWeightKgPerBird = flock?.targetHarvestWeightG ? flock.targetHarvestWeightG / 1000 : 2.2;
      const currentAvgWeightG = broilerStats.avgWeightG || Math.min(2500, Math.round(flockAgeDays * 48));
      const currentBiomassKg = Math.round((currentCount * currentAvgWeightG) / 1000);
      const forecastedHarvestBiomassKg = Math.round(currentCount * targetWeightKgPerBird);
      const pctOfHarvestTarget = forecastedHarvestBiomassKg > 0 ? (currentBiomassKg / forecastedHarvestBiomassKg) * 100 : 0;
      
      // Expected weight for current age in days (broiler curve ~45-50g gain/day)
      const expectedAvgWeightG = Math.max(45, Math.min(2500, Math.round(flockAgeDays * 48)));
      const weightVarianceG = currentAvgWeightG - expectedAvgWeightG;
      const variancePct = expectedAvgWeightG > 0 ? ((weightVarianceG / expectedAvgWeightG) * 100).toFixed(1) : "0.0";
      const numVar = parseFloat(variancePct);

      // Financial ROI Calculations
      const livePricePerKg = 250; // KSh 250/kg live market average
      const feedCostPerKg = 90;   // KSh 90/kg broiler pellets
      const docPricePerBird = 100; // KSh 100 per day-old chick
      
      const forecastedGrossRevenueKES = forecastedHarvestBiomassKg * livePricePerKg;
      const totalFeedRequiredKg = Math.round(currentCount * 1.58 * targetWeightKgPerBird); // FCR 1.58
      const forecastedFeedExpenseKES = totalFeedRequiredKg * feedCostPerKg;
      const docStockingCostKES = initialCount * docPricePerBird;
      const forecastedNetMarginKES = forecastedGrossRevenueKES - forecastedFeedExpenseKES - docStockingCostKES;
      const netMarginPct = forecastedGrossRevenueKES > 0 ? ((forecastedNetMarginKES / forecastedGrossRevenueKES) * 100).toFixed(1) : "0.0";

      return {
        enterpriseType,
        unitLabel: 'kg Live Biomass',
        currentVal: currentBiomassKg,
        forecastedLifetimeVal: forecastedHarvestBiomassKg,
        pctOfLifetimeTarget: Math.min(100, Math.round(pctOfHarvestTarget)),
        expectedToDate: Math.round((currentCount * expectedAvgWeightG) / 1000),
        performanceVariancePct: numVar,
        badgeText: flockAgeDays <= 3 ? 'Brooding Starter Stage' : `${numVar >= 0 ? '+' : ''}${variancePct}% vs Ross/Cobb Standard`,
        isAhead: numVar >= 0,
        subtext: `Target: ${targetWeightKgPerBird}kg/bird @ Day 35–42`,
        // ROI Forecasts
        forecastedGrossRevenueKES,
        forecastedFeedExpenseKES,
        forecastedNetMarginKES,
        netMarginPct
      };
    }

    if (enterpriseType === 'improved_kienyeji') {
      // Extended 52-week lay curve (~180 eggs/hen lifetime + cockerel sales)
      const currentEggs = (flock?.cumulativeEggs || 0) + kienyejiEggTotals;
      const layingWeeksElapsed = Math.max(0, flockAgeWeeks - 20);
      const remainingLayingWeeks = Math.max(0, 52 - layingWeeksElapsed);
      const remainingEggsForecast = Math.round(currentCount * (remainingLayingWeeks * 7) * 0.55); // 55% avg lay rate
      const forecastedLifetimeEggs = currentEggs + remainingEggsForecast;

      const expectedEggsPerHen = Math.min(180, layingWeeksElapsed * 3.5);
      const expectedEggsToDate = Math.round(initialCount * expectedEggsPerHen);
      const varianceEggs = currentEggs - expectedEggsToDate;
      const variancePct = expectedEggsToDate > 0 ? ((varianceEggs / expectedEggsToDate) * 100).toFixed(1) : "0.0";
      const numVar = parseFloat(variancePct);
      const pctOfTarget = (forecastedLifetimeEggs > 0 ? (currentEggs / forecastedLifetimeEggs) * 100 : 0);

      // Financial ROI Calculations (Dual Stream)
      const avgEggPrice = 25; // Blended KSh 35 hatching / KSh 16 table
      const feedCostPerKg = 75;
      const pulletCost = 750;

      const forecastedGrossRevenueKES = (forecastedLifetimeEggs * avgEggPrice) + (currentCount * 0.5 * 1000); // 50% roosters @ KSh 1,000
      const totalFeedRequiredKg = Math.round((currentCount * 52 * 7 * 0.095));
      const forecastedFeedExpenseKES = totalFeedRequiredKg * feedCostPerKg;
      const stockCostKES = initialCount * pulletCost;
      const forecastedNetMarginKES = forecastedGrossRevenueKES - forecastedFeedExpenseKES - stockCostKES;
      const netMarginPct = forecastedGrossRevenueKES > 0 ? ((forecastedNetMarginKES / forecastedGrossRevenueKES) * 100).toFixed(1) : "0.0";

      return {
        enterpriseType,
        unitLabel: 'Eggs',
        currentVal: currentEggs,
        forecastedLifetimeVal: forecastedLifetimeEggs,
        pctOfLifetimeTarget: Math.min(100, Math.round(pctOfTarget)),
        expectedToDate: expectedEggsToDate,
        performanceVariancePct: numVar,
        badgeText: flockAgeWeeks < 20 ? 'Rearing & Foraging Phase' : `${numVar >= 0 ? '+' : ''}${variancePct}% vs Kienyeji Standard`,
        isAhead: numVar >= 0,
        subtext: `Target: 180 Eggs/Hen + Cockerel Meat Sales`,
        // ROI Forecasts
        forecastedGrossRevenueKES,
        forecastedFeedExpenseKES,
        forecastedNetMarginKES,
        netMarginPct
      };
    }

    // Commercial Layers (72-80 week lay curve ~320 eggs/hen lifetime)
    const currentEggs = (flock?.cumulativeEggs || 0) + layerEggTotals;
    const layingWeeksElapsed = Math.max(0, flockAgeWeeks - 18);
    const remainingLayingWeeks = Math.max(0, 54 - layingWeeksElapsed); // 54 productive weeks (w18 - w72)
    const remainingEggsForecast = Math.round(currentCount * (remainingLayingWeeks * 7) * 0.82); // 82% average lay rate
    const forecastedLifetimeEggs = Math.max(initialCount * 320, currentEggs + remainingEggsForecast);

    // Expected eggs to date for current age
    let expectedEggsPerHenToDate = 0;
    if (layingWeeksElapsed > 0) {
      if (layingWeeksElapsed <= 12) {
        expectedEggsPerHenToDate = layingWeeksElapsed * 4.8; // Peak ramping phase
      } else {
        expectedEggsPerHenToDate = 57.6 + (layingWeeksElapsed - 12) * 6.1; // Sustained peak phase
      }
    }
    const expectedEggsToDate = Math.round(initialCount * expectedEggsPerHenToDate);
    const varianceEggs = currentEggs - expectedEggsToDate;
    const variancePct = expectedEggsToDate > 0 ? ((varianceEggs / expectedEggsToDate) * 100).toFixed(1) : "0.0";
    const numVar = parseFloat(variancePct);
    const pctOfTarget = (forecastedLifetimeEggs > 0 ? (currentEggs / forecastedLifetimeEggs) * 100 : 0);

    // Financial ROI Calculations (Eggs @ KSh 16.00 average, Feed @ KSh 75/kg, Pullet Asset @ KSh 850)
    const eggPriceKES = 16.0;
    const feedCostPerKg = 75.0;
    const pulletAssetCostKES = 850.0;

    const forecastedGrossRevenueKES = forecastedLifetimeEggs * eggPriceKES;
    const totalLifetimeFeedKg = Math.round(initialCount * 54 * 7 * 0.118); // 118g/day over 54 laying weeks
    const forecastedFeedExpenseKES = totalLifetimeFeedKg * feedCostPerKg;
    const totalPulletCapitalKES = initialCount * pulletAssetCostKES;
    const forecastedNetMarginKES = forecastedGrossRevenueKES - forecastedFeedExpenseKES - totalPulletCapitalKES;
    const netMarginPct = forecastedGrossRevenueKES > 0 ? ((forecastedNetMarginKES / forecastedGrossRevenueKES) * 100).toFixed(1) : "0.0";

    return {
      enterpriseType,
      unitLabel: 'Eggs',
      currentVal: currentEggs,
      forecastedLifetimeVal: forecastedLifetimeEggs,
      pctOfLifetimeTarget: Math.min(100, Math.round(pctOfTarget)),
      expectedToDate: expectedEggsToDate,
      performanceVariancePct: numVar,
      badgeText: flockAgeWeeks < 19 ? 'Point-of-Lay Rearing Phase (Onset W19)' : `${numVar >= 0 ? '+' : ''}${variancePct}% vs Lohmann Standard`,
      isAhead: numVar >= 0,
      subtext: `Target: 320 Eggs/Hen over 72 Weeks`,
      // ROI Forecasts
      forecastedGrossRevenueKES,
      forecastedFeedExpenseKES,
      forecastedNetMarginKES,
      netMarginPct
    };
  }, [flock, enterpriseType, broilerStats, layerEggTotals, kienyejiEggTotals, flockAgeDays, flockAgeWeeks]);

  // Automated Operational Lifecycle Schedules
  const scheduleMilestones = useMemo(() => {
    if (enterpriseType === 'broilers') {
      return [
        { title: "Brooder Setup & Temp Calibration", target: "Day 1 - 3", targetDay: 1, desc: "Pre-heat house to 32°C–34°C. Ensure 24-hr access to glucose/electrolyte water." },
        { title: "Newcastle + IB Vaccine (HB1)", target: "Day 7", targetDay: 7, desc: "Administer via ocular drop or non-chlorinated water with stabilizer dye." },
        { title: "Gumboro (IBD) Primary Dose", target: "Day 12 - 14", targetDay: 12, desc: "Withhold water for 2 hours prior to ensure rapid uptake within 60 mins." },
        { title: "Feed Transition to Grower Pellets", target: "Day 18 - 20", targetDay: 18, desc: "Shift from starter crumbs to grower pellets over 48 hours." },
        { title: "Gumboro Intermediate Booster", target: "Day 24", targetDay: 24, desc: "Reinforce bursal immunity against high-challenge field strains." },
        { title: "Finisher Withdrawal Transition", target: "Day 35", targetDay: 35, desc: "Switch to pure finisher (Zero antibiotics/coccidiostats) 5–7 days pre-slaughter." },
      ];
    }

    if (enterpriseType === 'improved_kienyeji') {
      return [
        { title: "Marek's & Day 1 Hydration", target: "Day 1 - 3", targetDay: 1, desc: "Provide liquid multivitamins and monitor brooding heat rings (33°C)." },
        { title: "Newcastle Disease (ND HB1)", target: "Day 7", targetDay: 7, desc: "Primary eye drop or drinking water line vaccination." },
        { title: "Gumboro (IBD 1)", target: "Day 14", targetDay: 14, desc: "First intermediate Gumboro vaccination in clean drinking water." },
        { title: "Fowl Pox Wing-Web Inoculation", target: "Week 6 - 8", targetDay: 42, desc: "Wing-web puncture. Inspect take swelling 7 days post-administration." },
        { title: "Cockerel Separation & Selection", target: "Week 14 - 16", targetDay: 98, desc: "Sort males for live meat market fattening; transition females to grower mash." },
        { title: "Routine Anthelmintic Deworming", target: "Every 8 Weeks", targetDay: 56, desc: "Administer Levamisole/Piperazine to combat soil-borne nematodes." },
      ];
    }

    if (enterpriseType === 'breeders') {
      return [
        { title: "Brooder Setup & Sexing Verification", target: "Day 1 - 3", targetDay: 1, desc: "Verify vent sexing and ensure 33°C at floor level. Initiate lighting program." },
        { title: "Newcastle + IB Primer", target: "Day 7", targetDay: 7, desc: "Ocular or drinking water administration with cold-chain verified vials." },
        { title: "Fowl Cholera & Coryza Primer", target: "Week 10", targetDay: 70, desc: "Administer intramuscularly to build flock immunity pre-lay." },
        { title: "Pre-Lay Breeder Mash Transition", target: "Week 18 - 20", targetDay: 126, desc: "Transition to breeder mash formulated for fertility and hatchability." },
        { title: "Photoperiod Stimulation (15hrs)", target: "Week 21+", targetDay: 147, desc: "Step up day length to stimulate mating behavior and egg production." },
        { title: "Routine Salmonella Pullorum Screening", target: "Every 12 Weeks", targetDay: 84, desc: "Mandatory blood screening to certify hatching eggs are pullorum-free." },
      ];
    }

    // Default: Commercial Layers
    return [
      { title: "Brooder Setup & Temp Calibration", target: "Day 1 - 3", targetDay: 1, desc: "Ensure 32°C at floor level and check crop-fill at 8 and 24 hours." },
      { title: "Newcastle + IB Primer", target: "Day 7", targetDay: 7, desc: "Ocular or drinking water administration with cold-chain verified vials." },
      { title: "Gumboro (IBD) Primer", target: "Day 14", targetDay: 14, desc: "Primary bursal protection dose; verify water stabilizer dye uptake." },
      { title: "Grower Mash Transition", target: "Week 8 - 16", targetDay: 56, desc: "Develop body frame and target shank length; avoid premature fattening." },
      { title: "Pre-Lay Calcium Transition", target: "Week 16 - 17", targetDay: 112, desc: "Introduce 2.5% calcium pre-lay diet to build medullary bone reserves." },
      { title: "16-Hour Photoperiod Activation", target: "Week 18+", targetDay: 126, desc: "Step up day length to 16 hours steady light to trigger and sustain peak lay." },
    ];
  }, [enterpriseType]);

  // Operational Diagnostics Engine
  const diagnostics = useMemo((): DiagnosticResult | null => {
    if (!flock) return null;
    const currentLive = Math.max(1, flock.currentBirdCount || 1);

    // 1. Mortality Spike Check (>0.15% for layers/kienyeji, >1.5% acute for broilers)
    const mortalityNumber = Number(formData.mortalityCount);
    const mortalityPct = (mortalityNumber / currentLive) * 100;
    const threshold = enterpriseType === 'broilers' ? 1.0 : 0.15;

    if (mortalityPct >= threshold && mortalityNumber > 0) {
      return {
        type: 'critical',
        title: 'Mortality Spike Detected',
        message: `Daily depletion is ${mortalityPct.toFixed(2)}% (${mortalityNumber} birds). Verify ventilation airflow, water supply, and check for acute disease symptoms immediately.`,
      };
    }

    // 2. Resource Ratio Checks
    if (formData.feedConsumedKg > 0 && formData.waterConsumedLiters > 0) {
      const ratio = Number(formData.waterConsumedLiters) / Number(formData.feedConsumedKg);
      if (ratio > 2.3) {
        return {
          type: 'warning',
          title: 'High Water-to-Feed Ratio Warning',
          message: `Water intake is ${ratio.toFixed(2)}:1 vs expected (1.6–2.0:1). Check for heat stress or drinker line leaks.`,
        };
      }
      if (ratio < 1.4) {
        return {
          type: 'warning',
          title: 'Water Under-Consumption Alert',
          message: `Water intake is low at ${ratio.toFixed(2)}:1. Inspect nipple line pressure regulators immediately to prevent feed refusal.`,
        };
      }
    }

    // 3. Enterprise-Specific Benchmarking
    if (enterpriseType === 'commercial_layers' && layerEggTotals > 0) {
      const henDayPct = (layerEggTotals / currentLive) * 100;
      if (flockAgeWeeks >= 22 && henDayPct < 70) {
        return {
          type: 'warning',
          title: 'Hen-Day Production Below Curve',
          message: `Hen-Day is currently ${henDayPct.toFixed(1)}%. Audit lighting timer duration and crude protein in Layer Phase 1 mash.`,
        };
      }
    }

    return null;
  }, [flock, formData, enterpriseType, layerEggTotals, flockAgeWeeks]);

  // Handle Input Changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'mortalityCount') setIsEmergencyAcknowledged(false);

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'date' || name === 'notes' || name === 'sampleWeightsString' || name === 'combCondition' || name === 'feedRationType'
        ? value 
        : Math.max(0, parseFloat(value) || 0),
    }));
  };

  // Submit Daily Log Atomically
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !flock) return;

    const totalDepletion = Number(formData.mortalityCount) + Number(formData.cullCount);
    if (totalDepletion > flock.currentBirdCount) {
      toast({
        title: "Validation Error",
        description: `Mortality and culls (${totalDepletion}) cannot exceed live bird headcount (${flock.currentBirdCount}).`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const rawWeights = formData.sampleWeightsString
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n));

      const logPayload: any = {
        date: formData.date,
        mortalityCount: Number(formData.mortalityCount),
        cullCount: Number(formData.cullCount),
        feedConsumedKg: Number(formData.feedConsumedKg),
        waterConsumedLiters: formData.waterConsumedLiters > 0 ? Number(formData.waterConsumedLiters) : null,
        temperatureC: Number(formData.ambientTempC) || null,
        humidityPercent: Number(formData.humidityPercent) || null,
        notes: formData.notes.trim() || null,
        loggedBy: user.uid,
        recordedByName: user.displayName || user.email || 'House Operator',
        syncStatus: 'synced',
        enterpriseType,
        flockAgeDays,
        flockAgeWeeks
      };

      // Enterprise Specific Embeds
      if (enterpriseType === 'commercial_layers') {
        logPayload.eggsCollected = {
          total: layerEggTotals,
          gradeA: Number(formData.eggsGradeA),
          gradeB: Number(formData.eggsGradeB),
          gradeC: Number(formData.eggsGradeC),
          cracked: Number(formData.cracked),
          dirty: Number(formData.dirty),
        };
      } else if (enterpriseType === 'broilers') {
        logPayload.broilerMetrics = {
          feedRationType: formData.feedRationType,
          sampleWeights: rawWeights,
          avgWeightG: broilerStats.avgWeightG,
          computedFCR: broilerStats.fcr
        };
      } else if (enterpriseType === 'improved_kienyeji') {
        logPayload.eggsCollected = {
          total: kienyejiEggTotals,
          fertilizedHatching: Number(formData.fertilizedHatchingEggs),
          tableEggs: Number(formData.kienyejiTableEggs),
          cracked: Number(formData.cracked)
        };
        logPayload.kienyejiTelemetry = {
          supplementaryGreensKg: Number(formData.supplementaryGreensKg),
          pastureGrazingHours: Number(formData.pastureGrazingHours),
          combCondition: formData.combCondition
        };
      }

      await submitDailyLog(db, {
        farmId,
        houseId,
        flockId,
        feedBatchId: selectedFeedBatchId || undefined,
        logData: logPayload,
      });

      toast({
        title: "Operational Log Committed",
        description: `Logged metrics for ${formData.date} across ${house?.houseName || 'Shed'}.`
      });

      // Clear operational inputs while preserving date and silo
      setFormData(prev => ({
        ...prev,
        mortalityCount: 0,
        cullCount: 0,
        feedConsumedKg: 0,
        waterConsumedLiters: 0,
        eggsGradeA: 0,
        eggsGradeB: 0,
        eggsGradeC: 0,
        cracked: 0,
        dirty: 0,
        fertilizedHatchingEggs: 0,
        kienyejiTableEggs: 0,
        sampleWeightsString: '',
        notes: ''
      }));
    } catch (err: any) {
      console.error("Log submission failed:", err);
      toast({
        title: "Error Recording Log",
        description: err.message || "Failed to commit log. Check connectivity.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">Connecting to shed stream...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-7xl">
      
      {/* 1. Header with Enterprise Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 bg-card p-6 rounded-3xl shadow-xs">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 mt-1">
            <Link href={`/farm/${farmId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                <ClipboardList className="h-7 w-7 text-primary" /> Daily Log Capture
              </h1>
              {isPendingSync && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px] font-bold">
                  <WifiOff className="h-3 w-3 mr-1" /> Offline Queued
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2 font-mono">
              <span className="font-bold text-foreground">{flock?.flockCode || 'Batch'}</span>
              <span>•</span>
              <span className="capitalize">{flock?.breed || 'Standard'}</span>
              <span>•</span>
              <span>Day {flockAgeDays} (Week {flockAgeWeeks})</span>
              <span>•</span>
              <Badge variant="secondary" className="capitalize text-[10px]">
                {enterpriseType.replace('_', ' ')}
              </Badge>
            </p>
          </div>
        </div>

        {/* Live Denormalized Status & Breed Benchmark Pill */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-muted/40 border border-border/80 p-3.5 px-5 rounded-2xl text-xs">
          <div>
            <span className="text-muted-foreground uppercase tracking-wider block text-[10px] font-bold">Live Birds</span>
            <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
              {flock?.currentBirdCount?.toLocaleString()}
            </span>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-4 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground uppercase tracking-wider block text-[10px] font-bold">
                {enterpriseType === 'broilers' ? 'Biomass Output' : 'Lifetime Output'}
              </span>
              <Badge 
                variant="outline" 
                className={`text-[9px] font-mono font-extrabold px-1.5 py-0 rounded-md ${
                  benchmarkStats.isAhead 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                }`}
              >
                {benchmarkStats.badgeText}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-black text-lg text-foreground">
                {benchmarkStats.currentVal.toLocaleString()} {benchmarkStats.unitLabel}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                / {benchmarkStats.forecastedLifetimeVal.toLocaleString()} Forecasted ({benchmarkStats.pctOfLifetimeTarget}%)
              </span>
            </div>
            
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-1">
              <div 
                className={`h-full transition-all duration-500 ${benchmarkStats.isAhead ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.max(3, Math.min(100, benchmarkStats.pctOfLifetimeTarget))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise ROI & Lifecycle Forecast Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/80 rounded-2xl shadow-xs">
          <CardHeader className="pb-1.5 p-4">
            <CardDescription className="text-[10px] font-mono uppercase tracking-wider font-bold flex items-center justify-between">
              Forecasted Cycle Revenue <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              KSh {benchmarkStats.forecastedGrossRevenueKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground font-medium">
              {enterpriseType === 'broilers' ? 'Target Liveweight Off-take' : 'Full Lay Cycle Egg Revenue'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 rounded-2xl shadow-xs">
          <CardHeader className="pb-1.5 p-4">
            <CardDescription className="text-[10px] font-mono uppercase tracking-wider font-bold flex items-center justify-between">
              Forecasted Feed Expense <Wheat className="w-4 h-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              KSh {benchmarkStats.forecastedFeedExpenseKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground font-medium">
              Expected Lifetime Silo Intake
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 rounded-2xl shadow-xs">
          <CardHeader className="pb-1.5 p-4">
            <CardDescription className="text-[10px] font-mono uppercase tracking-wider font-bold flex items-center justify-between">
              Projected Net Flock Margin <Sparkles className="w-4 h-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-xl font-black text-primary font-mono">
              KSh {benchmarkStats.forecastedNetMarginKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              +{benchmarkStats.netMarginPct}% Net Cycle Margin
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 rounded-2xl shadow-xs">
          <CardHeader className="pb-1.5 p-4">
            <CardDescription className="text-[10px] font-mono uppercase tracking-wider font-bold flex items-center justify-between">
              Standard Curve Benchmark <Layers className="w-4 h-4 text-sky-500" />
            </CardDescription>
            <CardTitle className="text-sm font-bold text-foreground truncate">
              {benchmarkStats.badgeText}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground font-medium">
              {benchmarkStats.subtext}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Automated Operational Schedule Carousel */}
      <Card className="rounded-3xl border-border/80 bg-card overflow-hidden">
        <CardHeader className="p-4 px-6 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Automated Operational Schedule
            </CardTitle>
            <CardDescription className="text-xs">
              Current Age: {flockAgeDays} Days ({Math.floor(flockAgeDays / 7)} Weeks & {flockAgeDays % 7} Days) • {enterpriseType.replace('_', ' ').toUpperCase()} Engine
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {scheduleMilestones.map((m, idx) => {
              const isPast = flockAgeDays > m.targetDay + 4;
              const isCurrent = Math.abs(flockAgeDays - m.targetDay) <= 3;
              return (
                <div 
                  key={idx}
                  className={`p-3.5 rounded-2xl border transition-all space-y-1.5 ${
                    isCurrent 
                      ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30" 
                      : isPast 
                      ? "bg-muted/10 border-border/60 opacity-70" 
                      : "bg-muted/30 border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      {isCurrent ? <Activity className="w-3.5 h-3.5 text-primary animate-pulse" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                      {m.title}
                    </span>
                    <Badge variant={isCurrent ? "default" : "outline"} className="text-[9px] font-mono">
                      {m.target}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 3. Main Operational Form & Ledger Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit}>
            <Card className="rounded-3xl border-border/80 bg-card overflow-hidden shadow-xs">
              <CardHeader className="pb-4 bg-muted/20 border-b border-border/60 px-6 py-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" /> Operational Entry
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter daily biological metrics and production figures for the date selected.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                
                {/* Diagnostics Alert Banner */}
                {diagnostics && (
                  <div
                    className={`p-4 rounded-2xl flex items-start gap-3 border transition-all ${
                      diagnostics.type === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                        : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                    }`}
                  >
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-current" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-sm">{diagnostics.title}</p>
                      <p className="leading-relaxed font-medium">{diagnostics.message}</p>
                    </div>
                  </div>
                )}

                {/* Log Date & Silo Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> Log Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      required
                      className="h-10 rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Wheat className="h-3.5 w-3.5" /> Deduct Feed From Silo
                    </Label>
                    <Select value={selectedFeedBatchId} onValueChange={setSelectedFeedBatchId}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                        <SelectValue placeholder="Select active feed batch" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {feedBatches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.feedType} ({Math.round(b.quantityRemainingKg).toLocaleString()} kg left)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Mortality & Culling */}
                <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-500" /> Flock Mortality & Depletion
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="mortalityCount" className="text-[11px] font-bold text-muted-foreground">Natural Deaths</Label>
                      <Input
                        id="mortalityCount"
                        type="number"
                        name="mortalityCount"
                        value={formData.mortalityCount || ''}
                        onChange={handleInputChange}
                        min={0}
                        placeholder="0"
                        className="h-10 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cullCount" className="text-[11px] font-bold text-muted-foreground">Deliberate Culls</Label>
                      <Input
                        id="cullCount"
                        type="number"
                        name="cullCount"
                        value={formData.cullCount || ''}
                        onChange={handleInputChange}
                        min={0}
                        placeholder="0"
                        className="h-10 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Resource Consumption */}
                <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-500" /> Resource Consumption
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="feedConsumedKg" className="text-[11px] font-bold text-muted-foreground">Feed Consumed (kg) *</Label>
                      <Input
                        id="feedConsumedKg"
                        type="number"
                        step="0.1"
                        name="feedConsumedKg"
                        value={formData.feedConsumedKg || ''}
                        onChange={handleInputChange}
                        min={0}
                        placeholder="0.0"
                        required
                        className="h-10 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="waterConsumedLiters" className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                        <span>Water Intake (Liters)</span>
                        <span className="text-[9px] font-mono opacity-70">Optional</span>
                      </Label>
                      <Input
                        id="waterConsumedLiters"
                        type="number"
                        step="1"
                        name="waterConsumedLiters"
                        value={formData.waterConsumedLiters || ''}
                        onChange={handleInputChange}
                        min={0}
                        placeholder="e.g. 1200"
                        className="h-10 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* DYNAMIC SECTION 1: Commercial Layers (Egg Grading) */}
                {enterpriseType === 'commercial_layers' && (
                  <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/60 pb-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Egg className="w-3.5 h-3.5 text-emerald-500" /> Egg Collection & Grading
                      </h4>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        Total: {layerEggTotals.toLocaleString()} Eggs ({(layerEggTotals / 30).toFixed(1)} Trays)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="eggsGradeA" className="text-[11px] font-bold text-muted-foreground">Grade A (Large)</Label>
                        <Input
                          id="eggsGradeA"
                          type="number"
                          name="eggsGradeA"
                          value={formData.eggsGradeA || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono text-center"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="eggsGradeB" className="text-[11px] font-bold text-muted-foreground">Grade B (Med)</Label>
                        <Input
                          id="eggsGradeB"
                          type="number"
                          name="eggsGradeB"
                          value={formData.eggsGradeB || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono text-center"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="eggsGradeC" className="text-[11px] font-bold text-muted-foreground">Grade C (Small)</Label>
                        <Input
                          id="eggsGradeC"
                          type="number"
                          name="eggsGradeC"
                          value={formData.eggsGradeC || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono text-center"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="cracked" className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Cracked / Damaged</Label>
                        <Input
                          id="cracked"
                          type="number"
                          name="cracked"
                          value={formData.cracked || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dirty" className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Dirty / Stained</Label>
                        <Input
                          id="dirty"
                          type="number"
                          name="dirty"
                          value={formData.dirty || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* DYNAMIC SECTION 2: Meat Broilers (Weight Sampling & Ration) */}
                {enterpriseType === 'broilers' && (
                  <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/60 pb-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Catch-Pen Weight Sampling & FCR
                      </h4>
                      <Badge variant="outline" className="font-mono text-xs">
                        Avg: {broilerStats.avgWeightG}g | FCR: {broilerStats.fcr}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Broiler Feeding Ration</Label>
                        <select
                          name="feedRationType"
                          value={formData.feedRationType}
                          onChange={(e: any) => setFormData(prev => ({ ...prev, feedRationType: e.target.value }))}
                          className="w-full h-10 px-3 bg-background border border-input rounded-xl text-xs font-semibold"
                        >
                          <option value="starter">Broiler Starter Crumbs (0–10 Days)</option>
                          <option value="grower">Broiler Grower Pellets (11–24 Days)</option>
                          <option value="finisher">Broiler Finisher Pellets (25–35 Days)</option>
                          <option value="withdrawal">Withdrawal Ration (Zero Meds pre-harvest)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Weighbridge Sample Array (Grams, comma-separated)</Label>
                        <Input
                          name="sampleWeightsString"
                          value={formData.sampleWeightsString}
                          onChange={handleInputChange}
                          placeholder="e.g. 1420, 1450, 1380, 1490"
                          className="h-10 rounded-xl font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* DYNAMIC SECTION 3: Improved Kienyeji (Dual Stream & Foraging) */}
                {enterpriseType === 'improved_kienyeji' && (
                  <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/60 pb-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <SunMedium className="w-3.5 h-3.5 text-amber-500" /> Kienyeji Dual Streams & Free-Range Run
                      </h4>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {kienyejiEggTotals} Total Eggs
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Fertilized Hatching Eggs (Premium)</Label>
                        <Input
                          type="number"
                          name="fertilizedHatchingEggs"
                          value={formData.fertilizedHatchingEggs || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Table / Commercial Eggs</Label>
                        <Input
                          type="number"
                          name="kienyejiTableEggs"
                          value={formData.kienyejiTableEggs || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0"
                          className="h-9 rounded-xl font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Greens & Kitchen Scratch (kg)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          name="supplementaryGreensKg"
                          value={formData.supplementaryGreensKg || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="0.0"
                          className="h-9 rounded-xl font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Pasture Run Grazing (Hours)</Label>
                        <Input
                          type="number"
                          name="pastureGrazingHours"
                          value={formData.pastureGrazingHours || ''}
                          onChange={handleInputChange}
                          min={0}
                          placeholder="4"
                          className="h-9 rounded-xl font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground">Comb & Health Inspection</Label>
                        <select
                          name="combCondition"
                          value={formData.combCondition}
                          onChange={(e: any) => setFormData(prev => ({ ...prev, combCondition: e.target.value }))}
                          className="w-full h-9 px-2.5 bg-background border border-input rounded-xl text-xs"
                        >
                          <option value="bright_red_healthy">Bright Red (Optimal)</option>
                          <option value="pale_anemic">Pale (Possible Mites/Worms)</option>
                          <option value="cyanotic_blue">Cyanotic / Blue (Vet Alert)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observations & Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-[11px] font-bold text-muted-foreground">Supervisor Notes / Biological Observations</Label>
                  <Input
                    id="notes"
                    type="text"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="e.g. Completed shed raking, drinker line flushed at 13:00"
                    className="h-10 rounded-xl"
                  />
                </div>

              </CardContent>

              <CardFooter className="pt-2 pb-6 px-6">
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-sm font-bold rounded-2xl shadow-sm">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Committing Operational Record...
                    </>
                  ) : (
                    'Commit Daily Operational Log'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        {/* Right Column: Historical Stream Ledger (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-3xl border-border/80 bg-card overflow-hidden shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20 px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Historical Ledger Stream
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">Previous 10 production entries</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {recentLogs.map((log) => {
                  const logHenDay = flock && flock.currentBirdCount > 0 && log.eggsCollected?.total
                    ? ((log.eggsCollected.total / flock.currentBirdCount) * 100).toFixed(1)
                    : null;

                  return (
                    <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{log.date}</span>
                            {log.isPending && (
                              <Badge variant="outline" className="text-[9px] text-amber-500 bg-amber-500/10 border-amber-500/30 py-0 px-1 font-bold uppercase">
                                Syncing
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground font-medium flex items-center gap-1.5 font-mono text-[11px]">
                            {log.eggsCollected?.total !== undefined ? (
                              <>
                                <Egg className="w-3 h-3 text-emerald-500" /> {log.eggsCollected.total.toLocaleString()} eggs
                              </>
                            ) : log.avgBodyWeightG ? (
                              <>
                                <Scale className="w-3 h-3 text-primary" /> {log.avgBodyWeightG}g avg
                              </>
                            ) : null}
                            <span className="opacity-50">|</span> 
                            <Wheat className="w-3 h-3 text-amber-500" /> {log.feedConsumedKg} kg
                          </p>
                        </div>

                        <div className="text-right space-y-1">
                          {logHenDay !== null ? (
                            <Badge variant="secondary" className="font-mono text-xs bg-primary/10 text-primary">
                              {logHenDay}% HD
                            </Badge>
                          ) : log.waterConsumedLiters ? (
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {log.waterConsumedLiters}L Water
                            </Badge>
                          ) : null}
                          <p className={`text-[10px] font-bold uppercase ${log.mortalityCount > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                            {log.mortalityCount > 0 ? `+${log.mortalityCount} Dead` : '0 Loss'}
                          </p>
                        </div>
                      </div>
                      
                      {log.notes && (
                        <p className="mt-2 text-[10px] text-muted-foreground border-l-2 border-border/80 pl-2">
                          "{log.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}

                {recentLogs.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground space-y-2">
                    <Info className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-xs font-semibold">No daily records logged for this flock yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
