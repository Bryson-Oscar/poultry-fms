import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertOctagon,
  Wind,
  ShieldAlert,
  Microscope,
  Syringe,
  Flame,
  MessageSquareWarning,
  FileCheck2
} from "lucide-react";

interface EmergencyMortalityProtocolProps {
  mortalityCount: number;
  mortalityPct: number;
  onAcknowledge: () => void;
}

export const EmergencyMortalityProtocol: React.FC<EmergencyMortalityProtocolProps> = ({
  mortalityCount,
  mortalityPct,
  onAcknowledge
}) => {
  return (
    <Card className="border-rose-500 shadow-lg shadow-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 overflow-hidden">
      <div className="bg-rose-600 p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full animate-pulse">
            <AlertOctagon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">CRITICAL EMERGENCY PROTOCOL ACTIVATED</h2>
            <p className="text-rose-100 text-sm opacity-90 mt-0.5">
              Acute Mortality Threshold Breached: {mortalityCount} birds ({mortalityPct.toFixed(2)}%)
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-white border-white/40 bg-white/10 font-bold px-3 py-1 text-xs">
          SEVERITY: CRITICAL
        </Badge>
      </div>

      <CardContent className="p-6 space-y-8">
        <div className="bg-rose-100/50 dark:bg-rose-900/30 p-4 rounded-xl border border-rose-200 dark:border-rose-800">
          <p className="text-sm text-rose-900 dark:text-rose-200 font-medium">
            <strong>WARNING:</strong> Unchecked acute mortality in intensive poultry units can wipe out an entire flock within 12–24 hours via suffocation or virulent outbreaks. Follow the exact operational sequence below.
          </p>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-rose-300 before:to-transparent">

          {/* Phase 1 */}
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-rose-100 bg-rose-600 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md shadow-rose-500/30 z-10">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  Phase 1: Triage & Isolation
                </h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">0-2 Hrs</Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 mt-3 list-disc pl-4 marker:text-rose-500">
                <li><strong className="text-foreground">Ventilation Check:</strong> Inspect generator/fans. Are curtains trapped? Look for heat stress/panting vs oxygen starvation.</li>
                <li><strong className="text-foreground">Water Systems:</strong> Check nipple lines for air-locks or overheated PVC pipes.</li>
                <li><strong className="text-foreground">Biosecurity Lockdown:</strong> Strict quarantine. Upgrade footbaths to active iodine/virucide.</li>
                <li><strong className="text-foreground">Feed Interception:</strong> Halt feeding from current silo until mycotoxin clearance.</li>
              </ul>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-rose-100 bg-amber-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md shadow-amber-500/30 z-10">
              <Microscope className="w-4 h-4" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  Phase 2: Diagnostic Triage
                </h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">2-6 Hrs</Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 mt-3 list-disc pl-4 marker:text-amber-500">
                <li><strong className="text-foreground">Necropsy (3-5 birds):</strong>
                  <ul className="pl-2 mt-1 space-y-1">
                    <li>- Respiratory: Tracheal plugs (Newcastle/IB)</li>
                    <li>- Visceral: Swollen kidneys, bruised bursae (Gumboro)</li>
                    <li>- Intestinal: Ballooning, blood spots (Necrotic Enteritis/Coccidiosis)</li>
                  </ul>
                </li>
                <li><strong className="text-foreground">Lab Sampling:</strong> Dispatch fresh viscera/blood swabs in ice coolers to diagnostic lab for PCR.</li>
              </ul>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-rose-100 bg-emerald-600 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md shadow-emerald-500/30 z-10">
              <Syringe className="w-4 h-4" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  Phase 3: Corrective Action
                </h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">6-24 Hrs</Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 mt-3 list-disc pl-4 marker:text-emerald-500">
                <li><strong className="text-foreground">Viral Suspect:</strong> Administer hyper-immune serum, water-soluble multi-vitamins (A, E, C), and electrolytes.</li>
                <li><strong className="text-foreground">Bacterial Suspect:</strong> Initiate broad-spectrum antibiotics (Amoxicillin, Colistin) ONLY under vet prescription.</li>
                <li><strong className="text-foreground">Carcass Disposal:</strong> Immediate removal. Deep burial (min 6ft') with quicklime or incineration. No open pits.</li>
              </ul>
            </div>
          </div>

          {/* Phase 4 */}
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-rose-100 bg-blue-600 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md shadow-blue-500/30 z-10">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  Phase 4: Digital Audit
                </h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Automated</Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 mt-3 list-disc pl-4 marker:text-blue-500">
                <li><strong className="text-foreground">Automated Logging:</strong> OvoCore securely records timestamp, house, batch, and mortality scale.</li>
                <li><strong className="text-foreground">Owner Alert:</strong> Portfolio managers receive automated push/WhatsApp notifications immediately.</li>
                <li><strong className="text-foreground">Financial Tagging:</strong> Mortality is tagged to adjust closing inventory, projected cull value, and FCR models.</li>
              </ul>
            </div>
          </div>

        </div>
      </CardContent>

      <CardFooter className="bg-rose-50 dark:bg-rose-950/40 p-4 flex justify-between items-center border-t border-rose-100 dark:border-rose-900">
        <p className="text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4" /> Alerts dispatched to Portfolio Manager
        </p>
        <Button onClick={onAcknowledge} variant="destructive" size="sm" className="font-bold shadow-lg shadow-rose-500/20">
          Acknowledge & Initiate Protocol
        </Button>
      </CardFooter>
    </Card>
  );
};
