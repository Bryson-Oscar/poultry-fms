// components/AddFeedBatchModal.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  Wheat,
  CalendarDays,
  DollarSign,
  Scale,
  Sparkles,
  Layers,
  Clock,
  Egg,
  ShieldCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import {
  computeFlockRequirements,
  BirdCategory,
  POULTRY_STRAIN_STANDARDS
} from '@/lib/ovocore/flockLifecycleEngine';
import type { House, Flock } from '@/services/ovocore/firebaseSchema';

// Standard East African Rations and Quality Targets
export const standardQualitySpecs: Record<string, { cp: number; energy: number; targetCategory: BirdCategory }> = {
  "Chick Starter Mash (0–4 wks)": { cp: 20.0, energy: 2950, targetCategory: "commercial_layers" },
  "Chick Starter Mash / Crumbs (CP 20%)": { cp: 20.0, energy: 2950, targetCategory: "commercial_layers" },
  "Growers Mash (8–18 weeks)": { cp: 16.0, energy: 2750, targetCategory: "commercial_layers" },
  "Grower Mash (CP 16%)": { cp: 16.0, energy: 2750, targetCategory: "commercial_layers" },
  "Pre-Lay Mash (CP 17.5%, Ca 2.5%)": { cp: 17.5, energy: 2750, targetCategory: "commercial_layers" },
  "Layers Complete Mash Phase 1 (CP 17.5%, Ca 3.8%)": { cp: 17.5, energy: 2750, targetCategory: "commercial_layers" },
  "Layers Phase 1 (Peak Production)": { cp: 17.5, energy: 2750, targetCategory: "commercial_layers" },
  "Layers Complete Mash Phase 2 (CP 16%, Ca 4.2%)": { cp: 16.0, energy: 2700, targetCategory: "commercial_layers" },
  "Layers Phase 2 (Mid Production)": { cp: 16.0, energy: 2700, targetCategory: "commercial_layers" },
  "Broiler Starter Crumbs (CP 22%)": { cp: 22.0, energy: 3050, targetCategory: "broilers" },
  "Broiler Grower Pellets (CP 20%)": { cp: 20.0, energy: 3100, targetCategory: "broilers" },
  "Broiler Finisher Pellets (CP 18%)": { cp: 18.0, energy: 3150, targetCategory: "broilers" },
  "Kienyeji Starter (CP 19%)": { cp: 19.0, energy: 2850, targetCategory: "dual_purpose_kienyeji" },
  "Kienyeji Layer Mash / Green Forage (CP 16%)": { cp: 16.0, energy: 2700, targetCategory: "dual_purpose_kienyeji" },
};

export const feedCategories = {
  "Poultry - Reconciled Lifecycle Rations": [
    "Chick Starter Mash / Crumbs (CP 20%)",
    "Grower Mash (CP 16%)",
    "Pre-Lay Mash (CP 17.5%, Ca 2.5%)",
    "Layers Complete Mash Phase 1 (CP 17.5%, Ca 3.8%)",
    "Layers Complete Mash Phase 2 (CP 16%, Ca 4.2%)",
    "Broiler Starter Crumbs (CP 22%)",
    "Broiler Grower Pellets (CP 20%)",
    "Broiler Finisher Pellets (CP 18%)",
    "Kienyeji Starter (CP 19%)",
    "Kienyeji Layer Mash / Green Forage (CP 16%)",
  ],
  "Poultry - Commercial Formats": [
    "Chick Mash (0–8 weeks)", "Pre-Starter Mash", "Growers Mash (8–18 weeks)",
    "Layers Crumble", "Layers Pellet", "Layers Concentrate",
    "Molting Feed", "Calcium-Enriched Layer Feed",
    "Breeder Mash", "Breeder Pellet"
  ],
  "Cattle": [
    "Calf Starter", "Dairy Meal (High Protein)", "Beef Finisher Meal", "Mineral Lick"
  ],
  "General & Supplements": [
    "Multi-purpose Concentrates", "Mineral Supplements", "Vitamin Premixes", "Probiotics", "Limestone Grit"
  ]
};

