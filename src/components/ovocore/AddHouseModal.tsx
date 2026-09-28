"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  Building2,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Wind
} from 'lucide-react';

export interface AddHouseModalProps {
  farmId: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

// Density standards based on house mechanics and ventilation architecture (birds per square meter)
const DENSITY_STANDARDS = {
  layers: {
    natural: { min: 6, recommended: 7, max: 8 },
    tunnel: { min: 8, recommended: 10, max: 12 },
    cages: { min: 14, recommended: 18, max: 22 }
  },
  broilers: {
    natural: { min: 10, recommended: 12, max: 14 },
    tunnel: { min: 14, recommended: 16, max: 18 },
    cages: { min: 18, recommended: 20, max: 24 }
  },
  brooders: {
    natural: { min: 18, recommended: 20, max: 24 },
    tunnel: { min: 22, recommended: 25, max: 30 },
    cages: { min: 25, recommended: 30, max: 35 }
  }
};

export function AddHouseModal({ farmId, isOpen, onClose, trigger }: AddHouseModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [farmType, setFarmType] = useState<'layers' | 'broilers'>('layers');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    houseName: '',
    houseType: 'Layer House',
    capacityBirds: '',
    ventilationType: 'Natural (Open Sided)',
    feederType: 'Manual Hanging Feeders',
    drinkerType: 'Nipple Drinker Lines',
    heatingSystem: 'None / Adult House',
    lengthMeters: '',
    widthMeters: '',
    biosecurityLevel: 'Standard Level 2',
  });

  const [isCapacityOverridden, setIsCapacityOverridden] = useState(false);

  // 1. Detect farm enterprise type to adjust defaults
  useEffect(() => {
    if (!open || !farmId) return;
    async function checkFarmType() {
      try {
        const farmSnap = await getDoc(doc(db, 'farms', farmId));
        if (farmSnap.exists()) {
          const type = farmSnap.data().flockType;
          if (type === 'broilers') {
            setFarmType('broilers');
            setFormData(prev => ({
              ...prev,
              houseType: 'Broiler House',
              heatingSystem: 'Commercial Gas Brooders'
            }));
          } else {
            setFarmType('layers');
            setFormData(prev => ({
              ...prev,
              houseType: 'Layer House',
              heatingSystem: 'None / Adult House'
            }));
          }
        }
      } catch (e) {
        console.warn("Could not determine farm type:", e);
      }
    }
    checkFarmType();
  }, [open, farmId]);

  // 2. Computed Floor Surface Area
  const computedAreaSqM = useMemo(() => {
    const l = parseFloat(formData.lengthMeters);
    const w = parseFloat(formData.widthMeters);
    if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
      return Number((l * w).toFixed(2));
    }
    return null;
  }, [formData.lengthMeters, formData.widthMeters]);

  // 3. Dynamic Density Computations (Min, Recommended, Max)
  const densityCalculation = useMemo(() => {
    if (computedAreaSqM === null || computedAreaSqM <= 0) return null;

    // Resolve category key
    let categoryKey: 'layers' | 'broilers' | 'brooders' = 'layers';
    if (formData.houseType === 'Broiler House') categoryKey = 'broilers';
    else if (formData.houseType === 'Brooder House') categoryKey = 'brooders';

    // Resolve system & ventilation mechanics
    let mode: 'natural' | 'tunnel' | 'cages' = 'natural';
    if (formData.feederType.includes('Battery') || formData.drinkerType.includes('Cup')) {
      mode = 'cages';
    } else if (formData.ventilationType.includes('Tunnel') || formData.ventilationType.includes('Environmentally')) {
      mode = 'tunnel';
    }

    const rates = DENSITY_STANDARDS[categoryKey][mode];

    return {
      densityRates: rates,
      minCapacity: Math.round(computedAreaSqM * rates.min),
      recommendedCapacity: Math.round(computedAreaSqM * rates.recommended),
      maxCapacity: Math.round(computedAreaSqM * rates.max),
      modeLabel: mode === 'cages' ? 'Battery Cage Density' : mode === 'tunnel' ? 'Tunnel Ventilated Floor' : 'Open-Sided Natural Floor'
    };
  }, [computedAreaSqM, formData.houseType, formData.ventilationType, formData.feederType, formData.drinkerType]);

  // Sync capacity if not overridden
  const activeCapacity = useMemo(() => {
    if (!isCapacityOverridden && densityCalculation) {
      return densityCalculation.recommendedCapacity.toString();
    }
    return formData.capacityBirds;
  }, [isCapacityOverridden, densityCalculation, formData.capacityBirds]);

  const handleApplyPreset = (value: number) => {
    setIsCapacityOverridden(true);
    setFormData(prev => ({ ...prev, capacityBirds: value.toString() }));
  };

  const handleCapacityChange = (val: string) => {
    setIsCapacityOverridden(true);
    setFormData(prev => ({ ...prev, capacityBirds: val }));
  };

  const handleResetToSuggested = () => {
    setIsCapacityOverridden(false);
    if (densityCalculation) {
      setFormData(prev => ({ ...prev, capacityBirds: densityCalculation.recommendedCapacity.toString() }));
    }
  };

  // Overstocking & Understocking Diagnostic
  const capacityAnalysis = useMemo(() => {
    const entered = parseFloat(activeCapacity);
    if (!densityCalculation || isNaN(entered) || entered <= 0) return null;

    const { minCapacity, maxCapacity, recommendedCapacity } = densityCalculation;

    if (entered > maxCapacity) {
      const overBy = entered - maxCapacity;
      const pctOver = Math.round((overBy / maxCapacity) * 100);
      return {
        status: 'overstocked',
        message: `Exceeds max safe density by ~${pctOver}% (+${overBy.toLocaleString()} birds).`,
        implications: [
          'High risk of thermal heat stress, rapid ammonia buildup, and wet litter.',
          'Elevated mortality spikes and reduced flock uniformity.'
        ],
        adjustments: [
          'Upgrade ventilation to high-capacity extraction fans.',
          'Install additional drinker nipples and automated feeding pans.'
        ]
      };
    } else if (entered < minCapacity) {
      const underBy = minCapacity - entered;
      return {
        status: 'understocked',
        message: `Underutilizing floor space by ${underBy.toLocaleString()} birds below standard density.`,
        implications: [
          'Higher brooding heating and energy costs per bird.',
          'Sub-optimal return on shed construction capital.'
        ],
        adjustments: [
          'Partition shed during early brooding to concentrate heating footprint.'
        ]
      };
    }

    return {
      status: 'optimal',
      message: 'Capacity is within recommended stocking density boundaries.'
    };
  }, [activeCapacity, densityCalculation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCapacity = Number(activeCapacity);
    if (!farmId || !formData.houseName.trim() || !finalCapacity) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please provide a house name and valid bird capacity.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `farms/${farmId}/houses`), {
        houseName: formData.houseName.trim(),
        houseType: formData.houseType,
        capacityBirds: finalCapacity,
        densityPerSqM: computedAreaSqM ? Number((finalCapacity / computedAreaSqM).toFixed(1)) : null,
        suggestedCapacity: densityCalculation?.recommendedCapacity || finalCapacity,
        isCapacityOverridden,
        ventilationType: formData.ventilationType,
        feederType: formData.feederType,
        drinkerType: formData.drinkerType,
        heatingSystem: formData.heatingSystem,
        lengthMeters: formData.lengthMeters ? Number(formData.lengthMeters) : null,
        widthMeters: formData.widthMeters ? Number(formData.widthMeters) : null,
        dimensionsSqM: computedAreaSqM,
        biosecurityLevel: formData.biosecurityLevel,
        currentFlockId: null,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'House Configured',
        description: `${formData.houseName} added with a capacity of ${finalCapacity.toLocaleString()} birds.`
      });

      setOpen(false);
      setFormData({
        houseName: '',
        houseType: farmType === 'broilers' ? 'Broiler House' : 'Layer House',
        capacityBirds: '',
        ventilationType: 'Natural (Open Sided)',
        feederType: 'Manual Hanging Feeders',
        drinkerType: 'Nipple Drinker Lines',
        heatingSystem: farmType === 'broilers' ? 'Commercial Gas Brooders' : 'None / Adult House',
        lengthMeters: '',
        widthMeters: '',
        biosecurityLevel: 'Standard Level 2',
      });
      setIsCapacityOverridden(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to record house configuration.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="font-bold text-xs h-10 rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Add Production House
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Configure Production House
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter shed dimensions to automatically calculate stocking density for {farmType === 'broilers' ? 'meat broilers' : 'commercial layers'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">

          {/* 1. Name & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="houseName" className="font-semibold text-muted-foreground">House Name / Shed ID *</Label>
              <Input
                id="houseName"
                value={formData.houseName}
                onChange={(e) => setFormData(prev => ({ ...prev, houseName: e.target.value }))}
                placeholder="e.g. Shed 1 (East Wing)"
                required
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="houseType" className="font-semibold text-muted-foreground">Enterprise Purpose</Label>
              <Select
                value={formData.houseType}
                onValueChange={(val) => setFormData(prev => ({ ...prev, houseType: val }))}
              >
                <SelectTrigger id="houseType" className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="Layer House">Layer House (Commercial Table Eggs)</SelectItem>
                  <SelectItem value="Broiler House">Broiler House (Meat Production)</SelectItem>
                  <SelectItem value="Brooder House">Brooder House (0–6 Weeks)</SelectItem>
                  <SelectItem value="Multi-Purpose">Multi-Purpose Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Dimensions & Area */}
          <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-muted/30 border border-border/70 rounded-2xl">
            <div className="space-y-1">
              <Label htmlFor="lengthMeters" className="text-[10px] uppercase font-bold text-muted-foreground">Length (m)</Label>
              <Input
                id="lengthMeters"
                type="number"
                step="0.1"
                min="1"
                value={formData.lengthMeters}
                onChange={(e) => setFormData(prev => ({ ...prev, lengthMeters: e.target.value }))}
                placeholder="e.g. 60"
                className="h-9 rounded-xl font-mono text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="widthMeters" className="text-[10px] uppercase font-bold text-muted-foreground">Width (m)</Label>
              <Input
                id="widthMeters"
                type="number"
                step="0.1"
                min="1"
                value={formData.widthMeters}
                onChange={(e) => setFormData(prev => ({ ...prev, widthMeters: e.target.value }))}
                placeholder="e.g. 12"
                className="h-9 rounded-xl font-mono text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                <Calculator className="w-3 h-3" /> Area
              </Label>
              <div className="h-9 px-3 flex items-center justify-center bg-background rounded-xl border font-mono font-bold text-xs text-foreground">
                {computedAreaSqM !== null ? `${computedAreaSqM} m²` : '—'}
              </div>
            </div>
          </div>

          {/* 3. Automatic Density Calculation Strip */}
          {densityCalculation && (
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1 text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> {densityCalculation.modeLabel}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Rec: {densityCalculation.densityRates.recommended} birds/m²
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(densityCalculation.minCapacity)}
                  className="p-2 rounded-xl border bg-card hover:border-primary/50 transition-all text-left"
                >
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block">Minimum</span>
                  <span className="font-mono font-bold text-xs text-foreground block">
                    {densityCalculation.minCapacity.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">({densityCalculation.densityRates.min}/m²)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset(densityCalculation.recommendedCapacity)}
                  className="p-2 rounded-xl border-2 border-primary/40 bg-primary/10 transition-all text-left"
                >
                  <span className="text-[9px] uppercase font-bold text-primary block">Recommended</span>
                  <span className="font-mono font-black text-xs text-primary block">
                    {densityCalculation.recommendedCapacity.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-primary/80 font-mono">({densityCalculation.densityRates.recommended}/m²)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset(densityCalculation.maxCapacity)}
                  className="p-2 rounded-xl border bg-card hover:border-primary/50 transition-all text-left"
                >
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block">Maximum</span>
                  <span className="font-mono font-bold text-xs text-foreground block">
                    {densityCalculation.maxCapacity.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">({densityCalculation.densityRates.max}/m²)</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. Active Capacity Input */}
          <div className="space-y-1.5 p-3 rounded-2xl border bg-background">
            <div className="flex items-center justify-between">
              <Label htmlFor="capacityBirds" className="font-bold text-xs">Configured Bird Capacity *</Label>
              {isCapacityOverridden && densityCalculation && (
                <button
                  type="button"
                  onClick={handleResetToSuggested}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to Recommended ({densityCalculation.recommendedCapacity.toLocaleString()})
                </button>
              )}
            </div>

            <Input
              id="capacityBirds"
              type="number"
              min="1"
              value={activeCapacity}
              onChange={(e) => handleCapacityChange(e.target.value)}
              placeholder="e.g. 5000"
              className="h-10 rounded-xl font-mono text-sm font-bold"
              required
            />

            {/* Implication Analysis Feedback */}
            {capacityAnalysis && capacityAnalysis.status !== 'optimal' && (
              <div className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 mt-2 ${capacityAnalysis.status === 'overstocked'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
                }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{capacityAnalysis.message}</span>
                </div>
                {capacityAnalysis.implications && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground dark:text-muted-foreground">
                    {capacityAnalysis.implications.map((imp, idx) => (
                      <li key={idx}>{imp}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* 5. Mechanical Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ventilationType" className="font-semibold text-muted-foreground">Ventilation Architecture</Label>
              <Select
                value={formData.ventilationType}
                onValueChange={(val) => setFormData(prev => ({ ...prev, ventilationType: val }))}
              >
                <SelectTrigger id="ventilationType" className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Ventilation" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="Natural (Open Sided)">Natural (Open-Sided with Curtains)</SelectItem>
                  <SelectItem value="Tunnel">Tunnel Ventilated (Exhaust Fans + Pads)</SelectItem>
                  <SelectItem value="Environmentally Controlled">Environmentally Controlled (Automated EC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feederType" className="font-semibold text-muted-foreground">Feeding System</Label>
              <Select
                value={formData.feederType}
                onValueChange={(val) => setFormData(prev => ({ ...prev, feederType: val }))}
              >
                <SelectTrigger id="feederType" className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Feeding" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="Manual Hanging Feeders">Manual Hanging Tube Feeders</SelectItem>
                  <SelectItem value="Automated Pan Feeders">Automated Pan Feeders</SelectItem>
                  <SelectItem value="Automated Chain Feeders">Automated Chain Feeders</SelectItem>
                  <SelectItem value="Battery Trough Feeders">Battery Cage Trough Feeders</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="drinkerType" className="font-semibold text-muted-foreground">Watering System</Label>
              <Select
                value={formData.drinkerType}
                onValueChange={(val) => setFormData(prev => ({ ...prev, drinkerType: val }))}
              >
                <SelectTrigger id="drinkerType" className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Drinkers" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="Nipple Drinker Lines">Automated Nipple Drinker Lines</SelectItem>
                  <SelectItem value="Bell Drinkers">Hanging Bell Drinkers</SelectItem>
                  <SelectItem value="Cup Drinkers">Cup Drinkers (Battery Cages)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="heatingSystem" className="font-semibold text-muted-foreground">Heating / Brooding</Label>
              <Select
                value={formData.heatingSystem}
                onValueChange={(val) => setFormData(prev => ({ ...prev, heatingSystem: val }))}
              >
                <SelectTrigger id="heatingSystem" className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Heating" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="None / Adult House">None (Adult Layer House)</SelectItem>
                  <SelectItem value="Commercial Gas Brooders">Commercial Gas Brooders</SelectItem>
                  <SelectItem value="Infrared Brooder Lamps">Infrared Electric Lamps</SelectItem>
                  <SelectItem value="Charcoal Jikos / Heaters">Charcoal Heaters / Salamanders</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs font-bold h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-bold text-xs h-11 px-5 bg-primary text-primary-foreground shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Shed Configuration...
                </>
              ) : (
                'Commit House Configuration'
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}