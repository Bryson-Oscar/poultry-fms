// components/LayerDashboardStrip.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Egg, TrendingUp, Sparkles, Layers, Activity } from 'lucide-react';

export interface LayerDashboardStripProps {
  totalBirds: number;
  totalTraysToday?: number;
  avgHenDayPct?: number;
  cumulativeEggs?: number;
}

export function LayerDashboardStrip({
  totalBirds,
  totalTraysToday = 142,
  avgHenDayPct = 88.5,
  cumulativeEggs = 425000
}: LayerDashboardStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-slate-900 border-amber-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Daily Egg Output <Egg className="w-4 h-4 text-amber-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-amber-400">
            {totalTraysToday} <span className="text-xs text-slate-400 font-normal">Trays Today</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 font-mono">
            ≈ {(totalTraysToday * 30).toLocaleString()} Commercial Table Eggs
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-amber-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Average Hen-Day Production <TrendingUp className="w-4 h-4 text-emerald-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-emerald-400">
            {avgHenDayPct.toFixed(1)}%
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
            Peak Lay Performance
          </Badge>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-amber-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Active Laying Flocks <Layers className="w-4 h-4 text-amber-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-white">
            {totalBirds.toLocaleString()} <span className="text-xs text-slate-500 font-normal">Hens</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400">
            Lohmann Brown & ISA Brown Strains
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-amber-500/20 text-white rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
          <CardDescription className="text-slate-400 text-xs font-mono uppercase flex items-center justify-between">
            Cumulative Egg Production <Sparkles className="w-4 h-4 text-amber-400" />
          </CardDescription>
          <CardTitle className="text-2xl font-black text-amber-300">
            {cumulativeEggs.toLocaleString()} <span className="text-xs text-slate-500 font-normal">Eggs</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs font-bold text-slate-300">
            Flock Life Lay Cycle Tracked
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
