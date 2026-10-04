"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { seedOvoCoreDemoData, clearOvoCoreDemoData } from '@/services/ovocore/demoSeeder';
import type { Farm } from '@/services/ovocore/firebaseSchema';
import {
  Loader2,
  Egg,
  LayoutDashboard,
  PlusCircle,
  Trash2,
  ArrowRight,
  Lock,
  ShieldCheck,
  Building2,
  Users,
  Share2,
  Search,
  MapPin,
  Check,
  Copy,
  Sparkles,
  RefreshCw,
  Activity,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateFarmModal from '@/components/ovocore/CreateFarmModal';
import FarmTeamOnboardingModal from '@/components/ovocore/FarmTeamOnboardingModal';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import { OvoCoreHeader } from '@/components/ovocore/OvoCoreHeader';
import { dispatchWhatsAppAdvisor, FarmTelemetryContext } from '@/lib/ovocore/whatsappAdvisor';

function OvoCoreDashboardContent() {
  const { toast } = useToast();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializingSession, setIsInitializingSession] = useState(false);
  const [isProcessingDemo, setIsProcessingDemo] = useState(false);
  const [hasDemoData, setHasDemoData] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedFarmId, setAssignedFarmId] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'layers' | 'broilers' | 'dual_purpose'>('all');

  // Quick Access Gate State
  const [farmIdInput, setFarmIdInput] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTeamFarmId, setSelectedTeamFarmId] = useState<string | null>(null);

  // Copied Farm ID tracking
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      handleSessionAuth(sessionId);
    } else {
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
    }
  }, [sessionId]);

  const handleSessionAuth = async (sid: string) => {
    setIsInitializingSession(true);
    try {
      const res = await fetch(`/api/checkout/session?session_id=${sid}`);
      const data = await res.json();
      
      if (data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
        toast({ title: 'Welcome!', description: 'Your workspace has been successfully initialized.' });
        if (data.farmId) {
          router.replace(`/farm/${data.farmId}`);
        } else {
          router.replace('/');
        }
      } else {
        throw new Error(data.error || 'Failed to initialize session');
      }
    } catch (error: any) {
      console.error('Session auth error:', error);
      toast({ title: 'Authentication Failed', description: error.message, variant: 'destructive' });
      const unsubscribe = onAuthStateChanged(auth, setUser);
      setIsInitializingSession(false);
      return () => unsubscribe();
    }
  };

  useEffect(() => {
    if (isInitializingSession) return;
    
    if (user) {
      resolveUserRoleAndFarms();
      checkDemoData();
    } else {
      setIsLoading(false);
      setIsAdmin(false);
      setFarms([]);
    }
  }, [user, isInitializingSession]);

  const resolveUserRoleAndFarms = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let userIsAdmin = false;
      let userAssignedFarm: string | null = null;

      try {
        const idToken = await user.getIdTokenResult();
        if (idToken.claims.role === 'admin') {
          userIsAdmin = true;
        }
      } catch (e) {
        console.warn("Could not read token claims:", e);
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role;
          if (role === 'admin' || role === 'super_admin') {
            userIsAdmin = true;
          }
          userAssignedFarm = userData.assignedFarmId || null;
          setAssignedFarmId(userAssignedFarm);
        }
      } catch (e) {
        console.error("Failed to read user doc:", e);
      }

      setIsAdmin(userIsAdmin);
      await fetchScopedFarms(userIsAdmin, user.uid, userAssignedFarm);
    } catch (error) {
      console.error("Role & farm resolution error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to initialize farm permissions."
      });
    } finally {
      setIsLoading(false);
    }
  };

