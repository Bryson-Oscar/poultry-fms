// components/LogComplianceEventModal.tsx
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
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { db, auth } from '@/lib/firebase';
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
  ShieldCheck,
  Syringe,
  ClipboardList,
  Sparkles,
  Building2,
  Calendar,
  AlertTriangle,
  BadgePercent,
  Coins
} from 'lucide-react';
import {
  computeFlockRequirements,
  BirdCategory
} from '@/lib/ovocore/flockLifecycleEngine';
import type { House, Flock } from '@/services/ovocore/firebaseSchema';
import { resolveEmergencyProtocol } from '@/services/ovocore/flockService';

export interface LogComplianceEventModalProps {
  farmId: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface ActiveFlockOption {
  houseId: string;
  houseName: string;
  flockId: string;
  flockCode: string;
  ageWeeks: number;
  category: BirdCategory;
  recommendedBiosecurityCheck: string;
}

export function LogComplianceEventModal({ farmId, isOpen, onClose, trigger, onSuccess }: LogComplianceEventModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingFlocks, setLoadingFlocks] = useState(false);
  const [availableFlocks, setAvailableFlocks] = useState<ActiveFlockOption[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    eventType: 'vaccination',
    status: 'completed',
    description: '',
    assignedTo: '',
    targetScope: 'all_farm', // 'all_farm' or specific flockId
    date: new Date().toISOString().split('T')[0],
    vetLicenseNumber: '',
    batchLotNumber: '',
    withdrawalPeriodDays: '0',
    associatedCostKES: ''
  });

  // Pull active flocks to resolve house codes and active age milestones
  useEffect(() => {
    if (!open || !farmId) return;

    async function loadFlockContext() {
      setLoadingFlocks(true);
      try {
        const housesSnap = await getDocs(collection(db, `farms/${farmId}/houses`));
        const flockList: ActiveFlockOption[] = [];

        for (const hDoc of housesSnap.docs) {
          const hData = hDoc.data() as House;
          if (hData.currentFlockId) {
            const flockSnap = await getDoc(doc(db, `farms/${farmId}/houses/${hDoc.id}/flocks/${hData.currentFlockId}`));
            if (flockSnap.exists()) {
              const fData = flockSnap.data() as Flock;
              const housedDate = fData.dateHoused
                ? (fData.dateHoused as any).toDate ? (fData.dateHoused as any).toDate() : new Date(fData.dateHoused as any)
                : new Date();

              const diffDays = Math.floor((Date.now() - housedDate.getTime()) / (1000 * 60 * 60 * 24));
              const currentAge = (fData.initialAgeWeeks || 0) + Math.max(0, Math.floor(diffDays / 7));
              const cat = (fData.category as BirdCategory) || 'commercial_layers';
              const reqs = computeFlockRequirements(cat, currentAge, housedDate);

              flockList.push({
                houseId: hDoc.id,
                houseName: hData.houseName,
                flockId: flockSnap.id,
                flockCode: fData.flockCode,
                ageWeeks: currentAge,
                category: cat,
                recommendedBiosecurityCheck: reqs.activePhase.biosecurityCheck
              });
            }
          }
        }
        setAvailableFlocks(flockList);
      } catch (e) {
        console.warn("Could not load farm flock options:", e);
      } finally {
        setLoadingFlocks(false);
      }
    }

    loadFlockContext();
  }, [open, farmId]);

  // Selected flock details
  const selectedFlock = useMemo(() => {
    return availableFlocks.find(f => f.flockId === formData.targetScope);
  }, [availableFlocks, formData.targetScope]);

  // Quick-apply recommended phase milestone
  const handleApplyMilestone = (milestone: string) => {
    setFormData(prev => ({
      ...prev,
      description: milestone
    }));
    toast({
      title: "Protocol Selected",
      description: "Auto-filled protocol from flock lifecycle schedule."
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !formData.description.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedScope = availableFlocks.find(f => f.flockId === formData.targetScope);
      const eventCost = parseFloat(formData.associatedCostKES) || 0;

      // 1. Log the Compliance / Biosecurity Event
      await addDoc(collection(db, `farms/${farmId}/complianceEvents`), {
        eventType: formData.eventType,
        status: formData.status,
        description: formData.description.trim(),
        assignedTo: formData.assignedTo.trim() || 'Attending Farm Vet / Supervisor',
        completedBy: formData.status === 'completed' ? (auth.currentUser?.uid || 'system') : null,
        date: Timestamp.fromDate(new Date(formData.date)),
        relatedFlockId: selectedScope ? selectedScope.flockId : null,
        relatedHouseName: selectedScope ? selectedScope.houseName : 'All Houses',
        flockAgeAtEventWeeks: selectedScope ? selectedScope.ageWeeks : null,
        vetLicenseNumber: formData.vetLicenseNumber.trim() || null,
        batchLotNumber: formData.batchLotNumber.trim() || null,
        withdrawalPeriodDays: parseInt(formData.withdrawalPeriodDays) || 0,
        costKES: eventCost,
        farmId,
        createdAt: serverTimestamp(),
      });

      // 1.b Handle Emergency Resolution if applicable
      if (formData.eventType === 'emergency_resolution' && selectedScope) {
        await resolveEmergencyProtocol(db, farmId, selectedScope.houseId, selectedScope.flockId);
      }

      // 2. Direct Sync: If a cost is attached, automatically record an OPEX entry
      if (eventCost > 0) {
        await addDoc(collection(db, `farms/${farmId}/opex`), {
          category: 'medication_vaccines',
          amount: eventCost,
          description: `${formData.eventType.toUpperCase()}: ${formData.description.trim()} (${selectedScope?.flockCode || 'Farm-wide'})`,
          date: Timestamp.fromDate(new Date(formData.date)),
          createdAt: serverTimestamp(),
        });
      }

      toast({
        title: 'Compliance Logged',
        description: `${formData.eventType.toUpperCase()} recorded${eventCost > 0 ? ' & ledger debited' : ''}.`
      });

      setOpen(false);
      if (onSuccess) onSuccess();

      // Reset
      setFormData({
        eventType: 'vaccination',
        status: 'completed',
        description: '',
        assignedTo: '',
        targetScope: 'all_farm',
        date: new Date().toISOString().split('T')[0],
        vetLicenseNumber: '',
        batchLotNumber: '',
        withdrawalPeriodDays: '0',
        associatedCostKES: ''
      });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to record event.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="rounded-xl h-10 text-xs font-bold">
            <ShieldCheck className="h-4 w-4 mr-1.5 text-emerald-500" /> Log Compliance
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Biosecurity & Veterinary Compliance
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Audit logging for vaccinations, flock treatment withdrawals, sanitization cycles, and certifications.
          </DialogDescription>
        </DialogHeader>

        {/* ACTIVE FLOCK MILESTONE INTELLIGENCE BANNER */}
        {availableFlocks.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Active Lifecycle Protocol Match:
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {availableFlocks.length} Active Flock{availableFlocks.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-1.5">
              {availableFlocks.map((f) => (
                <div
                  key={f.flockId}
                  className="p-2.5 rounded-xl bg-card border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-foreground">{f.houseName}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                      ({f.flockCode} • Wk {f.ageWeeks})
                    </span>
                    <p className="text-[11px] text-primary font-medium mt-0.5">
                      Milestone: {f.recommendedBiosecurityCheck}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, targetScope: f.flockId }));
                      handleApplyMilestone(f.recommendedBiosecurityCheck);
                    }}
                    className="h-7 text-[11px] font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                  >
                    Auto-Fill
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">

          {/* 1. Target Scope & Event Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Target Production House
              </Label>
              <Select
                value={formData.targetScope}
                onValueChange={(val) => setFormData(prev => ({ ...prev, targetScope: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select target..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="all_farm">Farm-Wide / General Facility</SelectItem>
                  {availableFlocks.map((f) => (
                    <SelectItem key={f.flockId} value={f.flockId}>
                      {f.houseName} ({f.flockCode} - Wk {f.ageWeeks})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Event Classification
              </Label>
              <Select
                value={formData.eventType}
                onValueChange={(val) => setFormData(prev => ({ ...prev, eventType: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="vaccination">Vaccination Protocol</SelectItem>
                  <SelectItem value="deworming">Deworming / Parasite Control</SelectItem>
                  <SelectItem value="disinfection">Deep Cleaning & Fumigation</SelectItem>
                  <SelectItem value="water_treatment">Water Line Chlorination / Testing</SelectItem>
                  <SelectItem value="vet_inspection">Veterinary Inspection / Necropsy</SelectItem>
                  <SelectItem value="biosecurity_audit">County / Regulatory Audit</SelectItem>
                  <SelectItem value="emergency_resolution">Emergency Protocol Resolution</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Protocol Details */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Protocol / Vaccine / Chemical Name *
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Newcastle Lasota Spray + Fowl Pox Wing Web"
              className="h-10 rounded-xl font-medium"
              required
            />
          </div>

          {/* 3. Dates & Execution Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-muted-foreground font-semibold">Scheduled Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="h-10 rounded-xl font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground font-semibold">Verification Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="completed">Completed & Verified</SelectItem>
                  <SelectItem value="pending">Scheduled / Pending</SelectItem>
                  <SelectItem value="missed">Overdue / Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 4. Veterinary & Vaccine Lot Traceability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/20 border border-border/70 rounded-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="assignedTo" className="text-muted-foreground">Veterinarian / Inspector</Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                placeholder="e.g. Dr. K. Mbugua (KVB Reg)"
                className="h-9 rounded-xl bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batchLotNumber" className="text-muted-foreground">Vaccine / Vial Batch Lot #</Label>
              <Input
                id="batchLotNumber"
                value={formData.batchLotNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, batchLotNumber: e.target.value }))}
                placeholder="e.g. LOT-NV992"
                className="h-9 rounded-xl font-mono bg-background"
              />
            </div>
          </div>

          {/* 5. Food Safety & Direct Financial Cost Sync */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="withdrawalPeriodDays" className="text-muted-foreground">Egg/Meat Withdrawal</Label>
                <span className="text-[10px] text-muted-foreground font-mono">0 = Safe</span>
              </div>
              <Input
                id="withdrawalPeriodDays"
                type="number"
                min="0"
                value={formData.withdrawalPeriodDays}
                onChange={(e) => setFormData(prev => ({ ...prev, withdrawalPeriodDays: e.target.value }))}
                placeholder="0 days"
                className="h-10 rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="associatedCostKES" className="text-primary font-bold">Cost (KSh) &rarr; Auto OPEX</Label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Syncs to Ledger</span>
              </div>
              <Input
                id="associatedCostKES"
                type="number"
                min="0"
                step="50"
                value={formData.associatedCostKES}
                onChange={(e) => setFormData(prev => ({ ...prev, associatedCostKES: e.target.value }))}
                placeholder="e.g. 4500"
                className="h-10 rounded-xl font-mono font-bold"
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Committing Compliance Seal...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" /> Commit Compliance Audit
                </>
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}