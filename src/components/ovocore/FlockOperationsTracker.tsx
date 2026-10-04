"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Syringe,
  Egg,
  Flame,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Activity
} from "lucide-react";

export interface ProtocolTask {
  id: string;
  dayMin: number;
  dayMax: number;
  title: string;
  category: 'Vaccine' | 'Nutrition' | 'Management' | 'Health';
  description: string;
  dosageOrMethod?: string;
}

export const getPoultryProtocols = (flockType: string): ProtocolTask[] => {
  const type = flockType.toLowerCase();

  if (type.includes('broiler')) {
    return [
      { id: 'b1', dayMin: 1, dayMax: 3, title: 'Brooder Setup, Temp (32°C) & Electrolytes', category: 'Management', description: 'Pre-heat house to 32°C floor temp. Provide 24-hr access to glucose and anti-stress multivitamins.', dosageOrMethod: '1g per 2L water for first 48 hours' },
      { id: 'b2', dayMin: 7, dayMax: 7, title: 'Newcastle + IB Vaccine (HB1 Strain)', category: 'Vaccine', description: 'Primary respiratory protection. Administer via coarse spray or non-chlorinated eye drop.', dosageOrMethod: '1 dose per bird (cold chain verified 2-8°C)' },
      { id: 'b3', dayMin: 10, dayMax: 12, title: 'Gumboro (IBD) Primary Bursal Vaccine', category: 'Vaccine', description: 'Critical bursal challenge defense. Withhold water for 2 hours prior to administration.', dosageOrMethod: 'Dissolve in skim milk powder solution (2.5g/L)' },
      { id: 'b4', dayMin: 14, dayMax: 16, title: 'Feed Transition to Grower Pellets', category: 'Nutrition', description: 'Gradually blend starter crumb and grower pellet over 48 hours to prevent digestive shock.', dosageOrMethod: '50/50 blend for 2 days, then 100% grower' },
      { id: 'b5', dayMin: 21, dayMax: 22, title: 'Gumboro (IBD) Intermediate Booster', category: 'Vaccine', description: 'Reinforce bursal immunity against high-challenge field strains.', dosageOrMethod: 'Drinking water administration early morning' },
      { id: 'b6', dayMin: 28, dayMax: 30, title: 'Coccidiosis Monitoring & Litter Management', category: 'Health', description: 'Inspect litter moisture (keep <25%). Turn caked spots to prevent ammonia burns.', dosageOrMethod: 'Supplement with Vitamin K if hemorrhagic signs appear' },
      { id: 'b7', dayMin: 35, dayMax: 35, title: 'Finisher Feed Withdrawal Transition', category: 'Nutrition', description: 'Switch to pure finisher mash/pellets strictly free of antibiotics and anticoccidials.', dosageOrMethod: '5–7 days pre-slaughter compliance' },
    ];
  }

  if (type.includes('kienyeji') || type.includes('improved')) {
    return [
      { id: 'k1', dayMin: 1, dayMax: 3, title: 'Marek\'s Disease Vaccination & Brooding', category: 'Management', description: 'Provide liquid glucose and electrolytes. Calibrate brooding rings to 33°C.', dosageOrMethod: 'Verify hatchery Marek\'s subcutaneous injection' },
      { id: 'k2', dayMin: 7, dayMax: 7, title: 'Newcastle Disease (ND HB1)', category: 'Vaccine', description: 'Ocular drop or clean drinking water vaccination.', dosageOrMethod: '1 drop per right eye' },
      { id: 'k3', dayMin: 14, dayMax: 14, title: 'Gumboro (IBD) Day 14 Dose', category: 'Vaccine', description: 'First intermediate Gumboro vaccination in non-chlorinated water.', dosageOrMethod: 'Consume within 2 hours of mixing' },
      { id: 'k4', dayMin: 28, dayMax: 28, title: 'Newcastle Lasota Booster', category: 'Vaccine', description: 'Second-stage Newcastle protection via drinking water.', dosageOrMethod: 'Withhold water 2 hrs prior; add skim milk' },
      { id: 'k5', dayMin: 42, dayMax: 45, title: 'Fowl Pox Wing-Web Inoculation', category: 'Vaccine', description: 'Wing-web needle puncture. Inspect vaccination "take" swelling 7 days post-op.', dosageOrMethod: 'Double-needle applicator through patagium' },
      { id: 'k6', dayMin: 56, dayMax: 56, title: 'Routine Anthelmintic Deworming', category: 'Health', description: 'Administer broad-spectrum dewormer (Levamisole/Piperazine) for soil-borne parasites.', dosageOrMethod: 'Repeat every 8 weeks' },
      { id: 'k7', dayMin: 98, dayMax: 105, title: 'Cockerel Sorting & Pullet Grower Transition', category: 'Management', description: 'Separate heavy roosters for meat finishing; transition pullets to developer mash.', dosageOrMethod: 'Maintain 14-hour lighting program' },
    ];
  }

  if (type.includes('breeder') || type.includes('parent')) {
    return [
      { id: 'br1', dayMin: 1, dayMax: 3, title: 'Brooder Setup & Sexing Verification', category: 'Management', description: 'Verify cockerel-to-pullet ratio (typically 10:90). Maintain 33°C floor temp.', dosageOrMethod: 'Initiate strict lighting program (23 hrs light)' },
      { id: 'br2', dayMin: 7, dayMax: 7, title: 'Newcastle + IB Primer Ocular', category: 'Vaccine', description: 'Cold-chain verified viral priming.', dosageOrMethod: 'Individual eye drop application' },
      { id: 'br3', dayMin: 42, dayMax: 45, title: 'Inactivated ND/IB/EDS Oil Emulsion', category: 'Vaccine', description: 'Subcutaneous or intramuscular injection for long-term breeder antibody titers.', dosageOrMethod: '0.5ml per bird in breast or back of neck' },
      { id: 'br4', dayMin: 84, dayMax: 84, title: 'Routine Salmonella Pullorum Screening', category: 'Health', description: 'Mandatory blood agglutination test to certify hatching eggs are pullorum-free.', dosageOrMethod: 'Random sampling via certified veterinary officer' },
      { id: 'br5', dayMin: 126, dayMax: 130, title: 'Pre-Lay Breeder Mash & Calcium Ramp', category: 'Nutrition', description: 'Transition to breeder mash formulated with 3.2% calcium and optimal Vitamin E/Selenium.', dosageOrMethod: 'Support peak hatchability and fertility' },
      { id: 'br6', dayMin: 147, dayMax: 154, title: 'Photoperiod Stimulation (16 Hours)', category: 'Management', description: 'Step up day length to trigger sexual maturity and synchronous mating activity.', dosageOrMethod: 'Gradual weekly increments to 16 hours' },
    ];
  }

  // Default: Commercial Layers
  return [
    { id: 't1', dayMin: 1, dayMax: 3, title: 'Brooder Setup, Temp (32°C) & Electrolytes', category: 'Management', description: 'Pre-heat house to 32°C. Ensure 24-hr access to glucose/electrolyte water.', dosageOrMethod: '1g per 2L water for 48 hours' },
    { id: 't2', dayMin: 7, dayMax: 7, title: 'Newcastle + IB Vaccine (HB1)', category: 'Vaccine', description: 'Administer via eye-drop or clean non-chlorinated drinking water.', dosageOrMethod: '1 dose per bird' },
    { id: 't3', dayMin: 14, dayMax: 14, title: 'Gumboro (IBD) Primary Vaccine', category: 'Vaccine', description: 'Primary bursal protection dose; verify water stabilizer dye uptake.', dosageOrMethod: 'Consume within 2 hours' },
    { id: 't4', dayMin: 28, dayMax: 28, title: 'Newcastle Lasota Booster', category: 'Vaccine', description: 'Secondary respiratory viral defense.', dosageOrMethod: 'Drinking water administration' },
    { id: 't5', dayMin: 56, dayMax: 60, title: 'Grower Mash & Frame Development', category: 'Nutrition', description: 'Focus on skeletal frame development and uniform body weight targets.', dosageOrMethod: 'Controlled feeding per breed manual' },
    { id: 't6', dayMin: 84, dayMax: 84, title: 'Routine Deworming & Multivitamins', category: 'Health', description: 'Broad-spectrum anthelmintic treatment and Vitamin AD3E complex.', dosageOrMethod: 'Administer over 3 consecutive days' },
    { id: 't7', dayMin: 112, dayMax: 119, title: 'Pre-Lay Feed & Medullary Calcium (2.5%)', category: 'Nutrition', description: 'Introduce pre-lay diet containing 2.5% calcium to prep medullary bone reserves.', dosageOrMethod: 'Critical for first eggshell strength' },
    { id: 't8', dayMin: 126, dayMax: 130, title: 'Lighting Program Activation (16 hrs)', category: 'Management', description: 'Step up lighting to 16 hours daily to stimulate peak egg production cycle.', dosageOrMethod: 'Ensure 20 lux light intensity at bird level' },
  ];
};

