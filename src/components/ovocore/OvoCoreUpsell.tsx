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
  CheckCheck,
  TrendingDown
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';

interface OvoCoreUpsellProps {
  farmId?: string;
  onApplyReferral?: (code: string) => Promise<boolean>;
  requiredTier?: 'operator' | 'pro' | 'syndicate';
}

export function OvoCoreUpsell({ farmId, onApplyReferral, requiredTier }: OvoCoreUpsellProps) {
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
          window.location.href = `/farm/${data.farmId}`;
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

  const handleSubscribe = async (tier: string) => {
    setIsSubscribing(true);
    try {
      const payload = auth.currentUser 
        ? {
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            billingPeriod,
            farmName: 'My Commercial Farm',
            tier
          }
        : {
            userId: 'GUEST',
            userEmail: null,
            billingPeriod,
            farmName: 'My Commercial Farm',
            tier
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

  return (
    <div className="container mx-auto px-4 py-12 lg:py-20 flex flex-col items-center justify-center min-h-[80vh] max-w-7xl">
      {/* Header Banner */}
      <div className="text-center max-w-4xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold uppercase tracking-wider mb-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Authorization Required
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          {requiredTier ? 'Upgrade to Unlock Institutional Control' : 'Secure Your Operational Advantage'}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
          Every 48 hours of unmonitored silo drift and manual mortality logging costs a 10,000-bird facility approximately KSh 28,000 in undetected feed spillage and delayed veterinary intervention. Remaining manual costs 10x more than automated governance.
        </p>

        {/* Billing Switcher */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <div className="bg-muted p-1 rounded-xl inline-flex items-center text-xs font-medium border border-border/50">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-lg transition-all ${billingPeriod === 'monthly'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Monthly 
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${billingPeriod === 'annual'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Annual
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 border border-emerald-500/20">
                Preferred
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Pitch Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        
        {/* Tier 1 */}
        <Card className="border-border/40 shadow-sm flex flex-col bg-card/40 hover:bg-card/60 transition-colors">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-bold">OvoCore Operator</CardTitle>
                <CardDescription className="text-sm mt-1">The Baseline Standard</CardDescription>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold">Free</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Entry-level initiation. Keeps you compliant, but leaves you vulnerable to manual errors.
            </p>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <ul className="text-sm space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Manual daily logs</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Basic mortality tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Standard inventory tracking</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full text-xs font-semibold" disabled>Current Plan</Button>
          </CardFooter>
        </Card>

        {/* Tier 2 */}
        <Card className="border-primary/50 shadow-xl relative overflow-hidden bg-card transform md:-translate-y-2">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-amber-300" />
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-bold text-amber-500">OvoCore Pro Elite</CardTitle>
                <CardDescription className="text-sm mt-1">The Operational Advantage</CardDescription>
              </div>
              <Badge className="bg-amber-500 text-amber-950 font-bold border-none">
                Top 12%
              </Badge>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{billingPeriod === 'annual' ? '$990' : '$99'}</span>
                <span className="text-sm text-muted-foreground font-medium">{billingPeriod === 'annual' ? '/ yr' : '/ mo'}</span>
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold">≈ KSh 1.20 per bird / month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              For producers who refuse to lose 3% to 5% of their margins to avoidable operational friction. A daily protection cost of less than KSh 0.04 per bird eliminates manual feed spillage.
            </p>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <ul className="text-sm space-y-3">
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-foreground font-medium">Arduino IoT telemetry integration</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-foreground font-medium">Predictive silo runway watchdogs</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Automated vaccination schedules</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Multi-stream cashflow ledgers</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-xs" onClick={() => handleSubscribe('pro')} disabled={isSubscribing}>
              {isSubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Initiate Pro Elite
            </Button>
          </CardFooter>
        </Card>

        {/* Tier 3 */}
        <Card className="border-border/40 shadow-sm flex flex-col bg-slate-900/50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-bold text-white">The Sovereign Syndicate</CardTitle>
                <CardDescription className="text-sm mt-1 text-slate-400">The Elite Circle</CardDescription>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{billingPeriod === 'annual' ? '€4,500' : '$499'}</span>
                <span className="text-sm text-slate-400 font-medium">{billingPeriod === 'annual' ? '/ yr' : '/ mo'}</span>
              </div>
              <span className="text-[10px] text-blue-400 font-bold">Translates to a capital outlay of €1.22 per bird</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Restricted access. Designed for institutional leaders who dictate market pricing. Replaces a €15,000 equivalent manual equipment upgrade.
            </p>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <ul className="text-sm space-y-3">
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-slate-200 font-medium">Autonomous WhatsApp AI advisor</span>
              </li>
              <li className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-slate-200 font-medium">Multi-shed enterprise control</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-400">Lenders Audit PDF Dossier generator</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-400">Real-time regional epidemiological geo-fencing</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full text-xs font-semibold bg-slate-800 text-white border-slate-700 hover:bg-slate-700" onClick={() => handleSubscribe('syndicate')} disabled={isSubscribing}>
              {isSubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Request Syndicate Access
            </Button>
          </CardFooter>
        </Card>

      </div>

      <div className="mt-12 max-w-md w-full">
        <Card className="border bg-muted/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Syndicate Invitation Code
            </CardTitle>
            <CardDescription className="text-xs">
              If you have been granted an integration voucher by a partner integrator, verify it below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApplyCode} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. SYNDICATE-2026"
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
                  className="h-10 px-4 text-xs font-bold"
                  disabled={!referralCode.trim() || isApplying}
                >
                  Verify
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}