"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Lock,
  ArrowLeft,
  ShieldCheck,
  Zap,
  LineChart,
  Cpu,
  Building2,
  Sparkles,
  HelpCircle,
  Loader2,
  XCircle,
  Copy,
  CheckCheck
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';

interface OvoCoreUpsellProps {
  farmId?: string;
  onApplyReferral?: (code: string) => Promise<boolean>;
}

export function OvoCoreUpsell({ farmId, onApplyReferral }: OvoCoreUpsellProps) {
  const [referralCode, setReferralCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [referralStatus, setReferralStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [copiedMpesa, setCopiedMpesa] = useState(false);
  const { toast } = useToast();

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralCode.trim()) return;

    setIsApplying(true);
    setReferralStatus('idle');

    try {
      if (onApplyReferral) {
        const success = await onApplyReferral(referralCode);
        setReferralStatus(success ? 'success' : 'error');
      } else {
        if (!auth.currentUser) throw new Error("Must be logged in");
        
        const res = await fetch('/api/invitations/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: referralCode,
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
          }),
        });
        
        const data = await res.json();
        if (data.success) {
          await auth.currentUser.getIdToken(true); // force refresh claims
          window.location.href = `/projects/21-ovocore/farm/${data.farmId}`;
        } else {
          throw new Error(data.error);
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Invalid code', variant: 'destructive' });
      setReferralStatus('error');
    } finally {
      setIsApplying(false);
    }
  };

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const payload = auth.currentUser 
        ? {
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            billingPeriod,
            farmName: 'My Commercial Farm',
          }
        : {
            userId: 'GUEST',
            userEmail: null,
            billingPeriod,
            farmName: 'My Commercial Farm',
          };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error);
    } catch (err) {
      toast({ title: 'Checkout Failed', description: 'Could not redirect to payment.', variant: 'destructive' });
    } finally {
      setIsSubscribing(false);
    }
  };

  const copyMpesaNumber = () => {
    navigator.clipboard.writeText("0713395864");
    setCopiedMpesa(true);
    toast({ title: 'Number Copied', description: 'M-PESA number copied to clipboard.' });
    setTimeout(() => setCopiedMpesa(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-12 lg:py-20 flex flex-col items-center justify-center min-h-[80vh] max-w-6xl">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mb-12 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="h-3.5 w-3.5" /> Enterprise Farm Operations
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          Unlock Full Production Intelligence
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          {farmId ? (
            <>
              Access to farm workspace <strong className="text-foreground">{farmId}</strong> requires an active enterprise license or team invitation.
            </>
          ) : (
            'Upgrade your poultry infrastructure with offline diagnostics, real-time FCR tracking, and autonomous batch planning.'
          )}
        </p>

        {/* Billing Switcher */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <div className="bg-muted p-1 rounded-xl inline-flex items-center text-xs font-medium">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${billingPeriod === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${billingPeriod === 'annual'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Annual Billing
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Pitch Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
        {/* Primary Enterprise Tier Card (7 Cols) */}
        <Card className="lg:col-span-7 border-primary/30 shadow-xl relative overflow-hidden bg-card/80 backdrop-blur-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/40" />

          <CardHeader className="pb-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  OvoCore Production Tier
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  Full multi-house operational ERP with offline edge synchronization.
                </CardDescription>
              </div>
              <Badge className="bg-primary text-primary-foreground font-semibold">
                Commercial
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Core Capability Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Offline-First Engine:</strong> Complete logging & cache persistence during blackouts.
                </span>
              </div>

              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Breed Benchmarks:</strong> Lohmann, ISA, and Hy-Line production curve tracking.
                </span>
              </div>

              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Feed Silo Balances:</strong> Atomic batch deduction and automated reorder triggers.
                </span>
              </div>

              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Real-Time Hen-Day %:</strong> Instant anomaly alerts on mortality and intake drops.
                </span>
              </div>

              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Financial Engine:</strong> Unit cost per tray and feed-to-egg conversion ratios.
                </span>
              </div>

              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Multi-House Management:</strong> Unlimited physical sheds and flock lifecycles.
                </span>
              </div>
            </div>

            {/* Pricing Details */}
            <div className="pt-6 border-t flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {billingPeriod === 'annual' ? 'KES 5,499' : 'KES 499'}
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">{billingPeriod === 'annual' ? '/ year' : '/ month'}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {billingPeriod === 'annual'
                    ? 'Billed annually.'
                    : 'Billed monthly. Cancel anytime with one click.'}
                </p>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                14-Day Full Access Guarantee
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 flex flex-col gap-3">
            <Button size="lg" className="w-full font-semibold h-12 text-sm shadow-md" onClick={handleSubscribe} disabled={isSubscribing}>
              {isSubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Subscribe & Initialize Workspace
            </Button>
            
            <div className="w-full bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase">Fallback</Badge>
                  Pay via M-PESA Pochi La Biashara
                </div>
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-black/20 rounded-lg p-2 border border-emerald-500/10">
                <span className="font-mono font-bold text-sm text-foreground">0713395864</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                  onClick={copyMpesaNumber}
                  title="Copy to clipboard"
                >
                  {copiedMpesa ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Send your subscription amount directly. Please include your registered email in the M-PESA reference message or contact support to have your workspace activated instantly.
              </p>
            </div>
          </CardFooter>
        </Card>

        {/* Secondary: Referral & Organization Access (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          <Card className="border bg-muted/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Invited by a Partner or Farm?
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Enter your invitation or promo voucher to join an existing organization or activate an evaluation license.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isApplying ? (
                <div className="py-4">
                  <PeckingChickenLoader message="Validating Farm Credentials..." />
                </div>
              ) : (
                <form onSubmit={handleApplyCode} className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. OVO-2026-X7Y"
                      value={referralCode}
                      onChange={(e) => {
                        setReferralCode(e.target.value);
                        if (referralStatus !== 'idle') setReferralStatus('idle');
                      }}
                      className="bg-background uppercase text-xs font-mono tracking-wider h-10"
                      disabled={isApplying}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      className="h-10 px-4 text-xs font-medium"
                      disabled={!referralCode.trim() || isApplying}
                    >
                      Apply
                    </Button>
                  </div>

                  {referralStatus === 'success' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Voucher verified. Activating access...
                    </p>
                  )}
                  {referralStatus === 'error' && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium">
                      Invalid or expired code. Please verify and retry.
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>

          {/* Value Props Strip */}
          <div className="p-4 rounded-xl border bg-card/40 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" /> System Guarantee
            </h4>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Zero-latency offline operation for remote sheds.
              </li>
              <li className="flex items-center gap-2">
                <LineChart className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                Automatic weekly rollups and benchmarking analytics.
              </li>
            </ul>
          </div>

          {/* Back Action */}
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground text-xs">
              <Link href="/projects/21-ovocore">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Return to Portfolio Overview
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}