// components/AddEggSaleModal.tsx
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
import { Badge } from "@/components/ui/badge";
import { db, auth } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Coins,
  Egg,
  Calculator,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  PhoneCall,
  UserCheck
} from 'lucide-react';
import type { House, Flock } from '@/services/ovocore/firebaseSchema';

export interface AddEggSaleModalProps {
  farmId: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface HouseFlockContext {
  houseId: string;
  houseName: string;
  flockId: string | null;
  flockCode: string | null;
  ageWeeks: number;
  availableEggs: number;
  liveBirds: number;
  status: string;
}

export function AddEggSaleModal({ farmId, isOpen, onClose, trigger, onSuccess }: AddEggSaleModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [houses, setHouses] = useState<HouseFlockContext[]>([]);
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<'trays' | 'eggs'>('trays');

  const [formData, setFormData] = useState({
    customerId: '',
    customerPhone: '',
    paymentMethod: 'M-Pesa Till / Business',
    targetAllocation: 'general_stock', // 'general_stock' or specific houseId

    // Grade A
    gradeA_qty: '',
    price_per_tray_gradeA: '450',

    // Grade B
    gradeB_qty: '',
    price_per_tray_gradeB: '390',

    // Grade C (Pullet eggs)
    gradeC_qty: '',
    price_per_tray_gradeC: '320',

    // Cracked / Bakery Off-takes
    cracked_pieces: '',
    price_crackedPiece: '12',

    amountPaid: '',
    paymentStatus: 'paid', // 'paid' | 'partial' | 'credit'
    date: new Date().toISOString().split('T')[0],
  });

  // Pull active production houses & verify flock availability
  useEffect(() => {
    if (!open || !farmId) return;

    async function loadFlockTelemetry() {
      setLoadingContext(true);
      try {
        const querySnapshot = await getDocs(collection(db, `farms/${farmId}/houses`));
        const list: HouseFlockContext[] = [];

        for (const hDoc of querySnapshot.docs) {
          const hData = hDoc.data() as House;
          let flockCode: string | null = null;
          let ageWeeks = 0;
          let liveBirds = 0;
          let availableEggs = 0;

          if (hData.currentFlockId) {
            try {
              const flockSnap = await getDoc(
                doc(db, `farms/${farmId}/houses/${hDoc.id}/flocks/${hData.currentFlockId}`)
              );
              if (flockSnap.exists()) {
                const fData = flockSnap.data() as Flock;
                const housedDate = fData.dateHoused
                  ? (fData.dateHoused as any).toDate ? (fData.dateHoused as any).toDate() : new Date(fData.dateHoused as any)
                  : new Date();

                const diffDays = Math.floor((Date.now() - housedDate.getTime()) / (1000 * 60 * 60 * 24));
                ageWeeks = (fData.initialAgeWeeks || 0) + Math.max(0, Math.floor(diffDays / 7));
                flockCode = fData.flockCode;
                liveBirds = fData.currentBirdCount || 0;
                availableEggs = fData.cumulativeEggs || 0;
              }
            } catch (e) {
              console.warn("Could not load flock context:", e);
            }
          }

          list.push({
            houseId: hDoc.id,
            houseName: hData.houseName,
            flockId: hData.currentFlockId || null,
            flockCode,
            ageWeeks,
            availableEggs,
            liveBirds,
            status: hData.status || 'active'
          });
        }
        setHouses(list);
      } catch (err) {
        console.error("Failed to load flock telemetry for egg sales:", err);
      } finally {
        setLoadingContext(false);
      }
    }

    loadFlockTelemetry();
  }, [open, farmId]);

  // Selected unit details
  const selectedUnit = useMemo(() => {
    return houses.find(h => h.houseId === formData.targetAllocation);
  }, [houses, formData.targetAllocation]);

  // Calculate totals and financial breakdown
  const calculatedTotals = useMemo(() => {
    const rawA = Number(formData.gradeA_qty) || 0;
    const rawB = Number(formData.gradeB_qty) || 0;
    const rawC = Number(formData.gradeC_qty) || 0;
    const cr = Number(formData.cracked_pieces) || 0;

    const traysA = inputMode === 'trays' ? rawA : rawA / 30;
    const traysB = inputMode === 'trays' ? rawB : rawB / 30;
    const traysC = inputMode === 'trays' ? rawC : rawC / 30;

    const eggsA = inputMode === 'trays' ? rawA * 30 : rawA;
    const eggsB = inputMode === 'trays' ? rawB * 30 : rawB;
    const eggsC = inputMode === 'trays' ? rawC * 30 : rawC;

    const priceTrayA = Number(formData.price_per_tray_gradeA) || 0;
    const priceTrayB = Number(formData.price_per_tray_gradeB) || 0;
    const priceTrayC = Number(formData.price_per_tray_gradeC) || 0;
    const priceCracked = Number(formData.price_crackedPiece) || 0;

    const revA = inputMode === 'trays' ? traysA * priceTrayA : (eggsA / 30) * priceTrayA;
    const revB = inputMode === 'trays' ? traysB * priceTrayB : (eggsB / 30) * priceTrayB;
    const revC = inputMode === 'trays' ? traysC * priceTrayC : (eggsC / 30) * priceTrayC;
    const revCr = cr * priceCracked;

    const totalTrays = Number((traysA + traysB + traysC).toFixed(2));
    const totalEggs = Math.round(eggsA + eggsB + eggsC + cr);
    const totalRevenue = Math.round(revA + revB + revC + revCr);

    const paid = formData.paymentStatus === 'paid'
      ? totalRevenue
      : formData.paymentStatus === 'partial'
        ? Number(formData.amountPaid) || 0
        : 0;

    const balanceDue = Math.max(0, totalRevenue - paid);

    const isQuarantined = selectedUnit?.status === 'quarantine_alert';

    return {
      traysA: Number(traysA.toFixed(2)),
      traysB: Number(traysB.toFixed(2)),
      traysC: Number(traysC.toFixed(2)),
      totalTrays,
      totalEggs,
      totalRevenue,
      cashAtHand: Math.round(paid),
      balanceDue: Math.round(balanceDue),
      isQuarantined
    };
  }, [
    formData.gradeA_qty, formData.gradeB_qty, formData.gradeC_qty, formData.cracked_pieces,
    formData.price_per_tray_gradeA, formData.price_per_tray_gradeB, formData.price_per_tray_gradeC,
    formData.price_crackedPiece, formData.paymentStatus, formData.amountPaid, inputMode, selectedUnit
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedTotals.isQuarantined) return;
    if (!farmId || !formData.customerId.trim() || calculatedTotals.totalEggs <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Sale Record",
        description: "Please specify the customer name and at least one grade quantity."
      });
      return;
    }

