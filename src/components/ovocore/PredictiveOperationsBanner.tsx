"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SunMedium,
  Moon,
  Droplets,
  Wind,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Scale,
  Syringe,
  Eye,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { Flock, House } from '@/services/ovocore/firebaseSchema';
import type { HouseSanitationState } from '@/types/ovocoreAutonomy';

export interface PredictiveDirective {
  id: string;
  category: 'LIGHT' | 'WATER' | 'BIOSECURITY' | 'FEED' | 'WEIGH' | 'VACCINE' | 'HEALTH';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  expectedValue: string;
  actionPrompt: string;
  urgency: 'normal' | 'urgent';
  sopModalKey?: string;
}

interface PredictiveBannerProps {
  farmType: 'layers' | 'broilers' | 'improved_kienyeji' | 'dual_purpose';
  activeHouse?: House & { id: string; sanitationState?: HouseSanitationState };
  activeFlock?: Flock & { id: string };
  supervisorPhone?: string;
  onOpenSopModal?: (actionKey: string) => void;
}

export function PredictiveOperationsBanner({
  farmType,
  activeHouse,
  activeFlock,
  supervisorPhone,
  onOpenSopModal
}: PredictiveBannerProps) {
  const [currentTick, setCurrentTick] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Compute Flock Age in Days
  const flockAgeDays = useMemo(() => {
    if (!activeFlock?.dateHoused) return 0;
    const placed = activeFlock.dateHoused.toDate
      ? activeFlock.dateHoused.toDate()
      : new Date(activeFlock.dateHoused as any);
    return Math.max(0, Math.floor((Date.now() - placed.getTime()) / (1000 * 60 * 60 * 24)));
  }, [activeFlock?.dateHoused]);

  // Compute Active Lifecycle Directives (Simulated Environmental Sensors & SOP Engine)
  const expectedDirectives = useMemo((): PredictiveDirective[] => {
    const list: PredictiveDirective[] = [];

    // 1. Biosecurity / Decontamination Downtime Lock
    if (activeHouse?.sanitationState && !activeHouse.sanitationState.clearedForPlacement) {
      const state = activeHouse.sanitationState;
      if (state.status === 'downtime_countdown' && state.downtimeEndAt) {
        const downtimeDate = state.downtimeEndAt.toDate ? state.downtimeEndAt.toDate() : new Date(state.downtimeEndAt as any);
        const daysLeft = Math.ceil((downtimeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        list.push({
          id: 'sanitary-downtime',
          category: 'BIOSECURITY',
          icon: ShieldAlert,
          title: `Sanitary Downtime Quarantine Active (${Math.max(0, daysLeft)} Days Left)`,
          expectedValue: 'Strict Shed Lockout — Zero Bird Access',
          actionPrompt: 'House under pathogen clearance countdown. Complete terminal swab before restocking.',
          urgency: 'urgent',
          sopModalKey: 'sanitary-downtime'
        });
      }
    }

    if (!activeFlock) {
      return list;
    }

    // 2. Day 1–2 Early Brooding Crop-Fill Check (First 48 Hours)
    if (flockAgeDays <= 2) {
      list.push({
        id: 'crop-fill-audit',
        category: 'HEALTH',
        icon: Eye,
        title: 'Chick Brooding Audit: Hour 8 & 24 Crop-Fill',
        expectedValue: 'Target: >85% at 8h, >95% at 24h (Soft & Pliable)',
        actionPrompt: 'Sample 100 chicks to ensure early feed discovery and check floor temp is 32°C–34°C.',
        urgency: 'urgent',
        sopModalKey: 'chick-check'
      });
    }

    // 3. Automated Photoperiod & Lux Control Logic
    if (farmType === 'broilers') {
      if (flockAgeDays <= 7) {
        list.push({
          id: 'broiler-light-starter',
          category: 'LIGHT',
          icon: SunMedium,
          title: 'Brooding Photoperiod: 23 hrs Light / 1 hr Dark',
          expectedValue: 'Target Intensity: 30 - 40 Lux',
          actionPrompt: 'Maintain high lux over feed pans to stimulate early water/feed discovery.',
          urgency: 'normal',
          sopModalKey: 'lighting'
        });
      } else {
        list.push({
          id: 'broiler-dark-window',
          category: 'LIGHT',
          icon: Moon,
          title: 'Growth Dark Program: 18 hrs Light / 6 hrs Darkness',
          expectedValue: 'Target Intensity: 5 - 10 Lux (Dark window prevents ascites)',
          actionPrompt: 'Dim shed lights to prevent metabolic stress and Sudden Death Syndrome (SDS).',
          urgency: 'normal',
          sopModalKey: 'lighting'
        });
      }
    } else {
      // Layers Lighting Curve (+15-30 min/wk from week 18)
      const ageWeeks = Math.floor(flockAgeDays / 7) + (activeFlock.initialAgeWeeks || 0);
      if (ageWeeks >= 18 && ageWeeks <= 26) {
        const targetHours = Math.min(16, 12 + (ageWeeks - 18) * 0.5);
        list.push({
          id: 'layer-stim-light',
          category: 'LIGHT',
          icon: SunMedium,
          title: `Layer Stimulation Lighting: ${targetHours} Hours/Day`,
          expectedValue: 'Target Intensity: 15 - 20 Lux',
          actionPrompt: 'Step up photoperiod weekly to trigger reproductive pituitary hormone release.',
          urgency: 'normal',
          sopModalKey: 'lighting'
        });
      } else if (ageWeeks > 26) {
        list.push({
          id: 'layer-peak-light',
          category: 'LIGHT',
          icon: SunMedium,
          title: 'Peak Lay Photoperiod: Constant 16 Hours Uniform Light',
          expectedValue: 'Target: 16 hrs (Never reduce day-length during lay)',
          actionPrompt: 'Strict timer adherence required to maintain ovarian follicle stimulation.',
          urgency: 'normal',
          sopModalKey: 'lighting'
        });
      }
    }

    // 4. Vaccine Scheduling Prompts (Day 7, 14, 21)
    if ([7, 14, 21].includes(flockAgeDays)) {
      const vName = flockAgeDays === 7 ? 'Gumboro (IBD 1)' : flockAgeDays === 14 ? 'Gumboro (IBD 2)' : 'Newcastle (ND-LaSota)';
      list.push({
        id: `vaccine-day-${flockAgeDays}`,
        category: 'VACCINE',
        icon: Syringe,
        title: `Mandatory Vaccine Schedule: ${vName}`,
        expectedValue: 'Verify Cold-Chain & Skim Milk Line Stabilizer',
        actionPrompt: 'Withdraw water for 1.5 hrs prior to administration. Check tongue blue-dye uptake.',
        urgency: 'urgent',
        sopModalKey: 'vaccine'
      });
    }

    // 5. Weekly Catch-Pen Sampling Audit (Days 7, 14, 21, 28, 35)
    if (flockAgeDays > 0 && flockAgeDays % 7 === 0) {
      list.push({
        id: 'weekly-weigh-in',
        category: 'WEIGH',
        icon: Scale,
        title: `Weekly Catch-Pen Weighing (Day ${flockAgeDays})`,
        expectedValue: 'Target CV: < 10% Uniformity',
        actionPrompt: 'Weigh 50-100 birds from 3 distinct shed zones to evaluate growth uniformity.',
        urgency: 'normal',
        sopModalKey: 'weighing'
      });
    }

    // 6. Water Sanitation & Flushing Schedule
    list.push({
      id: 'drinker-flush',
      category: 'WATER',
      icon: Droplets,
      title: 'Drinker Line Purge Directive',
      expectedValue: 'Max Water Temp: < 24°C | Chlorination: 3 - 5 ppm',
      actionPrompt: 'Daily automated line flush recommended between 12:00 PM - 2:00 PM.',
      urgency: 'normal',
      sopModalKey: 'drinker-flush'
    });

    // 7. Feed Transition Directives
    if (farmType === 'broilers') {
      if (flockAgeDays >= 10 && flockAgeDays <= 12) {
        list.push({
          id: 'ration-shift-grower',
          category: 'FEED',
          icon: Wind,
          title: 'Phase Feed Transition: Starter Crumbs → Grower Pellets',
          expectedValue: 'Target Cumulative Intake: ~1.0 kg/bird',
          actionPrompt: 'Blend 50/50 starter and grower over 48 hours to preserve digestive flora.',
          urgency: 'urgent',
          sopModalKey: 'feed'
        });
      } else if (flockAgeDays >= 35) {
        list.push({
          id: 'ration-withdrawal',
          category: 'FEED',
          icon: ShieldAlert,
          title: 'Mandatory Food Safety: Shift to Finisher Withdrawal',
          expectedValue: 'Zero Antibiotics / Zero Coccidiostats',
          actionPrompt: 'Enforce pure cereal withdrawal 5 days prior to abattoir collection.',
          urgency: 'urgent',
          sopModalKey: 'feed'
        });
      }
    }

    // 8. Improved Kienyeji Directives (Deworming, Fowl Pox, Cockerel Off-take)
    if (farmType === 'improved_kienyeji' || farmType === 'dual_purpose') {
      if (flockAgeDays > 42 && flockAgeDays % 60 <= 3) {
        list.push({
          id: 'kienyeji-deworming',
          category: 'HEALTH',
          icon: Syringe,
          title: 'Routine Deworming Cycle (Levamisole / Piperazine)',
          expectedValue: 'Mandatory for Pasture-Run Flocks',
          actionPrompt: 'Dose drinking water to eliminate roundworms and cecal worms contracted from soil foraging.',
          urgency: 'urgent',
          sopModalKey: 'deworming'
        });
      }

      if (flockAgeDays >= 42 && flockAgeDays <= 56) {
        list.push({
          id: 'kienyeji-fowl-pox',
          category: 'VACCINE',
          icon: ShieldAlert,
          title: 'Mandatory Vaccine: Fowl Pox (Wing-Web Stabs)',
          expectedValue: 'Inspect "Take" Scab at Day 7 Post-Vaccination',
          actionPrompt: 'Inoculate flock against mosquito-borne cutaneous/diphtheritic fowl pox.',
          urgency: 'urgent',
          sopModalKey: 'vaccine'
        });
      }

      if (flockAgeDays >= 98 && flockAgeDays <= 112) {
        list.push({
          id: 'cockerel-separation',
          category: 'FEED',
          icon: Scale,
          title: 'Cockerel Separation & Off-take Window',
          expectedValue: 'Target Live Weight: 1.5 - 1.8 kg',
          actionPrompt: 'Separate heavy males into finishing pens; transition females to layer preparation mash.',
          urgency: 'normal',
          sopModalKey: 'cockerel-offtake'
        });
      }
    }

    return list;
  }, [farmType, flockAgeDays, activeFlock, activeHouse]);

  // Handle Tick Rollover
  useEffect(() => {
    if (expectedDirectives.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentTick((prev) => (prev + 1) % expectedDirectives.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [expectedDirectives.length, isPaused]);

  const handleNext = useCallback(() => {
    setCurrentTick((prev) => (prev + 1) % expectedDirectives.length);
  }, [expectedDirectives.length]);

  const handlePrev = useCallback(() => {
    setCurrentTick((prev) => (prev - 1 + expectedDirectives.length) % expectedDirectives.length);
  }, [expectedDirectives.length]);

  if (expectedDirectives.length === 0) return null;

  const activeItem = expectedDirectives[currentTick] || expectedDirectives[0];
  const Icon = activeItem.icon;

  // Build Quick WhatsApp Handoff Message
  const handleWhatsAppDispatch = () => {
    const text = `🚨 *OvoCore SOP Directive* 🚨\n` +
      `House: *${activeHouse?.houseName || 'Shed 1'}*\n` +
      `Category: *${activeItem.category}*\n` +
      `Directive: *${activeItem.title}*\n` +
      `Expected Spec: ${activeItem.expectedValue}\n` +
      `Action Required: ${activeItem.actionPrompt}\n\n` +
      `Please verify and confirm completion in the farm portal.`;

    const phone = (supervisorPhone || '').replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`w-full border-y transition-colors duration-500 px-4 py-2 text-xs select-none ${activeItem.urgency === 'urgent'
          ? 'bg-rose-950/50 border-rose-800 text-rose-200'
          : 'bg-slate-900 border-border/80 text-slate-200'
        }`}
    >
      <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">

        {/* Left Side: Category Badge & Message */}
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <Badge
            variant="outline"
            className={`font-mono text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-md shrink-0 ${activeItem.urgency === 'urgent'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
          >
            {activeItem.category}
          </Badge>

          <div className="flex items-center gap-2 truncate">
            <Icon className="w-4 h-4 text-primary shrink-0" />
            <span className="font-bold text-foreground truncate">{activeItem.title}:</span>
            <span className="text-muted-foreground hidden md:inline truncate">{activeItem.actionPrompt}</span>
            <span className="font-mono text-[11px] font-semibold text-primary/90 hidden lg:inline">({activeItem.expectedValue})</span>
          </div>
        </div>

        {/* Right Side: Interactive Steppers & Actions */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">

          {/* Stepper Buttons */}
          <div className="flex items-center bg-slate-950/60 border border-border/60 rounded-lg p-0.5 mr-1">
            <button
              onClick={handlePrev}
              title="Previous Directive"
              aria-label="Previous Directive"
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground font-mono px-1.5 min-w-[28px] text-center">
              {currentTick + 1}/{expectedDirectives.length}
            </span>
            <button
              onClick={handleNext}
              title="Next Directive"
              aria-label="Next Directive"
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick WhatsApp Worker Dispatch */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleWhatsAppDispatch}
            title="Dispatch this directive via WhatsApp to on-duty staff"
            className="h-7 text-[11px] font-bold rounded-lg px-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            <Share2 className="w-3 h-3 mr-1" /> WhatsApp
          </Button>

          {/* SOP Verification Trigger */}
          {onOpenSopModal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenSopModal(activeItem.sopModalKey || activeItem.id)}
              className="h-7 text-[11px] font-bold rounded-lg px-2 text-primary hover:bg-primary/10"
            >
              Verify SOP <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}