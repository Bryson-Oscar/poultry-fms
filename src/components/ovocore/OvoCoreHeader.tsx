"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Egg, 
  Building2, 
  Wheat, 
  Coins, 
  ShieldCheck, 
  ChevronDown, 
  Share2, 
  LogOut, 
  WifiOff, 
  Menu, 
  X,
  Bell
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export interface OvoCoreAlert {
  id: string;
  title: string;
  description: string;
  href: string;
}

export interface OvoCoreHeaderProps {
  farmId?: string;
  farmName?: string;
  ownerPhone?: string;
  isPendingSync?: boolean;
  activeFlockCount?: number;
  alerts?: OvoCoreAlert[];
  onTriggerAdvisor?: () => void;
}

export function OvoCoreHeader({
  farmId,
  farmName = "OvoCore Farm",
  ownerPhone,
  isPendingSync = false,
  activeFlockCount = 0,
  alerts = [],
  onTriggerAdvisor
}: OvoCoreHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = farmId ? [
    { label: "Overview", href: `/farm/${farmId}`, icon: Building2 },
    { label: "Silos & Feed", href: `/farm/${farmId}/inventory`, icon: Wheat },
    { label: "Finance & Sales", href: `/farm/${farmId}/finance`, icon: Coins },
  ] : [
    { label: "All Farms", href: `/`, icon: Building2 },
  ];

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Sign out error", e);
    }
    router.push('/auth?redirect=/');
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Farm Context */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-sm shadow-amber-500/20">
              <Egg className="w-5 h-5 text-slate-950" />
            </div>
            <span className="font-black text-lg tracking-tight hidden sm:inline text-amber-400">OvoCore</span>
          </Link>

          {farmId && (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              <Badge variant="outline" className="text-white border-slate-700 bg-slate-900 text-xs font-semibold py-1">
                {farmName}
              </Badge>
              {isPendingSync && (
                <span title="Offline queued writes" className="flex items-center text-amber-400 text-xs gap-1 font-mono">
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  active 
                    ? "bg-amber-500 text-slate-950 shadow-sm" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Global Context Actions: WhatsApp Advisor & Auth */}
        <div className="flex items-center gap-2">
          {Boolean(onTriggerAdvisor) ? (
            <Button
              onClick={onTriggerAdvisor}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-9 shadow-sm shadow-emerald-600/20"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Send Advisor</span> WhatsApp
            </Button>
          ) : null}

          {alerts.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Button size="icon" variant="ghost" className="text-rose-400 hover:bg-rose-500/10 rounded-xl h-9 w-9">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold text-white rounded-full bg-rose-500 ring-2 ring-slate-950">
                      {alerts.length}
                    </span>
                  </Button>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-card border-border p-0 rounded-2xl shadow-2xl mt-2 overflow-hidden" align="end">
                <div className="p-3 border-b border-border/50 bg-muted/20">
                  <h3 className="font-bold text-sm">Notifications</h3>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-2 rounded-xl hover:bg-muted/40 transition-colors flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-rose-500/10 p-1.5 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-bold leading-tight">{alert.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{alert.description}</p>
                        <Link href={alert.href} className="text-[10px] text-amber-500 font-bold hover:underline inline-block mt-1">
                          Take Action →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button
            onClick={handleLogout}
            size="icon"
            variant="ghost"
            title="Sign out of OvoCore"
            className="text-slate-400 hover:text-white rounded-xl h-9 w-9"
          >
            <LogOut className="w-4 h-4" />
          </Button>

          <Button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            size="icon"
            variant="ghost"
            className="md:hidden text-slate-400"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900"
            >
              <item.icon className="w-4 h-4 text-amber-400" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
