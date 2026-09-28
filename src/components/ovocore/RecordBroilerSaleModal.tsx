"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
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
import {
  Truck,
  Scale,
  Coins,
  AlertTriangle,
  Loader2,
  Building2,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
  increment,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { House, Flock } from '@/services/ovocore/firebaseSchema';

export interface RecordBroilerSaleModalProps {
  farmId: string;
  houseId?: string;
  flockId?: string;
  availableBirds?: number;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface ActiveBroilerUnit {
  houseId: string;
  houseName: string;
  flockId: string;
  flockCode: string;
  liveBirds: number;
  ageDays: number;
}

export function RecordBroilerSaleModal({
  farmId,
  houseId: initialHouseId,
  flockId: initialFlockId,
  availableBirds: initialAvailableBirds,
  isOpen: propIsOpen,
  onClose,
  trigger,
  onSuccess
}: RecordBroilerSaleModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = propIsOpen !== undefined ? propIsOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [broilerUnits, setBroilerUnits] = useState<ActiveBroilerUnit[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    selectedUnitKey: '', // composite: `${houseId}:${flockId}`
    buyerName: '',
    buyerPhone: '',
    buyerType: 'live_bird' as 'live_bird' | 'dressed_carcass' | 'abattoir_contract',
    birdsLoaded: '',
    totalWeightKg: '',
    pricePerKg: '230', // Standard Kenyan farmgate live broiler rate
    doaCount: '0',
    amountPaid: '',
    paymentStatus: 'paid' as 'paid' | 'partial' | 'credit',
    date: new Date().toISOString().split('T')[0]
  });

  // Pull active broiler flocks across farm houses if not explicitly provided
  useEffect(() => {
    if (!open || !farmId) return;

    async function loadActiveUnits() {
      setLoadingUnits(true);
      try {
        const housesSnap = await getDocs(collection(db, `farms/${farmId}/houses`));
        const units: ActiveBroilerUnit[] = [];

        for (const hDoc of housesSnap.docs) {
          const hData = hDoc.data() as House;
          if (hData.currentFlockId) {
            try {
              const flockSnap = await getDoc(
                doc(db, `farms/${farmId}/houses/${hDoc.id}/flocks/${hData.currentFlockId}`)
              );
              if (flockSnap.exists()) {
                const fData = flockSnap.data() as Flock;
                // Only include broiler category or unclassified meat birds
                if (fData.category === 'broilers' || !fData.category) {
                  const placedDate = fData.dateHoused?.toDate
                    ? fData.dateHoused.toDate()
                    : new Date(fData.dateHoused as any || Date.now());
                  const ageDays = Math.max(1, Math.floor((Date.now() - placedDate.getTime()) / (1000 * 60 * 60 * 24)));

                  units.push({
                    houseId: hDoc.id,
                    houseName: hData.houseName,
                    flockId: flockSnap.id,
                    flockCode: fData.flockCode,
                    liveBirds: fData.currentBirdCount || 0,
                    ageDays
                  });
                }
              }
            } catch (e) {
              console.warn("Could not inspect house flock:", e);
            }
          }
        }

        setBroilerUnits(units);

        // Pre-select if initial props provided or pick first unit
        if (initialHouseId && initialFlockId) {
          setFormData(prev => ({ ...prev, selectedUnitKey: `${initialHouseId}:${initialFlockId}` }));
        } else if (units.length > 0) {
          setFormData(prev => ({ ...prev, selectedUnitKey: `${units[0].houseId}:${units[0].flockId}` }));
        }
      } catch (err) {
        console.error("Failed to load active broiler units:", err);
      } finally {
        setLoadingUnits(false);
      }
    }

    loadActiveUnits();
  }, [open, farmId, initialHouseId, initialFlockId]);

  // Active Unit Resolver
  const currentUnit = useMemo(() => {
    if (!formData.selectedUnitKey) return null;
    const [hId, fId] = formData.selectedUnitKey.split(':');
    const matched = broilerUnits.find(u => u.houseId === hId && u.flockId === fId);
    if (matched) return matched;

    // Fallback to prop inputs if available
    if (initialHouseId && initialFlockId) {
      return {
        houseId: initialHouseId,
        houseName: "Selected Shed",
        flockId: initialFlockId,
        flockCode: "Active Batch",
        liveBirds: initialAvailableBirds || 9500,
        ageDays: 38
      };
    }
    return null;
  }, [formData.selectedUnitKey, broilerUnits, initialHouseId, initialFlockId, initialAvailableBirds]);

  // Live Metrics & Revenue Calcs
  const saleCalcs = useMemo(() => {
    const birds = Number(formData.birdsLoaded) || 0;
    const kg = Number(formData.totalWeightKg) || 0;
    const rate = Number(formData.pricePerKg) || 0;
    const doa = Number(formData.doaCount) || 0;

    const netDeliveredBirds = Math.max(0, birds - doa);
    const avgBirdWeightKg = birds > 0 ? (kg / birds).toFixed(2) : "0.00";
    const totalAmount = Math.round(kg * rate);

    const paid = formData.paymentStatus === 'paid'
      ? totalAmount
      : formData.paymentStatus === 'partial'
        ? Number(formData.amountPaid) || 0
        : 0;

    const balanceDue = Math.max(0, totalAmount - paid);
    const remainingFlockBirds = Math.max(0, (currentUnit?.liveBirds || 0) - birds);
    const isFullDepletion = (currentUnit?.liveBirds || 0) > 0 && remainingFlockBirds === 0;

    return {
      netDeliveredBirds,
      avgBirdWeightKg,
      totalAmount,
      cashCollected: paid,
      balanceDue,
      remainingFlockBirds,
      isFullDepletion
    };
  }, [formData, currentUnit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedHouseId = currentUnit?.houseId || initialHouseId;
    const resolvedFlockId = currentUnit?.flockId || initialFlockId;

    if (!formData.buyerName.trim() || !formData.birdsLoaded || !formData.totalWeightKg) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please specify the processor/buyer, loaded birds, and total live weight."
      });
      return;
    }

    const birdsLoadedNum = Number(formData.birdsLoaded);
    if (currentUnit && birdsLoadedNum > currentUnit.liveBirds) {
      toast({
        variant: "destructive",
        title: "Overdraw Error",
        description: `Loaded bird count (${birdsLoadedNum}) exceeds active shed population (${currentUnit.liveBirds}).`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Commit Harvest / Slaughter Record
      await addDoc(collection(db, `farms/${farmId}/broilerSales`), {
        flockId: resolvedFlockId || null,
        flockCode: currentUnit?.flockCode || 'Broiler Batch',
        houseId: resolvedHouseId || null,
        houseName: currentUnit?.houseName || 'Production Shed',
        buyerName: formData.buyerName.trim(),
        buyerPhone: formData.buyerPhone.trim() || null,
        buyerType: formData.buyerType,
        birdsLoaded: birdsLoadedNum,
        totalLiveWeightKg: Number(formData.totalWeightKg),
        avgBirdWeightKg: Number(saleCalcs.avgBirdWeightKg),
        pricePerKg: Number(formData.pricePerKg),
        doaCount: Number(formData.doaCount),
        totalAmount: saleCalcs.totalAmount,
        amountPaid: saleCalcs.cashCollected,
        balanceDue: saleCalcs.balanceDue,
        paymentStatus: formData.paymentStatus,
        date: Timestamp.fromDate(new Date(formData.date)),
        createdAt: serverTimestamp(),
      });

      // 2. Decrement Live Herd Count & Handle All-In/All-Out Batch Depletion
      if (resolvedHouseId && resolvedFlockId) {
        const flockRef = doc(db, `farms/${farmId}/houses/${resolvedHouseId}/flocks/${resolvedFlockId}`);
        const updatePayload: any = {
          currentBirdCount: increment(-birdsLoadedNum),
          updatedAt: serverTimestamp()
        };

        // If batch is fully cleared, archive flock status and vacate house
        if (saleCalcs.isFullDepletion) {
          updatePayload.status = 'depleted';
          updatePayload.depletedDate = Timestamp.fromDate(new Date(formData.date));

          await updateDoc(doc(db, `farms/${farmId}/houses/${resolvedHouseId}`), {
            currentFlockId: null,
            updatedAt: serverTimestamp()
          });
        }

        await updateDoc(flockRef, updatePayload);
      }

      toast({
        title: "Broiler Harvest Committed 🍗",
        description: `Dispatched ${birdsLoadedNum.toLocaleString()} birds (${formData.totalWeightKg} kg) to ${formData.buyerName}.`
      });

      if (onSuccess) onSuccess();
      setOpen(false);

      // Reset
      setFormData({
        selectedUnitKey: broilerUnits.length > 0 ? `${broilerUnits[0].houseId}:${broilerUnits[0].flockId}` : '',
        buyerName: '',
        buyerPhone: '',
        buyerType: 'live_bird',
        birdsLoaded: '',
        totalWeightKg: '',
        pricePerKg: '230',
        doaCount: '0',
        amountPaid: '',
        paymentStatus: 'paid',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err: any) {
      console.error("Broiler dispatch failed:", err);
      toast({
        variant: "destructive",
        title: "Dispatch Failed",
        description: err.message || "Failed to commit slaughter off-take record."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl h-10 shadow-sm shadow-emerald-600/20">
            <Truck className="w-4 h-4 mr-1.5" /> Dispatch Broiler Harvest
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Truck className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Record Live-Weight Broiler Harvest
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Logs abattoir live-weight off-takes, pricing per kg, transit DOAs, and flock headcount depletion.
          </DialogDescription>
        </DialogHeader>

        {/* ACTIVE BATCH TELEMETRY BANNER */}
        {currentUnit && (
          <div className="p-3 bg-muted/40 border border-border/80 rounded-2xl flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{currentUnit.houseName}</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  ({currentUnit.flockCode} • Day {currentUnit.ageDays})
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Current Live Count: <strong className="text-foreground">{currentUnit.liveBirds.toLocaleString()} Birds</strong>
              </p>
            </div>
            {saleCalcs.isFullDepletion ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-bold">
                Complete Depletion (All-Out)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono">
                {saleCalcs.remainingFlockBirds.toLocaleString()} Left After Sale
              </Badge>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">

          {/* 1. Unit Selector (if multiple active broiler sheds) */}
          {broilerUnits.length > 1 && !initialHouseId && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Source Broiler Shed *
              </Label>
              <Select
                value={formData.selectedUnitKey}
                onValueChange={(val) => setFormData(prev => ({ ...prev, selectedUnitKey: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select active house..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  {broilerUnits.map((u) => (
                    <SelectItem key={`${u.houseId}:${u.flockId}`} value={`${u.houseId}:${u.flockId}`}>
                      {u.houseName} — {u.flockCode} ({u.liveBirds.toLocaleString()} birds, Day {u.ageDays})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 2. Buyer Details & Off-take Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="font-semibold text-muted-foreground">Buyer / Plant Name *</Label>
              <Input
                value={formData.buyerName}
                onChange={e => setFormData(prev => ({ ...prev, buyerName: e.target.value }))}
                placeholder="e.g. Xena Mckenzie"
                className="h-10 rounded-xl"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="font-semibold text-muted-foreground">Phone Number</Label>
              <Input
                value={formData.buyerPhone}
                onChange={e => setFormData(prev => ({ ...prev, buyerPhone: e.target.value }))}
                placeholder="e.g. 0712345678"
                className="h-10 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="font-semibold text-muted-foreground">Harvest Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="h-10 rounded-xl font-mono"
                required
              />
            </div>
          </div>

          {/* 3. Weight, Birds & Price Matrix */}
          <div className="p-3.5 bg-muted/30 border border-border/70 rounded-2xl space-y-2.5">
            <span className="font-bold text-muted-foreground uppercase text-[11px] block">
              Weighbridge & Catching Ledger
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Birds Loaded *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.birdsLoaded}
                  onChange={e => setFormData(prev => ({ ...prev, birdsLoaded: e.target.value }))}
                  placeholder="2500"
                  className="h-9 text-xs font-mono font-bold bg-background"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-primary font-bold">Total Weight (Kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formData.totalWeightKg}
                  onChange={e => setFormData(prev => ({ ...prev, totalWeightKg: e.target.value }))}
                  placeholder="5125.0"
                  className="h-9 text-xs font-mono font-bold bg-background text-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Price/Kg (KSh)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.pricePerKg}
                  onChange={e => setFormData(prev => ({ ...prev, pricePerKg: e.target.value }))}
                  className="h-9 text-xs font-mono font-bold bg-background"
                />
              </div>
            </div>
          </div>

          {/* 4. Buyer Type & In-Transit DOA Mortality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">Offtake Channel</Label>
              <Select
                value={formData.buyerType}
                onValueChange={(val: any) => setFormData(prev => ({ ...prev, buyerType: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Buyer type" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="live_bird">Live Bird Market Trader</SelectItem>
                  <SelectItem value="dressed_carcass">Eviscerated / Hotel Wholesale</SelectItem>
                  <SelectItem value="abattoir_contract">Industrial Abattoir Offtake</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-semibold text-muted-foreground">In-Transit DOAs</Label>
                <span className="text-[10px] text-muted-foreground font-mono">Transit Deaths</span>
              </div>
              <Input
                type="number"
                min="0"
                value={formData.doaCount}
                onChange={e => setFormData(prev => ({ ...prev, doaCount: e.target.value }))}
                className="h-10 text-xs font-mono"
              />
            </div>
          </div>

          {/* 5. Live Computed Commercial Summary */}
          <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-muted-foreground">Average Live Weight:</span>
              <span className="font-mono font-bold text-foreground">{saleCalcs.avgBirdWeightKg} kg / bird</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-primary/10 pt-1.5">
              <span className="font-bold text-foreground">Total Batch Revenue:</span>
              <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                KSh {saleCalcs.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 6. Payment Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">Payment Status</Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(val: any) => setFormData(prev => ({ ...prev, paymentStatus: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Payment status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="paid">Paid in Full (Cash / M-Pesa)</SelectItem>
                  <SelectItem value="partial">Partial Deposit Collected</SelectItem>
                  <SelectItem value="credit">30-Day Abattoir Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.paymentStatus === 'partial' ? (
              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground">Amount Paid (KSh)</Label>
                <Input
                  type="number"
                  value={formData.amountPaid}
                  onChange={e => setFormData(prev => ({ ...prev, amountPaid: e.target.value }))}
                  placeholder="e.g. 200000"
                  className="h-10 text-xs font-mono font-bold"
                  required
                />
              </div>
            ) : (
              <div className="flex flex-col justify-end text-[11px] text-muted-foreground pb-2">
                <span>Receivables Balance: <strong>KSh {saleCalcs.balanceDue.toLocaleString()}</strong></span>
              </div>
            )}
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
              disabled={isSubmitting || saleCalcs.totalAmount <= 0}
              className="rounded-xl font-bold text-xs h-11 px-5 bg-primary text-primary-foreground shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Committing Harvest...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" /> Commit Broiler Offtake
                </>
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}