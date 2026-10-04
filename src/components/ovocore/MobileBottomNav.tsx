"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Package, 
  LineChart, 
  Settings, 
  Plus, 
  Egg,
  Wheat,
  Syringe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  farmId: string;
}

export function MobileBottomNav({ farmId }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: 'Home', href: `/farm/${farmId}` },
    { icon: Package, label: 'Inventory', href: `/farm/${farmId}/inventory` },
    // Placeholder middle button for the FAB
    { isFabSpacer: true },
    { icon: LineChart, label: 'Finance', href: `/farm/${farmId}/finance` },
    { icon: Settings, label: 'Settings', href: `/profile` },
  ];

  if (!farmId) return null;

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] px-2 pb-safe">
        <div className="flex items-center justify-between h-16 max-w-md mx-auto">
          {navItems.map((item, index) => {
            if (item.isFabSpacer) {
              return <div key="fab-spacer" className="w-16" />;
            }
            
            const Icon = item.icon!;
            const isActive = pathname === item.href || (item.href !== `/farm/${farmId}` && pathname.startsWith(item.href!));

            return (
              <Link
                key={index}
                href={item.href!}
                className="flex flex-col items-center justify-center w-full h-full space-y-1"
              >
                <div className={cn(
                  "p-1.5 rounded-full transition-all",
                  isActive ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:text-foreground"
                )}>
                  <Icon className={cn("w-5 h-5", isActive && "fill-current/20")} />
                </div>
                <span className={cn(
                  "text-[9px] font-semibold tracking-wider uppercase",
                  isActive ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Add FAB (Floating Action Button) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pb-safe">
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              size="icon"
              className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xl shadow-amber-500/30 ring-4 ring-white dark:ring-slate-950 transition-transform active:scale-95"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" sideOffset={16} className="w-48 p-2 rounded-3xl shadow-2xl border-border bg-white dark:bg-slate-900" align="center">
            <div className="flex flex-col gap-1">
              <Button variant="ghost" className="justify-start gap-3 h-12 rounded-2xl">
                <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500">
                  <Egg className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-foreground">Daily Log</span>
                  <span className="block text-[10px] text-muted-foreground">Eggs, Mortality, Feed</span>
                </div>
              </Button>
              <Button variant="ghost" className="justify-start gap-3 h-12 rounded-2xl">
                <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">
                  <Wheat className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-foreground">Receive Feed</span>
                  <span className="block text-[10px] text-muted-foreground">Log new feed batch</span>
                </div>
              </Button>
              <Button variant="ghost" className="justify-start gap-3 h-12 rounded-2xl">
                <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500">
                  <Syringe className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-foreground">Log Treatment</span>
                  <span className="block text-[10px] text-muted-foreground">Vaccines & Meds</span>
                </div>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
