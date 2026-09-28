"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { calculateBroilerTelemetry } from '@/lib/ovocore/broilerEngine';
import { 
  Scale, 
  Flame, 
  Droplets, 
  Wheat, 
  HeartPulse, 
  AlertTriangle, 
  Truck,
  TrendingUp,
  Activity,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface BroilerLogProps {
  farmId?: string;
  houseId?: string;
  flockId?: string;
  currentAgeDays?: number;
  liveBirds?: number;
  initialBirds?: number;
  cumulativeFeedKg?: number;
  onSaveLog?: (data: any) => Promise<void>;
}

export function BroilerDailyLogCapture({
  farmId,
  houseId,
  flockId,
  currentAgeDays = 28,
  liveBirds = 9650,
  initialBirds = 10000,
  cumulativeFeedKg = 18400,
  onSaveLog
}: BroilerLogProps) {
  const { toast } = useToast();
  const [mortality, setMortality] = useState(6);
  const [culls, setCulls] = useState(2);
  const [feedConsumedKg, setFeedConsumedKg] = useState(1150);
  const [feedType, setFeedType] = useState<'starter' | 'grower' | 'finisher' | 'withdrawal'>('grower');
  const [waterLiters, setWaterLiters] = useState(2100);
  const [sampleWeightsG, setSampleWeightsG] = useState('1420, 1450, 1390, 1480, 1410');
  const [tempMaxC, setTempMaxC] = useState(24.5);
  const [submitting, setSubmitting] = useState(false);

  // Computations using the Broiler Engine
  const stats = useMemo(() => {
    const rawSamples = sampleWeightsG.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    
    return calculateBroilerTelemetry({
      currentAgeDays,
      liveBirds,
      initialBirds,
      cumulativeFeedKg,
      todayFeedKg: feedConsumedKg,
      todayWaterLiters: waterLiters,
      sampleWeightsG: rawSamples,
    });
  }, [sampleWeightsG, liveBirds, initialBirds, cumulativeFeedKg, feedConsumedKg, waterLiters, currentAgeDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const rawSamples = sampleWeightsG.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const payload = {
        dayOfCycle: currentAgeDays,
        mortalityCount: mortality,
        cullCount: culls,
        feedConsumedKg,
        feedType,
        waterConsumedLiters: waterLiters,
        waterToFeedRatio: stats.waterToFeedRatio,
        sampleWeights: rawSamples,
        avgWeightG: stats.avgWeightG,
        computedFCR: stats.currentFCRFormatted,
        computedEPEF: stats.epef,
        dailyWeightGainG: stats.adgGramsPerDay,
        ambientTempMaxC: tempMaxC,
        date: new Date().toISOString().split('T')[0],
        loggedAt: serverTimestamp(),
      };

      if (onSaveLog) {
        await onSaveLog(payload);
      } else if (farmId && houseId && flockId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const logRef = doc(db, `farms/${farmId}/houses/${houseId}/flocks/${flockId}/dailyLogs`, todayStr);
        await setDoc(logRef, payload, { merge: true });
        toast({
          title: "Broiler Telemetry Saved",
          description: `Logged Day ${currentAgeDays}: FCR ${stats.currentFCRFormatted}, EPEF ${stats.epef}, Avg Weight ${stats.avgWeightG}g.`
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Log Failed",
        description: err.message || "Failed to save broiler daily log."
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Broiler Header Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-800 p-4 bg-slate-900 text-white shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase font-mono">
            <span>Flock Age</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black mt-2 text-white">Day {currentAgeDays}</p>
          <p className="text-[11px] text-slate-400 capitalize">{feedType} Phase</p>
        </Card>

        <Card className="rounded-2xl border-slate-800 p-4 bg-slate-900 text-white shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase font-mono">
            <span>Avg Bird Weight</span>
            <Scale className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black mt-2 text-white">{stats.avgWeightG} <span className="text-xs font-normal text-slate-400">g</span></p>
          <p className="text-[11px] text-slate-400 font-mono">Biomass: {Math.round(stats.liveBiomassKg).toLocaleString()} kg</p>
        </Card>

        <Card className="rounded-2xl border-slate-800 p-4 bg-slate-900 text-white shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase font-mono">
            <span>Live FCR</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black mt-2 text-amber-400">{stats.currentFCRFormatted}</p>
          <p className="text-[11px] text-slate-400 font-mono">Target: 1.50 – 1.65</p>
        </Card>

        <Card className="rounded-2xl border-slate-800 p-4 bg-slate-900 text-white shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase font-mono">
            <span>EPEF Efficiency</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-emerald-400">{stats.epef}</p>
          <p className="text-[11px] text-slate-400 font-mono">Livability: {stats.livabilityPct}%</p>
        </Card>
      </div>

      {/* Main Logging Form */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 text-white overflow-hidden shadow-xl">
        <CardHeader className="bg-slate-950/60 border-b border-slate-800 p-6">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" /> Log Daily Broiler Growth & Feed Consumption
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-5 text-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Mortality & Culls */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-300">Natural Deaths (Mortality)</Label>
                <Input 
                  type="number" 
                  value={mortality} 
                  onChange={e => setMortality(Number(e.target.value))} 
                  className="h-10 text-xs font-mono font-bold bg-slate-900 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-300">Culls (Runts / Deformed)</Label>
                <Input 
                  type="number" 
                  value={culls} 
                  onChange={e => setCulls(Number(e.target.value))} 
                  className="h-10 text-xs font-mono font-bold bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            {/* Feed & Water Resource Management */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-300">Feed Ration Type</Label>
                <select 
                  value={feedType} 
                  onChange={(e: any) => setFeedType(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white"
                >
                  <option value="starter">Broiler Starter (0–10 Days)</option>
                  <option value="grower">Broiler Grower (11–24 Days)</option>
                  <option value="finisher">Broiler Finisher (25–35 Days)</option>
                  <option value="withdrawal">Withdrawal Ration (No Meds)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-300">Feed Consumed Today (Kg)</Label>
                <Input 
                  type="number" 
                  value={feedConsumedKg} 
                  onChange={e => setFeedConsumedKg(Number(e.target.value))}
                  className="h-10 text-xs font-mono font-bold bg-slate-950 border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-bold text-slate-300">Water Intake (Liters)</Label>
                  <span className={`text-[10px] font-mono ${stats.waterToFeedStatus === 'heat_stress_warning' ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'}`}>
                    Ratio: {stats.waterToFeedRatio}:1
                  </span>
                </div>
                <Input 
                  type="number" 
                  value={waterLiters} 
                  onChange={e => setWaterLiters(Number(e.target.value))}
                  className="h-10 text-xs font-mono font-bold bg-slate-950 border-slate-800 text-white"
                />
              </div>
            </div>

            {/* Catch-Pen Weight Sampling */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[11px] font-bold text-slate-300">Catch-Pen Weight Sample Array (Grams, comma-separated)</Label>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/10">Avg: {stats.avgWeightG}g</Badge>
              </div>
              <Input 
                value={sampleWeightsG} 
                onChange={e => setSampleWeightsG(e.target.value)}
                placeholder="e.g. 1350, 1420, 1380, 1450" 
                className="h-10 text-xs font-mono bg-slate-900 border-slate-800 text-white"
              />
              <p className="text-[10px] text-slate-400">
                Weigh at least 50–100 birds from three distinct sections of the shed to ensure accurate herd profiling.
              </p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-11 text-xs font-extrabold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {submitting ? "Committing Broiler Telemetry..." : "Save Daily Broiler Log"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
