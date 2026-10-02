'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogComplianceEventModal } from '@/components/ovocore/LogComplianceEventModal';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Unsubscribe } from 'firebase/firestore';
import type { ComplianceEvent } from '@/services/ovocore/firebaseSchema';

interface FarmComplianceOverviewProps {
  farmId: string;
}

export function FarmComplianceOverview({ farmId }: FarmComplianceOverviewProps) {
  const [compliance, setCompliance] = useState<(ComplianceEvent & { id: string })[]>([]);

  useEffect(() => {
    if (!farmId) return;

    const complianceRef = query(
      collection(db, `farms/${farmId}/compliance`),
      orderBy('date', 'desc')
    );

    const unsubCompliance = onSnapshot(complianceRef, (snapshot) => {
      setCompliance(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as (ComplianceEvent & { id: string }))));
    });

    return () => {
      unsubCompliance();
    };
  }, [farmId]);

  return (
    <Card className="rounded-3xl border-border/80 shadow-xs overflow-hidden bg-card mt-8">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b bg-muted/20 px-6 py-4 gap-4">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" /> Biosecurity & Inspections
          </CardTitle>
          <CardDescription className="text-xs">
            Audit logs for mandatory veterinary vaccinations, inspections, and environmental audits.
          </CardDescription>
        </div>
        <LogComplianceEventModal farmId={farmId} />
      </CardHeader>
      
      {/* Principle 5: Sell Yourself First (Systemic Authority) */}
      <div className="bg-rose-950/40 border-y border-rose-900/50 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Audit Compliance Check Paused</h4>
          <p className="text-[11px] text-rose-300/80 leading-relaxed max-w-2xl">
            2 unrecorded days detected in House 01. Financial ledger reconciliation suspended until telemetry is synchronized.
          </p>
        </div>
      </div>

      <CardContent className="p-6">
        {compliance.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/20 border border-dashed rounded-2xl space-y-2">
            <ClipboardList className="h-8 w-8 mx-auto opacity-50 text-muted-foreground" />
            <p className="text-xs font-semibold">No compliance or veterinary events logged yet.</p>
            <p className="text-[11px] text-muted-foreground">
              Log scheduled vaccinations, disinfection cycles, or county health certifications.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {compliance.map((c) => {
              const date = c.date?.toDate ? c.date.toDate().toLocaleDateString('en-GB') : new Date(c.date as any).toLocaleDateString('en-GB');
              const isMissed = c.status === 'missed';
              const isPending = c.status === 'pending';

              return (
                <div
                  key={c.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                    isMissed
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : isPending
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-border/70 bg-card hover:border-primary/40'
                  }`}
                >
                  {isMissed ? (
                    <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className={`h-5 w-5 shrink-0 mt-0.5 ${isPending ? 'text-amber-500' : 'text-emerald-500'}`} />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-xs capitalize text-foreground">{c.eventType}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold ${
                          isMissed
                            ? 'text-rose-600 border-rose-300'
                            : isPending
                              ? 'text-amber-600 border-amber-300'
                              : 'text-emerald-600 border-emerald-300'
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium line-clamp-2">{c.description}</p>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/40 mt-2">
                      <span>Date: {date}</span>
                      <span>Assignee: {c.assignedTo || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