    if (formData.paymentStatus !== 'paid' && !formData.customerPhone.trim()) {
      toast({
        variant: "destructive",
        title: "Phone Number Required",
        description: "Please provide the customer's phone number for partial or credit orders to enable future debt follow-up."
      });
      return;
    }

    const totalFarmEggs = houses.reduce((sum, h) => sum + (h.availableEggs || 0), 0);
    const isGeneral = formData.targetAllocation === 'general_stock';

    if (isGeneral) {
      if (totalFarmEggs === 0) {
        toast({
          variant: "destructive",
          title: "No Eggs Available",
          description: "No eggs have been recorded farm-wide. Please log daily production first."
        });
        return;
      }
      if (calculatedTotals.totalEggs > totalFarmEggs) {
        toast({
          variant: "destructive",
          title: "Insufficient Eggs",
          description: `Cannot sell ${calculatedTotals.totalEggs} eggs. Only ${totalFarmEggs} eggs have been recorded farm-wide.`
        });
        return;
      }
    } else if (selectedUnit) {
      if (selectedUnit.availableEggs === 0) {
        toast({
          variant: "destructive",
          title: "No Eggs Available",
          description: `No eggs have been recorded for ${selectedUnit.houseName}. Please log daily production first.`
        });
        return;
      }
      if (calculatedTotals.totalEggs > selectedUnit.availableEggs) {
        toast({
          variant: "destructive",
          title: "Insufficient Eggs",
          description: `Cannot sell ${calculatedTotals.totalEggs} eggs. Only ${selectedUnit.availableEggs} eggs have been recorded for ${selectedUnit.houseName}.`
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isGeneral = formData.targetAllocation === 'general_stock';
      const allocatedHouse = isGeneral ? null : selectedUnit;

      await addDoc(collection(db, `farms/${farmId}/eggSales`), {
        customerId: formData.customerId.trim(),
        customerName: formData.customerId.trim(),
        customerPhone: formData.customerPhone.trim() || null,
        paymentMethod: formData.paymentMethod,
        relatedHouseId: allocatedHouse ? allocatedHouse.houseId : null,
        relatedHouseName: allocatedHouse ? allocatedHouse.houseName : 'General Farm Gate',
        relatedFlockId: allocatedHouse ? allocatedHouse.flockId : null,
        relatedFlockCode: allocatedHouse ? allocatedHouse.flockCode : null,
        inputModeUsed: inputMode,
        gradeBreakdown: {
          gradeA: { inputQty: Number(formData.gradeA_qty) || 0, equivalentTrays: calculatedTotals.traysA },
          gradeB: { inputQty: Number(formData.gradeB_qty) || 0, equivalentTrays: calculatedTotals.traysB },
          gradeC: { inputQty: Number(formData.gradeC_qty) || 0, equivalentTrays: calculatedTotals.traysC },
          crackedPieces: Number(formData.cracked_pieces) || 0,
          totalTrays: calculatedTotals.totalTrays,
          totalEggs: calculatedTotals.totalEggs
        },
        pricingTiers: {
          pricePerTrayGradeA: Number(formData.price_per_tray_gradeA) || 0,
          pricePerTrayGradeB: Number(formData.price_per_tray_gradeB) || 0,
          pricePerTrayGradeC: Number(formData.price_per_tray_gradeC) || 0,
          pricePerCrackedPiece: Number(formData.price_crackedPiece) || 0,
        },
        totalAmount: calculatedTotals.totalRevenue,
        amountPaid: calculatedTotals.cashAtHand,
        balanceDue: calculatedTotals.balanceDue,
        paymentStatus: formData.paymentStatus,
        date: Timestamp.fromDate(new Date(formData.date)),
        recordedBy: auth.currentUser?.uid || 'system',
        farmId,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Egg Sale Recorded! 🥚',
        description: `Revenue: KSh ${calculatedTotals.totalRevenue.toLocaleString()} (${calculatedTotals.totalTrays} Trays) to ${formData.customerId}.`
      });

      setOpen(false);
      if (onSuccess) onSuccess();

      // Reset
      setFormData({
        customerId: '',
        customerPhone: '',
        paymentMethod: 'M-Pesa Till / Business',
        targetAllocation: 'general_stock',
        gradeA_qty: '',
        gradeB_qty: '',
        gradeC_qty: '',
        cracked_pieces: '',
        price_per_tray_gradeA: '450',
        price_per_tray_gradeB: '390',
        price_per_tray_gradeC: '320',
        price_crackedPiece: '12',
        amountPaid: '',
        paymentStatus: 'paid',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error("Failed to commit egg sale:", error);
      toast({
        title: 'Transaction Error',
        description: 'Failed to record commercial egg sale.',
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
          <Button size="sm" className="font-bold rounded-xl h-10 text-xs shadow-sm">
            <Coins className="h-4 w-4 mr-1.5" /> Log Egg Sale
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Egg className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight">
                Record Commercial Egg Offtake
              </DialogTitle>
            </div>

            {/* Input Switcher */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInputMode(prev => prev === 'trays' ? 'eggs' : 'trays')}
              className="h-8 text-[11px] font-bold rounded-xl gap-1.5 bg-muted/40 border-border/80"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
              Mode: {inputMode === 'trays' ? 'Crate Trays (30s)' : 'Individual Eggs'}
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Logs wholesale & retail egg off-takes, pricing tiers, buyer profiles, and credit terms.
          </DialogDescription>
        </DialogHeader>

        {/* FLOCK BATCH RECONCILIATION BANNER */}
        {selectedUnit?.flockCode && (
          <div className="p-3 bg-muted/40 rounded-2xl border border-border/80 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{selectedUnit.houseName}</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  ({selectedUnit.flockCode} • Wk {selectedUnit.ageWeeks})
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Live Stock: <strong>{selectedUnit.liveBirds.toLocaleString()} Birds</strong>
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] bg-background">
              {selectedUnit.ageWeeks <= 22 ? 'Pullet Grade Expected' : 'Peak Large Size Expected'}
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">

          {/* 1. Date & Source Allocation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-muted-foreground font-semibold">Sale Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="h-10 rounded-xl font-mono text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetAllocation" className="text-muted-foreground font-semibold">
                Source Production Unit
              </Label>
              <Select
                value={formData.targetAllocation}
                onValueChange={(val) => setFormData(prev => ({ ...prev, targetAllocation: val }))}
              >
                <SelectTrigger id="targetAllocation" className="h-10 rounded-xl">
                  <SelectValue placeholder="Select unit..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs max-h-60">
                  <SelectItem value="general_stock">General Farm Gate / Egg Store</SelectItem>
                  {houses.map((h) => (
                    <SelectItem key={h.houseId} value={h.houseId}>
                      {h.houseName} {h.flockCode ? `(${h.flockCode} • Wk ${h.ageWeeks})` : '(Vacant)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {calculatedTotals.isQuarantined && (
            <div className="bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 border p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">Withdrawal/Hold Warning</h4>
                <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">This house is currently under a <strong>Critical Emergency Quarantine</strong>. Commercial egg sales are frozen to prevent contaminated stock from reaching the market. You must resolve the quarantine via a veterinary compliance log before resuming sales.</p>
              </div>
            </div>
          )}

          {/* 2. Customer & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="customerId" className="text-muted-foreground font-semibold">
                Customer / Wholesaler Name *
              </Label>
              <Input
                id="customerId"
                value={formData.customerId}
                onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                placeholder="e.g. Xena Mckenzie / Ruiru Wholesalers"
                required
                className="h-10 rounded-xl font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="customerPhone" className="text-muted-foreground font-semibold">
                  WhatsApp / Phone Number {formData.paymentStatus !== 'paid' && <span className="text-amber-500 font-bold">*</span>}
                </Label>
                {formData.paymentStatus !== 'paid' && (
                  <span className="text-[10px] text-amber-500 font-mono font-bold">Required for Credit</span>
                )}
              </div>
              <Input
                id="customerPhone"
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="e.g. 0712345678"
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          {/* 3. Grading & Pricing Matrix */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Grading & Tonnage Matrix
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Values cross-calculate {inputMode === 'trays' ? 'to pieces' : 'to trays'}
              </span>
            </div>

            {/* Grade A */}
            <div className="p-3 bg-muted/30 border border-border/70 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5 space-y-0.5">
                <span className="font-bold text-foreground block">Grade A (Large / Jumbo)</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {inputMode === 'trays'
                    ? `≈ ${((Number(formData.gradeA_qty) || 0) * 30).toLocaleString()} eggs`
                    : `≈ ${((Number(formData.gradeA_qty) || 0) / 30).toFixed(1)} trays`}
                </span>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Qty ({inputMode === 'trays' ? 'Trays' : 'Eggs'})
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.gradeA_qty}
                  onChange={(e) => setFormData(prev => ({ ...prev, gradeA_qty: e.target.value }))}
                  placeholder="0"
                  className="h-9 rounded-xl font-mono text-xs bg-background"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">KSh / Tray</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.price_per_tray_gradeA}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_tray_gradeA: e.target.value }))}
                  className="h-9 rounded-xl font-mono font-bold text-xs bg-background text-primary"
                />
              </div>
            </div>

            {/* Grade B */}
            <div className="p-3 bg-muted/30 border border-border/70 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5 space-y-0.5">
                <span className="font-bold text-foreground block">Grade B (Medium Table)</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {inputMode === 'trays'
                    ? `≈ ${((Number(formData.gradeB_qty) || 0) * 30).toLocaleString()} eggs`
                    : `≈ ${((Number(formData.gradeB_qty) || 0) / 30).toFixed(1)} trays`}
                </span>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Qty ({inputMode === 'trays' ? 'Trays' : 'Eggs'})
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.gradeB_qty}
                  onChange={(e) => setFormData(prev => ({ ...prev, gradeB_qty: e.target.value }))}
                  placeholder="0"
                  className="h-9 rounded-xl font-mono text-xs bg-background"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">KSh / Tray</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.price_per_tray_gradeB}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_tray_gradeB: e.target.value }))}
                  className="h-9 rounded-xl font-mono font-bold text-xs bg-background text-primary"
                />
              </div>
            </div>

            {/* Grade C (Pullet) */}
            <div className="p-3 bg-muted/30 border border-border/70 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5 space-y-0.5">
                <span className="font-bold text-foreground block">Grade C (Small / Pullet)</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {inputMode === 'trays'
                    ? `≈ ${((Number(formData.gradeC_qty) || 0) * 30).toLocaleString()} eggs`
                    : `≈ ${((Number(formData.gradeC_qty) || 0) / 30).toFixed(1)} trays`}
                </span>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Qty ({inputMode === 'trays' ? 'Trays' : 'Eggs'})
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.gradeC_qty}
                  onChange={(e) => setFormData(prev => ({ ...prev, gradeC_qty: e.target.value }))}
                  placeholder="0"
                  className="h-9 rounded-xl font-mono text-xs bg-background"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">KSh / Tray</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.price_per_tray_gradeC}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_tray_gradeC: e.target.value }))}
                  className="h-9 rounded-xl font-mono font-bold text-xs bg-background text-primary"
                />
              </div>
            </div>

            {/* Cracked / Bakery Pieces */}
            <div className="p-3 bg-muted/30 border border-border/70 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5 space-y-0.5">
                <span className="font-bold text-foreground block">Cracked / Loose Eggs</span>
                <span className="text-[10px] text-muted-foreground font-mono">Sold as loose bakery units</span>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">Loose Pieces</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.cracked_pieces}
                  onChange={(e) => setFormData(prev => ({ ...prev, cracked_pieces: e.target.value }))}
                  placeholder="0"
                  className="h-9 rounded-xl font-mono text-xs bg-background"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-[10px] uppercase font-semibold text-muted-foreground">KSh / Piece</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.price_crackedPiece}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_crackedPiece: e.target.value }))}
                  className="h-9 rounded-xl font-mono font-bold text-xs bg-background text-primary"
                />
              </div>
            </div>
          </div>

          {/* 4. Live Valuation & Settlement Summary */}
          <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 space-y-3">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" /> Total Volume Summary
              </span>
              <span className="font-mono font-bold text-foreground text-xs">
                {calculatedTotals.totalTrays} Trays ({calculatedTotals.totalEggs.toLocaleString()} Eggs)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Invoice</span>
                <span className="font-black text-foreground font-mono text-sm">
                  KSh {calculatedTotals.totalRevenue.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold block">Cash Collected</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  KSh {calculatedTotals.cashAtHand.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-rose-500 uppercase font-bold block">Credit Balance</span>
                <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm">
                  KSh {calculatedTotals.balanceDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Payment Status & Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paymentStatus" className="text-muted-foreground font-semibold">
                Settlement Status *
              </Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(val) => setFormData(prev => ({ ...prev, paymentStatus: val }))}
              >
                <SelectTrigger id="paymentStatus" className="h-10 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="paid">Paid in Full (Cash / Till)</SelectItem>
                  <SelectItem value="partial">Partial Payment (Deposit)</SelectItem>
                  <SelectItem value="credit">Pending / Full Credit (0% Paid)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod" className="text-muted-foreground font-semibold">
                Payment Channel
              </Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(val) => setFormData(prev => ({ ...prev, paymentMethod: val }))}
              >
                <SelectTrigger id="paymentMethod" className="h-10 rounded-xl">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="M-Pesa Till / Business">M-Pesa Buy Goods / Till</SelectItem>
                  <SelectItem value="M-Pesa Paybill">M-Pesa Paybill</SelectItem>
                  <SelectItem value="Cash">Physical Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer / EFT</SelectItem>
                  <SelectItem value="Customer Credit Account">Customer Credit Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Partial Payment Input */}
          {formData.paymentStatus === 'partial' && (
            <div className="space-y-1.5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Label htmlFor="amountPaid" className="font-bold text-amber-900 dark:text-amber-200">
                Deposit / Amount Collected (KSh) *
              </Label>
              <Input
                id="amountPaid"
                type="number"
                value={formData.amountPaid}
                onChange={(e) => setFormData(prev => ({ ...prev, amountPaid: e.target.value }))}
                placeholder="e.g. 5000"
                required
                className="h-10 rounded-xl font-mono font-bold bg-background text-sm"
              />
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 pt-1">
                Outstanding Balance to be Collected: KSh {calculatedTotals.balanceDue.toLocaleString()}
              </p>
            </div>
          )}

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
              disabled={isSubmitting || calculatedTotals.totalEggs <= 0 || calculatedTotals.isQuarantined}
              className="rounded-xl font-bold text-xs h-11 px-5 bg-primary text-primary-foreground shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Committing Revenue...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" /> Commit Egg Sale & Revenue
                </>
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}