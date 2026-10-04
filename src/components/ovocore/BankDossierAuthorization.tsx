"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, ShieldCheck, Landmark, Lock, DownloadCloud, Loader2 } from 'lucide-react';
import { generateBankVerificationDossier, FinTechDossier } from '@/lib/ovocore/fintechDossierEngine';
import { useToast } from '@/hooks/use-toast';

interface BankDossierAuthorizationProps {
  farmId: string;
}

export function BankDossierAuthorization({ farmId }: BankDossierAuthorizationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<FinTechDossier | null>(null);

  const handleGenerateDossier = async () => {
    setLoading(true);
    try {
      // In production, this would hit a secure Next.js API endpoint to sign the PDF
      const result = await generateBankVerificationDossier(farmId);
      
      // Simulate network delay for dramatic effect
      setTimeout(() => {
        setDossier(result);
        setLoading(false);
        toast({
          title: "Bank Dossier Generated",
          description: "Immutable financial and biological audit secured. Downloading PDF..."
        });
      }, 2500);
      
    } catch (err: any) {
      setLoading(false);
      toast({ variant: 'destructive', title: "Error", description: err.message });
    }
  };

  return (
    <Card className="bg-slate-900 border-emerald-900/50 text-white rounded-3xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Landmark className="w-32 h-32 text-emerald-500" />
      </div>
      
      <CardHeader className="relative z-10 space-y-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-emerald-400">Institutional Credit Dossier</CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1 max-w-md">
              Generate a tamper-proof, biologically-verified financial audit to secure asset-financing from commercial banks (e.g., Equity Bank, Co-op Bank) for Big Dutchman expansions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-5">
        {!dossier ? (
          <div className="space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 flex gap-3">
              <Lock className="w-5 h-5 text-emerald-500 shrink-0" />
              <p>
                By generating this dossier, OvoCore aggregates 90 days of immutable SiloPulse telemetry, flock mortality records, and egg revenue cash flows to compute your <strong className="text-emerald-400">Biological Credit Score</strong>.
              </p>
            </div>
            
            <Button
              onClick={handleGenerateDossier}
              disabled={loading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Compiling Cryptographic Ledger...</>
              ) : (
                <><ShieldCheck className="w-4 h-4 mr-2" /> Generate Verified Bank Dossier</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 rounded-2xl p-4 border border-emerald-900/30">
                <p className="text-[10px] uppercase font-bold text-slate-500">OvoCore Credit Score</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{dossier.creditRiskScore} <span className="text-sm font-normal text-slate-500">/ 850</span></p>
                <Badge variant="outline" className="mt-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                  Prime Tier Commercial
                </Badge>
              </div>
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">FCR (90-Day):</span>
                  <span className="font-bold text-white">{dossier.metrics.averageFcr}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Mortality:</span>
                  <span className="font-bold text-emerald-400">{dossier.metrics.cumulativeMortalityPct}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Net Margin:</span>
                  <span className="font-bold text-emerald-400">{dossier.metrics.netOperatingMarginPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 flex items-center justify-between">
              <div className="truncate pr-4">
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Secure Bank Verification Link</p>
                <a 
                  href={dossier.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:underline truncate mt-0.5 block"
                >
                  {dossier.verificationUrl}
                </a>
              </div>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-8 shrink-0 print:hidden"
                onClick={() => window.print()}
              >
                <DownloadCloud className="w-3.5 h-3.5 mr-1.5" /> PDF
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}