// components/AddOpexModal.tsx
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
  Receipt,
  Building2,
  Sparkles,
  Calculator,
  TrendingDown,
  Tag,
  CreditCard,
  Plus
} from 'lucide-react';
import type { House, Flock } from '@/services/ovocore/firebaseSchema';

export interface AddOpexModalProps {
  farmId: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface HouseFlockLink {
  houseId: string;
  houseName: string;
  flockId: string | null;
  flockCode: string | null;
  liveBirds: number;
}

export const opexCategories = {
  "Labor & Farm Personnel": [
    "Permanent Staff Salaries",
    "Casual Fundi & House Cleaning",
    "Security & Watchman Service",
    "Farm Management Stipend"
  ],
  "Utilities & Production Energy": [
    "Electricity (KPLC / Grid)",
    "Generator Diesel & Brooding Fuel",
    "Metered Water & Borehole Pumping Power",
    "Gas Cylinders (Brooding Heaters)"
  ],
  "Veterinary, Vaccines & Biosecurity": [
    "Routine Vaccines & Biologicals",
    "Antibiotics, Dewormers & Vitamins",
    "Disinfectants, Footbath Lime & Virucides",
    "Veterinary Consultation Fees"
  ],
  "Infrastructure & Cage Maintenance": [
    "Battery Cage & Nipple Drinker Repairs",
    "Shed Roofing, Mesh & Curtain Maintenance",
    "Feed Trough & Auger Servicing",
    "Electrical & Standby Generator Maint."
  ],
  "Packaging & Consumables": [
    "Paper Egg Trays & Plastic Crates",
    "Disinfectant Dip & Sanitizer Consumables",
    "Gunny Bags, Scales & Strapping Twine"
  ],
  "Logistics & Market Distribution": [
    "Farmgate Delivery Fuel & Van Hire",
    "Feed Offloading & Transport Casuals",
    "Vehicle Insurance & Commercial Road Levies"
  ],
  "Administrative & Regulatory": [
    "County Agricultural Business Permits",
    "NEMA & Veterinary Health Inspections",
    "M-Pesa Business Till / Bank Charges",
    "Farm Property & Stock Insurance"
  ],
  "Other Expenses": [
    "Ad-hoc Purchases & Hardware Spares",
    "Miscellaneous Grounds Upkeep"
  ]
};

export function AddOpexModal({ farmId, trigger, onSuccess }: AddOpexModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [houses, setHouses] = useState<HouseFlockLink[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    category: 'Permanent Staff Salaries',
    amount: '',
    supplierOrPayee: '',
    paymentMethod: 'M-Pesa Business / Till',
    invoiceOrReceiptNumber: '',
    targetAllocation: 'general_overhead', // 'general_overhead' or specific houseId
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Pull active production houses & link their active flocks
  useEffect(() => {
    if (!open || !farmId) return;

    async function loadHouseContext() {
      setLoadingContext(true);
      try {
        const querySnapshot = await getDocs(collection(db, `farms/${farmId}/houses`));
        const resolved: HouseFlockLink[] = [];

        for (const hDoc of querySnapshot.docs) {
          const hData = hDoc.data() as House;
          let activeFlockCode: string | null = null;
          let liveBirds = 0;

          if (hData.currentFlockId) {
            try {
              const flockSnap = await getDoc(
                doc(db, `farms/${farmId}/houses/${hDoc.id}/flocks/${hData.currentFlockId}`)
              );
              if (flockSnap.exists()) {
                const fData = flockSnap.data() as Flock;
                activeFlockCode = fData.flockCode;
                liveBirds = fData.currentBirdCount || 0;
              }
            } catch (e) {
              console.warn("Could not resolve flock for house:", e);
            }
          }

          resolved.push({
            houseId: hDoc.id,
            houseName: hData.houseName,
            flockId: hData.currentFlockId || null,
            flockCode: activeFlockCode,
            liveBirds
          });
        }
        setHouses(resolved);
      } catch (err) {
        console.error("Failed to load production houses for OPEX modal:", err);
      } finally {
        setLoadingContext(false);
      }
    }

    loadHouseContext();
  }, [open, farmId]);

  // Aggregate live birds across the farm
  const totalLiveBirds = useMemo(() => {
    return houses.reduce((acc, h) => acc + h.liveBirds, 0);
  }, [houses]);

  // Selected house allocation
  const selectedHouse = useMemo(() => {
    return houses.find(h => h.houseId === formData.targetAllocation);
  }, [houses, formData.targetAllocation]);

  // Real-time cost impact per bird & per egg calculation
  const costImpact = useMemo(() => {
    const val = parseFloat(formData.amount);
    if (!val || val <= 0) return null;

    const baseBirds = selectedHouse ? selectedHouse.liveBirds : totalLiveBirds;
    if (baseBirds <= 0) return null;

    const costPerBird = val / baseBirds;
    // Commercial layer producing ~20-25 eggs/month
    const estimatedCostPerEggImpact = costPerBird / 24;

    return {
      costPerBird,
      estimatedCostPerEggImpact,
      baseBirds
    };
  }, [formData.amount, selectedHouse, totalLiveBirds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !formData.amount || !formData.description.trim()) return;

    setIsSubmitting(true);
    try {
      const amountNum = Number(formData.amount);
      const isGeneral = formData.targetAllocation === 'general_overhead';
      const allocatedHouse = isGeneral ? null : selectedHouse;

      await addDoc(collection(db, `farms/${farmId}/opex`), {
        category: formData.category,
        amount: amountNum,
        currency: 'KSh',
        supplierOrPayee: formData.supplierOrPayee.trim() || 'Internal / Cash',
        paymentMethod: formData.paymentMethod,
        invoiceOrReceiptNumber: formData.invoiceOrReceiptNumber.trim() || null,
        relatedHouseId: allocatedHouse ? allocatedHouse.houseId : null,
        relatedHouseName: allocatedHouse ? allocatedHouse.houseName : 'General Farm Overhead',
        relatedFlockId: allocatedHouse ? allocatedHouse.flockId : null,
        relatedFlockCode: allocatedHouse ? allocatedHouse.flockCode : null,
        date: Timestamp.fromDate(new Date(formData.date)),
        description: formData.description.trim(),
        recordedBy: auth.currentUser?.uid || 'system',
        farmId,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'OPEX Expense Logged',
        description: `KSh ${amountNum.toLocaleString()} debited to ${allocatedHouse ? allocatedHouse.houseName : 'General Farm Overhead'}.`
      });

      setOpen(false);
      if (onSuccess) onSuccess();

      // Reset
      setFormData({
        category: 'Permanent Staff Salaries',
        amount: '',
        supplierOrPayee: '',
        paymentMethod: 'M-Pesa Business / Till',
        invoiceOrReceiptNumber: '',
        targetAllocation: 'general_overhead',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error("Failed to record OPEX:", error);
      toast({
        title: 'Transaction Error',
        description: 'Failed to record expense entry.',
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
          <Button size="sm" variant="outline" className="rounded-xl font-bold text-xs h-10">
            <Plus className="h-4 w-4 mr-1.5" /> Log Expense
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 bg-card text-card-foreground custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Receipt className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Log Operating Expense (OPEX)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Records operational cash outflows, utility payments, biosecurity inputs, and cost centers.
          </DialogDescription>
        </DialogHeader>

        {/* Dynamic Unit Economic Impact Banner */}
        {costImpact && (
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-1 text-xs">
            <div className="flex items-center justify-between font-bold text-primary">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" /> Unit Economics Impact:
              </span>
              <span>Across {costImpact.baseBirds.toLocaleString()} Birds</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1">
              <div>
                <span>Expense per Bird:</span>
                <span className="font-mono font-bold text-foreground block">
                  KSh {costImpact.costPerBird.toFixed(2)}
                </span>
              </div>
              <div>
                <span>Production Surcharge:</span>
                <span className="font-mono font-bold text-foreground block">
                  +KSh {costImpact.estimatedCostPerEggImpact.toFixed(3)} / egg
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">

          {/* 1. Category Classification */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Cost Center Category *
            </Label>
            <Select
              value={formData.category}
              onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
              required
            >
              <SelectTrigger id="category" className="h-10 rounded-xl">
                <SelectValue placeholder="Select cost center..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] rounded-2xl text-xs">
                {Object.entries(opexCategories).map(([group, items]) => (
                  <SelectGroup key={group}>
                    <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase">{group}</SelectLabel>
                    {items.map(item => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Amount & Payee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-primary font-bold">Total Amount (KSh) *</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g. 18500"
                min="0.01"
                step="0.01"
                required
                className="h-10 rounded-xl font-mono font-bold bg-background text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplierOrPayee" className="font-semibold text-muted-foreground">Payee / Supplier</Label>
              <Input
                id="supplierOrPayee"
                value={formData.supplierOrPayee}
                onChange={(e) => setFormData(prev => ({ ...prev, supplierOrPayee: e.target.value }))}
                placeholder="e.g. Kenya Power, John Mwangi"
                className="h-10 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* 3. Payment Method & Transaction Identifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod" className="font-semibold text-muted-foreground">Disbursement Channel</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(val) => setFormData(prev => ({ ...prev, paymentMethod: val }))}
              >
                <SelectTrigger id="paymentMethod" className="h-10 rounded-xl">
                  <SelectValue placeholder="Payment mode" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs">
                  <SelectItem value="M-Pesa Business / Till">M-Pesa Buy Goods / Till</SelectItem>
                  <SelectItem value="M-Pesa Paybill">M-Pesa Paybill</SelectItem>
                  <SelectItem value="M-Pesa Send Money">M-Pesa Send Money (Personal)</SelectItem>
                  <SelectItem value="Bank Transfer (EFT/RTGS)">Bank Transfer / RTGS</SelectItem>
                  <SelectItem value="Cash / Petty Cash">Physical Cash / Petty Cash</SelectItem>
                  <SelectItem value="Supplier Credit Account">Supplier 30-Day Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoiceOrReceiptNumber" className="font-semibold text-muted-foreground">
                Transaction / Receipt Ref #
              </Label>
              <Input
                id="invoiceOrReceiptNumber"
                value={formData.invoiceOrReceiptNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, invoiceOrReceiptNumber: e.target.value }))}
                placeholder="e.g. QKH82931 or INV-981"
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          {/* 4. Production Unit Attribution & Incurred Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="targetAllocation" className="font-semibold text-muted-foreground">
                Allocated House / Production Unit
              </Label>
              <Select
                value={formData.targetAllocation}
                onValueChange={(val) => setFormData(prev => ({ ...prev, targetAllocation: val }))}
              >
                <SelectTrigger id="targetAllocation" className="h-10 rounded-xl">
                  <SelectValue placeholder="Select target..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl text-xs max-h-60">
                  <SelectItem value="general_overhead">General Farm Overhead (Unallocated)</SelectItem>
                  {houses.map((h) => (
                    <SelectItem key={h.houseId} value={h.houseId}>
                      {h.houseName} {h.flockCode ? `(${h.flockCode} • ${h.liveBirds} birds)` : '(Vacant)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date" className="font-semibold text-muted-foreground">Date Incurred *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="h-10 rounded-xl font-mono text-xs"
                required
              />
            </div>
          </div>

          {/* 5. Purpose & Line Item Details */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Detailed Description & Purpose *
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Purchased 4 boxes of nipple drinkers and PVC connectors for House 2"
              required
              className="h-10 rounded-xl font-medium"
            />
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording Expenditure...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 mr-2" /> Commit OPEX Entry
                </>
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}