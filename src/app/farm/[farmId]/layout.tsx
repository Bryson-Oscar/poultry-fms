"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import type { Farm, House, Flock, FeedBatch } from '@/services/ovocore/firebaseSchema';
import { OvoCoreHeader } from '@/components/ovocore/OvoCoreHeader';
import { MobileBottomNav } from '@/components/ovocore/MobileBottomNav';
import { 
  dispatchWhatsAppAdvisor, 
  FarmTelemetryContext 
} from '@/lib/ovocore/whatsappAdvisor';

export default function IndependentFarmLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const farmId = params?.farmId as string;

  const [farm, setFarm] = useState<Farm | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [feedBatches, setFeedBatches] = useState<FeedBatch[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [isPendingSync, setIsPendingSync] = useState(false);

  useEffect(() => {
    if (!farmId || !db) return;

    // 1. Subscribe to Farm Document
    const unsubFarm = onSnapshot(doc(db, 'farms', farmId), { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) {
        setFarm(snap.data() as Farm);
        setIsPendingSync(snap.metadata.hasPendingWrites);
      }
    }, (err) => console.warn("Farm sub error", err));

    // 2. Subscribe to Houses
    const unsubHouses = onSnapshot(collection(db, `farms/${farmId}/houses`), (snap) => {
      setHouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as House)));
    }, (err) => console.warn("Houses sub error", err));

    // 3. Subscribe to Silo Feed Batches
    const unsubFeed = onSnapshot(collection(db, `farms/${farmId}/feedBatches`), (snap) => {
      setFeedBatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedBatch)));
    }, (err) => console.warn("Feed sub error", err));

    // 4. Subscribe to Flocks
    const unsubFlocks = onSnapshot(collection(db, `farms/${farmId}/flocks`), (snap) => {
      setFlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Flock)));
    }, (err) => console.warn("Flocks sub error", err));

    return () => {
      unsubFarm();
      unsubHouses();
      unsubFeed();
      unsubFlocks();
    };
  }, [farmId]);

  // Aggregate Metrics for Intelligent Contextual Rules
  const telemetry = useMemo((): FarmTelemetryContext => {
    const totalFeedKg = feedBatches.reduce((acc, b) => acc + (b.quantityRemainingKg || 0), 0);
    const activeFlocksList = flocks.filter(f => f.status === 'active');
    const activeFlockCount = activeFlocksList.length || houses.filter(h => !!h.currentFlockId).length;
    
    const liveBirdsCount = activeFlocksList.reduce((acc, f) => acc + (f.currentBirdCount || 0), 0);
    const birdBaseline = liveBirdsCount > 0 ? liveBirdsCount : 5000;
    const dailyDemandKg = birdBaseline * 0.12; // 120g/bird/day baseline
    const daysOfFeed = dailyDemandKg > 0 ? Math.floor(totalFeedKg / dailyDemandKg) : 999;

    let currentPage: FarmTelemetryContext['currentPage'] = 'farm_dashboard';
    if (pathname.includes('/inventory')) currentPage = 'inventory';
    if (pathname.includes('/finance')) currentPage = 'finance';

    // Calculate mortality rate from active flocks
    let totalInitial = 0;
    let totalMortality = 0;
    activeFlocksList.forEach(f => {
      totalInitial += (f.initialBirdCount || 0);
      totalMortality += (f.cumulativeMortality || 0);
    });
    const mortalityRatePct = totalInitial > 0 ? Number(((totalMortality / totalInitial) * 100).toFixed(1)) : 2.1;

    // Resolve farm owner phone number from profile metadata
    const resolvedOwnerPhone = 
      farm?.ownerContact?.phone || 
      (farm as any)?.ownerPhone || 
      (farm as any)?.phone || 
      (auth?.currentUser?.phoneNumber || '');

    return {
      farmId,
      farmName: farm?.name || "OvoCore Farm",
      ownerName: farm?.ownerName || farm?.ownerContact?.name || "Farm Owner",
      ownerPhone: resolvedOwnerPhone,
      houseCount: houses.length,
      activeFlockCount,
      totalFeedKg,
      daysOfFeed,
      mortalityRatePct,
      unrecordedDays: 0,
      unsettledCreditKES: 45000,
      currentPage,
    };
  }, [farm, houses, feedBatches, flocks, farmId, pathname]);

  const handleTriggerAdvisor = () => {
    dispatchWhatsAppAdvisor(telemetry);
  };
  const computedAlerts = useMemo(() => {
    const alerts = [];
    if (telemetry.daysOfFeed <= 3) {
      alerts.push({
        id: 'low-feed',
        title: 'Low Feed Stock',
        description: `You have ${telemetry.daysOfFeed} days of feed remaining for your active flocks.`,
        href: `/farm/${farmId}/inventory`
      });
    }
    if (telemetry.mortalityRatePct > 1.5) {
      alerts.push({
        id: 'high-mortality',
        title: 'High Mortality Rate',
        description: `Your aggregate mortality rate is ${telemetry.mortalityRatePct}%. Check biosecurity.`,
        href: `/farm/${farmId}`
      });
    }
    return alerts;
  }, [telemetry, farmId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <OvoCoreHeader
        farmId={farmId}
        farmName={farm?.name}
        ownerPhone={telemetry.ownerPhone}
        isPendingSync={isPendingSync}
        activeFlockCount={telemetry.activeFlockCount}
        alerts={computedAlerts}
        onTriggerAdvisor={handleTriggerAdvisor}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>
      <MobileBottomNav farmId={farmId} />
    </div>
  );
}
