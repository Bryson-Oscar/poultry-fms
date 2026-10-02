"use client";

import React, { useState } from 'react';
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
  Crown, 
  MessageCircle, 
  Sparkles, 
  ShieldAlert, 
  TrendingUp,
  Loader2 
} from 'lucide-react';
import { dispatchSuperAdminUpsellWhatsApp } from '@/lib/ovocore/whatsappAdvisor';
import { useToast } from '@/hooks/use-toast';

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFarmName?: string;
  defaultOwnerName?: string;
  defaultPhone?: string;
  birdCapacity?: number;
}

export function SuperAdminUpsellModal({
  isOpen,
  onClose,
  defaultFarmName = 'Lusoi Commercial Farm',
  defaultOwnerName = 'JM Kiragu',
  defaultPhone = '+254700000000',
  birdCapacity = 20000
}: UpsellModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [ownerName, setOwnerName] = useState(defaultOwnerName);
  const [farmName, setFarmName] = useState(defaultFarmName);
  const [phone, setPhone] = useState(defaultPhone);
  const [capacity, setCapacity] = useState(birdCapacity);

  // Compute estimated monthly loss based on capacity (approx KSh 3.50 / bird / month in unoptimized feed/mortality)
  const estimatedLeakKES = Math.round(capacity * 3.5);

  const handleDispatch = () => {
    setLoading(true);
    try {
      dispatchSuperAdminUpsellWhatsApp({
        targetOwnerName: ownerName,
        targetFarmName: farmName,
        targetPhone: phone,
        currentTier: 'Tier 1',
        recommendedUpgradeTier: 'Sovereign Syndicate',
        estimatedMonthlySavingsKES: estimatedLeakKES
      });

      toast({
        title: "Executive Upsell Dispatched",
        description: `WhatsApp advisory sent to ${ownerName} (${farmName}).`
      });
      onClose();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Dispatch Failed',
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl p-6 bg-card text-card-foreground">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Crown className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Super Admin: Sovereign Syndicate Upsell
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Deploy elite sales psychology and margin-leak framing directly to target farm owners via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Farm Name</Label>
              <Input 
                value={farmName} 
                onChange={e => setFarmName(e.target.value)} 
                className="h-9 text-xs font-bold" 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Owner Name</Label>
              <Input 
                value={ownerName} 
                onChange={e => setOwnerName(e.target.value)} 
                className="h-9 text-xs font-bold" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">WhatsApp Phone (E.164)</Label>
              <Input 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                className="h-9 text-xs font-mono" 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Active Bird Capacity</Label>
              <Input 
                type="number"
                value={capacity} 
                onChange={e => setCapacity(Number(e.target.value) || 0)} 
                className="h-9 text-xs font-mono font-bold" 
              />
            </div>
          </div>

          {/* Calculated Leak Preview Box */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" /> Projected Margin Leak (Cost of Inaction)
            </div>
            <p className="text-foreground font-mono font-black text-lg">
              KSh {estimatedLeakKES.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ month in unmonitored waste</span>
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This calculated figure is automatically woven into the WhatsApp message to evoke the Fear of Loss and demonstrate superior intelligence.
            </p>
          </div>

          <Button
            onClick={handleDispatch}
            disabled={loading || !phone.trim()}
            className="w-full h-11 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            Dispatch Sovereign Syndicate Upsell via WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
