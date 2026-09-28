// components/OvoCoreAccessGate.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ensureUserDocument } from '@/services/userService';
import { OvoCoreUpsell } from '@/components/ovocore/OvoCoreUpsell';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export interface OvoCoreAccessGateProps {
  children: React.ReactNode;
}

export function OvoCoreAccessGate({ children }: OvoCoreAccessGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planState, setPlanState] = useState<{
    status: 'trial' | 'upcoming_renewal' | 'grace_period' | 'hard_paywall' | 'pro_annual';
    daysRemaining: number;
    daysSinceOnboarding: number;
  }>({
    status: 'trial',
    daysRemaining: 180,
    daysSinceOnboarding: 0
  });

  const [isGraceModalOpen, setIsGraceModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const profile = await ensureUserDocument(u);
          const plan = profile.plan;

          if (plan === 'pro_annual') {
            setPlanState({ status: 'pro_annual', daysRemaining: 365, daysSinceOnboarding: 0 });
            setIsLoading(false);
            return;
          }

          const createdAt = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(u.metadata.creationTime || Date.now());
          const diffMs = Date.now() - createdAt.getTime();
          const daysSinceOnboarding = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          const daysRemaining = Math.max(0, 180 - daysSinceOnboarding);

          if (daysSinceOnboarding > 185) {
            setPlanState({ status: 'hard_paywall', daysRemaining: 0, daysSinceOnboarding });
          } else if (daysSinceOnboarding >= 180 && daysSinceOnboarding <= 185) {
            setPlanState({ status: 'grace_period', daysRemaining: Math.max(0, 185 - daysSinceOnboarding), daysSinceOnboarding });
            setIsGraceModalOpen(true);
          } else if (daysSinceOnboarding >= 165 && daysSinceOnboarding < 180) {
            setPlanState({ status: 'upcoming_renewal', daysRemaining, daysSinceOnboarding });
          } else {
            setPlanState({ status: 'trial', daysRemaining, daysSinceOnboarding });
          }
        } catch (e) {
          console.warn("Access gate user check error:", e);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <PeckingChickenLoader />
        <p className="mt-4 text-xs font-mono text-slate-400 animate-pulse">
          Verifying OvoCore Workspace Subscription & Access Gate...
        </p>
      </div>
    );
  }

  if (planState.status === 'hard_paywall') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-xl w-full">
          <OvoCoreUpsell />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Upcoming Renewal Top Alert Banner */}
      {planState.status === 'upcoming_renewal' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs font-mono text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              <strong>Trial Renewal Notice:</strong> Your 6-month free trial expires in {planState.daysRemaining} days.
            </span>
          </div>
          <Link href="/ovocore?action=upgrade" className="font-bold underline hover:text-white">
            Upgrade to Pro Annual &rarr;
          </Link>
        </div>
      )}

      {/* Grace Period Page-Load Modal Prompt */}
      {planState.status === 'grace_period' && (
        <Dialog open={isGraceModalOpen} onOpenChange={setIsGraceModalOpen}>
          <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 bg-slate-900 border-slate-800 text-white shadow-2xl">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <DialogTitle className="text-base font-bold text-white">
                  6-Month Free Trial Expired — Grace Period Active
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-400">
                Your 6-month free trial ended. You have {planState.daysRemaining} days remaining in your grace period before database write lock.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Plan Status:</span>
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">Grace Period</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lock Schedule:</span>
                <span className="text-rose-400 font-bold">Hard Paywall in {planState.daysRemaining} days</span>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsGraceModalOpen(false)}
                className="border-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Continue Viewing Telemetry
              </Button>
              <Link href="/ovocore?action=upgrade" className="w-full sm:w-auto">
                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs">
                  <Sparkles className="w-4 h-4 mr-1.5" /> Upgrade Pro Annual (KSh 12,000/yr)
                </Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {children}
    </div>
  );
}