export interface AddFeedBatchModalProps {
  farmId: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface ActiveFlockTelemetry {
  houseName: string;
  flockCode: string;
  category: BirdCategory;
  ageWeeks: number;
  liveBirds: number;
  recommendedFeedType: string;
  recommendedCP: number;
  recommendedEnergy: number;
}

export function AddFeedBatchModal({ farmId, isOpen, onClose, trigger, onSuccess }: AddFeedBatchModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [activeFlocks, setActiveFlocks] = useState<ActiveFlockTelemetry[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    feedType: '',
    supplier: '',
    deliveryNoteNumber: '',
    numberOfBags: '',
    bagWeightKg: '50',
    quantityReceivedKg: '',
    costPerKg: '',
    proteinPercentage: '',
    energyKcal: '',
    storageSiloId: 'Main Silo 1 (Bulk)',
    expiryDate: '',
    dateReceived: new Date().toISOString().split('T')[0],
  });

  // Pull active farm flocks to intelligently calculate recommended intake & matching rations
  useEffect(() => {
    if (!open || !farmId) return;

    async function loadFarmFlockLifecycle() {
      setLoadingContext(true);
      try {
        const housesSnap = await getDocs(collection(db, `farms/${farmId}/houses`));
        const list: ActiveFlockTelemetry[] = [];

        for (const hDoc of housesSnap.docs) {
          const hData = hDoc.data() as House;
          if (hData.currentFlockId) {
            const flockRef = doc(db, `farms/${farmId}/houses/${hDoc.id}/flocks/${hData.currentFlockId}`);
            const flockSnap = await getDoc(flockRef);

            if (flockSnap.exists()) {
              const fData = flockSnap.data() as Flock;
              const housedDate = fData.dateHoused
                ? (fData.dateHoused as any).toDate ? (fData.dateHoused as any).toDate() : new Date(fData.dateHoused as any)
                : new Date();

              const diffDays = Math.floor((Date.now() - housedDate.getTime()) / (1000 * 60 * 60 * 24));
              const currentAge = (fData.initialAgeWeeks || 0) + Math.max(0, Math.floor(diffDays / 7));

              const cat = (fData.category as BirdCategory) || 'commercial_layers';
              const lifeReq = computeFlockRequirements(cat, currentAge, housedDate);

              list.push({
                houseName: hData.houseName,
                flockCode: fData.flockCode,
                category: cat,
                ageWeeks: currentAge,
                liveBirds: fData.currentBirdCount || 0,
                recommendedFeedType: lifeReq.activePhase.feedType,
                recommendedCP: standardQualitySpecs[lifeReq.activePhase.feedType]?.cp || 17.5,
                recommendedEnergy: standardQualitySpecs[lifeReq.activePhase.feedType]?.energy || 2750,
              });
            }
          }
        }
        setActiveFlocks(list);
      } catch (err) {
        console.warn("Could not load farm flock requirements:", err);
      } finally {
        setLoadingContext(false);
      }
    }

    loadFarmFlockLifecycle();
  }, [open, farmId]);

  // Aggregate active live birds
  const totalFarmLiveBirds = useMemo(() => {
    return activeFlocks.reduce((acc, f) => acc + f.liveBirds, 0);
  }, [activeFlocks]);

  // Expected daily feed consumption in Kg (standard layer average: 120g/bird/day)
  const dailyFarmDemandKg = useMemo(() => {
    return totalFarmLiveBirds * 0.12;
  }, [totalFarmLiveBirds]);

  // Calculate buffer runway days provided by this incoming delivery
  const deliveryRunwayDays = useMemo(() => {
    const qty = parseFloat(formData.quantityReceivedKg);
    if (!qty || dailyFarmDemandKg <= 0) return 0;
    return Math.floor(qty / dailyFarmDemandKg);
  }, [formData.quantityReceivedKg, dailyFarmDemandKg]);

  const handleBagsChange = (bagsStr: string) => {
    const bags = parseFloat(bagsStr);
    const bagWt = parseFloat(formData.bagWeightKg) || 50;
    if (!isNaN(bags)) {
      const totalKg = bags * bagWt;
      setFormData(prev => ({ ...prev, numberOfBags: bagsStr, quantityReceivedKg: totalKg.toString() }));
    } else {
      setFormData(prev => ({ ...prev, numberOfBags: bagsStr }));
    }
  };

  // 1-Click Auto-Fill with Recommended Flock Ration
  const handleApplyRecommended = (flock: ActiveFlockTelemetry) => {
    const spec = standardQualitySpecs[flock.recommendedFeedType];
    setFormData(prev => ({
      ...prev,
      feedType: flock.recommendedFeedType,
      proteinPercentage: (spec?.cp || flock.recommendedCP || 17.5).toString(),
      energyKcal: (spec?.energy || flock.recommendedEnergy || 2750).toString()
    }));

    toast({
      title: "Ration Auto-Filled",
      description: `Matched to ${flock.flockCode} (${flock.ageWeeks} Wks) with ${spec?.cp || 17.5}% CP quality target.`
    });
  };

