"use client";

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Egg, 
  Coins, 
  Users, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface KienyejiSaleModalProps {
  farmId: string;
  houseId: string;
  flockId: string;
  isOpen: boolean;
  onClose: () => void;
  availableBirds?: number;
}

export function RecordKienyejiSaleModal({
  farmId,
  houseId,
  flockId,
  isOpen,
  onClose,
  availableBirds = 800
}: KienyejiSaleModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [saleStream, setSaleStream] = useState<'live_birds' | 'fertilized_eggs' | 'table_eggs'>('live_birds');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPriceKES, setUnitPriceKES] = useState('1000'); // Default live bird price
  const [birdType, setBirdType] = useState<'cockerels' | 'spent_hens'>('cockerels');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'credit'>('paid');
  const [amountPaid, setAmountPaid] = useState('');

  // Automatic adjustments based on stream selection
  const handleStreamChange = (stream: 'live_birds' | 'fertilized_eggs' | 'table_eggs') => {
    setSaleStream(stream);
    if (stream === 'live_birds') setUnitPriceKES('1000');
    if (stream === 'fertilized_eggs') setUnitPriceKES('35');
    if (stream === 'table_eggs') setUnitPriceKES('16');
  };

  const totals = useMemo(() => {
    const q = Number(quantity) || 0;
    const p = Number(unitPriceKES) || 0;
    const rev = q * p;
    const paidVal = paymentStatus === 'paid' ? rev : paymentStatus === 'partial' ? (Number(amountPaid) || 0) : 0;
    const bal = Math.max(0, rev - paidVal);

    return {
      revenue: rev,
      paid: paidVal,
      balanceDue: bal,
      remainingStock: saleStream === 'live_birds' ? Math.max(0, availableBirds - q) : availableBirds
    };
  }, [quantity, unitPriceKES, availableBirds, saleStream, paymentStatus, amountPaid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !quantity || Number(quantity) <= 0) return;

    setSubmitting(true);
    try {
      const qNum = Number(quantity);

      // 1. Commit Sale Document
      await addDoc(collection(db, `farms/${farmId}/kienyejiSales`), {
        houseId,
        flockId,
        saleStream,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim() || null,
        quantity: qNum,
        unitPriceKES: Number(unitPriceKES),
        totalRevenueKES: totals.revenue,
        amountPaid: totals.paid,
        balanceDue: totals.balanceDue,
        paymentStatus,
        birdCategory: saleStream === 'live_birds' ? birdType : null,
        recordedAt: Timestamp.now(),
        createdAt: serverTimestamp()
      });

      // 2. If Live Birds, deduct from Flock headcount
      if (saleStream === 'live_birds') {
        const flockRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}`);
        await updateDoc(flockRef, {
          currentBirdCount: increment(-qNum),
          updatedAt: serverTimestamp()
        });
      }

      toast({
        title: "Kienyeji Transaction Recorded",
        description: `Dispatched ${qNum.toLocaleString()} ${saleStream.replace('_', ' ')} to ${buyerName} (KSh ${totals.revenue.toLocaleString()}).`
      });

      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Sale Commit Failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl p-6 bg-card text-card-foreground">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Record Improved Kienyeji Offtake
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage live cockerel/hen sales or premium fertilized hatching egg distribution.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          
          {/* Revenue Stream Mode Toggle */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product Category</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStreamChange('live_birds')}
                className={`p-2.5 rounded-xl border font-semibold transition-all ${saleStream === 'live_birds' ? 'border-primary bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}
              >
                Live Meat Birds
              </button>
              <button
                type="button"
                onClick={() => handleStreamChange('fertilized_eggs')}
                className={`p-2.5 rounded-xl border font-semibold transition-all ${saleStream === 'fertilized_eggs' ? 'border-primary bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}
              >
                Fertilized Eggs
              </button>
              <button
                type="button"
                onClick={() => handleStreamChange('table_eggs')}
                className={`p-2.5 rounded-xl border font-semibold transition-all ${saleStream === 'table_eggs' ? 'border-primary bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}
              >
                Table Eggs
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">Buyer / Customer Name *</Label>
              <Input
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                placeholder="e.g. Xena Mckenzie"
                required
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">Phone Number</Label>
              <Input
                value={buyerPhone}
                onChange={e => setBuyerPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                className="h-10 rounded-xl font-mono"
              />
            </div>
          </div>

          {saleStream === 'live_birds' && (
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">Bird Category</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setBirdType('cockerels'); setUnitPriceKES('1000'); }}
                  className={`p-2 rounded-xl border font-semibold text-xs ${birdType === 'cockerels' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'bg-muted/30 text-muted-foreground'}`}
                >
                  Mature Cockerel (Rooster)
                </button>
                <button
                  type="button"
                  onClick={() => { setBirdType('spent_hens'); setUnitPriceKES('800'); }}
                  className={`p-2 rounded-xl border font-semibold text-xs ${birdType === 'spent_hens' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'bg-muted/30 text-muted-foreground'}`}
                >
                  Spent Hen / Point-of-Lay
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border/70 rounded-2xl">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                {saleStream === 'live_birds' ? 'Birds Loaded' : 'Eggs Dispatched'} *
              </Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                required
                className="h-9 font-mono font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Price (KSh) *</Label>
              <Input
                type="number"
                value={unitPriceKES}
                onChange={e => setUnitPriceKES(e.target.value)}
                required
                className="h-9 font-mono font-bold"
              />
            </div>
          </div>

          {/* Payment Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">Payment Status</Label>
              <select
                value={paymentStatus}
                onChange={(e: any) => setPaymentStatus(e.target.value)}
                className="w-full h-10 rounded-xl border bg-background px-3 font-semibold text-xs"
              >
                <option value="paid">Paid in Full</option>
                <option value="partial">Partial Payment</option>
                <option value="credit">Pending / Credit</option>
              </select>
            </div>
            {paymentStatus === 'partial' ? (
              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground">Amount Paid (KSh)</Label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="e.g. 5000"
                  className="h-10 rounded-xl font-mono font-bold"
                  required
                />
              </div>
            ) : (
              <div className="flex flex-col justify-end pb-2 font-mono text-[11px] text-muted-foreground">
                Pending: <strong>KSh {totals.balanceDue.toLocaleString()}</strong>
              </div>
            )}
          </div>

          {/* Revenue Ledger Preview */}
          <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-muted-foreground">Total Sale Value:</span>
              <p className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                KSh {totals.revenue.toLocaleString()}
              </p>
            </div>
            {saleStream === 'live_birds' && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {totals.remainingStock.toLocaleString()} Birds Remaining
              </Badge>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || totals.revenue <= 0} className="rounded-xl h-10 font-bold">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Commit Kienyeji Sale
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
