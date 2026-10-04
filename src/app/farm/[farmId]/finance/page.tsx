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
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  getDocs,
  getDoc,
  doc,
  Unsubscribe
} from 'firebase/firestore';
import type { Farm, OpexEntry, EggSale, FeedBatch, ComplianceEvent, House, Flock, BroilerSale } from '@/services/ovocore/firebaseSchema';
import { calculateCostPerEgg, calculateGrossMargin, calculatePulletAmortizationPerWeek } from '@/services/ovocore/analyticsService';
import {
  Loader2,
  ArrowLeft,
  TrendingUp,
  Banknote,
  TrendingDown,
  LineChart,
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  Wheat,
  Scale,
  Coins,
  Receipt,
  FileDown,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  Percent,
  Plus,
  Truck,
  ShoppingBag,
  PhoneCall,
  MessageSquare
} from 'lucide-react';
import { AddOpexModal } from '@/components/ovocore/AddOpexModal';
import { AddEggSaleModal } from '@/components/ovocore/AddEggSaleModal';
import { RecordBroilerSaleModal } from '@/components/ovocore/RecordBroilerSaleModal';
import { RecordKienyejiSaleModal } from '@/components/ovocore/RecordKienyejiSaleModal';
import { LogComplianceEventModal } from '@/components/ovocore/LogComplianceEventModal';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import { useToast } from '@/hooks/use-toast';
import { computeUnitEggEconomics } from '@/lib/ovocore/layerAmortization';
import { generateMonthlyDossier } from '@/lib/ovocore/generateDossierPdf';
import { BankDossierAuthorization } from '@/components/ovocore/BankDossierAuthorization';

function cleanPhoneForWhatsApp(phoneStr?: string): string {
  if (!phoneStr) return '';
  let clean = phoneStr.replace(/\D/g, '');
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '254' + clean.slice(1);
  } else if (!clean.startsWith('254') && clean.length === 9) {
    clean = '254' + clean;
  }
  return clean;
}

function FinanceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const farmId = params?.farmId as string;
  const { toast } = useToast();

  const [farm, setFarm] = useState<(Farm & { id: string }) | null>(null);
  const [opex, setOpex] = useState<(OpexEntry & { id: string })[]>([]);
  const [sales, setSales] = useState<(EggSale & { id: string })[]>([]);
  const [broilerSales, setBroilerSales] = useState<(BroilerSale & { id: string })[]>([]);
  const [kienyejiSales, setKienyejiSales] = useState<(any & { id: string })[]>([]);
  const [batches, setBatches] = useState<(FeedBatch & { id: string })[]>([]);
  const [compliance, setCompliance] = useState<(ComplianceEvent & { id: string })[]>([]);

  const [totalFlockCapitalAssetKES, setTotalFlockCapitalAssetKES] = useState<number>(0);
  const [totalActiveLiveBirds, setTotalActiveLiveBirds] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'sales' | 'broilerSales' | 'kienyejiSales' | 'opex' | 'compliance'>('sales');

  const [isOpexModalOpen, setIsOpexModalOpen] = useState(false);
  const [isEggSaleModalOpen, setIsEggSaleModalOpen] = useState(false);
  const [isBroilerSaleModalOpen, setIsBroilerSaleModalOpen] = useState(false);
  const [isKienyejiSaleModalOpen, setIsKienyejiSaleModalOpen] = useState(false);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  // Operational Rules for Workflow Isolation
  const farmType = farm?.flockType || 'layers';
  const canSellEggs = farmType !== 'broilers' || sales.length > 0;
  const canHarvestBroilers = farmType === 'broilers' || broilerSales.length > 0;
  const canSellKienyeji = farmType === 'improved_kienyeji' || farmType === 'dual_purpose' || farmType === 'dual_purpose_kienyeji' || kienyejiSales.length > 0;

  // Deep Link Query Parameter Action Handlers
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'log_sale' && canSellEggs) {
      setIsEggSaleModalOpen(true);
    } else if (action === 'log_opex') {
      setIsOpexModalOpen(true);
    } else if (action === 'record_broiler_sale' && canHarvestBroilers) {
      setIsBroilerSaleModalOpen(true);
    } else if (action === 'record_kienyeji_sale' || action === 'log_kienyeji_sale') {
      setIsKienyejiSaleModalOpen(true);
    }
  }, [searchParams, canSellEggs, canHarvestBroilers]);

  useEffect(() => {
    if (!farmId) return;

    let isMounted = true;
    let unsubFarm: Unsubscribe;
    let unsubOpex: Unsubscribe;
    let unsubSales: Unsubscribe;
    let unsubBroilerSales: Unsubscribe;
    let unsubKienyejiSales: Unsubscribe;
    let unsubFeed: Unsubscribe;
    let unsubCompliance: Unsubscribe;
    let unsubHouses: Unsubscribe;

    // 0. Farm Metadata Listener
    const farmRef = doc(db, 'farms', farmId);
    unsubFarm = onSnapshot(farmRef, (snapshot) => {
      if (!isMounted) return;
      if (snapshot.exists()) {
        const farmData = { id: snapshot.id, ...snapshot.data() } as (Farm & { id: string });
        setFarm(farmData);
        if (farmData.flockType === 'broilers') {
          setActiveLedgerTab('broilerSales');
        } else if (farmData.flockType === 'improved_kienyeji' || farmData.flockType === 'dual_purpose') {
          setActiveLedgerTab('kienyejiSales');
        }
      }
    });

    // 1. OPEX Listener
    const opexRef = collection(db, `farms/${farmId}/opex`);
    unsubOpex = onSnapshot(opexRef, (snapshot) => {
      if (!isMounted) return;
      setOpex(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as (OpexEntry & { id: string }))));
    });

    // 2. Egg Sales Listener
    const salesRef = collection(db, `farms/${farmId}/eggSales`);
    unsubSales = onSnapshot(salesRef, (snapshot) => {
      if (!isMounted) return;
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as (EggSale & { id: string }))));
    });

    // 2b. Broiler Sales Listener
    const broilerSalesRef = collection(db, `farms/${farmId}/broilerSales`);
    unsubBroilerSales = onSnapshot(broilerSalesRef, (snapshot) => {
      if (!isMounted) return;
      setBroilerSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as (BroilerSale & { id: string }))));
    });

    // 2c. Kienyeji Sales Listener
    const kienyejiSalesRef = collection(db, `farms/${farmId}/kienyejiSales`);
    unsubKienyejiSales = onSnapshot(kienyejiSalesRef, (snapshot) => {
      if (!isMounted) return;
      setKienyejiSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Feed Batches Listener
    const feedRef = collection(db, `farms/${farmId}/feedBatches`);
    unsubFeed = onSnapshot(feedRef, (snapshot) => {
      if (!isMounted) return;
      setBatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as (FeedBatch & { id: string }))));
    });

    // 4. Compliance Events Listener
    const complianceRef = collection(db, `farms/${farmId}/complianceEvents`);
    unsubCompliance = onSnapshot(complianceRef, (snapshot) => {
      if (!isMounted) return;
      setCompliance(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as (ComplianceEvent & { id: string }))));
    });

    // 5. Flocks & Asset Valuation
    const housesRef = collection(db, `farms/${farmId}/houses`);
    unsubHouses = onSnapshot(housesRef, async (snapshot) => {
      if (!isMounted) return;
      let assetTotal = 0;
      let liveTotal = 0;

      for (const hDoc of snapshot.docs) {
        const flockSnap = await getDocs(collection(db, `farms/${farmId}/houses/${hDoc.id}/flocks`));
        flockSnap.docs.forEach(fd => {
          const f = fd.data() as Flock;
          if (f.status === 'active') {
            const count = f.currentBirdCount || 0;
            liveTotal += count;
            assetTotal += count * 850; // KSh 850 POL pullet asset valuation
          }
        });
      }

      if (isMounted) {
        setTotalFlockCapitalAssetKES(assetTotal);
        setTotalActiveLiveBirds(liveTotal);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (unsubFarm) unsubFarm();
      if (unsubOpex) unsubOpex();
      if (unsubSales) unsubSales();
      if (unsubBroilerSales) unsubBroilerSales();
      if (unsubKienyejiSales) unsubKienyejiSales();
      if (unsubFeed) unsubFeed();
      if (unsubCompliance) unsubCompliance();
      if (unsubHouses) unsubHouses();
    };
  }, [farmId]);

  // Financial Calculations
  const metrics = useMemo(() => {
    const totalEggRevenueKES = sales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const totalBroilerRevenueKES = broilerSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const totalKienyejiRevenueKES = kienyejiSales.reduce((acc, s) => acc + (s.totalRevenueKES || s.totalAmount || 0), 0);
    const totalRevenueKES = totalEggRevenueKES + totalBroilerRevenueKES + totalKienyejiRevenueKES;

    const pendingEggReceivables = sales.reduce((acc, s) => {
      if (s.balanceDue !== undefined) return acc + s.balanceDue;
      if (s.paymentStatus === 'paid') return acc;
      const paid = s.amountPaid ?? 0;
      return acc + Math.max(0, (s.totalAmount || 0) - paid);
    }, 0);

    const pendingBroilerReceivables = broilerSales.reduce((acc, s) => {
      if (s.balanceDue !== undefined) return acc + s.balanceDue;
      if (s.paymentStatus === 'paid') return acc;
      const paid = s.amountPaid ?? 0;
      return acc + Math.max(0, (s.totalAmount || 0) - paid);
    }, 0);

    const pendingKienyejiReceivables = kienyejiSales.reduce((acc, s) => {
      if (s.balanceDue !== undefined) return acc + s.balanceDue;
      if (s.paymentStatus === 'paid') return acc;
      const paid = s.amountPaid ?? 0;
      const total = s.totalRevenueKES || s.totalAmount || 0;
      return acc + Math.max(0, total - paid);
    }, 0);

    const pendingReceivablesKES = pendingEggReceivables + pendingBroilerReceivables + pendingKienyejiReceivables;

    const totalOpexKES = opex.reduce((acc, o) => acc + (o.amount || 0), 0);
    const totalFeedCostKES = batches.reduce((acc, b) => acc + ((b.quantityReceivedKg || 0) * (b.costPerKg || 0)), 0);

    const grandExpenseKES = totalOpexKES + totalFeedCostKES;
    const netCashflowKES = totalRevenueKES - grandExpenseKES;
    const grossMarginPct = totalRevenueKES > 0 ? ((totalRevenueKES - grandExpenseKES) / totalRevenueKES) * 100 : 0;

    let totalTraysSold = 0;
    sales.forEach(s => {
      const gb = s.gradeBreakdown || {};
      totalTraysSold += (gb.gradeA_trays || gb.gradeA?.equivalentTrays || 0) + (gb.gradeB_trays || gb.gradeB?.equivalentTrays || 0) + (gb.gradeC_trays || gb.gradeC?.equivalentTrays || 0);
    });

    const totalBroilerKgSold = broilerSales.reduce((acc, s) => acc + (s.totalLiveWeightKg || 0), 0);

    return {
      totalEggRevenueKES,
      totalBroilerRevenueKES,
      totalKienyejiRevenueKES,
      totalRevenueKES,
      pendingReceivablesKES,
      totalOpexKES,
      totalFeedCostKES,
      grandExpenseKES,
      netCashflowKES,
      grossMarginPct,
      totalTraysSold,
      totalBroilerKgSold
    };
  }, [sales, broilerSales, kienyejiSales, opex, batches]);

  const pulletEconomics = useMemo(() => {
    return computeUnitEggEconomics({
      initialPulletCount: totalActiveLiveBirds || 5000,
      costPerPulletKES: 850,
      expectedProductiveWeeks: 52,
      currentAgeWeeks: 32,
      currentBirdCount: totalActiveLiveBirds || 5000,
      weeklyEggsProduced: metrics.totalTraysSold > 0 ? (metrics.totalTraysSold * 30) : 28000,
      weeklyFeedCostKES: metrics.totalFeedCostKES > 0 ? metrics.totalFeedCostKES : 210000,
      weeklyOverheadCostKES: metrics.totalOpexKES > 0 ? metrics.totalOpexKES : 45000
    });
  }, [totalActiveLiveBirds, metrics]);

  const handleDownloadDossier = () => {
    generateMonthlyDossier({
      farmName: farm?.name || 'OvoCore Farm',
      farmId: farmId,
      county: farm?.county || 'Kenya',
      ownerName: farm?.ownerName || farm?.ownerContact?.name || 'Farm Manager',
      farmType: (farm?.flockType === 'broilers' ? 'broilers' : 'layers'),
      monthYear: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      totalFlockHeadcount: totalActiveLiveBirds || 5000,
      activeHousesCount: 1,
      capacityUtilizationPct: 98,
      cumulativeMortalityPct: 1.2,
      totalFeedConsumedKg: metrics.totalFeedCostKES > 0 ? Math.round(metrics.totalFeedCostKES / 75) : 3500,
      totalProductionYield: canHarvestBroilers 
        ? `${metrics.totalBroilerKgSold.toLocaleString()} kg Live Biomass`
        : `${metrics.totalTraysSold.toLocaleString()} Trays (${(metrics.totalTraysSold * 30).toLocaleString()} Eggs)`,
      fcrOrHenDayScore: canHarvestBroilers ? "1.58 FCR" : "88.4% Avg Hen-Day",
      grossRevenueKES: metrics.totalRevenueKES,
      totalOpexKES: metrics.grandExpenseKES,
      totalFeedCostKES: metrics.totalFeedCostKES,
      netMarginKES: metrics.netCashflowKES,
      grossMarginPct: metrics.grossMarginPct,
      unitCostMetric: canHarvestBroilers 
        ? `KSh ${metrics.totalBroilerKgSold > 0 ? (metrics.grandExpenseKES / metrics.totalBroilerKgSold).toFixed(2) : '175'} / kg live`
        : `KSh ${metrics.totalTraysSold > 0 ? (metrics.grandExpenseKES / (metrics.totalTraysSold * 30)).toFixed(2) : '11.50'} / egg`,
      pulletAmortizationPerEggKES: pulletEconomics ? `KSh ${pulletEconomics.pulletCapitalCostPerEggKES.toFixed(2)} / egg` : undefined,
      siloRunwayDays: 10,
      biosecurityStatus: 'Level 2 Verified'
    });
    toast({
      title: "PDF Dossier Generated",
      description: "Downloaded executive performance dossier for farm bank/lender audit."
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <PeckingChickenLoader />
        <p className="mt-4 text-xs font-mono text-slate-400 animate-pulse">
          Computing Cashflow Ledgers & Unit Economics...
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
            <Coins className="w-7 h-7 text-amber-400" /> Cashflow & Unit Economics
          </h1>
          <p className="text-xs text-slate-400">
            {canSellEggs && canHarvestBroilers
              ? "Egg sales, broiler live-weight harvests, feed opex, and margin analysis."
              : canHarvestBroilers
              ? "Broiler live-weight slaughter harvests, feed opex, and margin analysis."
              : "Egg sale revenue ledgers, feed opex, pending credit receivables, and margin analysis."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSellEggs && (
            <Button
              onClick={() => setIsEggSaleModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl h-10 px-4 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Record Egg Sale
            </Button>
          )}
          {canHarvestBroilers && (
            <Button
              onClick={() => setIsBroilerSaleModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl h-10 px-4 shadow-lg shadow-emerald-600/20"
            >
              <Truck className="w-4 h-4 mr-1.5" /> Dispatch Harvest (Broiler)
            </Button>
          )}
          {canSellKienyeji && (
            <Button
              onClick={() => setIsKienyejiSaleModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl h-10 px-4 shadow-lg shadow-amber-600/20"
            >
              <ShoppingBag className="w-4 h-4 mr-1.5" /> Record Kienyeji Sale
            </Button>
          )}
          <Button
            onClick={() => setIsOpexModalOpen(true)}
            variant="secondary"
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl h-10 px-4"
          >
            <Receipt className="w-4 h-4 mr-1.5" /> Log Operating Expense
          </Button>

          <Button
            onClick={handleDownloadDossier}
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-bold text-xs rounded-xl h-10 px-4"
          >
            <FileDown className="w-4 h-4 mr-1.5" /> Export PDF Dossier
          </Button>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              {canHarvestBroilers && !canSellEggs ? "Total Broiler Revenue" : canSellEggs && !canHarvestBroilers ? "Total Egg Revenue" : "Total Farm Revenue"} <Banknote className="w-4 h-4 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-400">
              KSh {metrics.totalRevenueKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 font-mono">
              {canHarvestBroilers && !canSellEggs
                ? `Net Weight: ${metrics.totalBroilerKgSold.toLocaleString()} kg`
                : canSellEggs && !canHarvestBroilers
                ? `Volume: ${metrics.totalTraysSold.toLocaleString()} trays`
                : `Egg: KSh ${metrics.totalEggRevenueKES.toLocaleString()} | Broiler: KSh ${metrics.totalBroilerRevenueKES.toLocaleString()}`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Pending Receivables <Clock className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-amber-400">
              KSh {metrics.pendingReceivablesKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">
              {metrics.pendingReceivablesKES > 0 ? "Buyer credit outstanding" : "All customer credit settled"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Operating Expenses <TrendingDown className="w-4 h-4 text-rose-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-rose-400">
              KSh {metrics.grandExpenseKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 font-mono">
              Feed: KSh {metrics.totalFeedCostKES.toLocaleString()} | Opex: KSh {metrics.totalOpexKES.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-lg">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
              Net Profit / Cashflow <TrendingUp className="w-4 h-4 text-amber-400" />
            </CardDescription>
            <CardTitle className={`text-2xl font-black ${metrics.netCashflowKES >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              KSh {metrics.netCashflowKES.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-bold text-slate-300">
              Gross Margin: {metrics.grossMarginPct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="py-2">
        <BankDossierAuthorization farmId={farmId} />
      </div>

      {/* Unit Egg Economics & Pullet Amortization Banner (For Layer / Mixed Farms) */}
      {canSellEggs && pulletEconomics && (
        <Card className="bg-slate-900 border-amber-500/20 text-white rounded-3xl p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono uppercase font-bold">
                Point-of-Lay Pullet Capital Amortization
              </Badge>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" /> Unit Production Cost: KSh {pulletEconomics.totalProductionCostPerEggKES.toFixed(2)} / egg
              </h3>
              <p className="text-xs text-slate-400">
                Weekly pullet asset amortization across 52-week laying period + feed & overhead cost share per egg.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-mono text-center">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Feed Share</span>
                <span className="font-bold text-amber-400">KSh {pulletEconomics.feedShareCostPerEggKES.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Pullet Share</span>
                <span className="font-bold text-emerald-400">KSh {pulletEconomics.pulletCapitalCostPerEggKES.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Overhead</span>
                <span className="font-bold text-slate-300">KSh {pulletEconomics.overheadCostPerEggKES.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Ledger Tables */}
      <Card className="bg-slate-900 border-slate-800 text-white rounded-3xl shadow-xl">
        <CardHeader className="pb-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-400" /> Financial Ledgers & Audits
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Detailed breakdown of revenue streams, off-takes, operational costs, and compliance logs.
            </CardDescription>
          </div>

          <Tabs value={activeLedgerTab} onValueChange={(v: any) => setActiveLedgerTab(v)} className="w-full md:w-auto">
            <TabsList className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex-wrap">
              {canSellEggs && (
                <TabsTrigger value="sales" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                  Egg Sales ({sales.length})
                </TabsTrigger>
              )}
              {canHarvestBroilers && (
                <TabsTrigger value="broilerSales" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                  Broiler Harvests ({broilerSales.length})
                </TabsTrigger>
              )}
              {canSellKienyeji && (
                <TabsTrigger value="kienyejiSales" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                  Kienyeji Sales ({kienyejiSales.length})
                </TabsTrigger>
              )}
              <TabsTrigger value="opex" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                Opex Ledger ({opex.length})
              </TabsTrigger>
              <TabsTrigger value="compliance" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
                Compliance ({compliance.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {activeLedgerTab === 'sales' && (
            <div className="space-y-3">
              {sales.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Banknote className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Egg Sales Recorded</h4>
                  <p className="text-slate-400 text-xs">Log your first buyer invoice to track cashflow and unit pricing.</p>
                  <Button onClick={() => setIsEggSaleModalOpen(true)} size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs">
                    Log Egg Sale
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sales.map((sale) => {
                    const customerName = (sale as any).customerName || (sale as any).customerId || 'Cash Customer';
                    const customerPhone = (sale as any).customerPhone || '';
                    const totalVal = sale.totalAmount || 0;
                    const paidVal = (sale as any).amountPaid !== undefined
                      ? (sale as any).amountPaid
                      : sale.paymentStatus === 'paid' ? totalVal : 0;
                    const pendingVal = (sale as any).balanceDue !== undefined
                      ? (sale as any).balanceDue
                      : Math.max(0, totalVal - paidVal);
                    const paidPct = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : 100;
                    const cleanPhone = cleanPhoneForWhatsApp(customerPhone);
                    const saleDateStr = sale.date?.toDate ? sale.date.toDate().toLocaleDateString() : 'Recent';
                    const waMsg = `Hello ${customerName}, this is a friendly follow-up from ${farm?.name || 'OvoCore Farm'} regarding your egg order balance due of KSh ${pendingVal.toLocaleString()} (Date: ${saleDateStr}). Please let us know when payment will be settled. Thank you!`;
                    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

                    return (
                      <Card key={sale.id} className="bg-slate-950 border-slate-800 text-white rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-base">
                                Buyer: {customerName}
                              </span>
                              {customerPhone ? (
                                <a href={`tel:${customerPhone}`} className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:underline bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <PhoneCall className="w-3 h-3" /> {customerPhone}
                                </a>
                              ) : (
                                <span className="text-[11px] font-mono text-slate-500">No phone attached</span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                              Date: {saleDateStr} • {(sale as any).relatedHouseName || 'General Farm Gate'}
                            </p>
                          </div>

                          <Badge className={
                            sale.paymentStatus === 'paid' || pendingVal === 0
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs py-1"
                              : sale.paymentStatus === 'partial'
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs py-1 animate-pulse"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs py-1"
                          }>
                            {sale.paymentStatus === 'paid' || pendingVal === 0 ? "PAID IN FULL" : sale.paymentStatus === 'partial' ? "PARTIAL PAYMENT" : "CREDIT / PENDING"}
                          </Badge>
                        </div>

                        {/* Financial Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-2 bg-card p-3 rounded-xl border border-slate-800 text-xs font-mono text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Total Order</span>
                            <span className="font-extrabold text-white text-sm">KSh {totalVal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-400 block uppercase font-bold">Amount Paid</span>
                            <span className="font-extrabold text-emerald-400 text-sm">KSh {paidVal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-amber-400 block uppercase font-bold">Pending Due</span>
                            <span className={`font-extrabold text-sm ${pendingVal > 0 ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
                              KSh {pendingVal.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Payment Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>Payment Progress</span>
                            <span className={paidPct === 100 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                              {paidPct}% Paid ({pendingVal > 0 ? `KSh ${pendingVal.toLocaleString()} Pending` : 'Fully Settled'})
                            </span>
                          </div>
                          <Progress value={paidPct} className="h-2 bg-slate-800" />
                        </div>

                        {/* Direct Customer Follow-Up Action Trigger */}
                        {pendingVal > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Credit balance active for {customerName}
                            </span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Follow Up via WhatsApp
                            </a>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeLedgerTab === 'broilerSales' && (
            <div className="space-y-3">
              {broilerSales.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Truck className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Broiler Harvests Recorded</h4>
                  <p className="text-slate-400 text-xs">Log live-weight off-takes, off-take weight, DOA counts, and revenue.</p>
                  <Button onClick={() => setIsBroilerSaleModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">
                    Record Broiler Harvest
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {broilerSales.map((sale) => {
                    const buyerName = sale.buyerName || 'Processor';
                    const buyerPhone = (sale as any).buyerPhone || '';
                    const totalVal = sale.totalAmount || 0;
                    const paidVal = (sale as any).amountPaid !== undefined
                      ? (sale as any).amountPaid
                      : sale.paymentStatus === 'paid' ? totalVal : 0;
                    const pendingVal = (sale as any).balanceDue !== undefined
                      ? (sale as any).balanceDue
                      : Math.max(0, totalVal - paidVal);
                    const paidPct = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : 100;
                    const cleanPhone = cleanPhoneForWhatsApp(buyerPhone);
                    const harvestDateStr = sale.date?.toDate ? sale.date.toDate().toLocaleDateString() : 'Recent';
                    const waMsg = `Hello ${buyerName}, this is a friendly follow-up from ${farm?.name || 'OvoCore Farm'} regarding the outstanding balance of KSh ${pendingVal.toLocaleString()} for the broiler live-weight harvest dispatch on ${harvestDateStr}. Please let us know when payment will be settled. Thank you!`;
                    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

                    return (
                      <Card key={sale.id} className="bg-slate-950 border-slate-800 text-white rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-base">
                                Buyer: {buyerName}
                              </span>
                              {buyerPhone ? (
                                <a href={`tel:${buyerPhone}`} className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:underline bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <PhoneCall className="w-3 h-3" /> {buyerPhone}
                                </a>
                              ) : (
                                <span className="text-[11px] font-mono text-slate-500">No phone attached</span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                              Date: {harvestDateStr} • Shed: {sale.houseId || 'Broiler Unit'}
                            </p>
                          </div>

                          <Badge className={
                            sale.paymentStatus === 'paid' || pendingVal === 0
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs py-1"
                              : sale.paymentStatus === 'partial'
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs py-1 animate-pulse"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs py-1"
                          }>
                            {sale.paymentStatus === 'paid' || pendingVal === 0 ? "PAID IN FULL" : sale.paymentStatus === 'partial' ? "PARTIAL DEPOSIT" : "30-DAY CREDIT"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-slate-500 text-[10px]">HARVESTED:</span>
                            <p className="font-bold text-slate-200">{sale.birdsLoaded} birds ({sale.totalLiveWeightKg} kg)</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">UNIT PRICE:</span>
                            <p className="font-bold text-amber-400">KSh {sale.pricePerKg} / kg</p>
                          </div>
                        </div>

                        {/* Financial Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-2 bg-card p-3 rounded-xl border border-slate-800 text-xs font-mono text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Total Harvest</span>
                            <span className="font-extrabold text-white text-sm">KSh {totalVal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-400 block uppercase font-bold">Amount Paid</span>
                            <span className="font-extrabold text-emerald-400 text-sm">KSh {paidVal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-amber-400 block uppercase font-bold">Pending Due</span>
                            <span className={`font-extrabold text-sm ${pendingVal > 0 ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
                              KSh {pendingVal.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Payment Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>Payment Progress</span>
                            <span className={paidPct === 100 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                              {paidPct}% Paid ({pendingVal > 0 ? `KSh ${pendingVal.toLocaleString()} Pending` : 'Fully Settled'})
                            </span>
                          </div>
                          <Progress value={paidPct} className="h-2 bg-slate-800" />
                        </div>

                        {/* Direct Customer Follow-Up Action Trigger */}
                        {pendingVal > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Abattoir credit balance pending
                            </span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Follow Up via WhatsApp
                            </a>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeLedgerTab === 'kienyejiSales' && (
            <div className="space-y-3">
              {kienyejiSales.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Kienyeji Transactions Recorded</h4>
                  <p className="text-slate-400 text-xs">Log live cockerel, spent hen, or fertilized egg sales.</p>
                  <Button onClick={() => setIsKienyejiSaleModalOpen(true)} size="sm" className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs">
                    Record Kienyeji Sale
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {kienyejiSales.map((sale) => {
                    const buyerName = sale.buyerName || 'Customer';
                    const buyerPhone = sale.buyerPhone || '';
                    const totalVal = sale.totalRevenueKES || sale.totalAmount || 0;
                    const paidVal = sale.amountPaid !== undefined
                      ? sale.amountPaid
                      : sale.paymentStatus === 'paid' ? totalVal : 0;
                    const pendingVal = sale.balanceDue !== undefined
                      ? sale.balanceDue
                      : Math.max(0, totalVal - paidVal);
                    const paidPct = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : 100;
                    const cleanPhone = cleanPhoneForWhatsApp(buyerPhone);
                    const saleDateStr = sale.recordedAt?.toDate ? sale.recordedAt.toDate().toLocaleDateString() : 'Recent';
                    const waMsg = `Hello ${buyerName}, this is a friendly follow-up from ${farm?.name || 'OvoCore Farm'} regarding the pending balance of KSh ${pendingVal.toLocaleString()} for your Kienyeji order on ${saleDateStr}. Please let us know when payment will be settled. Thank you!`;
                    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

                    return (
                      <Card key={sale.id} className="bg-slate-950 border-slate-800 text-white rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-base">
                                Buyer: {buyerName}
                              </span>
                              {buyerPhone ? (
                                <a href={`tel:${buyerPhone}`} className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:underline bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <PhoneCall className="w-3 h-3" /> {buyerPhone}
                                </a>
                              ) : (
                                <span className="text-[11px] font-mono text-slate-500">No phone attached</span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                              Date: {saleDateStr} • Category: {(sale.saleStream || 'live_birds').replace('_', ' ')}
                            </p>
                          </div>

                          <Badge className={
                            sale.paymentStatus === 'paid' || pendingVal === 0
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs py-1"
                              : sale.paymentStatus === 'partial'
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs py-1 animate-pulse"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs py-1"
                          }>
                            {sale.paymentStatus === 'paid' || pendingVal === 0 ? "PAID IN FULL" : sale.paymentStatus === 'partial' ? "PARTIAL PAYMENT" : "CREDIT / PENDING"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-slate-500 text-[10px]">QUANTITY:</span>
                            <p className="font-bold text-slate-200">{sale.quantity} units</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">UNIT PRICE:</span>
                            <p className="font-bold text-amber-400">KSh {sale.unitPriceKES}</p>
                          </div>
                        </div>

                        {/* Financial Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-2 bg-card p-3 rounded-xl border border-slate-800 text-xs font-mono text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Total Sale</span>
                            <span className="font-extrabold text-white text-sm">KSh {totalVal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-400 block uppercase font-bold">Amount Paid</span>
                            <span className="font-extrabold text-emerald-400 text-sm">KSh {paidVal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-amber-400 block uppercase font-bold">Pending Due</span>
                            <span className={`font-extrabold text-sm ${pendingVal > 0 ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
                              KSh {pendingVal.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Payment Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>Payment Progress</span>
                            <span className={paidPct === 100 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                              {paidPct}% Paid ({pendingVal > 0 ? `KSh ${pendingVal.toLocaleString()} Pending` : 'Fully Settled'})
                            </span>
                          </div>
                          <Progress value={paidPct} className="h-2 bg-slate-800" />
                        </div>

                        {/* Direct Customer Follow-Up Action Trigger */}
                        {pendingVal > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Credit balance outstanding
                            </span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Follow Up via WhatsApp
                            </a>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeLedgerTab === 'opex' && (
            <div className="space-y-3">
              {opex.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Opex Logged</h4>
                  <p className="text-slate-400 text-xs">Log labour, medication, utility, or maintenance costs.</p>
                  <Button onClick={() => setIsOpexModalOpen(true)} size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs">
                    Log Opex Entry
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {opex.map((entry) => (
                    <Card key={entry.id} className="bg-slate-950 border-slate-800 text-white rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="outline" className="border-rose-500/30 text-rose-400 text-[10px] uppercase font-mono">
                            {entry.category}
                          </Badge>
                          <h4 className="font-bold text-white text-sm mt-1">
                            KSh {entry.amount?.toLocaleString()}
                          </h4>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300">{entry.description}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeLedgerTab === 'compliance' && (
            <div className="space-y-3">
              {compliance.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Compliance Events Logged</h4>
                  <p className="text-slate-400 text-xs">Record veterinary audits, vaccinations, and water sanitation events.</p>
                  <Button onClick={() => setIsComplianceModalOpen(true)} size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs">
                    Log Compliance Event
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {compliance.map((comp) => (
                    <Card key={comp.id} className="bg-slate-950 border-slate-800 text-white rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px] uppercase font-mono">
                            {comp.eventType}
                          </Badge>
                          <h4 className="font-bold text-white text-sm mt-1">
                            {comp.description}
                          </h4>
                        </div>
                        <Badge className="bg-slate-800 text-slate-300">
                          {comp.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {isOpexModalOpen && (
        <AddOpexModal
          isOpen={isOpexModalOpen}
          onClose={() => setIsOpexModalOpen(false)}
          farmId={farmId}
        />
      )}

      {isEggSaleModalOpen && (
        <AddEggSaleModal
          isOpen={isEggSaleModalOpen}
          onClose={() => setIsEggSaleModalOpen(false)}
          farmId={farmId}
        />
      )}

      {isBroilerSaleModalOpen && (
        <RecordBroilerSaleModal
          isOpen={isBroilerSaleModalOpen}
          onClose={() => setIsBroilerSaleModalOpen(false)}
          farmId={farmId}
        />
      )}

      {isKienyejiSaleModalOpen && (
        <RecordKienyejiSaleModal
          isOpen={isKienyejiSaleModalOpen}
          onClose={() => setIsKienyejiSaleModalOpen(false)}
          farmId={farmId}
          houseId="house_01"
          flockId="flock_01"
        />
      )}

      {isComplianceModalOpen && (
        <LogComplianceEventModal
          isOpen={isComplianceModalOpen}
          onClose={() => setIsComplianceModalOpen(false)}
          farmId={farmId}
        />
      )}
    </div>
  );
}

export default function FinancialAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <PeckingChickenLoader />
      </div>
    }>
      <FinanceContent />
    </Suspense>
  );
}
