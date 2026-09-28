// components/BroilerDashboardStrip.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, Activity, Truck, Flame, TrendingUp } from 'lucide-react';

import { calculateHarvestTippingPoint } from '@/lib/ovocore/broilerTippingPoint';

export interface BroilerDashboardStripProps {
  totalBirds: number;
  avgWeightGrams?: number;
  fcr?: number;
  epef?: number;
  totalBiomassKg?: number;
  daysToHarvest?: number;
}

export function BroilerDashboardStrip({
  totalBirds,
  avgWeightGrams = 1950,
  fcr = 1.58,
  epef = 365,
  totalBiomassKg,
  daysToHarvest = 7
}: BroilerDashboardStripProps) {
  const computedBiomass = totalBiomassKg || Math.round((totalBirds * avgWeightGrams) / 1000);

  const tippingPoint = calculateHarvestTippingPoint({
    currentAgeDays: 38,
    liveBirds: totalBirds || 5000,
    currentAvgWeightG: avgWeightGrams,
    costPerKgFinisherKES: 75,
    livePricePerKgKES: 195,
    observedDailyGainG: 55,
    observedDailyFeedIntakeG: 180
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-900 border-emerald-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Catch-Pen Avg Weight <Scale className="w-4 h-4 text-emerald-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-emerald-400">
            {avgWeightGrams.toLocaleString()} <span className="text-xs text-slate-400 font-normal">g / bird</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 font-mono">
            Live Biomass: {computedBiomass.toLocaleString()} kg
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-emerald-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Live Feed Conversion Ratio (FCR) <Activity className="w-4 h-4 text-amber-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-amber-400">
            {fcr.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge className={fcr <= 1.6 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]" : "bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]"}>
            {fcr <= 1.6 ? "Excellent Feed Efficiency" : "Standard Feed Efficiency"}
          </Badge>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-emerald-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            EPEF Index Rating <TrendingUp className="w-4 h-4 text-emerald-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-white">
            {epef} <span className="text-xs text-slate-500 font-normal">Points</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-emerald-400 font-bold">
            {epef >= 350 ? "Target Benchmark Exceeded" : "Good Broiler Index"}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-emerald-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Harvest Readiness Countdown <Truck className="w-4 h-4 text-emerald-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-emerald-300">
            {daysToHarvest > 0 ? `${daysToHarvest} Days Left` : "Ready for Off-Take"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 font-mono">
            {totalBirds.toLocaleString()} Meat Birds Active
          </p>
        </CardContent>
      </Card>

      {/* Harvest Tipping Point Recommendation Banner */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-4 p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-start gap-3 shadow-lg">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white uppercase font-mono">Economic Harvest Tipping Point</span>
            <Badge className={tippingPoint.status === 'HARVEST_NOW' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}>
              {tippingPoint.status === 'HARVEST_NOW' ? '⚡ HARVEST RECOMMENDED' : '📈 OPTIMAL GROWTH PHASE'}
            </Badge>
          </div>
          <p className="text-slate-300 font-sans leading-relaxed">
            {tippingPoint.recommendationText}
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-1">
            <span>Marginal Revenue: <strong className="text-emerald-400">KSh {tippingPoint.marginalRevenueKES}/bird/day</strong></span>
            <span>Marginal Feed Cost: <strong className="text-rose-400">KSh {tippingPoint.marginalFeedCostKES}/bird/day</strong></span>
            <span>Net Flock Profit: <strong className="text-amber-400">+KSh {tippingPoint.totalFlockDailyNetGainKES.toLocaleString()}/day</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
