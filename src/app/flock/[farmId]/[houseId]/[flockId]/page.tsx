"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
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
  getDoc
} from 'firebase/firestore';
import type { Flock, DailyLog, BreedStandard, FeedBatch } from '@/services/ovocore/firebaseSchema';
import { submitDailyLog, activateEmergencyProtocol } from '@/services/ovocore/flockService';
import { useBreedStandardStore } from '@/store/ovocore/breedStandardStore';
import { FlockOperationsTracker } from '@/components/ovocore/FlockOperationsTracker';
import { OperationalAlertWidget } from '@/components/ovocore/OperationalAlertWidget';
import { EmergencyMortalityProtocol } from '@/components/ovocore/EmergencyMortalityProtocol';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
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
  Activity
} from 'lucide-react';

interface DiagnosticResult {
  type: 'warning' | 'critical' | 'success';
  title: string;
  message: string;
}

export default function OvoCoreFlockLogging() {
  const params = useParams();
  const farmId = params?.farmId as string;
  const houseId = params?.houseId as string;
  const flockId = params?.flockId as string;

  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [flock, setFlock] = useState<(Flock & { id: string }) | null>(null);
  const [feedBatches, setFeedBatches] = useState<(FeedBatch & { id: string })[]>([]);
  const [selectedFeedBatchId, setSelectedFeedBatchId] = useState<string>('');
  const [recentLogs, setRecentLogs] = useState<(DailyLog & { id: string; isPending?: boolean })[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [isEmergencyAcknowledged, setIsEmergencyAcknowledged] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    mortalityCount: 0,
    cullCount: 0,
    feedConsumedKg: 0,
    waterConsumedLiters: 0,
    avgBodyWeightG: 0,
    eggsGradeA: 0,
    eggsGradeB: 0,
    eggsGradeC: 0,
    cracked: 0,
    dirty: 0,
    notes: '',
  });

  const breedStandards = useBreedStandardStore((state) => state.standards);
  const setBreedStandard = useBreedStandardStore((state) => state.setStandard);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Real-time Subscriptions (Flock, Logs, Feed Batches)
  useEffect(() => {
    if (!farmId || !houseId || !flockId) return;

    let isMounted = true;

    // 1. Subscribe to parent flock
    const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);
    const unsubFlock = onSnapshot(flockRef, { includeMetadataChanges: true }, async (docSnap) => {
      if (!isMounted) return;
      if (docSnap.exists()) {
        const data = docSnap.data() as Flock;
        setFlock({ id: docSnap.id, ...data });
        setIsPendingSync(docSnap.metadata.hasPendingWrites);

        // Fetch breed standard if missing from local cache
        if (data.breedStandardId && !breedStandards[data.breedStandardId]) {
          try {
            const standardSnap = await getDoc(doc(db, 'breedStandards', data.breedStandardId));
            if (standardSnap.exists() && isMounted) {
              setBreedStandard({ id: standardSnap.id, ...standardSnap.data() } as BreedStandard);
            }
          } catch (e) {
            console.warn("Could not fetch breed standard:", e);
          }
        }
      }
      setIsLoading(false);
    });

    // 2. Subscribe to Recent Daily Logs (Top 10)
    const logsRef = collection(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs`);
    const logsQ = query(logsRef, orderBy('date', 'desc'), limit(10));
    const unsubLogs = onSnapshot(logsQ, { includeMetadataChanges: true }, (snapshot) => {
      if (!isMounted) return;
      const logs = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DailyLog),
        isPending: d.metadata.hasPendingWrites,
      }));
      setRecentLogs(logs);
    });

    // 3. Fetch available feed batches for this farm
    const feedRef = collection(db, `farms/${farmId}/feedBatches`);
    const unsubFeed = onSnapshot(feedRef, (snapshot) => {
      if (!isMounted) return;
      const batches = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as FeedBatch) }))
        .filter((b) => (b.quantityRemainingKg || 0) > 0);
      setFeedBatches(batches);
      if (batches.length > 0 && !selectedFeedBatchId) {
        setSelectedFeedBatchId(batches[0].id);
      }
    });

    return () => {
      isMounted = false;
      unsubFlock();
      unsubLogs();
      unsubFeed();
    };
  }, [farmId, houseId, flockId]);

  // Derived Calculations
  const calculatedEggsTotal = useMemo(() => {
    return (
      Number(formData.eggsGradeA) +
      Number(formData.eggsGradeB) +
      Number(formData.eggsGradeC) +
      Number(formData.cracked) +
      Number(formData.dirty)
    );
  }, [formData]);

  const flockAgeWeeks = useMemo(() => {
    if (!flock?.dateHoused) return 1;
    const housedDate = flock.dateHoused.toDate
      ? flock.dateHoused.toDate()
      : new Date(flock.dateHoused as any);
    const logDate = new Date(formData.date);
    const diffDays = Math.floor((logDate.getTime() - housedDate.getTime()) / (1000 * 60 * 60 * 24));
    return (flock.initialAgeWeeks || 0) + Math.max(0, Math.floor(diffDays / 7));
  }, [flock, formData.date]);

  // Dynamic Rule-Engine / Diagnostics
  const diagnostics = useMemo((): DiagnosticResult | null => {
    if (!flock || (formData.feedConsumedKg === 0 && calculatedEggsTotal === 0 && formData.mortalityCount === 0)) {
      return null;
    }

    const standard = breedStandards[flock.breedStandardId];
    const curve = standard?.performanceCurve?.[flockAgeWeeks.toString()] || standard?.performanceCurve?.[flockAgeWeeks];

    const currentLiveBirds = Math.max(
      1,
      (flock.currentBirdCount || 0) - Number(formData.mortalityCount) - Number(formData.cullCount)
    );

    // 1. Mortality Spike Check (> 0.15% daily threshold)
    const mortalityPct = (Number(formData.mortalityCount) / (flock.currentBirdCount || 1)) * 100;
    if (mortalityPct >= 0.15) {
      return {
        type: 'critical',
        title: 'Critical Mortality Spike Detected',
        message: `Daily mortality is ${mortalityPct.toFixed(2)}% (${formData.mortalityCount} birds). This exceeds safety thresholds. Inspect for acute disease triggers, heat stress, or ventilation failure immediately.`,
      };
    }

    // 2. Feed Intake Diagnostics
    if (formData.feedConsumedKg > 0) {
      const feedIntakeGrams = (Number(formData.feedConsumedKg) * 1000) / currentLiveBirds;

      if (curve?.feedIntakeG) {
        const feedVariancePct = ((feedIntakeGrams - curve.feedIntakeG) / curve.feedIntakeG) * 100;
        if (feedVariancePct < -12) {
          return {
            type: 'warning',
            title: 'Under-Consumption / Low Feed Intake',
            message: `Birds are eating ${feedIntakeGrams.toFixed(1)}g/bird (Target: ${curve.feedIntakeG}g, ${Math.abs(feedVariancePct).toFixed(0)}% drop). Check nipple lines for water availability and evaluate feed palatability.`,
          };
        }
        if (feedVariancePct > 15) {
          return {
            type: 'warning',
            title: 'Over-Consumption / Potential Feed Spillage',
            message: `Feed intake is high at ${feedIntakeGrams.toFixed(1)}g/bird (Target: ${curve.feedIntakeG}g). Inspect feed troughs for physical spillage, improper feeder height, or rodent infestation.`,
          };
        }
      }
    }

    // 3. Hen-Day Production Diagnostics
    if (calculatedEggsTotal > 0) {
      const henDayPct = (calculatedEggsTotal / currentLiveBirds) * 100;
      if (curve?.henDayPercent && henDayPct < curve.henDayPercent - 6) {
        return {
          type: 'warning',
          title: 'Egg Production Drop Alert',
          message: `Hen-Day is ${henDayPct.toFixed(1)}% vs breed standard ${curve.henDayPercent}%. Review water logs, lighting schedules, and crude protein levels in the feed.`,
        };
      }
      return {
        type: 'success',
        title: 'Production On Track',
        message: `Hen-Day production is performing optimally at ${henDayPct.toFixed(1)}% with ${calculatedEggsTotal.toLocaleString()} total eggs recorded.`,
      };
    }

    return null;
  }, [flock, formData, calculatedEggsTotal, flockAgeWeeks, breedStandards]);

  // Acute Emergency Mortality Check
  const emergencyCheck = useMemo(() => {
    if (!flock) return null;
    const mortalityNumber = Number(formData.mortalityCount);
    if (mortalityNumber <= 0) return null;

    const currentLiveBirds = Math.max(1, (flock.currentBirdCount || 1));
    const mortalityPct = (mortalityNumber / currentLiveBirds) * 100;

    // Standard acute threshold (>= 1.5% or >= 50 birds absolute)
    if (mortalityPct >= 1.5 || mortalityNumber >= 50) {
      return { isEmergency: true, mortalityPct, mortalityNumber };
    }
    return null;
  }, [flock, formData.mortalityCount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Reset emergency acknowledgement if mortality changes significantly
    if (name === 'mortalityCount') {
      setIsEmergencyAcknowledged(false);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'date' || name === 'notes' ? value : Math.max(0, parseFloat(value) || 0),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !flock) return;

    if (calculatedEggsTotal === 0 && formData.feedConsumedKg === 0 && formData.mortalityCount === 0) {
      toast({
        title: 'Empty Log Validation',
        description: 'Please input feed, mortality, or egg counts before saving the operational log.',
        variant: 'destructive',
      });
      return;
    }

    // Live bird boundary validation
    const totalDepletion = Number(formData.mortalityCount) + Number(formData.cullCount);
    if (totalDepletion > flock.currentBirdCount) {
      toast({
        title: 'Depletion Error',
        description: `Mortality and culls (${totalDepletion}) cannot exceed the live flock headcount (${flock.currentBirdCount}).`,
        variant: 'destructive',
      });
      return;
    }

    // Feed boundary validation
    if (formData.feedConsumedKg > 0 && selectedFeedBatchId) {
      const activeBatch = feedBatches.find(b => b.id === selectedFeedBatchId);
      if (activeBatch && formData.feedConsumedKg > (activeBatch.quantityRemainingKg || 0)) {
        toast({
          title: 'Silo Overdraw Error',
          description: `Logged feed (${formData.feedConsumedKg} kg) exceeds remaining capacity of selected batch (${activeBatch.quantityRemainingKg} kg).`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const logPayload: Omit<DailyLog, 'loggedAt'> = {
        date: formData.date,
        mortalityCount: Number(formData.mortalityCount),
        cullCount: Number(formData.cullCount),
        feedConsumedKg: Number(formData.feedConsumedKg),
        waterConsumedLiters: formData.waterConsumedLiters > 0 ? Number(formData.waterConsumedLiters) : null,
        avgBodyWeightG: formData.avgBodyWeightG > 0 ? Number(formData.avgBodyWeightG) : null,
        temperatureC: null,
        humidityPercent: null,
        notes: formData.notes.trim() || null,
        loggedBy: user.uid,
        recordedByName: user.displayName || user.email || 'Unknown Operator',
        syncStatus: 'synced',
        eggsCollected: {
          total: calculatedEggsTotal,
          gradeA: Number(formData.eggsGradeA),
          gradeB: Number(formData.eggsGradeB),
          gradeC: Number(formData.eggsGradeC),
          cracked: Number(formData.cracked),
          dirty: Number(formData.dirty),
        },
      };

      await submitDailyLog(db, {
        farmId,
        houseId,
        flockId,
        feedBatchId: selectedFeedBatchId || undefined,
        logData: logPayload,
      });

      toast({
        title: 'Daily Log Committed',
        description: `Production data for ${formData.date} securely logged and flock balance reconciled.`,
      });

      // Clear input fields for next entry while preserving date & batch
      setFormData((prev) => ({
        ...prev,
        mortalityCount: 0,
        cullCount: 0,
        feedConsumedKg: 0,
        waterConsumedLiters: 0,
        avgBodyWeightG: 0,
        eggsGradeA: 0,
        eggsGradeB: 0,
        eggsGradeC: 0,
        cracked: 0,
        dirty: 0,
        notes: '',
      }));
    } catch (error) {
      console.error("Submission failed:", error);
      toast({
        title: 'Error Saving Log',
        description: 'Failed to commit atomic batch update. Entry queued for offline sync.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] p-6">
        <PeckingChickenLoader
          size="lg"
          message="Connecting to flock stream & production telemetry..."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
      {/* 1. Header & Live Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 bg-card p-6 rounded-3xl shadow-sm">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 mt-1">
            <Link href={`/projects/21-ovocore/farm/${farmId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                Daily Log Capture
              </h1>
              {isPendingSync && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 flex items-center gap-1.5 text-[10px] font-bold">
                  <WifiOff className="h-3 w-3" /> Offline Queued
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-bold text-foreground">{flock?.flockCode}</span>
              <span>•</span>
              <span className="capitalize">{flock?.breed}</span>
              <span>•</span>
              <span>Production Week {flockAgeWeeks}</span>
            </p>
          </div>
        </div>

        {/* Live Denormalized Status Pill */}
        <div className="flex items-center gap-4 bg-muted/30 border border-border/80 p-3 px-5 rounded-2xl text-xs shadow-xs">
          <div>
            <span className="text-muted-foreground font-semibold uppercase tracking-wider block text-[10px]">Live Birds</span>
            <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
              {flock?.currentBirdCount.toLocaleString()}
            </span>
          </div>
          <div className="border-l border-border/60 pl-4">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider block text-[10px]">Lifetime Output</span>
            <span className="font-black text-lg text-foreground">{flock?.cumulativeEggs.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">Eggs</span></span>
          </div>
        </div>
      </div>

      {flock && (
        <>
          <FlockOperationsTracker
            placementDate={flock.dateHoused.toDate ? flock.dateHoused.toDate().toISOString() : new Date(flock.dateHoused as any).toISOString()}
            flockType={flock.breed.toLowerCase().includes('layer') ? 'Layers' : 'Broilers'}
          />
          <OperationalAlertWidget 
            placementDate={flock.dateHoused.toDate ? flock.dateHoused.toDate().toISOString() : new Date(flock.dateHoused as any).toISOString()} 
          />
        </>
      )}

      {flock?.status === 'quarantine_alert' && (
        <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-lg shadow-rose-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-white animate-pulse" />
            <div>
              <h2 className="font-black text-sm uppercase tracking-wider">Flock Under Quarantine</h2>
              <p className="text-xs text-rose-100 mt-0.5 font-medium">Critical Emergency Protocol is currently active. Commercial egg/meat outflow is frozen.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-white border-white/30 bg-white/10 shrink-0">
            RESTRICTED ACCESS
          </Badge>
        </div>
      )}

      {emergencyCheck && !isEmergencyAcknowledged && (
        <EmergencyMortalityProtocol
          mortalityCount={emergencyCheck.mortalityNumber}
          mortalityPct={emergencyCheck.mortalityPct}
          onAcknowledge={async () => {
            try {
              setIsEmergencyAcknowledged(true);
              await activateEmergencyProtocol(db, farmId, houseId, flockId);
              toast({
                title: "Emergency Protocol Activated",
                description: "Flock placed under quarantine. Alerts dispatched to leadership.",
                variant: "destructive"
              });
            } catch (err) {
              console.error("Failed to activate emergency protocol:", err);
              toast({ title: "Activation Failed", description: "Could not activate protocol.", variant: "destructive" });
            }
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Form Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit}>
            <Card className="shadow-sm border border-border/80 rounded-3xl overflow-hidden">
              <CardHeader className="pb-4 bg-muted/20 border-b border-border/60">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
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
                    className={`p-4 rounded-2xl flex items-start gap-3 border transition-all ${diagnostics.type === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                        : diagnostics.type === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                      }`}
                  >
                    {diagnostics.type === 'critical' || diagnostics.type === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-current" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-current" />
                    )}
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-sm">{diagnostics.title}</p>
                      <p className="leading-relaxed font-medium">{diagnostics.message}</p>
                    </div>
                  </div>
                )}

                {/* Date & Inventory Source */}
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

                {/* Feed & Water Intake */}
                <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-500" /> Resource Consumption
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="feedConsumedKg" className="text-[11px] font-bold text-muted-foreground">Feed Consumed (kg)</Label>
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

                {/* Egg Production Breakdown */}
                <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-4">
                  <div className="flex justify-between items-center border-b border-border/60 pb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Egg className="w-3.5 h-3.5 text-emerald-500" /> Egg Collection & Grading
                    </h4>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Total: {calculatedEggsTotal.toLocaleString()} Eggs ({(calculatedEggsTotal / 30).toFixed(1)} Trays)
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

                {/* Weight Sampling & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="avgBodyWeightG" className="text-[11px] font-bold text-muted-foreground">Weekly Sample Weight (Grams)</Label>
                    <Input
                      id="avgBodyWeightG"
                      type="number"
                      name="avgBodyWeightG"
                      value={formData.avgBodyWeightG || ''}
                      onChange={handleInputChange}
                      min={0}
                      placeholder="e.g. 1950"
                      className="h-10 rounded-xl font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-[11px] font-bold text-muted-foreground">Observations / Supervisor Notes</Label>
                    <Input
                      id="notes"
                      type="text"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="e.g. Shed 3 fan maintenance completed"
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-6 px-6">
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-sm font-bold rounded-2xl shadow-sm shadow-primary/20">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Committing Atomic Transaction...
                    </>
                  ) : (
                    'Commit Daily Operational Log'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        {/* Right Column: Historical Stream & Benchmarking (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-xs border border-border/80 rounded-3xl overflow-hidden">
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
                  const logHenDay = flock && flock.currentBirdCount > 0
                    ? ((log.eggsCollected?.total || 0) / flock.currentBirdCount * 100).toFixed(1)
                    : "0.0";

                  return (
                    <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{log.date}</span>
                            {log.isPending && (
                              <Badge variant="outline" className="text-[10px] text-amber-500 bg-amber-500/10 border-amber-500/30 py-0 px-1.5 font-bold uppercase">
                                Syncing
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <Egg className="w-3 h-3 text-emerald-500" /> {log.eggsCollected?.total.toLocaleString()}
                            <span className="opacity-50">|</span>
                            <Wheat className="w-3 h-3 text-amber-500" /> {log.feedConsumedKg} kg
                          </p>
                        </div>

                        <div className="text-right space-y-1">
                          <Badge variant="secondary" className="font-mono text-xs bg-primary/10 text-primary hover:bg-primary/20">
                            {logHenDay}% HD
                          </Badge>
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

                      {log.recordedByName && (
                        <div className="mt-2 pt-2 border-t border-border/40 text-[9px] text-muted-foreground flex justify-between">
                          <span>Operator: {log.recordedByName}</span>
                        </div>
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