function formatLastActive(timestamp: any): string {
  if (!timestamp) return 'No Activity Logged';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Recently Active';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

  const fetchScopedFarms = async (adminPrivilege: boolean, userId: string, assignedId: string | null) => {
    try {
      const farmsRef = collection(db, 'farms');
      let farmMap = new Map<string, Farm>();

      if (adminPrivilege) {
        const snapshot = await getDocs(farmsRef);
        snapshot.docs.forEach(docSnap => {
          farmMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Farm);
        });
      } else {
        if (user?.email) {
          const ownerQuery = query(farmsRef, where('ownerContact.email', '==', user.email));
          const ownerSnap = await getDocs(ownerQuery);
          ownerSnap.docs.forEach(d => farmMap.set(d.id, { id: d.id, ...d.data() } as Farm));
        }

        if (userId) {
          const ownerUidQuery = query(farmsRef, where('ownerUserId', '==', userId));
          const ownerUidSnap = await getDocs(ownerUidQuery);
          ownerUidSnap.docs.forEach(d => farmMap.set(d.id, { id: d.id, ...d.data() } as Farm));

          const userUidQuery = query(farmsRef, where('userId', '==', userId));
          const userUidSnap = await getDocs(userUidQuery);
          userUidSnap.docs.forEach(d => farmMap.set(d.id, { id: d.id, ...d.data() } as Farm));

          const createdByQuery = query(farmsRef, where('createdBy', '==', userId));
          const createdBySnap = await getDocs(createdByQuery);
          createdBySnap.docs.forEach(d => farmMap.set(d.id, { id: d.id, ...d.data() } as Farm));
        }

        if (assignedId) {
          const assignedDoc = await getDoc(doc(db, 'farms', assignedId));
          if (assignedDoc.exists()) {
            farmMap.set(assignedDoc.id, { id: assignedDoc.id, ...assignedDoc.data() } as Farm);
          }
        }
      }

      const rawFarms = Array.from(farmMap.values());

      // Enrich farms with registered user counts
      const enrichedFarms = await Promise.all(
        rawFarms.map(async (f) => {
          let userCount = 1;
          try {
            const userSet = new Set<string>();
            const ownerId = (f as any).ownerUserId;
            if (ownerId) userSet.add(ownerId);
            if (f.ownerContact?.email) userSet.add(f.ownerContact.email);

            const staffSnap = await getDocs(collection(db, `farms/${f.id}/staff`));
            staffSnap.docs.forEach(s => userSet.add(s.id));

            const usersQuery = query(collection(db, 'users'), where('assignedFarmId', '==', f.id));
            const usersSnap = await getDocs(usersQuery);
            usersSnap.docs.forEach(u => userSet.add(u.id));

            userCount = Math.max(1, userSet.size);
          } catch (err) {
            console.warn(`Could not load user count for farm ${f.id}:`, err);
          }
          return {
            ...f,
            registeredUsersCount: userCount
          };
        })
      );

      setFarms(enrichedFarms);
    } catch (e) {
      console.error("Fetch farms error:", e);
    }
  };

  const checkDemoData = async () => {
    try {
      const docRef = doc(db, 'farms', 'FARM_1');
      const snap = await getDoc(docRef);
      setHasDemoData(snap.exists());
    } catch (e) {
      console.error("Error checking demo data:", e);
    }
  };

  const handleSeedDemo = async () => {
    setIsProcessingDemo(true);
    try {
      const farmId = await seedOvoCoreDemoData(db, user?.uid || 'demo_user');
      toast({
        title: "Demo Data Initialized",
        description: `Created active farm 'Kuku Bora Farm' (ID: ${farmId}) with live flock metrics.`
      });
      setHasDemoData(true);
      if (user) resolveUserRoleAndFarms();
      router.push(`/farm/${farmId}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Seeding Failed",
        description: error.message || "Failed to initialize demo farm."
      });
    } finally {
      setIsProcessingDemo(false);
    }
  };

  const handleClearDemo = async () => {
    setIsProcessingDemo(true);
    try {
      await clearOvoCoreDemoData(db, user?.uid || 'demo_user');
      toast({
        title: "Demo Data Cleared",
        description: "All demo farm collections have been removed."
      });
      setHasDemoData(false);
      if (user) resolveUserRoleAndFarms();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Clear Failed",
        description: error.message || "Failed to clear demo farm."
      });
    } finally {
      setIsProcessingDemo(false);
    }
  };

  const handleQuickAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmIdInput.trim()) return;

    setIsCheckingAccess(true);
    try {
      const farmRef = doc(db, 'farms', farmIdInput.trim());
      const snap = await getDoc(farmRef);
      if (snap.exists()) {
        router.push(`/farm/${farmIdInput.trim()}`);
      } else {
        toast({
          variant: "destructive",
          title: "Farm Not Found",
          description: `No farm exists with ID '${farmIdInput.trim()}'. Check the code and try again.`
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Access Error",
        description: err.message || "Failed to verify farm ID."
      });
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast({ title: "Copied!", description: `Farm ID ${text} copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredFarms = useMemo(() => {
    return farms.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            f.county?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            f.id?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      const farmType = f.flockType || 'layers';
      const matchesType = typeFilter === 'all' || 
                          (typeFilter === 'layers' && (farmType === 'layers' || farmType === 'commercial_layers')) ||
                          (typeFilter === 'broilers' && farmType === 'broilers') ||
                          (typeFilter === 'dual_purpose' && (farmType === 'dual_purpose' || farmType === 'dual_purpose_kienyeji'));
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [farms, searchQuery, statusFilter, typeFilter]);

  const handleGlobalAdvisorTrigger = () => {
    const portfolioCtx: FarmTelemetryContext = {
      farmId: farms[0]?.id || 'demo_farm',
      farmName: farms[0]?.name || 'OvoCore Farm',
      ownerName: user?.displayName || user?.email?.split('@')[0] || 'Mkulima',
      ownerPhone: 
        farms[0]?.ownerContact?.phone || 
        (farms[0] as any)?.ownerPhone || 
        (farms[0] as any)?.phone || 
        user?.phoneNumber || 
        '',
      houseCount: farms.length,
      activeFlockCount: farms.length,
      totalFeedKg: 1200,
      daysOfFeed: 10,
      mortalityRatePct: 2.1,
      unrecordedDays: 0,
      unsettledCreditKES: 0,
      currentPage: 'portfolio',
    };
    dispatchWhatsAppAdvisor(portfolioCtx);
  };

  if (isInitializingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="text-center space-y-4">
          <PeckingChickenLoader />
          <p className="text-slate-400 text-sm font-mono animate-pulse">Initializing OvoCore Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <OvoCoreHeader 
        farmName="Portfolio Console"
        onTriggerAdvisor={handleGlobalAdvisorTrigger}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 p-6 sm:p-8 shadow-2xl border border-amber-500/20">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-mono font-semibold ">
              <Sparkles className="w-3.5 h-3.5" /> OvoCore Multi-Enterprise Engine
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Poultry Farm Operations Console
            </h1>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Super admin oversight across Commercial Layers, Meat Broilers, and Kienyeji operations.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl h-11 px-5 shadow-lg shadow-amber-400/20"
              >
                <PlusCircle className="w-4 h-4 mr-2" /> Register New Farm
              </Button>

              {hasDemoData ? (
                <Button
                  onClick={handleClearDemo}
                  disabled={isProcessingDemo}
                  variant="outline"
                  className="border-slate-700 text-rose-300 hover:bg-rose-500/10 rounded-xl h-11"
                >
                  {isProcessingDemo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Clear Demo Farm
                </Button>
              ) : (
                <Button
                  onClick={handleSeedDemo}
                  disabled={isProcessingDemo}
                  variant="secondary"
                  className="bg-card hover:bg-slate-900 text-amber-400 border border-amber-500/30 font-bold rounded-xl h-11 px-5"
                >
                  {isProcessingDemo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Seed Demo Farm (Kuku Bora)
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Access & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 bg-card border-slate-800 text-white shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" /> Filter & Search Farms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Search by farm name, county, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('all')}
                    size="sm"
                    className={statusFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold text-xs rounded-xl' : 'border-slate-800 text-slate-400 text-xs rounded-xl'}
                  >
                    All Status
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('active')}
                    size="sm"
                    className={statusFilter === 'active' ? 'bg-amber-500 text-slate-950 font-bold text-xs rounded-xl' : 'border-slate-800 text-slate-400 text-xs rounded-xl'}
                  >
                    Active
                  </Button>
                </div>
              </div>

              {/* Super Admin Farm Type Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 mr-1">Farm Type:</span>
                <Button
                  variant={typeFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setTypeFilter('all')}
                  size="sm"
                  className={typeFilter === 'all' ? 'bg-amber-500 text-slate-950 font-extrabold text-[11px] h-7 px-3 rounded-lg' : 'border-slate-800 text-slate-400 text-[11px] h-7 px-3 rounded-lg'}
                >
                  All Types
                </Button>
                <Button
                  variant={typeFilter === 'layers' ? 'default' : 'outline'}
                  onClick={() => setTypeFilter('layers')}
                  size="sm"
                  className={typeFilter === 'layers' ? 'bg-amber-500 text-slate-950 font-extrabold text-[11px] h-7 px-3 rounded-lg' : 'border-slate-800 text-slate-400 text-[11px] h-7 px-3 rounded-lg'}
                >
                  🥚 Commercial Layers
                </Button>
                <Button
                  variant={typeFilter === 'broilers' ? 'default' : 'outline'}
                  onClick={() => setTypeFilter('broilers')}
                  size="sm"
                  className={typeFilter === 'broilers' ? 'bg-emerald-600 text-white font-extrabold text-[11px] h-7 px-3 rounded-lg' : 'border-slate-800 text-slate-400 text-[11px] h-7 px-3 rounded-lg'}
                >
                  🍗 Meat Broilers
                </Button>
                <Button
                  variant={typeFilter === 'dual_purpose' ? 'default' : 'outline'}
                  onClick={() => setTypeFilter('dual_purpose')}
                  size="sm"
                  className={typeFilter === 'dual_purpose' ? 'bg-blue-600 text-white font-extrabold text-[11px] h-7 px-3 rounded-lg' : 'border-slate-800 text-slate-400 text-[11px] h-7 px-3 rounded-lg'}
                >
                  🐔 Dual-Purpose Kienyeji
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-slate-800 text-white shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" /> Quick Access Gate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleQuickAccess} className="flex gap-2">
                <Input
                  placeholder="Enter Farm ID..."
                  value={farmIdInput}
                  onChange={(e) => setFarmIdInput(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl focus:border-amber-500 font-mono text-xs"
                />
                <Button
                  type="submit"
                  disabled={isCheckingAccess}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  {isCheckingAccess ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Farms Grid */}
        {isLoading ? (
          <div className="py-16 text-center space-y-4">
            <PeckingChickenLoader />
            <p className="text-slate-400 text-sm font-mono animate-pulse">Loading active farm operations...</p>
          </div>
        ) : filteredFarms.length === 0 ? (
          <Card className="bg-slate-900/60 border-slate-800 text-center py-12 px-4 rounded-3xl">
            <CardContent className="space-y-4">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No Farms Found</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  {searchQuery || typeFilter !== 'all' ? "No farm matches your search query or type filter." : "You don't have any registered farms yet. Click below or seed demo data to get started."}
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> Register Farm
                </Button>
                {!hasDemoData && (
                  <Button
                    onClick={handleSeedDemo}
                    variant="outline"
                    className="border-slate-700 text-amber-400 rounded-xl"
                  >
                    Seed Demo Farm
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFarms.map((farm) => {
              const fType = farm.flockType || 'layers';
              return (
                <Card
                  key={farm.id}
                  className="bg-slate-900 border-slate-800 text-white rounded-3xl overflow-hidden hover:border-amber-500/50 transition-all flex flex-col shadow-xl group"
                >
                  <CardHeader className="border-b border-slate-800/80 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] uppercase font-mono font-bold">
                            {farm.county || 'Kenyan County'}
                          </Badge>

                          {/* Super Admin Farm Type Visibility Badge */}
                          {fType === 'broilers' ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                              <Activity className="w-3 h-3" /> BROILERS
                            </Badge>
                          ) : fType === 'dual_purpose' || fType === 'dual_purpose_kienyeji' ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                              <Egg className="w-3 h-3" /> KIENYEJI
                            </Badge>
                          ) : fType === 'breeders' ? (
                            <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> BREEDERS
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                              <Egg className="w-3 h-3" /> LAYERS
                            </Badge>
                          )}
                        </div>

                        <CardTitle className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                          {farm.name}
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize text-xs">
                        {farm.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-slate-400 text-xs flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {farm.location?.address || `${farm.county}, Kenya`}
                    </CardDescription>
                  </CardHeader>

                <CardContent className="py-4 flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono">Owner</span>
                      <span className="font-bold text-slate-200 truncate block">{farm.ownerName || 'Farm Manager'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono">Capacity</span>
                      <span className="font-bold text-amber-400 block">{farm.targetCapacity?.toLocaleString() || '5,000'} Birds</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono flex items-center justify-between">
                        Reg. Users <Users className="w-3 h-3 text-amber-400" />
                      </span>
                      <span className="font-bold text-slate-200 block">{farm.registeredUsersCount || 1} Registered</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono flex items-center justify-between">
                        Last Active <Clock className="w-3 h-3 text-emerald-400" />
                      </span>
                      <span className="font-bold text-emerald-400 block text-[11px] truncate" title={formatLastActive(farm.lastActiveAt || farm.updatedAt)}>
                        {formatLastActive(farm.lastActiveAt || farm.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-mono">
                    <span>Farm ID: <code className="text-slate-200">{farm.id}</code></span>
                    <button
                      onClick={() => copyToClipboard(farm.id || '')}
                      className="p-1 hover:text-amber-400 transition-colors"
                      title="Copy Farm ID"
                    >
                      {copiedId === farm.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </CardContent>

                <CardFooter className="bg-slate-950 border-t border-slate-800/80 p-3 flex gap-2">
                  <Link href={`/farm/${farm.id}`} className="flex-1">
                    <Button
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs h-9"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" /> Open Control Room
                    </Button>
                  </Link>

                  <Button
                    onClick={() => setSelectedTeamFarmId(farm.id || null)}
                    variant="outline"
                    size="icon"
                    className="border-slate-800 text-slate-300 hover:bg-slate-900 rounded-xl h-9 w-9"
                    title="Manage Operators & Onboarding"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
        )}
      </main>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateFarmModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newFarmId) => {
            setIsCreateModalOpen(false);
            if (user) resolveUserRoleAndFarms();
            router.push(`/farm/${newFarmId}`);
          }}
        />
      )}

      {selectedTeamFarmId && (
        <FarmTeamOnboardingModal
          isOpen={!!selectedTeamFarmId}
          onClose={() => setSelectedTeamFarmId(null)}
          farmId={selectedTeamFarmId}
        />
      )}
    </div>
  );
}

export default function OvoCoreDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <PeckingChickenLoader />
      </div>
    }>
      <OvoCoreDashboardContent />
    </Suspense>
  );
}
