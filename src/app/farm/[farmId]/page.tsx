"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { auth, db } from '@/lib/firebase';
import { checkUserFarmAccess, FarmAccessResult } from '@/services/userService';
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import type { Farm, House, Flock, FeedBatch } from '@/services/ovocore/firebaseSchema';
import {
  WifiOff,
  Users,
  Plus,
  Building2,
  Egg,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Activity,
  Wheat,
  Scale,
  TrendingUp,
  HeartPulse,
  Share2,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  Coins,
  ChevronRight,
  Filter,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

import { AddHouseModal } from '@/components/ovocore/AddHouseModal';
import { AddFlockModal } from '@/components/ovocore/AddFlockModal';
import { LogComplianceEventModal } from '@/components/ovocore/LogComplianceEventModal';
import { RecordBroilerSaleModal } from '@/components/ovocore/RecordBroilerSaleModal';
import { AddEggSaleModal } from '@/components/ovocore/AddEggSaleModal';
import { OvoCoreUpsell } from '@/components/ovocore/OvoCoreUpsell';
import { FarmOperatorsModal } from '@/components/ovocore/FarmOperatorsModal';
import FarmTeamOnboardingModal from '@/components/ovocore/FarmTeamOnboardingModal';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import { useToast } from '@/hooks/use-toast';
import { PredictiveOperationsBanner } from '@/components/ovocore/PredictiveOperationsBanner';
import { FarmSetupWizardBanner } from '@/components/ovocore/FarmSetupWizardBanner';
import { SanitaryClearanceModal } from '@/components/ovocore/SanitaryClearanceModal';
import { FeedQualityInspectorModal } from '@/components/ovocore/FeedQualityInspectorModal';
import type { HouseSanitationState } from '@/types/ovocoreAutonomy';

interface HouseWithFlock extends House {
  id: string;
  activeFlock?: (Flock & { id: string });
  sanitationState?: HouseSanitationState;
}

function FarmDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const farmId = params?.farmId as string;
  const { toast } = useToast();
  const router = useRouter();

  const [farm, setFarm] = useState<(Farm & { id: string }) | null>(null);
  const [houses, setHouses] = useState<HouseWithFlock[]>([]);
  const [feedBatches, setFeedBatches] = useState<(FeedBatch & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<FarmAccessResult | null>(null);

  // Modal States
  const [isAddHouseOpen, setIsAddHouseOpen] = useState(false);
  const [isPlaceFlockOpen, setIsPlaceFlockOpen] = useState(false);
  const [selectedHouseForFlock, setSelectedHouseForFlock] = useState<HouseWithFlock | null>(null);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [isRecordBroilerSaleOpen, setIsRecordBroilerSaleOpen] = useState(false);
  const [isAddEggSaleOpen, setIsAddEggSaleOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isOperatorsModalOpen, setIsOperatorsModalOpen] = useState(false);
  const [isSanitaryModalOpen, setIsSanitaryModalOpen] = useState(false);
  const [selectedHouseForSanitation, setSelectedHouseForSanitation] = useState<HouseWithFlock | null>(null);
  const [isFeedInspectorOpen, setIsFeedInspectorOpen] = useState(false);

  // Filter state
  const [houseFilter, setHouseFilter] = useState<'all' | 'active' | 'vacant'>('all');
  const [copiedId, setCopiedId] = useState(false);

  // Operational Mode & Workflow Isolation
  const operationalMode = useMemo(() => {
    const categories = new Set<string>();
    houses.forEach(h => {
      if (h.activeFlock?.category) {
        categories.add(h.activeFlock.category);
      }
    });

    const farmType = farm?.flockType || 'layers';
    const hasLayerFlock = categories.has('commercial_layers') || categories.has('dual_purpose_kienyeji');
    const hasBroilerFlock = categories.has('broilers');

    // Operational Rules:
    // Egg sales allowed if farm is layer/mixed OR if any house currently has an active layer flock
    const canSellEggs = farmType !== 'broilers' || hasLayerFlock;

    // Broiler harvest allowed if farm is broiler OR if any house currently has an active broiler flock
    const canHarvestBroilers = farmType === 'broilers' || hasBroilerFlock;

    return {
      farmType,
      hasLayerFlock,
      hasBroilerFlock,
      canSellEggs,
      canHarvestBroilers
    };
  }, [farm, houses]);

  // Deep Link Query Parameter Action Handlers (e.g. ?action=add_house)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add_house') {
      setIsAddHouseOpen(true);
    } else if (action === 'place_flock') {
      setIsPlaceFlockOpen(true);
    } else if (action === 'log_compliance') {
      setIsComplianceModalOpen(true);
    } else if (action === 'record_broiler_sale') {
      router.push(`/farm/${farmId}/finance?action=record_broiler_sale`);
    } else if (action === 'log_egg_sale' && operationalMode.canSellEggs) {
      setIsAddEggSaleOpen(true);
    }
  }, [searchParams, operationalMode, farmId, router]);

  useEffect(() => {
    if (!farmId) return;

    let isMounted = true;
    let unsubFarm: Unsubscribe;
    let unsubFeed: Unsubscribe;
    let unsubHouses: Unsubscribe;

    const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!isMounted) return;
      if (currentUser) {
        const check = await checkUserFarmAccess(currentUser, farmId);
        if (isMounted) setAccessResult(check);
      } else {
        if (isMounted) {
          setAccessResult({
            hasAccess: false,
            isAdmin: false,
            assignedFarmId: null,
            reason: 'Authentication required to view farm dashboard.'
          });
        }
      }
    });

    // 1. Real-time Farm Metadata Listener
    const farmRef = doc(db, 'farms', farmId);
    updateDoc(farmRef, { lastActiveAt: serverTimestamp() }).catch(() => {});
    unsubFarm = onSnapshot(
      farmRef,
      { includeMetadataChanges: true },
      (docSnap) => {
        if (!isMounted) return;
        if (docSnap.exists()) {
          const farmData = docSnap.data() as Farm;
          setFarm({ id: docSnap.id, ...farmData });
          setIsPendingSync(docSnap.metadata.hasPendingWrites);

          if (farmData.status === 'pending_onboarding') {
            const cacheKey = `ovocore_onboarded_pop_${docSnap.id}`;
            if (typeof window !== 'undefined' && !localStorage.getItem(cacheKey)) {
              setIsOnboardingModalOpen(true);
              localStorage.setItem(cacheKey, 'true');
            }
          }
        } else {
          setError('Farm document not found.');
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Farm listener error:", err);
        if (isMounted) {
          setError("Failed to load farm details.");
          setIsLoading(false);
        }
      }
    );

    // 2. Real-time Feed Inventory Subcollection Listener
    const feedRef = collection(db, `farms/${farmId}/feedBatches`);
    unsubFeed = onSnapshot(feedRef, (snapshot) => {
      if (!isMounted) return;
      const batches = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as (FeedBatch & { id: string })
      );
      setFeedBatches(batches);
    });

    // 3. Real-time Houses & Active Flocks Resolver
    const housesRef = collection(db, `farms/${farmId}/houses`);
    unsubHouses = onSnapshot(
      housesRef,
      { includeMetadataChanges: true },
      async (snapshot) => {
        if (!isMounted) return;
        try {
          const rawHouses = snapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as HouseWithFlock
          );

          const populatedHouses = await Promise.all(
            rawHouses.map(async (house) => {
              if (!house.currentFlockId) return house;

              try {
                const flockDocRef = doc(
                  db,
                  `farms/${farmId}/houses/${house.id}/flocks/${house.currentFlockId}`
                );
                const flockSnap = await getDoc(flockDocRef);

                if (flockSnap.exists()) {
                  return {
                    ...house,
                    activeFlock: { id: flockSnap.id, ...(flockSnap.data() as Flock) }
                  };
                }
              } catch (flockErr) {
                console.warn(`Could not resolve flock ${house.currentFlockId}:`, flockErr);
              }
              return house;
            })
          );

          if (isMounted) {
            setHouses(populatedHouses);
            setIsPendingSync(snapshot.metadata.hasPendingWrites);
          }
        } catch (err) {
          console.error("Houses processing error:", err);
        }
      }
    );

    return () => {
      isMounted = false;
      if (unsubAuth) unsubAuth();
      if (unsubFarm) unsubFarm();
      if (unsubFeed) unsubFeed();
      if (unsubHouses) unsubHouses();
    };
  }, [farmId]);

  // Aggregated Telemetry Calculations
  const metrics = useMemo(() => {
    let totalBirds = 0;
    let totalCapacity = 0;
    let activeFlocksCount = 0;
    let cumulativeMortality = 0;

    houses.forEach((h) => {
      totalCapacity += h.capacityBirds || 0;
      if (h.activeFlock) {
        activeFlocksCount++;
        totalBirds += h.activeFlock.currentBirdCount || 0;
        cumulativeMortality += h.activeFlock.cumulativeMortality || 0;
      }
    });

    const occupancyRate = totalCapacity > 0 ? (totalBirds / totalCapacity) * 100 : 0;
    const totalSiloFeedKg = feedBatches.reduce((acc, b) => acc + (b.quantityRemainingKg || 0), 0);

    const baselineDailyFeedDemandKg = (totalBirds || 5000) * 0.12; // 120g/bird
    const daysOfFeedRemaining = baselineDailyFeedDemandKg > 0
      ? Math.floor(totalSiloFeedKg / baselineDailyFeedDemandKg)
      : 999;

    return {
      totalBirds,
      totalCapacity,
      occupancyRate,
      activeFlocksCount,
      totalSiloFeedKg,
      daysOfFeedRemaining,
      cumulativeMortality
    };
  }, [houses, feedBatches]);

  const filteredHouses = useMemo(() => {
    return houses.filter(h => {
      if (houseFilter === 'active') return !!h.currentFlockId;
      if (houseFilter === 'vacant') return !h.currentFlockId;
      return true;
    });
  }, [houses, houseFilter]);

  const copyToClipboard = () => {
    if (!farmId) return;
    navigator.clipboard.writeText(farmId);
    setCopiedId(true);
    toast({ title: "Copied!", description: "Farm ID copied to clipboard." });
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleOpenPlaceFlockModal = (house?: HouseWithFlock) => {
    if (house) setSelectedHouseForFlock(house);
    setIsPlaceFlockOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <PeckingChickenLoader />
        <p className="mt-4 text-xs font-mono text-slate-400 animate-pulse">
          Connecting to OvoCore Telemetry & Live Shed Sensors...
        </p>
      </div>
    );
  }

  if (accessResult && !accessResult.hasAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 space-y-4">
        <ShieldAlert className="w-14 h-14 text-rose-500 animate-pulse" />
        <h2 className="text-2xl font-black text-white">Access Denied: Restricted Farm</h2>
        <p className="text-slate-400 text-sm max-w-lg text-center">
          {accessResult.reason || "Regular users only have access to their specific assigned or owned farm. Only system administrators have overall visibility across all farms."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {accessResult.assignedFarmId ? (
            <Button
              onClick={() => router.push(`/farm/${accessResult.assignedFarmId}`)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
            >
              Go to My Assigned Farm
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
            >
              Return to Portfolio Console
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (error || !farm) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 animate-bounce" />
        <h2 className="text-xl font-bold text-white">Farm Workspace Not Available</h2>
        <p className="text-slate-400 text-sm max-w-md text-center">{error || "The requested farm ID could not be loaded."}</p>
        <Button onClick={() => router.push('/')} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl">
          Return to Portfolio Console
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Farm Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/ovocore" className="text-slate-400 hover:text-amber-400 transition-colors text-xs flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> All Farms
            </Link>
            <span className="text-slate-600">•</span>
            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
              {farm.county || 'Kenyan Region'}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            {farm.name}
            {isPendingSync && (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" /> Offline Queue
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            ID: {farm.id} • Owner: <span className="text-slate-200">{farm.ownerName || farm.ownerContact?.name || 'Farm Manager'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <Button
            onClick={() => setIsAddHouseOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl h-10 px-4 shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Production Shed
          </Button>

          <Button
            onClick={() => handleOpenPlaceFlockModal()}
            disabled={houses.length === 0}
            variant="secondary"
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl h-10 px-4"
          >
            <Egg className="w-4 h-4 mr-1.5 text-amber-400" /> Stock Flock Batch
          </Button>

          {operationalMode.canSellEggs && (
            <AddEggSaleModal
              farmId={farmId}
            />
          )}

          <Button
            onClick={() => setIsComplianceModalOpen(true)}
            variant="outline"
            className="border-slate-800 text-rose-300 hover:bg-rose-500/10 text-xs rounded-xl h-10"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5" /> Log Vet Inspection
          </Button>

          <Button
            onClick={() => {
              if(confirm("DPA 2019 Right to Erasure: This will permanently purge all PII associated with this farm workspace. Aggregate data will be anonymized. Proceed?")) {
                console.log("Purge Prospect Data Triggered");
                // Implementation would go here
              }
            }}
            variant="ghost"
            className="border border-rose-900/50 text-rose-500 hover:bg-rose-950 hover:text-rose-400 text-[10px] rounded-xl h-10 px-3 uppercase tracking-wider font-bold"
          >
            Purge Data
          </Button>
        </div>
      </div>
      {/* Farm Setup & Onboarding Completeness Guidance Banner */}
      <FarmSetupWizardBanner
        farmId={farmId}
        farmName={farm.name}
        houseCount={houses.length}
        flockCount={houses.filter(h => h.activeFlock).length}
        feedBatchCount={feedBatches.length}
        onOpenAddHouse={() => setIsAddHouseOpen(true)}
        onOpenAddFlock={() => handleOpenPlaceFlockModal()}
        onOpenAddFeed={() => setIsFeedInspectorOpen(true)}
        onOpenInviteTeam={() => setIsOperatorsModalOpen(true)}
      />

      {/* Predictive Operations & Autonomous Directives Banner */}
      <PredictiveOperationsBanner
        farmType={operationalMode.farmType === 'broilers' ? 'broilers' : 'layers'}
        activeHouse={houses[0]}
        activeFlock={houses[0]?.activeFlock}
        onOpenSopModal={(actionKey) => {
          if (actionKey === 'sanitary-downtime') {
            setSelectedHouseForSanitation(houses[0]);
            setIsSanitaryModalOpen(true);
          } else if (actionKey.includes('feed') || actionKey.includes('ration')) {
            setIsFeedInspectorOpen(true);
          } else {
            setIsComplianceModalOpen(true);
          }
        }}
      />

      {/* Biosecurity & Telemetry Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Total Birds & Capacity <Egg className="w-4 h-4 text-sky-400" />
            </CardDescription>
            <CardTitle className={`text-2xl font-black ${metrics.occupancyRate > 100 ? 'text-rose-500' : metrics.occupancyRate > 80 ? 'text-emerald-400' : 'text-sky-400'}`}>
              {metrics.totalBirds.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ {metrics.totalCapacity.toLocaleString()}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={Math.min(100, metrics.occupancyRate)} className="h-1.5 bg-slate-800" />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span className={metrics.occupancyRate > 100 ? 'text-rose-500 font-bold' : metrics.occupancyRate > 80 ? 'text-emerald-400 font-bold' : ''}>
                Occupancy: {metrics.occupancyRate.toFixed(1)}%
              </span>
              <span>{houses.length} Houses</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Silo Feed Inventory <Wheat className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className={`text-2xl font-black ${metrics.daysOfFeedRemaining <= 3 ? 'text-rose-500 animate-pulse' : metrics.daysOfFeedRemaining <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {metrics.totalSiloFeedKg.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kg</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={metrics.daysOfFeedRemaining <= 3 ? "text-rose-500 font-black" : metrics.daysOfFeedRemaining <= 7 ? "text-amber-400" : "text-emerald-400"}>
                {metrics.daysOfFeedRemaining <= 900 ? `${metrics.daysOfFeedRemaining} Days Remaining` : 'Stock Active'}
              </span>
              <Link href={`/farm/${farmId}/inventory`} className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline">
                Manage Silos &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Active Flocks <Layers className="w-4 h-4 text-indigo-400" />
            </CardDescription>
            <CardTitle className={`text-2xl font-black ${metrics.activeFlocksCount > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>
              {metrics.activeFlocksCount} <span className="text-xs text-slate-500 font-normal">Batches</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xs font-medium ${metrics.activeFlocksCount > 0 ? 'text-indigo-300' : 'text-slate-400'}`}>
              {metrics.activeFlocksCount === 0 ? "No flock currently stocked" : "Active production layers"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Cashflow & Ledger <Coins className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-400">
              Finance <span className="text-xs text-emerald-600/50 font-normal">Center</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/farm/${farmId}/finance`} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1">
              View Egg Revenue & Opex &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Production Houses List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" /> Production Houses & Laying Sheds
            </h2>
            <p className="text-slate-400 text-xs">Manage shed capacities, environmental ventilation, and active layer flock batches.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={houseFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setHouseFilter('all')}
              size="sm"
              className={houseFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-400'}
            >
              All ({houses.length})
            </Button>
            <Button
              variant={houseFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setHouseFilter('active')}
              size="sm"
              className={houseFilter === 'active' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-400'}
            >
              Active Flocks ({houses.filter(h => !!h.currentFlockId).length})
            </Button>
            <Button
              variant={houseFilter === 'vacant' ? 'default' : 'outline'}
              onClick={() => setHouseFilter('vacant')}
              size="sm"
              className={houseFilter === 'vacant' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-400'}
            >
              Vacant ({houses.filter(h => !h.currentFlockId).length})
            </Button>
          </div>
        </div>

        {filteredHouses.length === 0 ? (
          <Card className="bg-slate-900/60 border-slate-800 text-center py-12 rounded-3xl">
            <CardContent className="space-y-3">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Houses Found</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                No production sheds match the selected filter or exist in this farm yet.
              </p>
              <Button
                onClick={() => setIsAddHouseOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Register Production Shed
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHouses.map((house) => {
              const hasActiveFlock = !!house.activeFlock;
              return (
                <Card
                  key={house.id}
                  className="bg-slate-900 border-slate-800 text-white rounded-3xl overflow-hidden hover:border-amber-500/50 transition-all flex flex-col shadow-xl"
                >
                  <CardHeader className="border-b border-slate-800 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-400" /> {house.houseName}
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs capitalize mt-0.5">
                          {house.ventilationType} Ventilation • Cap: {house.capacityBirds?.toLocaleString()} Birds
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={hasActiveFlock ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]" : "border-slate-700 text-slate-400 text-[10px]"}
                      >
                        {hasActiveFlock ? "Occupied" : "Vacant"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="py-4 flex-1 space-y-3">
                    {house.activeFlock ? (
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-400">{house.activeFlock.flockCode}</span>
                          <span className="text-[10px] font-mono text-slate-400">{house.activeFlock.breed}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1 border-t border-slate-900">
                          <div>
                            <span className="text-slate-500 block text-[9px]">Live Birds</span>
                            <span className="text-slate-200 font-bold">{house.activeFlock.currentBirdCount?.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">Cumulative Mortality</span>
                            <span className="text-rose-400 font-bold">{house.activeFlock.cumulativeMortality || 0}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                        <p className="text-xs text-slate-400">Shed is empty and available for batch placement.</p>
                        <Button
                          onClick={() => handleOpenPlaceFlockModal(house)}
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
                        >
                          <Egg className="w-3.5 h-3.5 mr-1" /> Stock Flock
                        </Button>
                      </div>
                    )}
                  </CardContent>

                  {house.activeFlock && (
                    <CardFooter className="bg-slate-950 border-t border-slate-800 p-3">
                      <Link
                        href={`/flock/${farmId}/${house.id}/${house.activeFlock.id}`}
                        className="w-full"
                      >
                        <Button
                          variant="outline"
                          className="w-full border-slate-800 text-slate-200 hover:bg-slate-900 hover:text-amber-400 font-bold text-xs rounded-xl h-9"
                        >
                          <Activity className="w-3.5 h-3.5 mr-1.5" /> View Daily Log & Telemetry
                        </Button>
                      </Link>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {isAddHouseOpen && (
        <AddHouseModal
          isOpen={isAddHouseOpen}
          onClose={() => setIsAddHouseOpen(false)}
          farmId={farmId}
        />
      )}

      {isPlaceFlockOpen && (
        <AddFlockModal
          isOpen={isPlaceFlockOpen}
          onClose={() => {
            setIsPlaceFlockOpen(false);
            setSelectedHouseForFlock(null);
          }}
          farmId={farmId}
          initialHouseId={selectedHouseForFlock?.id}
        />
      )}

      {isRecordBroilerSaleOpen && (
        <RecordBroilerSaleModal
          isOpen={isRecordBroilerSaleOpen}
          onClose={() => setIsRecordBroilerSaleOpen(false)}
          farmId={farmId}
        />
      )}

      {isComplianceModalOpen && (
        <LogComplianceEventModal
          isOpen={isComplianceModalOpen}
          onClose={() => setIsComplianceModalOpen(false)}
          farmId={farmId}
        />
      )}

      {isOnboardingModalOpen && (
        <FarmTeamOnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
          farmId={farmId}
        />
      )}

      {isOperatorsModalOpen && (
        <FarmOperatorsModal
          isOpen={isOperatorsModalOpen}
          onClose={() => setIsOperatorsModalOpen(false)}
          farmId={farmId}
        />
      )}

      {selectedHouseForSanitation && (
        <SanitaryClearanceModal
          farmId={farmId}
          houseId={selectedHouseForSanitation.id}
          houseName={selectedHouseForSanitation.houseName}
          isOpen={isSanitaryModalOpen}
          onClose={() => {
            setIsSanitaryModalOpen(false);
            setSelectedHouseForSanitation(null);
          }}
          currentState={selectedHouseForSanitation.sanitationState}
        />
      )}

      {isFeedInspectorOpen && (
        <FeedQualityInspectorModal
          isOpen={isFeedInspectorOpen}
          onClose={() => setIsFeedInspectorOpen(false)}
          feedType={operationalMode.farmType === 'broilers' ? 'Broiler Grower Pellets' : 'Layer Phase 1 Mash'}
          onApproveDelivery={(qa) => {
            toast({
              title: "Silo Intake Approved",
              description: `Moisture: ${qa.moisturePct}%, Protein: ${qa.crudeProteinPct}%, Aflatoxin: ${qa.aflatoxinPpb} ppb.`
            });
          }}
        />
      )}
    </div>
  );
}

export default function OvoCoreFarmDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <PeckingChickenLoader />
      </div>
    }>
      <FarmDashboardContent />
    </Suspense>
  );
}
