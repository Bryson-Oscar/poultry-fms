"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  getDocs,
  Unsubscribe
} from 'firebase/firestore';
import type { FeedBatch, House, Flock } from '@/services/ovocore/firebaseSchema';
import {
  Loader2,
  ArrowLeft,
  Wheat,
  Scale,
  Coins,
  AlertTriangle,
  TrendingDown,
  Truck,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Barcode,
  Building,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Flame,
  Info
} from 'lucide-react';
import { AddFeedBatchModal } from '@/components/ovocore/AddFeedBatchModal';
import { computeFlockRequirements, BirdCategory } from '@/lib/ovocore/flockLifecycleEngine';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';

interface EnhancedFeedBatch extends FeedBatch {
  id: string;
  batchNumber: string | null;
  proteinPercentage?: number;
  energyKcal?: number;
  deliveryNoteNumber?: string;
  expiryDate?: any;
  storageSiloId?: string;
  supplierName?: string;
}

function FeedInventoryContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const farmId = params?.farmId as string;

  const [batches, setBatches] = useState<EnhancedFeedBatch[]>([]);
  const [totalLiveBirds, setTotalLiveBirds] = useState<number>(0);
  const [dailyFlockFeedNeedKg, setDailyFlockFeedNeedKg] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'depleted' | 'analytics'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeedTypeFilter, setSelectedFeedTypeFilter] = useState<string>('all');
  const [isAddFeedModalOpen, setIsAddFeedModalOpen] = useState(false);

  // Deep Link Action Handler
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'receive_feed') {
      setIsAddFeedModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!farmId) return;

    let isMounted = true;
    let unsubFeed: Unsubscribe;
    let unsubHouses: Unsubscribe;

    // 1. Subscribe to Feed Batches
    const feedRef = collection(db, `farms/${farmId}/feedBatches`);
    unsubFeed = onSnapshot(feedRef, (snapshot) => {
      if (!isMounted) return;
      const b = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EnhancedFeedBatch));

      b.sort((x, y) => {
        const dateX = x.dateReceived?.toDate ? x.dateReceived.toDate() : new Date((x.dateReceived as any) || Date.now());
        const dateY = y.dateReceived?.toDate ? y.dateReceived.toDate() : new Date((y.dateReceived as any) || Date.now());
        return dateY.getTime() - dateX.getTime();
      });

      setBatches(b);
      setIsLoading(false);
    }, (err) => {
      console.error("Feed inventory error:", err);
      if (isMounted) setIsLoading(false);
    });

    // 2. Resolve Live Birds & Daily Feed Demand
    const housesRef = collection(db, `farms/${farmId}/houses`);
    unsubHouses = onSnapshot(housesRef, async (snapshot) => {
      if (!isMounted) return;
      try {
        let totalBirds = 0;
        let totalDailyKg = 0;

        for (const houseDoc of snapshot.docs) {
          const house = houseDoc.data() as House;
          if (house.currentFlockId) {
            const flockSnap = await getDocs(collection(db, `farms/${farmId}/houses/${houseDoc.id}/flocks`));
            flockSnap.docs.forEach(fd => {
              const flock = fd.data() as Flock;
              if (flock.status !== 'culled' && flock.status !== 'sold') {
                const birds = flock.currentBirdCount || 0;
                totalBirds += birds;
                
                // Category-based intake rates (kg/bird/day)
                const cat = (flock.category || '').toLowerCase();
                const rate = cat.includes('broiler') ? 0.13 : (cat.includes('kienyeji') ? 0.09 : 0.115);
                totalDailyKg += birds * rate;
              }
            });
          }
        }

        if (isMounted) {
          setTotalLiveBirds(totalBirds);
          setDailyFlockFeedNeedKg(totalDailyKg);
        }
      } catch (err) {
        console.warn("Error computing bird feed demand:", err);
      }
    });

    return () => {
      isMounted = false;
      if (unsubFeed) unsubFeed();
      if (unsubHouses) unsubHouses();
    };
  }, [farmId]);

  // Aggregated Feed Telemetry
  const telemetry = useMemo(() => {
    const activeBatches = batches.filter(b => (b.quantityRemainingKg || 0) > 0);
    const depletedBatches = batches.filter(b => (b.quantityRemainingKg || 0) <= 0);

    const totalStoredFeedKg = activeBatches.reduce((acc, b) => acc + (b.quantityRemainingKg || 0), 0);
    const totalInvestedKES = batches.reduce((acc, b) => acc + ((b.quantityReceivedKg || 0) * (b.costPerKg || 0)), 0);
    const remainingValueKES = activeBatches.reduce((acc, b) => acc + ((b.quantityRemainingKg || 0) * (b.costPerKg || 0)), 0);

    const dailyNeed = dailyFlockFeedNeedKg;
    const daysOfFeed = dailyNeed > 0 ? Math.floor(totalStoredFeedKg / dailyNeed) : (totalStoredFeedKg > 0 ? Infinity : 0);

    return {
      activeBatches,
      depletedBatches,
      totalStoredFeedKg,
      totalInvestedKES,
      remainingValueKES,
      daysOfFeed,
      dailyNeed
    };
  }, [batches, dailyFlockFeedNeedKg]);

  const filteredBatches = useMemo(() => {
    const list = activeTab === 'active' ? telemetry.activeBatches : telemetry.depletedBatches;
    return list.filter(b => {
      const matchesSearch = (b.feedType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (b.batchNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (b.supplierId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedFeedTypeFilter === 'all' || b.feedType === selectedFeedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [telemetry, activeTab, searchQuery, selectedFeedTypeFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <PeckingChickenLoader />
        <p className="mt-4 text-xs font-mono text-slate-400 animate-pulse">
          Retrieving Silo Telemetry & Delivery Records...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <Link href={`/farm/${farmId}`} className="text-slate-400 hover:text-amber-400 transition-colors text-xs flex items-center gap-1 font-bold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Farm Control Room
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Wheat className="w-7 h-7 text-amber-400" /> Silo & Feed Inventory
          </h1>
          <p className="text-xs text-slate-400">
            Real-time feed silo tracking, miller delivery batches, and biosecurity runway telemetry.
          </p>
        </div>

        <Button
          onClick={() => setIsAddFeedModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl h-10 px-4 shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Log Feed Delivery Batch
        </Button>
      </div>

      {/* Silo Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Total Stored Feed <Scale className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-amber-400">
              {telemetry.totalStoredFeedKg.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kg</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">
              Across {telemetry.activeBatches.length} active silo batches
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Silo Feed Runway <Clock className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-white">
              {telemetry.daysOfFeed === Infinity ? '∞' : telemetry.daysOfFeed} <span className="text-xs text-slate-400 font-normal">Days Remaining</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <span className={telemetry.daysOfFeed <= 3 ? "text-rose-400 font-bold text-xs animate-pulse block" : "text-emerald-400 text-xs font-bold block"}>
              {telemetry.daysOfFeed === Infinity 
                ? "No active flocks consuming feed"
                : telemetry.daysOfFeed <= 3 
                  ? "🚨 Restock Required Immediately" 
                  : "Biosecurity Runway Healthy"}
            </span>
            <p className="text-[10px] text-slate-400 font-mono">
              {telemetry.totalStoredFeedKg.toLocaleString()} kg stored ÷ {Math.round(telemetry.dailyNeed).toLocaleString()} kg/day burn
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Daily Feed Demand <Flame className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-white">
              {Math.round(telemetry.dailyNeed).toLocaleString()} <span className="text-xs text-slate-400 font-normal">kg / day</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 font-mono">
              Based on {totalLiveBirds.toLocaleString()} active birds
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Stored Asset Value <Coins className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-400">
              KSh {telemetry.remainingValueKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">
              Total Feed Asset Inventory
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Delivery Batches */}
      <Card className="bg-slate-900 border-slate-800 text-white rounded-3xl shadow-xl">
        <CardHeader className="pb-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" /> Feed Deliveries & Silo Batches
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Track feed formulations, batch numbers, remaining quantities, and unit costs.
            </CardDescription>
          </div>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full md:w-auto">
            <TabsList className="bg-slate-950 border border-slate-800 rounded-xl p-1">
              <TabsTrigger value="active" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                Active Batches ({telemetry.activeBatches.length})
              </TabsTrigger>
              <TabsTrigger value="depleted" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                Depleted History ({telemetry.depletedBatches.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search feed type, batch #, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs"
            />
          </div>

          {filteredBatches.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Wheat className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Feed Batches Found</h4>
              <p className="text-slate-400 text-xs">No batches match the selected tab or search query.</p>
              <Button
                onClick={() => setIsAddFeedModalOpen(true)}
                size="sm"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Log Feed Delivery
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBatches.map((batch) => {
                const pctRemaining = batch.quantityReceivedKg > 0
                  ? Math.min(100, Math.max(0, (batch.quantityRemainingKg / batch.quantityReceivedKg) * 100))
                  : 0;

                return (
                  <Card key={batch.id} className="bg-slate-950 border-slate-800 text-white rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] uppercase font-mono font-bold mb-1">
                          {batch.feedType || 'Layer Mash'}
                        </Badge>
                        <h4 className="font-bold text-white text-sm">
                          Batch #{batch.batchNumber || batch.id.substring(0, 8)}
                        </h4>
                      </div>
                      <span className="text-emerald-400 font-black text-xs font-mono">
                        KSh {batch.costPerKg ? batch.costPerKg.toFixed(1) : '0'}/kg
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Remaining Stock</span>
                        <span className="text-white font-bold">{batch.quantityRemainingKg?.toLocaleString()} / {batch.quantityReceivedKg?.toLocaleString()} kg</span>
                      </div>
                      <Progress value={pctRemaining} className="h-1.5 bg-slate-900" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                      <div>
                        <span className="text-slate-500 block text-[9px]">Supplier</span>
                        <span className="text-slate-300 font-bold truncate block">{batch.supplierId || 'Standard Miller'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Total Cost</span>
                        <span className="text-slate-300 font-bold block">KSh {((batch.quantityReceivedKg || 0) * (batch.costPerKg || 0)).toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Feed Modal */}
      {isAddFeedModalOpen && (
        <AddFeedBatchModal
          isOpen={isAddFeedModalOpen}
          onClose={() => setIsAddFeedModalOpen(false)}
          farmId={farmId}
        />
      )}
    </div>
  );
}

export default function FeedInventoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <PeckingChickenLoader />
      </div>
    }>
      <FeedInventoryContent />
    </Suspense>
  );
}
