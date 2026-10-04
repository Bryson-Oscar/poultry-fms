// components/AddFlockModal.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  POULTRY_STRAIN_STANDARDS,
  BirdCategory,
  computeFlockRequirements
} from '@/lib/ovocore/flockLifecycleEngine';
import {
  Egg,
  Calendar,
  Wheat,
  Droplets,
  Sun,
  ShieldCheck,
  Sparkles,
  Loader2,
  Clock,
  Activity,
  AlertCircle
} from 'lucide-react';

export interface AddFlockModalProps {
  farmId: string;
  houseId?: string;
  initialHouseId?: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddFlockModal({ farmId, houseId, initialHouseId, isOpen, onClose, trigger, onSuccess }: AddFlockModalProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const openState = isOpen !== undefined ? isOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [category, setCategory] = useState<BirdCategory>('commercial_layers');
  const [breed, setBreed] = useState<string>('Lohmann Brown');
  const [flockCode, setFlockCode] = useState<string>('');
  const [initialBirdCount, setInitialBirdCount] = useState<number>(1000);
  const [currentAgeWeeks, setCurrentAgeWeeks] = useState<number>(0); // 0 = DOC, 18 = POL, etc.
  const [sourceHatchery, setSourceHatchery] = useState<string>('Kenchic / Muguku');
  const [housedDateString, setHousedDateString] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Auto-inspect farm type to set default flock category
  useEffect(() => {
    if (!openState || !farmId) return;
    async function checkFarmType() {
      try {
        const farmRef = doc(db, 'farms', farmId);
        const snap = await getDoc(farmRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.flockType === 'broilers') {
            setCategory('broilers');
          } else if (data.flockType === 'dual_purpose' || data.flockType === 'dual_purpose_kienyeji') {
            setCategory('dual_purpose_kienyeji');
          } else if (data.flockType === 'breeders') {
            setCategory('breeders_parent_stock');
          }
        }
      } catch (e) {
        console.warn("Could not inspect farm type for flock modal:", e);
      }
    }
    checkFarmType();
  }, [openState, farmId]);

  // Auto-generate a clean flock code when category or house changes
  useEffect(() => {
    const prefix = category === 'commercial_layers' ? 'LAY' : category === 'broilers' ? 'BRL' : 'KNJ';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    setFlockCode(`${prefix}-${rand}`);
  }, [category, isOpen]);

  // Update default breed selection when category changes
  useEffect(() => {
    const breeds = POULTRY_STRAIN_STANDARDS[category]?.defaultBreeds || [];
    if (breeds.length > 0) setBreed(breeds[0]);
  }, [category]);