interface FlockOpsProps {
  placementDate: string; // ISO Date e.g. "2026-06-01"
  flockType: string;
  initialAgeDays?: number; // Biological age of the birds when they were placed
}

export const FlockOperationsTracker: React.FC<FlockOpsProps> = ({ placementDate, flockType, initialAgeDays = 0 }) => {
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate Flock Age in Days
  const flockAgeDays = useMemo(() => {
    const placed = new Date(placementDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - placed) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays) + initialAgeDays;
  }, [placementDate, initialAgeDays]);

  const flockAgeWeeks = Math.floor(flockAgeDays / 7);

  // Task categorization
  const evaluatedTasks = useMemo(() => {
    const protocols = getPoultryProtocols(flockType);
    return protocols.map(task => {
      let status: 'completed' | 'due_today' | 'upcoming' | 'overdue' = 'upcoming';

      if (completedTasks.includes(task.id)) {
        status = 'completed';
      } else if (flockAgeDays >= task.dayMin && flockAgeDays <= task.dayMax) {
        status = 'due_today';
      } else if (flockAgeDays > task.dayMax) {
        status = 'overdue';
      }

      return { ...task, status };
    });
  }, [flockAgeDays, completedTasks, flockType]);

  const toggleTask = (id: string) => {
    setCompletedTasks(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const overdueCount = evaluatedTasks.filter(t => t.status === 'overdue' && !completedTasks.includes(t.id)).length;
  const dueTodayCount = evaluatedTasks.filter(t => t.status === 'due_today' && !completedTasks.includes(t.id)).length;

  return (
    <Card className="border border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Automated Operational Protocol Engine
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              Flock Age: <strong className="text-foreground">{flockAgeDays} Days</strong> ({flockAgeWeeks} Weeks & {flockAgeDays % 7} Days)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2.5">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="font-bold text-[10px] animate-pulse">
                {overdueCount} Overdue
              </Badge>
            )}
            {dueTodayCount > 0 && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold text-[10px]">
                {dueTodayCount} Due Today
              </Badge>
            )}
            <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-xs">
              {flockType}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-xl hover:bg-muted"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-6 bg-card space-y-6">

          {/* Overdue Section */}
          {evaluatedTasks.filter(t => t.status === 'overdue' && !completedTasks.includes(t.id)).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5" /> Action Required (Overdue Protocols)
              </h4>
              <div className="space-y-2.5">
                {evaluatedTasks.filter(t => t.status === 'overdue' && !completedTasks.includes(t.id)).map(task => (
                  <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} isDone={false} />
                ))}
              </div>
            </div>
          )}

          {/* Today Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Today's Agenda (Day {flockAgeDays})
            </h4>
            <div className="space-y-2.5">
              {evaluatedTasks.filter(t => t.status === 'due_today' || (t.status === 'overdue' && completedTasks.includes(t.id))).length === 0 ? (
                <div className="p-5 border border-dashed border-border rounded-2xl text-center bg-muted/10">
                  <p className="text-xs text-muted-foreground font-semibold">No critical medical or nutritional milestones scheduled for today.</p>
                </div>
              ) : (
                evaluatedTasks.filter(t => t.status === 'due_today' || completedTasks.includes(t.id)).map(task => (
                  <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} isDone={completedTasks.includes(task.id)} />
                ))
              )}
            </div>
          </div>

          {/* Upcoming Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Upcoming Pipeline
            </h4>
            <div className="space-y-2.5">
              {evaluatedTasks.filter(t => t.status === 'upcoming').map(task => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} isDone={false} />
              ))}
            </div>
          </div>

        </CardContent>
      )}
    </Card>
  );
};

function TaskCard({ task, onToggle, isDone }: { task: any, onToggle: () => void, isDone: boolean }) {
  const isDue = task.status === 'due_today';
  const isOverdue = task.status === 'overdue';

  const categoryBadgeColor =
    task.category === 'Vaccine' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' :
      task.category === 'Nutrition' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
        task.category === 'Health' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

  return (
    <div
      onClick={onToggle}
      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${isDone
          ? 'bg-muted/30 border-border opacity-50'
          : isDue
            ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20 shadow-sm'
            : isOverdue
              ? 'bg-rose-500/5 border-rose-500/40'
              : 'bg-card border-border/80 hover:border-border'
        }`}
    >
      <button type="button" className="mt-0.5 text-primary shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Square className={`w-5 h-5 ${isDue ? 'text-amber-500' : isOverdue ? 'text-rose-500' : 'text-muted-foreground'}`} />
        )}
      </button>

      <div className="flex-1 space-y-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <span className={`text-xs sm:text-sm font-bold ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {task.title}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${categoryBadgeColor}`}>
              {task.category}
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              Day {task.dayMin} {task.dayMin !== task.dayMax ? `- ${task.dayMax}` : ''}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {task.description}
        </p>
        {task.dosageOrMethod && (
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Syringe className="w-3 h-3 shrink-0" />
            <span>Method / Dosage: {task.dosageOrMethod}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default FlockOperationsTracker;