  // Auto-fill quality specs if user picks a standard ration from dropdown
  const handleSelectFeedType = (val: string) => {
    const spec = standardQualitySpecs[val];
    setFormData(prev => ({
      ...prev,
      feedType: val,
      proteinPercentage: spec ? spec.cp.toString() : prev.proteinPercentage,
      energyKcal: spec ? spec.energy.toString() : prev.energyKcal
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !formData.feedType || !formData.quantityReceivedKg) return;

    setIsSubmitting(true);
    try {
      const quantity = Number(formData.quantityReceivedKg);
      const cost = Number(formData.costPerKg);

      await addDoc(collection(db, `farms/${farmId}/feedBatches`), {
        feedType: formData.feedType,
        supplierName: formData.supplier.trim() || 'Direct Feed Mill',
        deliveryNoteNumber: formData.deliveryNoteNumber.trim() || null,
        numberOfBags: formData.numberOfBags ? Number(formData.numberOfBags) : null,
        bagWeightKg: formData.bagWeightKg ? Number(formData.bagWeightKg) : 50,
        quantityReceivedKg: quantity,
        quantityRemainingKg: quantity,
        costPerKg: cost || 0,
        totalCost: quantity * (cost || 0),
        proteinPercentage: formData.proteinPercentage ? Number(formData.proteinPercentage) : null,
        energyKcal: formData.energyKcal ? Number(formData.energyKcal) : null,
        storageSiloId: formData.storageSiloId,
        expiryDate: formData.expiryDate ? Timestamp.fromDate(new Date(formData.expiryDate)) : null,
        dateReceived: Timestamp.fromDate(new Date(formData.dateReceived)),
        status: 'active',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Feed Silo Stocked 🌾',
        description: `${quantity.toLocaleString()} Kg of ${formData.feedType} logged (+${deliveryRunwayDays} days runway).`
      });

      setOpen(false);
      if (onSuccess) onSuccess();

      // Reset
      setFormData({
        feedType: '',
        supplier: '',
        deliveryNoteNumber: '',
        numberOfBags: '',
        bagWeightKg: '50',
        quantityReceivedKg: '',
        costPerKg: '',
        proteinPercentage: '',
        energyKcal: '',
        storageSiloId: 'Main Silo 1 (Bulk)',
        expiryDate: '',
        dateReceived: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error("Feed batch saving error:", error);
      toast({ title: 'Error', description: 'Failed to record feed batch.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="font-bold text-xs h-10 rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Receive Feed
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Wheat className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Register Feed Delivery & Quality Spec
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Logs incoming grain shipments with crude protein specs, delivery notes, and reconciled flock feed runways.
          </DialogDescription>
        </DialogHeader>

        {/* RECONCILED FLOCK RECOMMENDATION BANNER */}
        {activeFlocks.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Active Flock Ration Requirements:
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {totalFarmLiveBirds.toLocaleString()} Total Birds Stocked
              </span>
            </div>

            <div className="space-y-1.5">
              {activeFlocks.map((flock, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl bg-card border border-border/60 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{flock.houseName}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">({flock.flockCode} • Wk {flock.ageWeeks})</span>
                    </div>
                    <p className="text-[11px] text-primary font-semibold truncate mt-0.5">
                      Target: {flock.recommendedFeedType} ({flock.recommendedCP}% CP)
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyRecommended(flock)}
                    className="h-7 text-[11px] font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                  >
                    1-Click Match
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">

          {/* 1. Feed Type & Quality Presets */}
          <div className="space-y-1.5">
            <Label htmlFor="feedType" className="font-bold uppercase tracking-wider text-[11px]">
              Feed Formulation / Ration Type *
            </Label>
            <Select
              value={formData.feedType}
              onValueChange={handleSelectFeedType}
              required
            >
              <SelectTrigger id="feedType" className="h-10 rounded-xl">
                <SelectValue placeholder="Select or match formulation..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] rounded-2xl">
                {Object.entries(feedCategories).map(([category, items]) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase">{category}</SelectLabel>
                    {items.map(item => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Mill Supplier & Delivery Note */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="supplier" className="font-semibold text-muted-foreground">Feed Mill / Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                placeholder="e.g. Unga Farm Care, Pembe, Bidco"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deliveryNoteNumber" className="font-semibold text-muted-foreground">Delivery Note / Invoice #</Label>
              <Input
                id="deliveryNoteNumber"
                value={formData.deliveryNoteNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryNoteNumber: e.target.value }))}
                placeholder="e.g. DN-88194"
                className="h-10 rounded-xl font-mono"
              />
            </div>
          </div>

          {/* 3. Weight Calculation & Bag Converter */}
          <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/80 space-y-2.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-bold text-muted-foreground uppercase">Intake Weight Measurement</span>
              {deliveryRunwayDays > 0 && (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Adds +{deliveryRunwayDays} Days Flock Runway
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="numberOfBags" className="text-[10px] text-muted-foreground">Number of Bags</Label>
                <Input
                  id="numberOfBags"
                  type="number"
                  value={formData.numberOfBags}
                  onChange={(e) => handleBagsChange(e.target.value)}
                  placeholder="e.g. 40"
                  className="h-9 rounded-xl font-mono bg-background text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bagWeightKg" className="text-[10px] text-muted-foreground">Bag Weight</Label>
                <Input
                  id="bagWeightKg"
                  type="number"
                  value={formData.bagWeightKg}
                  onChange={(e) => setFormData(prev => ({ ...prev, bagWeightKg: e.target.value }))}
                  placeholder="50"
                  className="h-9 rounded-xl font-mono bg-background text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quantityReceivedKg" className="text-[10px] text-primary font-bold">Total Intake (Kg) *</Label>
                <Input
                  id="quantityReceivedKg"
                  type="number"
                  value={formData.quantityReceivedKg}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantityReceivedKg: e.target.value }))}
                  placeholder="2000"
                  required
                  min="1"
                  step="0.1"
                  className="h-9 rounded-xl font-mono font-bold bg-background text-primary text-xs"
                />
              </div>
            </div>
          </div>

          {/* 4. Pricing & Silo Store */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="costPerKg" className="font-semibold text-muted-foreground">Cost per Kg (KSh)</Label>
              <Input
                id="costPerKg"
                type="number"
                value={formData.costPerKg}
                onChange={(e) => setFormData(prev => ({ ...prev, costPerKg: e.target.value }))}
                placeholder="e.g. 64.00"
                min="0"
                step="0.01"
                className="h-10 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storageSiloId" className="font-semibold text-muted-foreground">Destination Silo</Label>
              <Select
                value={formData.storageSiloId}
                onValueChange={(val) => setFormData(prev => ({ ...prev, storageSiloId: val }))}
              >
                <SelectTrigger id="storageSiloId" className="h-10 rounded-xl">
                  <SelectValue placeholder="Select silo..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="Main Silo 1 (Bulk)">Main Silo 1 (Bulk)</SelectItem>
                  <SelectItem value="Secondary Silo 2">Secondary Silo 2</SelectItem>
                  <SelectItem value="Store Room A (Bagged)">Store Room A (Bagged)</SelectItem>
                  <SelectItem value="Store Room B (Bagged)">Store Room B (Bagged)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 5. Quality Specs (CP% & Energy) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-2xl border border-border/70">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="proteinPercentage" className="text-[11px] font-semibold text-muted-foreground">Crude Protein (%)</Label>
                <span className="text-[10px] text-muted-foreground font-mono">Spec: 16-20%</span>
              </div>
              <Input
                id="proteinPercentage"
                type="number"
                step="0.1"
                value={formData.proteinPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, proteinPercentage: e.target.value }))}
                placeholder="e.g. 17.5"
                className="h-9 rounded-xl font-mono bg-background text-xs"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="energyKcal" className="text-[11px] font-semibold text-muted-foreground">Energy (kcal/kg)</Label>
                <span className="text-[10px] text-muted-foreground font-mono">Spec: 2750+</span>
              </div>
              <Input
                id="energyKcal"
                type="number"
                value={formData.energyKcal}
                onChange={(e) => setFormData(prev => ({ ...prev, energyKcal: e.target.value }))}
                placeholder="e.g. 2750"
                className="h-9 rounded-xl font-mono bg-background text-xs"
              />
            </div>
          </div>

          {/* 6. Dates & Quality Audit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateReceived" className="font-semibold text-muted-foreground">Delivery Date *</Label>
              <Input
                id="dateReceived"
                type="date"
                value={formData.dateReceived}
                onChange={(e) => setFormData(prev => ({ ...prev, dateReceived: e.target.value }))}
                required
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiryDate" className="font-semibold text-muted-foreground">Best Before / Expiry</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="h-10 rounded-xl font-mono text-xs"
              />
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying Quality & Stocking Silo...
                </>
              ) : (
                <>
                  <Wheat className="w-4 h-4 mr-2" /> Commit Silo Delivery
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}