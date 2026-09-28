'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle2, ChevronRight, Syringe, Wheat, Flame, HeartPulse, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POULTRY_PROTOCOLS, ProtocolTask } from './FlockOperationsTracker';
import { Progress } from '@/components/ui/progress';

interface OperationalAlertWidgetProps {
  placementDate: string;
}

const CategoryIcon = ({ category, className }: { category: ProtocolTask['category'], className?: string }) => {
  switch (category) {
    case 'Vaccine': return <Syringe className={className} />;
    case 'Nutrition': return <Wheat className={className} />;
    case 'Management': return <Flame className={className} />;
    case 'Health': return <HeartPulse className={className} />;
    default: return <AlertTriangle className={className} />;
  }
};

export const OperationalAlertWidget: React.FC<OperationalAlertWidgetProps> = ({ placementDate }) => {
  const [activeTask, setActiveTask] = useState<ProtocolTask | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [flockAgeDays, setFlockAgeDays] = useState(0);

  // Time tracking for gamified countdown
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Initial Calculation
  useEffect(() => {
    if (!placementDate) return;
    
    const placed = new Date(placementDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - placed) / (1000 * 60 * 60 * 24));
    
    // Prevent negative days if placed in future
    const currentAge = Math.max(0, diffDays);
    setFlockAgeDays(currentAge);

    // Find first task that is currently due
    const currentTask = POULTRY_PROTOCOLS.find(
      t => currentAge >= t.dayMin && currentAge <= t.dayMax
    );

    // If we have a new task, un-dismiss
    if (currentTask && (!activeTask || currentTask.id !== activeTask.id)) {
      setActiveTask(currentTask);
      setIsDismissed(false);
    } else if (!currentTask) {
      setActiveTask(null);
    }
  }, [placementDate, activeTask]);

  // Real-time Countdown Timer
  useEffect(() => {
    if (!activeTask || !placementDate) return;

    const interval = setInterval(() => {
      const placed = new Date(placementDate);
      
      // The task ends at the end of `dayMax` (i.e. dayMax + 1 at 00:00:00)
      const endDate = new Date(placed);
      endDate.setDate(endDate.getDate() + activeTask.dayMax + 1);
      endDate.setHours(0, 0, 0, 0);

      const startDate = new Date(placed);
      startDate.setDate(startDate.getDate() + activeTask.dayMin);
      startDate.setHours(0, 0, 0, 0);

      const now = new Date();
      const totalDuration = endDate.getTime() - startDate.getTime();
      const timeRemaining = endDate.getTime() - now.getTime();

      if (timeRemaining <= 0) {
        setTimeLeftStr("00:00:00");
        setProgressPercent(100);
      } else {
        const h = Math.floor((timeRemaining / (1000 * 60 * 60)));
        const m = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeRemaining % (1000 * 60)) / 1000);
        
        setTimeLeftStr(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
        
        const elapsed = now.getTime() - startDate.getTime();
        setProgressPercent(Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTask, placementDate]);

  if (!activeTask || isDismissed) return null;

  const isCritical = activeTask.category === 'Vaccine' || activeTask.category === 'Health';

  return (
    <div className="fixed top-20 right-4 md:right-8 z-[100] w-[350px]">
      <AnimatePresence>
        {!isDismissed && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ${
              isCritical 
                ? 'bg-rose-950/80 border-rose-500/50 shadow-rose-500/20' 
                : 'bg-emerald-950/80 border-emerald-500/50 shadow-emerald-500/20'
            }`}
          >
            {/* Animated Pulse Background */}
            <motion.div 
              className={`absolute -inset-1 opacity-20 blur-xl ${isCritical ? 'bg-rose-500' : 'bg-emerald-500'}`}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative p-5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsDismissed(true)}
                className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-black/20 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </Button>

              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  <CategoryIcon category={activeTask.category} className="w-6 h-6" />
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                      Action Required
                    </span>
                    <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
                      Day {activeTask.dayMin}{activeTask.dayMax !== activeTask.dayMin ? `-${activeTask.dayMax}` : ''}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground leading-tight mb-1">{activeTask.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {activeTask.description}
                  </p>
                </div>
              </div>

              {/* Gamified Countdown Tracker */}
              <div className="mt-4 bg-black/40 rounded-xl p-3 border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1" /> Time Remaining
                  </span>
                  <span className={`text-xs font-bold font-mono tracking-tight ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {timeLeftStr || '...'}
                  </span>
                </div>
                <Progress value={progressPercent} className={`h-1.5 ${isCritical ? 'bg-rose-950' : 'bg-emerald-950'}`} indicatorClassName={isCritical ? 'bg-rose-500' : 'bg-emerald-500'} />
              </div>

              <div className="mt-4 flex gap-2">
                <Button 
                  onClick={() => setIsDismissed(true)} 
                  className={`flex-1 h-9 text-xs font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 ${
                    isCritical 
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/50' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/50'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Complete
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
