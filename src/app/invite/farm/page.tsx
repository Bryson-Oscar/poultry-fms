"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFarmInvite, claimFarmInvite, FarmInviteRecord } from '@/services/farmService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';
import { BlueMotionOverlay } from '@/components/ovocore/BlueMotionOverlay';
import { Building2, UserPlus, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const code = searchParams.get('code');
  
  const [invite, setInvite] = useState<FarmInviteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchInvite() {
      if (!code) {
        setError('No invitation code provided.');
        setLoading(false);
        return;
      }
      
      try {
        const data = await getFarmInvite(code);
        if (!data) {
          setError('Invitation not found or has expired.');
        } else if (data.status === 'accepted') {
          setError('This invitation has already been claimed.');
        } else {
          setInvite(data);
        }
      } catch (err: any) {
        console.error("Error fetching invite:", err);
        setError('Failed to load invitation details.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchInvite();
  }, [code]);

  const handleClaim = async () => {
    if (!user || !invite || !code) return;
    
    setClaiming(true);
    try {
      const farmId = await claimFarmInvite(code, user.uid, user.email || '');
      toast({
        title: "Invitation Accepted!",
        description: `You have successfully joined ${invite.farmName}.`
      });
      router.push(`/farm/${farmId}`);
    } catch (err: any) {
      console.error("Failed to claim invite:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to accept the invitation."
      });
      setClaiming(false);
    }
  };

  if (loading || authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white space-y-4">
        <PeckingChickenLoader />
        <p className="text-xs font-mono text-slate-400 animate-pulse">
          Validating Syndicate Invitation Code...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <BlueMotionOverlay />

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none z-0" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        <Card className="bg-card border-slate-800 text-white shadow-2xl rounded-3xl overflow-hidden ">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 shadow-xl shadow-amber-500/20 mb-2">
              {error ? <AlertCircle className="w-8 h-8 text-slate-950" /> : <UserPlus className="w-8 h-8 text-slate-950" />}
            </div>
            <CardTitle className="text-xl font-bold">
              {error ? 'Invalid Invitation' : 'Farm Invitation'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-2">
              {error ? 'We could not process this invite link.' : 'You have been invited to join an OvoCore managed poultry enterprise.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error ? (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                <p className="text-rose-400 text-sm font-semibold">{error}</p>
                <Button asChild variant="outline" className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Link href="/">Return Home</Link>
                </Button>
              </div>
            ) : invite && (
              <div className="space-y-6">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <Building2 className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Enterprise</p>
                      <p className="text-base font-bold text-white">{invite.farmName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Assigned Role</p>
                      <p className="text-sm font-bold text-emerald-400 capitalize">{invite.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Invited By</p>
                      <p className="text-sm font-medium text-slate-200">{invite.ownerName}</p>
                    </div>
                  </div>
                </div>

                {user ? (
                  <div className="space-y-3 text-center">
                    <p className="text-xs text-slate-400">
                      You are signed in as <strong className="text-white">{user.email}</strong>
                    </p>
                    <Button 
                      onClick={handleClaim} 
                      disabled={claiming}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl h-12 text-sm shadow-lg shadow-amber-500/20"
                    >
                      {claiming ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
                      Accept Invitation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-xs text-slate-400 mb-2">
                      Create an account (or sign in) to accept this invitation.
                    </p>
                    <Button asChild className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl h-12 text-sm shadow-lg shadow-amber-500/20">
                      <Link href={`/auth?mode=signup&inviteCode=${code}&farmName=${encodeURIComponent(invite.farmName)}&redirect=${encodeURIComponent(`/invite/farm?code=${code}`)}`}>
                        Register to Join <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-800/80 p-4">
            <p className="text-[10px] text-slate-500 text-center font-mono">
              OvoCore Autonomous Poultry Intelligence
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <PeckingChickenLoader />
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