  // Dynamic lifecycle computation based on current entry age
  const computation = useMemo(() => {
    const baseDate = housedDateString ? new Date(housedDateString) : new Date();
    return computeFlockRequirements(category, currentAgeWeeks, baseDate);
  }, [category, currentAgeWeeks, housedDateString]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flockCode.trim() || initialBirdCount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify a valid flock code and bird count.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const targetHouseId = houseId || initialHouseId;
      if (!targetHouseId) {
        throw new Error("No house selected or provided for this flock.");
      }
      
      const flockRef = doc(collection(db, `farms/${farmId}/houses/${targetHouseId}/flocks`));
      const flockId = flockRef.id;

      const housedDate = new Date(housedDateString);

      // Back-calculate approximate hatch date if birds are introduced as older pullets
      const calculatedHatchDate = new Date(housedDate.getTime());
      calculatedHatchDate.setDate(calculatedHatchDate.getDate() - (currentAgeWeeks * 7));

      const flockPayload = {
        id: flockId,
        flockCode: flockCode.trim().toUpperCase(),
        category,
        breed,
        sourceHatchery,
        initialBirdCount,
        currentBirdCount: initialBirdCount,
        initialAgeWeeks: currentAgeWeeks,
        targetCycleWeeks: computation.totalCycleWeeks,
        remainingWeeksAtPlacement: computation.remainingCycleWeeks,
        targetEndDate: computation.targetEndDate.toISOString(),
        dateHoused: housedDate.toISOString(),
        hatchDate: calculatedHatchDate.toISOString(),
        currentPhaseName: computation.activePhase.stageName,
        recommendedFeedType: computation.activePhase.feedType,
        cumulativeEggs: 0,
        cumulativeMortality: 0,
        cumulativeFeedKg: 0,
        status: 'active',
        createdAt: serverTimestamp()
      };

      // 1. Write the flock subcollection document
      await setDoc(flockRef, flockPayload);

      // 2. Point the parent house to this newly active flock
      await updateDoc(doc(db, `farms/${farmId}/houses/${targetHouseId}`), {
        currentFlockId: flockId,
        updatedAt: serverTimestamp()
      });

      toast({
        title: 'Flock Registered & Telemetry Initialized! 🐣',
        description: `Flock ${flockCode} placed at Week ${currentAgeWeeks}. Expected completion: ${computation.targetEndDate.toLocaleDateString('en-GB')}`
      });

      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Flock placement error:', err);
      toast({
        variant: 'destructive',
        title: 'Placement Failed',
        description: err.message || 'Could not register flock.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={openState} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="rounded-xl font-bold text-xs">
            <Egg className="w-3.5 h-3.5 mr-1.5" /> Place New Flock
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Egg className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Place Flock Batch & Auto-Lifecycle Profiling
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter placement age (from Day-Old-Chicks up to established layers). The engine adapts target cycles, end dates, and feeding guidelines.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          
          {/* 1. Category & Breed Setup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Bird Category
              </Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BirdCategory)}
                className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="commercial_layers">Commercial Layers (Table Eggs)</option>
                <option value="broilers">Meat Broilers (Intensive)</option>
                <option value="dual_purpose_kienyeji">Improved Kienyeji / Dual-Purpose</option>
                <option value="breeders_parent_stock">Parent Stock / Breeders</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Breed Strain
              </Label>
              <select
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="w-full p-2.5 bg-background border border-border/80 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {(POULTRY_STRAIN_STANDARDS[category]?.defaultBreeds || []).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Flock Identification, Headcount & Entry Age */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Flock Batch Code
              </Label>
              <Input
                value={flockCode}
                onChange={(e) => setFlockCode(e.target.value)}
                placeholder="e.g. LAY-8821"
                className="h-10 text-xs font-mono font-bold rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Bird Count (Stocked)
              </Label>
              <Input
                type="number"
                min={1}
                value={initialBirdCount}
                onChange={(e) => setInitialBirdCount(Number(e.target.value))}
                className="h-10 text-xs font-bold rounded-xl"
                required
              />
            </div>

            {/* Crucial: Current Age in Weeks Slider/Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Current Age
                </Label>
                <span className="text-xs font-mono font-extrabold text-primary">
                  {currentAgeWeeks} Weeks
                </span>
              </div>
              <Input
                type="number"
                min={0}
                max={computation.totalCycleWeeks - 1}
                value={currentAgeWeeks}
                onChange={(e) => setCurrentAgeWeeks(Math.max(0, Number(e.target.value)))}
                className="h-10 text-xs font-bold rounded-xl"
                required
              />
            </div>
          </div>

          {/* Quick Pre-Set Age Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Quick Select:</span>
            <button
              type="button"
              onClick={() => setCurrentAgeWeeks(0)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                currentAgeWeeks === 0
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 hover:bg-muted border-border/70 text-muted-foreground'
              }`}
            >
              Day-Old Chicks (0 Wk)
            </button>
            {category === 'commercial_layers' && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentAgeWeeks(18)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    currentAgeWeeks === 18
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 hover:bg-muted border-border/70 text-muted-foreground'
                  }`}
                >
                  Point of Lay (18 Wks)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentAgeWeeks(32)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    currentAgeWeeks === 32
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 hover:bg-muted border-border/70 text-muted-foreground'
                  }`}
                >
                  Mid-Peak Lay (32 Wks)
                </button>
              </>
            )}
          </div>

          {/* 3. AUTO-COMPUTED TARGET END CYCLE & HORIZON (Hero Display) */}
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Intelligent Cycle Target
              </span>
              <Badge variant="outline" className="bg-background text-foreground text-[10px] font-mono font-bold">
                {computation.entryAgeClassification}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2 rounded-xl bg-background/80 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Standard Life</span>
                <p className="font-mono font-black text-sm text-foreground">
                  {computation.totalCycleWeeks} Weeks
                </p>
              </div>

              <div className="p-2 rounded-xl bg-background/80 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Target Remaining</span>
                <p className="font-mono font-black text-sm text-primary">
                  {computation.remainingCycleWeeks} Weeks
                </p>
              </div>

              <div className="p-2 rounded-xl bg-background/80 border border-border/50 col-span-2">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Target Depletion / Culling</span>
                <p className="font-bold text-xs text-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  {computation.targetEndDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* 4. DYNAMIC OPERATIONAL STATE & DAILY INTAKE BENCHMARKS */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Activity className="w-4 h-4 text-emerald-500" />
                Active Operational Requirement:
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {computation.activePhase.stageName}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground font-medium">
              Operational Focus: <strong className="text-foreground">{computation.activePhase.operationalStatus}</strong>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
              <div className="p-2 rounded-xl bg-card border border-border/60 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Wheat className="w-3 h-3 text-amber-500" /> Ration Spec
                </span>
                <p className="font-semibold text-[11px] text-foreground leading-tight">
                  {computation.activePhase.feedType}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-card border border-border/60 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Wheat className="w-3 h-3 text-amber-500" /> Daily Feed Batch
                </span>
                <p className="font-mono font-bold text-xs text-foreground">
                  {computation.dailyFarmFeedNeedKg(initialBirdCount).toLocaleString()} kg / day
                </p>
                <span className="text-[9px] text-muted-foreground">({computation.activePhase.targetIntakeGramsPerBirdDay}g / bird)</span>
              </div>

              <div className="p-2 rounded-xl bg-card border border-border/60 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" /> Daily Water
                </span>
                <p className="font-mono font-bold text-xs text-foreground">
                  {computation.dailyFarmWaterNeedLiters(initialBirdCount).toLocaleString()} L / day
                </p>
                <span className="text-[9px] text-muted-foreground">({computation.activePhase.waterIntakeMlPerBirdDay}ml / bird)</span>
              </div>

              <div className="p-2 rounded-xl bg-card border border-border/60 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-500" /> Lighting Program
                </span>
                <p className="font-mono font-bold text-xs text-foreground">
                  {computation.activePhase.lightHours} Hours / Day
                </p>
                <span className="text-[9px] text-muted-foreground">{computation.activePhase.targetTempCelsius}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-background border border-border/60 text-[11px] text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span><strong>Phase Health Milestone:</strong> {computation.activePhase.biosecurityCheck}</span>
            </div>
          </div>

          {/* 5. Hatchery & Stocking Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Source Hatchery / Breeder
              </Label>
              <Input
                value={sourceHatchery}
                onChange={(e) => setSourceHatchery(e.target.value)}
                placeholder="e.g. Kenchic, Muguku, Bixa"
                className="h-10 text-xs font-semibold rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Placement / Arrival Date
              </Label>
              <Input
                type="date"
                value={housedDateString}
                onChange={(e) => setHousedDateString(e.target.value)}
                className="h-10 text-xs font-semibold rounded-xl"
                required
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end gap-2 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="rounded-xl text-xs font-bold h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold h-11 px-5 bg-primary text-primary-foreground shadow-md shadow-primary/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Initializing Flock Telemetry...
                </>
              ) : (
                <>
                  <Egg className="w-4 h-4 mr-2" /> Commit & Stock Flock Batch
                </>
              )}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}