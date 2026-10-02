// lib/ovocore/procurementDispatcher.ts
import { sanitizePhone, createAuthRedirectUrl } from './whatsappAdvisor';

interface ProcurementDispatchContext {
  farmId: string;
  farmName: string;
  ownerName: string;
  ownerPhone: string;
  supplierName: string;
  feedType: string;
  requiredTons: number;
  totalCostKES: number;
  siloId: string;
}

export function generateProcurementWhatsAppMessage(ctx: ProcurementDispatchContext): {
  message: string;
  checkoutUrl: string;
  cleanPhone: string;
  waUrl: string;
} {
  const checkoutPath = `/ovocore/farm/${ctx.farmId}/checkout?siloId=${ctx.siloId}&tons=${ctx.requiredTons}&amount=${ctx.totalCostKES}`;
  const checkoutUrl = createAuthRedirectUrl(checkoutPath);

  const message = 
    `🚨 *URGENT SILO REORDER & ESCROW DISPATCH* 🚨\n` +
    `Habari ${ctx.ownerName}, Silo reserves at *${ctx.farmName}* have reached critical threshold.\n\n` +
    `📦 *Order Specification:*\n` +
    `• Feed Type: *${ctx.feedType}*\n` +
    `• Volume: *${ctx.requiredTons} Metric Tons*\n` +
    `• Preferred Mill: *${ctx.supplierName || 'Unga Farm Care'}*\n` +
    `• Total Investment: *KSh ${ctx.totalCostKES.toLocaleString()}*\n\n` +
    `To bypass retail spot-price markups and secure mill-gate priority delivery, authorize secure platform escrow below:\n\n` +
    `👉 *Authorize One-Click Escrow:* ${checkoutUrl}\n\n` +
    `_Funds are securely held in escrow and released to the miller only upon verified farm-gate delivery scan._`;

  const cleanPhone = sanitizePhone(ctx.ownerPhone);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return {
    message,
    checkoutUrl,
    cleanPhone,
    waUrl
  };
}

export function dispatchProcurementWhatsApp(ctx: ProcurementDispatchContext) {
  const { waUrl } = generateProcurementWhatsAppMessage(ctx);
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
