"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  CheckCircle2, 
  Lock, 
  ArrowRight,
  Building2,
  Activity,
  Award
} from 'lucide-react';
import { evaluateInfrastructureReadiness, FarmAuditInput } from '@/lib/ovocore/infrastructureAuditEngine';
import { useToast } from '@/hooks/use-toast';

interface EllaAuditProps {
  initialData?: Partial<FarmAuditInput>;
  onTierUnlocked?: (tier: string) => void;
}

export function EllaInfrastructureAuditWidget({ initialData, onTierUnlocked }: EllaAuditProps) {
  const { toast } = useToast();
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditComplete, setAuditComplete] = useState(false);

  const [formData, setFormData] = useState<FarmAuditInput>({
    enterpriseType: initialData?.enterpriseType || 'layers',
    totalBirdCapacity: initialData?.totalBirdCapacity || 10000,
    ventilationType: initialData?.ventilationType || 'Tunnel',
    biosecurityLevel: initialData?.biosecurityLevel || 'Standard Level 2',
    hasIoTControllers: initialData?.hasIoTControllers || false
  });

  const [result, setResult] = useState<ReturnType<typeof evaluateInfrastructureReadiness> | null>(null);

  const handleRunAudit = () => {
    setIsAuditing(true);
    setAuditComplete(false);

    setTimeout(() => {
      const evaluation = evaluateInfrastructureReadiness(formData);
      setResult(evaluation);
      setIsAuditing(false);
      setAuditComplete(true);

      if (onTierUnlocked) {
        onTierUnlocked(evaluation.tier);
      }

      toast({
        title: `Audit Complete: ${evaluation.tier} Unlocked`,
        description: `Ella verified your infrastructure with a readiness score of ${evaluation.score}/100.`
      });
    }, 2000);
  };

  return (
    <Card className="rounded-3xl border-border/80 bg-card overflow-hidden shadow-sm">
      <CardHeader className="bg-muted/20 border-b border-border/60 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2">
              Ella's Infrastructure Readiness Audit
            </CardTitle>
            <CardDescription className="text-xs">
              AI Smart Assistant evaluation mapping your farm capacity and hardware to system feature unlocks.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6 text-xs">
        {!auditComplete ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground uppercase text-[10px]">Enterprise Focus</label>
                <select
                  value={formData.enterpriseType}
                  onChange={(e: any) => setFormData(p => ({ ...p, enterpriseType: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-input rounded-xl text-xs font-semibold"
                >
                  <option value="layers">Commercial Layers</option>
                  <option value="broilers">Meat Broilers</option>
                  <option value="improved_kienyeji">Improved Kienyeji</option>
                  <option value="mixed">Mixed Enterprise</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground uppercase text-[10px]">Total Bird Capacity</label>
                <input
                  type="number"
                  value={formData.totalBirdCapacity}
                  onChange={(e) => setFormData(p => ({ ...p, totalBirdCapacity: Number(e.target.value) || 0 }))}
                  className="w-full h-10 px-3 bg-background border border-input rounded-xl font-mono font-bold text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground uppercase text-[10px]">Ventilation Architecture</label>
                <select
                  value={formData.ventilationType}
                  onChange={(e: any) => setFormData(p => ({ ...p, ventilationType: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-input rounded-xl text-xs font-semibold"
                >
                  <option value="Natural (Open Sided)">Natural (Open Sided)</option>
                  <option value="Tunnel">Tunnel Ventilated</option>
                  <option value="Environmentally Controlled">Environmentally Controlled (EC)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground uppercase text-[10px]">Biosecurity Tier</label>
                <select
                  value={formData.biosecurityLevel}
                  onChange={(e: any) => setFormData(p => ({ ...p, biosecurityLevel: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-input rounded-xl text-xs font-semibold"
                >
                  <option value="Standard Level 1">Standard Level 1 (Basic Footbath)</option>
                  <option value="Standard Level 2">Standard Level 2 (Shower + Footbath)</option>
                  <option value="Strict Quarantine Level 3">Strict Quarantine Level 3 (Full Perimeter)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="iotCheck"
                checked={formData.hasIoTControllers}
                onChange={(e) => setFormData(p => ({ ...p, hasIoTControllers: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary"
              />
              <label htmlFor="iotCheck" className="font-semibold cursor-pointer select-none">
                Hardware Arduino / ESP32 sensor telemetry nodes deployed on site
              </label>
            </div>

            <Button
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="w-full h-11 rounded-2xl font-bold text-xs mt-2"
            >
              {isAuditing ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-spin" /> Ella is running infrastructure audit...
                </>
              ) : (
                'Run Automated Infrastructure Audit'
              )}
            </Button>
          </div>
        ) : result && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            {/* Score & Tier Banner */}
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="space-y-1">
                <Badge className="bg-primary text-primary-foreground font-mono text-[10px] uppercase font-black">
                  {result.tier} Qualified
                </Badge>
                <p className="font-bold text-sm text-foreground">{result.ellasVerdict}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block font-bold">Readiness Score</span>
                <span className="font-mono font-black text-2xl text-primary">{result.score}%</span>
              </div>
            </div>

            {/* Unlocked Features List */}
            <div className="space-y-2">
              <span className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider">
                Dynamically Unlocked Modules ({result.unlockedFeatures.length})
              </span>
              <div className="space-y-1.5">
                {result.unlockedFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border bg-card text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ella's Recommendation */}
            <div className="p-3.5 rounded-xl border bg-muted/30 text-muted-foreground text-[11px] leading-relaxed">
              <strong className="text-foreground">Ella's Strategic Recommendation:</strong> {result.recommendation}
            </div>

            <Button
              variant="outline"
              onClick={() => setAuditComplete(false)}
              className="w-full h-10 rounded-xl font-bold text-xs"
            >
              Re-evaluate Parameters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
