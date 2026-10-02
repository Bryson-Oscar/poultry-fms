// lib/ovocore/vetDispatchHelper.ts
import { sanitizePhone, createAuthRedirectUrl } from './whatsappAdvisor';

interface VetDispatchContext {
  farmId: string;
  farmName: string;
  ownerName: string;
  vetName: string;
  vetPhone: string;
  mortalityRatePct: number;
  dailyMortalityCount: number;
  incidentId: string;
}

export function generateVetDispatchWhatsAppMessage(ctx: VetDispatchContext): {
  message: string;
  cleanPhone: string;
  waUrl: string;
} {
  const incidentUrl = createAuthRedirectUrl(`/ovocore/farm/${ctx.farmId}/vet-incident/${ctx.incidentId}`);

  const message = 
    `🚨 *EMERGENCY VET DISPATCH — OVOCORE TELEMETRY* 🚨\n` +
    `Dr. ${ctx.vetName || 'Field Veterinarian'}, automated biological monitoring has detected a severe health anomaly at *${ctx.farmName}*.\n\n` +
    `📊 *Clinical Snapshot:*\n` +
    `• Daily Mortality: *${ctx.mortalityRatePct.toFixed(2)}%* (${ctx.dailyMortalityCount} birds)\n` +
    `• Status: *Immediate Necropsy & Water Sanitization Audit Required*\n\n` +
    `👉 *Review Full Telemetry Dossier:* ${incidentUrl}\n\n` +
    `_Please reply to coordinate on-site farm visit or emergency water-line treatment protocols._`;

  const cleanPhone = sanitizePhone(ctx.vetPhone);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return {
    message,
    cleanPhone,
    waUrl
  };
}

export function dispatchVetWhatsApp(ctx: VetDispatchContext) {
  const { waUrl } = generateVetDispatchWhatsAppMessage(ctx);
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
