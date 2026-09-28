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
import { Wheat, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  feedType: string;
  onApproveDelivery: (qaSpecs: { moisturePct: number; crudeProteinPct: number; aflatoxinPpb: number }) => void;
}

export function FeedQualityInspectorModal({
  isOpen,
  onClose,
  feedType,
  onApproveDelivery
}: FeedInspectorProps) {
  const { toast } = useToast();
  const [moisturePct, setMoisturePct] = useState('12.2');
  const [crudeProteinPct, setCrudeProteinPct] = useState('20.5');
  const [aflatoxinPpb, setAflatoxinPpb] = useState('8');

  // Hard Biological Guardrails
  const moistureNum = parseFloat(moisturePct) || 0;
  const aflatoxinNum = parseFloat(aflatoxinPpb) || 0;
  const isAflatoxinHazard = aflatoxinNum > 20; // Kenya Bureau of Standards / FAO max: 20 ppb
  const isMoistureHigh = moistureNum > 13.0;   // Moisture > 13% causes Aspergillus mold in silos
  const isBlocked = isAflatoxinHazard || isMoistureHigh;

  const handleValidate = () => {
    if (isBlocked) {
      toast({
        variant: "destructive",
        title: "Feed Delivery Rejected",
        description: `Blocked due to ${isAflatoxinHazard ? 'Aflatoxin > 20ppb' : 'Moisture > 13%'}. Grain cannot enter silos.`
      });
      return;
    }

    onApproveDelivery({
      moisturePct: moistureNum,
      crudeProteinPct: parseFloat(crudeProteinPct) || 0,
      aflatoxinPpb: aflatoxinNum
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] rounded-3xl p-6 bg-card">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Wheat className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold">
              Feed Inbound QA & Silo Gate — {feedType}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Mandatory intake checks. Prevents aflatoxicosis and nutritional starvation before silo filling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-bold">Moisture Content (%)</Label>
              <span className="text-[10px] text-muted-foreground font-mono">Max: 13.0%</span>
            </div>
            <Input 
              type="number" 
              step="0.1" 
              value={moisturePct} 
              onChange={e => setMoisturePct(e.target.value)} 
              className={`h-9 font-mono ${isMoistureHigh ? 'border-destructive text-destructive' : ''}`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-bold">Crude Protein (CP %)</Label>
              <span className="text-[10px] text-muted-foreground font-mono">Spec: 18 - 22%</span>
            </div>
            <Input 
              type="number" 
              step="0.1" 
              value={crudeProteinPct} 
              onChange={e => setCrudeProteinPct(e.target.value)} 
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-bold">Aflatoxin / Mycotoxin Test (ppb)</Label>
              <span className="text-[10px] text-muted-foreground font-mono">Max Safe Limit: 20 ppb</span>
            </div>
            <Input 
              type="number" 
              value={aflatoxinPpb} 
              onChange={e => setAflatoxinPpb(e.target.value)} 
              className={`h-9 font-mono ${isAflatoxinHazard ? 'border-destructive text-destructive font-bold' : ''}`}
            />
          </div>

          {isBlocked && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4" /> Feed Quality Threshold Breach
              </div>
              <p className="text-[11px] leading-relaxed">
                {isAflatoxinHazard 
                  ? 'Aflatoxin exceeds 20 ppb limit. Ingestion causes acute liver hemorrhages and severe immune suppression.'
                  : 'Moisture exceeds 13.0%. High moisture leads to rapid fungal mold growth inside bulk silos.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs h-9">
            Cancel
          </Button>
          <Button 
            onClick={handleValidate} 
            disabled={isBlocked}
            className={`rounded-xl text-xs font-bold h-9 ${
              isBlocked ? 'bg-destructive/50' : 'bg-primary text-primary-foreground'
            }`}
          >
            {isBlocked ? 'Discharge Prohibited' : 'Approve & Release to Silos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
