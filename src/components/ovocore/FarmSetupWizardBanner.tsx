"use client";

import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Egg,
  Wheat,
  Users,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Sparkles,
  ChevronRight,
  X,
  ShieldCheck
} from 'lucide-react';

export interface FarmSetupWizardBannerProps {
  farmId: string;
  farmName: string;
  houseCount: number;
  flockCount: number;
  feedBatchCount: number;
  registeredUsersCount?: number;
  onOpenAddHouse: () => void;
  onOpenAddFlock: () => void;
  onOpenAddFeed: () => void;
  onOpenInviteTeam: () => void;
}

export function FarmSetupWizardBanner({
  farmId,
  farmName,
  houseCount,
  flockCount,
  feedBatchCount,
  registeredUsersCount = 1,
  onOpenAddHouse,
  onOpenAddFlock,
  onOpenAddFeed,
  onOpenInviteTeam
}: FarmSetupWizardBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Calculate configuration steps
  const isProfileComplete = true; // Farm registration complete
  const isHouseComplete = houseCount > 0;
  const isFlockComplete = flockCount > 0;
  const isFeedComplete = feedBatchCount > 0;

  const completedStepsCount = [
    isProfileComplete,
    isHouseComplete,
    isFlockComplete,
    isFeedComplete
  ].filter(Boolean).length;

  const totalSteps = 4;
  const progressPct = Math.round((completedStepsCount / totalSteps) * 100);
  const isFullyConfigured = progressPct === 100;

  const [isMinimized, setIsMinimized] = useState(isFullyConfigured);

  React.useEffect(() => {
    if (isFullyConfigured) {
      setIsMinimized(true);
    }
  }, [isFullyConfigured]);

  if (isDismissed) return null;

  if (isFullyConfigured && isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <button
          onClick={() => setIsMinimized(false)}
          className="group relative flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-110 hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] transition-all"
          title="Farm is 100% Configured - Click for Status"
        >
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30 group-hover:opacity-50" />
          <ShieldCheck className="w-7 h-7 relative z-10" />
        </button>
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 text-white shadow-2xl transition-all">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <CardContent className="p-6 sm:p-8 space-y-6 relative z-10">
        
        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
              {isFullyConfigured ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>100% Fully Configured</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Farm Setup Completeness: {progressPct}%</span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isFullyConfigured ? `${farmName} Setup Complete` : `Complete Your Farm Configuration`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {isFullyConfigured
                ? 'Your poultry farm infrastructure, active flocks, and feed rations are fully operational.'
                : 'Follow the setup checklist below to configure your sheds, flocks, and feed rations.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block mr-2">
              <span className="text-2xl font-black text-amber-400 font-mono">{progressPct}%</span>
              <span className="block text-[10px] text-slate-400 uppercase font-mono tracking-wider">Completed</span>
            </div>
            
            {isFullyConfigured && (
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Minimize to badge"
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            )}
            
            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Dismiss banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <Progress value={progressPct} className="h-2.5 bg-slate-950 border border-slate-800" />
        </div>

        {/* Step Checklist Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          
          {/* Step 1: Farm Registered */}
          <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
            isProfileComplete ? 'bg-background border-emerald-500/30 text-slate-200' : 'bg-slate-950/50 border-slate-800'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Building2 className="w-5 h-5 text-amber-400" />
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">1. Register Farm</h4>
                <p className="text-[11px] text-slate-400 truncate">{farmName}</p>
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-bold pt-2 flex items-center gap-1">
              ✓ Registered
            </span>
          </div>

          {/* Step 2: Add Production Shed */}
          <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
            isHouseComplete ? 'bg-background border-emerald-500/30 text-slate-200' : 'bg-slate-950/90 border-amber-500/40 shadow-lg'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Building2 className={`w-5 h-5 ${isHouseComplete ? 'text-emerald-400' : 'text-amber-400'}`} />
                {isHouseComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">2. Add Production Shed</h4>
                <p className="text-[11px] text-slate-400">
                  {isHouseComplete ? `${houseCount} Shed(s) Active` : 'No production sheds added yet'}
                </p>
              </div>
            </div>

            {isHouseComplete ? (
              <span className="text-[10px] text-emerald-400 font-mono font-bold pt-2">
                ✓ {houseCount} Shed(s) Ready
              </span>
            ) : (
              <Button
                onClick={onOpenAddHouse}
                size="sm"
                className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] h-8 rounded-xl shadow-md"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Shed
              </Button>
            )}
          </div>

          {/* Step 3: Stock Flock Batch */}
          <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
            isFlockComplete ? 'bg-background border-emerald-500/30 text-slate-200' : 'bg-slate-950/90 border-amber-500/40 shadow-lg'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Egg className={`w-5 h-5 ${isFlockComplete ? 'text-emerald-400' : 'text-amber-400'}`} />
                {isFlockComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">3. Stock Flock Batch</h4>
                <p className="text-[11px] text-slate-400">
                  {isFlockComplete ? `${flockCount} Active Flock(s)` : 'No flock batches housed'}
                </p>
              </div>
            </div>

            {isFlockComplete ? (
              <span className="text-[10px] text-emerald-400 font-mono font-bold pt-2">
                ✓ {flockCount} Flock(s) Stocked
              </span>
            ) : (
              <Button
                onClick={onOpenAddFlock}
                disabled={!isHouseComplete}
                size="sm"
                className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] h-8 rounded-xl shadow-md disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Stock Flock
              </Button>
            )}
          </div>

          {/* Step 4: Add Feed Rations */}
          <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
            isFeedComplete ? 'bg-background border-emerald-500/30 text-slate-200' : 'bg-slate-950/90 border-amber-500/40 shadow-lg'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Wheat className={`w-5 h-5 ${isFeedComplete ? 'text-emerald-400' : 'text-amber-400'}`} />
                {isFeedComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">4. Feed Inventory & Rations</h4>
                <p className="text-[11px] text-slate-400">
                  {isFeedComplete ? `${feedBatchCount} Batch(es) in Silos` : 'No feed inventory recorded'}
                </p>
              </div>
            </div>

            {isFeedComplete ? (
              <span className="text-[10px] text-emerald-400 font-mono font-bold pt-2">
                ✓ Feed Rations Ready
              </span>
            ) : (
              <Button
                onClick={onOpenAddFeed}
                size="sm"
                className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] h-8 rounded-xl shadow-md"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Feed Rations
              </Button>
            )}
          </div>

        </div>

      </CardContent>
    </Card>
  );
}
