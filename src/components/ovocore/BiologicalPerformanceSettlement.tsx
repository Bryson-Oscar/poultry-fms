"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Target, Coins, TrendingUp, AlertTriangle, ChevronDown, Printer } from 'lucide-react';
import { calculateBiologicalAlpha, BiologicalPerformanceInput, PerformanceAlphaReport } from '@/lib/ovocore/BiologicalHurdleEngine';

interface BiologicalPerformanceSettlementProps {
  farmId: string;
  flockId: string;
  enterpriseType: 'layers' | 'broilers' | 'improved_kienyeji';
  // We mock some data for the UI if not fully provided, just to show the power of the engine
}

export function BiologicalPerformanceSettlement({
  farmId,
  flockId,
  enterpriseType
}: BiologicalPerformanceSettlementProps) {
  const [report, setReport] = useState<PerformanceAlphaReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Simulate fetching flock close-out data and running it through the Hurdle Engine
    const mockInput: BiologicalPerformanceInput = {
      farmId,
      flockId,
      enterpriseType,
      initialBirdCount: 10000,
      finalBirdCount: 9750, // 2.5% mortality
      totalFeedConsumedKg: 28500,
      totalHarvestWeightKg: 18500, // For broilers, gives FCR ~1.54
      totalEggsProduced: 275000, // For layers
      flockCycleDays: 320,
      averageFeedCostPerKgKES: 65,
      averageProductSalePriceKES: 250 // KSh per Kg meat or per tray depending on logic
    };

    const calculatedReport = calculateBiologicalAlpha(mockInput);
    setReport(calculatedReport);
  }, [farmId, flockId, enterpriseType]);

  if (!report) return null;

  return (
    <Card className={`relative overflow-hidden border ${report.clearedHurdle ? 'border-emerald-500/30 bg-card' : 'border-rose-500/30 bg-card'} shadow-2xl  rounded-3xl`}>
      {/* Background Glow */}
      <div className={`absolute top-0 right-0 w-64 h-64 opacity-10 rounded-full blur-3xl pointer-events-none ${report.clearedHurdle ? 'bg-emerald-500' : 'bg-rose-500'}`} />

      <CardContent className="p-6 sm:p-8">
        {/* Collapsible Header */}
        <div
          className="flex items-center justify-between cursor-pointer select-none group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`${report.clearedHurdle ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} px-3 py-1 text-xs font-black uppercase tracking-widest`}>
              {report.clearedHurdle ? 'Biological Hurdle Cleared' : 'Hurdle Missed'}
            </Badge>
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 font-mono text-[10px]">
              FLOCK: {flockId.slice(0, 8)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs text-slate-400 hover:text-white print:hidden"
              onClick={(e) => {
                e.stopPropagation();
                window.print();
              }}
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> PDF Export
            </Button> */}
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-4 flex-1">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                {report.clearedHurdle ? (
                  <><ShieldCheck className="w-8 h-8 text-emerald-400" /> Contract Protection Audit</>
                ) : (
                  <><AlertTriangle className="w-8 h-8 text-rose-400" /> Operational Corrective Audit</>
                )}
              </h3>

              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                {report.summaryMessage}
              </p>

              <div className="flex flex-wrap gap-6 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Actual FCR</span>
                  <div className="text-xl font-black text-white font-mono">{report.actualFCR}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Mortality</span>
                  <div className="text-xl font-black text-white font-mono">{report.actualMortalityPct}%</div>
                </div>
                {report.actualLayingPct && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Laying Pct</span>
                    <div className="text-xl font-black text-white font-mono">{report.actualLayingPct}%</div>
                  </div>
                )}
              </div>
            </div>

            <div className={`flex flex-col min-w-[280px] p-6 rounded-2xl border ${report.clearedHurdle ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}  relative overflow-hidden group`}>
              {report.clearedHurdle && (
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              )}

              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Alpha Value Generated
              </span>
              <div className={`text-3xl font-black ${report.clearedHurdle ? 'text-emerald-400' : 'text-slate-500'} font-mono mb-4`}>
                KSh {report.alphaGeneratedKES.toLocaleString()}
              </div>

              <div className="h-px w-full bg-slate-800 mb-4" />

              <span className="text-[10px] text-amber-400/80 font-bold tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" /> OvoCore Escrow (10%)
              </span>
              <div className={`text-xl font-black ${report.clearedHurdle ? 'text-amber-400' : 'text-slate-500'} font-mono mb-5`}>
                KSh {report.platformCarriedInterestKES.toLocaleString()}
              </div>

              <Button
                className={`w-full font-bold shadow-lg ${report.clearedHurdle ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                disabled={!report.clearedHurdle}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {report.clearedHurdle ? 'Authorize Profit Share' : 'No Alpha Generated'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
