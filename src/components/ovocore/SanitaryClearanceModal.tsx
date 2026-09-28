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
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  Trash2, 
  Droplets, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { HouseSanitationState } from '@/types/ovocoreAutonomy';

interface SanitaryModalProps {
  farmId: string;
  houseId: string;
  houseName: string;
  isOpen: boolean;
  onClose: () => void;
  currentState?: HouseSanitationState;
}

export function SanitaryClearanceModal({
  farmId,
  houseId,
  houseName,
  isOpen,
  onClose,
  currentState = {
    status: 'depleted',
    depletedAt: Timestamp.now(),
    downtimeEndAt: null,
    clearedForPlacement: false
  }
}: SanitaryModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [litterTareWeighbill, setLitterTareWeighbill] = useState('');
  const [detergentLot, setDetergentLot] = useState('');
  const [disinfectantActiveIngredient, setDisinfectantActiveIngredient] = useState('Glutaraldehyde + QAC (Virkon S)');
  const [labSwabClearanceId, setLabSwabClearanceId] = useState('');
  const [floorTempC, setFloorTempC] = useState('32.5');
  const [shavingsDepthCm, setShavingsDepthCm] = useState('6.5');

  // Compute step advancement
  const currentStep = {
    active_production: 1,
    depleted: 1,
    litter_removed: 2,
    wet_washed: 3,
    disinfected: 4,
    downtime_countdown: 5,
    swab_cleared: 6
  }[currentState.status] || 1;

  const handleStepSubmit = async (nextStatus: HouseSanitationState['status'], extraData: any = {}) => {
    setSubmitting(true);
    try {
      const houseRef = doc(db, `farms/${farmId}/houses/${houseId}`);
      const payload: any = {
        'sanitationState.status': nextStatus,
        'sanitationState.updatedAt': serverTimestamp(),
        ...extraData
      };

      if (nextStatus === 'downtime_countdown') {
        const downtimeEnd = new Date();
        downtimeEnd.setDate(downtimeEnd.getDate() + 14); // 14-day sanitary downtime lock
        payload['sanitationState.downtimeEndAt'] = Timestamp.fromDate(downtimeEnd);
      }

      if (nextStatus === 'swab_cleared') {
        payload['sanitationState.clearedForPlacement'] = true;
      }

      await updateDoc(houseRef, payload);

      toast({
        title: "Biosecurity Milestone Verified",
        description: `Stage updated to ${nextStatus.replace('_', ' ').toUpperCase()}.`
      });
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] rounded-3xl p-6 bg-card text-card-foreground">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Terminal Biosecurity Cleanout — {houseName}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Enforced 5-gate decontamination sequence. House is locked until sanitary protocols pass clearance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Progress Tracker */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
              <span>Cleanout Gate {currentStep} of 5</span>
              <span>{Math.round((currentStep / 5) * 100)}% Complete</span>
            </div>
            <Progress value={(currentStep / 5) * 100} className="h-1.5" />
          </div>

          {/* Gate 1: Dry Cleaning & Litter Evacuation */}
          {currentStep === 1 && (
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Trash2 className="w-4 h-4 text-primary" /> Gate 1: Dry Cleaning & Manure Outloading
              </div>
              <p className="text-muted-foreground text-[11px]">
                Remove all organic matter, blow dust off rafters and wire partitions, and bag out old bedding litter.
              </p>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Litter Disposal Manifest / Weighbill #</Label>
                <Input 
                  value={litterTareWeighbill} 
                  onChange={e => setLitterTareWeighbill(e.target.value)} 
                  placeholder="e.g. WB-9921 / Truck Tare Confirmed"
                  className="h-9 text-xs" 
                />
              </div>
              <Button 
                onClick={() => handleStepSubmit('litter_removed', { 'sanitationState.litterWeighbillId': litterTareWeighbill })}
                disabled={!litterTareWeighbill.trim() || submitting}
                className="w-full text-xs font-bold rounded-xl h-9"
              >
                Confirm Dry Cleaning Sign-Off
              </Button>
            </div>
          )}

          {/* Gate 2: Wet Foam Washing */}
          {currentStep === 2 && (
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Droplets className="w-4 h-4 text-blue-500" /> Gate 2: High-Pressure Alkaline Foam Wash
              </div>
              <p className="text-muted-foreground text-[11px]">
                Soak shed surfaces with broad-spectrum alkaline detergent foam for 4 hours to dissolve organic biofilm.
              </p>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Detergent Batch / Lot Number</Label>
                <Input 
                  value={detergentLot} 
                  onChange={e => setDetergentLot(e.target.value)} 
                  placeholder="e.g. CID-LINES FOAM LOT #4481" 
                  className="h-9 text-xs" 
                />
              </div>
              <Button 
                onClick={() => handleStepSubmit('wet_washed', { 'sanitationState.chemicalLotNumber': detergentLot })}
                disabled={!detergentLot.trim() || submitting}
                className="w-full text-xs font-bold rounded-xl h-9"
              >
                Confirm High-Pressure Foam Rinse
              </Button>
            </div>
          )}

          {/* Gate 3: Disinfection & Fogging */}
          {currentStep === 3 && (
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Flame className="w-4 h-4 text-amber-500" /> Gate 3: Disinfection & Thermal Fogging
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Active Disinfectant Chemical</Label>
                <Input 
                  value={disinfectantActiveIngredient} 
                  onChange={e => setDisinfectantActiveIngredient(e.target.value)} 
                  className="h-9 text-xs" 
                />
              </div>
              <Button 
                onClick={() => handleStepSubmit('downtime_countdown', { 'sanitationState.disinfectantActiveIngredient': disinfectantActiveIngredient })}
                disabled={submitting}
                className="w-full text-xs font-bold rounded-xl h-9"
              >
                Activate 14-Day Quarantine Downtime Lock
              </Button>
            </div>
          )}

          {/* Gate 4: 14-Day Mandatory Downtime Countdown */}
          {currentStep === 4 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-center">
              <Clock className="w-8 h-8 text-amber-600 mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-foreground">Sanitary Downtime Lock Enforced</p>
                <p className="text-muted-foreground text-[11px]">
                  Bacteriological and viral death curve requires zero host occupation for 14 continuous days.
                </p>
              </div>
              <Button 
                onClick={() => handleStepSubmit('disinfected')}
                variant="outline"
                className="text-xs rounded-xl h-9"
              >
                Proceed to Swab Microbiological Testing
              </Button>
            </div>
          )}

          {/* Gate 5: Microbiological Swabs & Pre-Placement Heat Check */}
          {currentStep === 5 && (
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Gate 5: Lab Swab Clearance & Pre-Heating
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Floor Bedding Temp (°C)</Label>
                  <Input value={floorTempC} onChange={e => setFloorTempC(e.target.value)} className="h-9 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Wood Shavings Depth (cm)</Label>
                  <Input value={shavingsDepthCm} onChange={e => setShavingsDepthCm(e.target.value)} className="h-9 text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Veterinary Swab Certificate ID</Label>
                <Input 
                  value={labSwabClearanceId} 
                  onChange={e => setLabSwabClearanceId(e.target.value)} 
                  placeholder="e.g. LAB-SALMONELLA-NEG-081" 
                  className="h-9 text-xs font-mono" 
                />
              </div>
              <Button 
                onClick={() => handleStepSubmit('swab_cleared', {
                  'sanitationState.swabLabClearanceId': labSwabClearanceId,
                  'sanitationState.prePlacementFloorTempC': Number(floorTempC),
                  'sanitationState.prePlacementShavingsDepthCm': Number(shavingsDepthCm)
                })}
                disabled={!labSwabClearanceId.trim() || submitting}
                className="w-full text-xs font-bold rounded-xl h-9 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Grant Certified Pre-Placement Clearance
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
