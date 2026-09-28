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
  ChevronUp
} from "lucide-react";

export interface ProtocolTask {
  id: string;
  dayMin: number;
  dayMax: number;
  title: string;
  category: 'Vaccine' | 'Nutrition' | 'Management' | 'Health';
  description: string;
}

export const POULTRY_PROTOCOLS: ProtocolTask[] = [
  { id: 't1', dayMin: 1, dayMax: 3, title: 'Brooder Setup & Temp Calibration', category: 'Management', description: 'Pre-heat house to 32°C. Ensure 24-hr access to glucose/electrolyte water.' },
  { id: 't2', dayMin: 7, dayMax: 7, title: 'Newcastle + IB Vaccine (HB1)', category: 'Vaccine', description: 'Administer via eye-drop or clean non-chlorinated drinking water.' },
  { id: 't3', dayMin: 12, dayMax: 14, title: 'Gumboro (IBD) Primary Vaccine', category: 'Vaccine', description: 'Critical first Gumboro dose. Withhold water for 2 hours prior.' },
  { id: 't4', dayMin: 28, dayMax: 30, title: 'Feed Transition to Grower Mash', category: 'Nutrition', description: 'Gradually mix starter and grower over 4 days to avoid digestive shock.' },
  { id: 't5', dayMin: 35, dayMax: 35, title: 'Fowl Typhoid / Gumboro Booster', category: 'Vaccine', description: 'Administer booster vaccination per regional vet guidelines.' },
  { id: 't6', dayMin: 84, dayMax: 84, title: 'Routine Deworming & Vitamin Complex', category: 'Health', description: 'Administer broad-spectrum anthelmintic and multi-vitamins.' },
  { id: 't7', dayMin: 112, dayMax: 119, title: 'Pre-Lay Feed & Calcium Transition', category: 'Nutrition', description: 'Introduce pre-lay feed containing 2.5% calcium to prep medullary bone.' },
  { id: 't8', dayMin: 126, dayMax: 130, title: 'Lighting Program Activation (16 hrs)', category: 'Management', description: 'Set automatic timers to provide 16 hours of steady light daily.' },
];

interface FlockOpsProps {
  placementDate: string; // ISO Date e.g. "2026-06-01"
  flockType: 'Layers' | 'Broilers';
}

export const FlockOperationsTracker: React.FC<FlockOpsProps> = ({ placementDate, flockType }) => {
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate Flock Age in Days
  const flockAgeDays = useMemo(() => {
    const placed = new Date(placementDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - placed) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [placementDate]);

  const flockAgeWeeks = Math.floor(flockAgeDays / 7);

  // Task categorization
  const evaluatedTasks = useMemo(() => {
    return POULTRY_PROTOCOLS.map(task => {
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
  }, [flockAgeDays, completedTasks]);

  const toggleTask = (id: string) => {
    setCompletedTasks(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <Card className="border border-border/80 shadow-sm rounded-3xl bg-card">
      <CardHeader className="border-b bg-muted/30 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Automated Operational Schedule
            </CardTitle>
            <CardDescription className="text-xs">
              Current Age: <strong className="text-foreground">{flockAgeDays} Days</strong> ({flockAgeWeeks} Weeks & {flockAgeDays % 7} Days)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs">
              {flockType} Management Engine
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-6 space-y-4 border-t">
        <div className="space-y-3">
          {evaluatedTasks.map((task) => {
            const isDone = task.status === 'completed';
            const isDue = task.status === 'due_today';
            const isOverdue = task.status === 'overdue';

            return (
              <div 
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isDone 
                    ? 'bg-muted/20 border-border/50 opacity-60 line-through' 
                    : isDue 
                    ? 'bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20' 
                    : isOverdue
                    ? 'bg-rose-500/5 border-rose-500/30'
                    : 'bg-background border-border/80'
                }`}
              >
                <button type="button" className="mt-0.5 text-primary shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Target: Day {task.dayMin} {task.dayMin !== task.dayMax ? `- ${task.dayMax}` : ''}
                      </span>
                      {isDue && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0">
                          Due Today
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {task.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      )}
    </Card>
  );
};

export default FlockOperationsTracker;
