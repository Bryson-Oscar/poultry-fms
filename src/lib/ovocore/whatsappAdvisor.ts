// lib/whatsappAdvisor.ts
import { auth } from '@/lib/firebase';

export type EnterpriseMode = 'layers' | 'broilers' | 'improved_kienyeji' | 'dual_purpose' | 'mixed';

export interface FinancialKPIs {
  costPerEggKES?: number;
  feedCostPerDozenKES?: number;
  costPerKgLiveWeight?: number;
  revenueTodayKES?: number;
  monthlyRevenueKES?: number;
  grossMarginPct?: number;
  accountsReceivableKES?: number;
  netOperatingProfitKES?: number;
}

export interface MarketIntelligence {
  eggSellingPriceKES?: number;
  birdSellingPriceKES?: number;
  maizePriceKES?: number;
  soybeanPriceKES?: number;
  nearestBuyer?: string;
  pendingOrders?: number;
  customerDemandTrend?: string;
  regionalDiseaseAlert?: boolean;
}

export interface GrowthReadiness {
  availableLandAcres?: number;
  projectedCapacity?: number;
  fundingStatus?: string;
  expansionPhase?: string;
  automationReadinessScore?: number;
}

export interface CommercialOpportunity {
  projectStage: 'Prospecting' | 'Qualified' | 'Quote Submitted' | 'Negotiation' | 'Won';
  projectedBirdCapacity?: number;
  estimatedProjectValueEUR?: number;
  probabilityPct?: number;
  nextAction?: string;
  competitorThreatLevel?: 'Low' | 'Medium' | 'High';
}

export interface FarmTelemetryContext {
  farmId: string;
  farmName: string;
  ownerName: string;
  ownerPhone: string;
  vetPhone?: string;
  supplierPhone?: string;
  supplierName?: string;
  houseCount: number;
  activeFlockCount: number;
  totalFeedKg: number;
  daysOfFeed: number;
  dailyFeedDemandKg?: number;
  mortalityRatePct: number;
  dailyMortalityCount?: number;
  houseId?: string;
  houseName?: string;
  flockCode?: string;
  unrecordedDays: number;
  unsettledCreditKES: number;
  currentPage: 'portfolio' | 'farm_dashboard' | 'inventory' | 'finance' | 'daily_log';

  // Enterprise & Operational Extensions
  enterpriseMode?: EnterpriseMode;
  flockAgeDays?: number;
  broilerAvgWeightG?: number;
  broilerFCR?: number;

  // Advanced Biosecurity, Quarantine & QA Gate Flags
  houseSanitaryStatus?: string; // 'downtime_countdown' | 'depleted' | 'wet_washed' | etc.
  isFeedQualityBlocked?: boolean;
  isOverstocked?: boolean;
  thermalStressAlert?: boolean; // High THI / heat stress watch

  // AI Strategic Advisory Pillars
  finance?: FinancialKPIs;
  market?: MarketIntelligence;
  growth?: GrowthReadiness;
  commercial?: CommercialOpportunity;
}

/**
 * Normalizes Kenyan & international telephone formats to E.164 without +
 */
export function sanitizePhone(phone: string): string {
  let cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = '254' + cleaned;
  return cleaned || '+254711637374';
}

/**
 * Builds an authenticated target link that routes through the auth gate
 */
export function createAuthRedirectUrl(targetPath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}${targetPath}`;
}

/**
 * Evaluates farm telemetry across all enterprise modes, biosecurity locks, and commercial pipelines,
 * drafting prioritized, high-impact WhatsApp action triggers.
 */
export async function generateContextualAdvisoryMessage(ctx: FarmTelemetryContext): Promise<{
  message: string;
  actionUrl: string;
  urgency: 'low' | 'medium' | 'critical' | 'strategic';
  targetRecipientPhone?: string;
}> {
  const enterpriseLabel =
    ctx.enterpriseMode === 'broilers' ? 'Meat Broilers' :
      ctx.enterpriseMode === 'improved_kienyeji' ? 'Improved Kienyeji' :
        ctx.enterpriseMode === 'dual_purpose' ? 'Dual-Purpose Poultry' : 'Commercial Layers';

  const greeting = `Habari ${ctx.ownerName || 'Mkulima'}! 🐣\n*OvoCore Farm Operations Dossier* — *${ctx.farmName || 'OvoCore Farm'}*\n`;

  // 1. CRITICAL FEED QUALITY REJECTION GATE (Mycotoxin / Moisture Breach)
  if (ctx.isFeedQualityBlocked) {
    const supplierPhone = ctx.supplierPhone || ctx.ownerPhone;
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}/inventory`);
    const message =
      `🚨 *CRITICAL FEED QA REJECTION NOTICE* 🚨\n` +
      `Supplier: *${ctx.supplierName || 'Feed Mill'}*\n` +
      `Farm: *${ctx.farmName}*\n\n` +
      `Inbound feed delivery has failed laboratory moisture (>13%) or mycotoxin/aflatoxin (>20ppb) thresholds. Silo discharge is strictly prohibited to prevent mycotoxicosis.\n\n` +
      `👉 *Action Required:* Return batch to miller immediately.\n\n` +
      `🔗 *Inspect Silo Inventory:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'critical', targetRecipientPhone: supplierPhone };
  }

  // 2. SANITARY QUARANTINE / PRE-PLACEMENT LOCK (14-Day Countdown)
  if (ctx.houseSanitaryStatus === 'downtime_countdown') {
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}`);
    const message =
      `🔒 *BIOSECURITY QUARANTINE LOCK ACTIVE* 🔒\n` +
      `Farm: *${ctx.farmName}* | Shed: *${ctx.houseName || ctx.houseId || 'Shed'}*\n\n` +
      `House is currently under mandatory 14-day sanitary downtime countdown following terminal cleanout. Bird placement is locked.\n\n` +
      `👉 *Action Required:* Complete swab microbiological testing prior to restocking.\n\n` +
      `🔗 *Review House Status:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'medium' };
  }

  // 3. THERMAL HEAT STRESS WATCHDOG (High THI Alert)
  if (ctx.thermalStressAlert && ctx.activeFlockCount > 0) {
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}`);
    const message =
      `🔥 *THERMAL HEAT STRESS ALERT* 🔥\n` +
      `Farm: *${ctx.farmName}* | Shed: *${ctx.houseName || 'House 01'}*\n\n` +
      `Environmental sensors indicate critical Temperature-Humidity Index (THI >= 80). Risk of acute mortality and feed depression.\n\n` +
      `👉 *Action Required:* Maximize curtain ventilation, run emergency cooling pads/fans, and supplement drinking water with electrolytes/Vitamin C.\n\n` +
      `🔗 *View Shed Telemetry:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'critical' };
  }

  // 4. BIOSECURITY EMERGENCY ESCALATION (>0.15% layers, >1.5% broilers)
  const mortalityThreshold = ctx.enterpriseMode === 'broilers' ? 1.5 : 0.15;
  if (ctx.mortalityRatePct >= mortalityThreshold && ctx.activeFlockCount > 0) {
    const vetPhone = ctx.vetPhone || ctx.ownerPhone;
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}?action=log_compliance`);
    const message =
      `🚨 *EMERGENCY VET DISPATCH — MORTALITY SPIKE* 🚨\n` +
      `Farm: *${ctx.farmName}* (${enterpriseLabel})\n` +
      `Shed: *${ctx.houseName || 'House 01'}* | Flock: *${ctx.flockCode || 'FLK-ACTIVE'}*\n\n` +
      `Daily Mortality Spike: *${ctx.mortalityRatePct.toFixed(2)}%* (${ctx.dailyMortalityCount || 0} dead today). Benchmark limit is ${mortalityThreshold}%.\n\n` +
      `👉 *Vet Action Required:* Schedule immediate necropsy and water-line sanitization audit.\n\n` +
      `🔗 *Log Inspection / Audit:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'critical', targetRecipientPhone: vetPhone };
  }

  // 5. INTAKE & SILO DEPLETION PREDICTIVE WATCHDOG (<= 3 Days Runway)
  if (ctx.daysOfFeed <= 3 && ctx.activeFlockCount > 0) {
    const dailyDemand = ctx.dailyFeedDemandKg || 600;
    const requiredTons = Math.ceil((dailyDemand * 7) / 1000);
    const supplierPhone = ctx.supplierPhone || ctx.ownerPhone;
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}/inventory?action=receive_feed`);

    const message =
      `🚨 *AUTOMATED SILO REORDER WATCHDOG* 🚨\n` +
      `Supplier: *${ctx.supplierName || 'Feed Miller'}*\n` +
      `Farm: *${ctx.farmName}*\n\n` +
      `Silo reserves have dropped to *${ctx.daysOfFeed} days* (${ctx.totalFeedKg.toLocaleString()} kg remaining).\n\n` +
      `👉 *Order Draft:* Please prepare delivery of *${requiredTons} Metric Tons* of feed for ${enterpriseLabel}.\n\n` +
      `🔗 *Record Delivery Entry:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'critical', targetRecipientPhone: supplierPhone };
  }

  // 6. IMPROVED KIENYEJI COCKEREL SEPARATION WINDOW (Weeks 14–16 / Days 98–112)
  if (ctx.enterpriseMode === 'improved_kienyeji' && ctx.flockAgeDays !== undefined) {
    const ageDays = ctx.flockAgeDays;
    if (ageDays >= 98 && ageDays <= 112) {
      const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}`);
      const message =
        `🐓 *KIENYEJI COCKEREL SEPARATION WINDOW* 🐓\n` +
        `Farm: *${ctx.farmName}* | Flock Age: *Day ${ageDays} (~Week ${Math.floor(ageDays / 7)})*\n\n` +
        `Cockerels have reached prime market weight while pullets prepare for point-of-lay transitions.\n\n` +
        `👉 *Action Required:* Separate heavy roosters into finishing pens and transition pullets to breeder mash.\n\n` +
        `🔗 *Manage Flock Partition:* ${actionUrl}`;

      return { message, actionUrl, urgency: 'medium' };
    }
  }

  // 7. BROILER WITHDRAWAL & ABATTOIR CLEARANCE (Days 35-42)
  if (ctx.enterpriseMode === 'broilers' && ctx.activeFlockCount > 0) {
    const age = ctx.flockAgeDays || 0;
    if (age >= 35 && age <= 42) {
      const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}?action=record_broiler_sale`);
      const message =
        `⚠️ *ABATTOIR CLEARANCE & WITHDRAWAL LOCK* ⚠️\n` +
        `Farm: *${ctx.farmName}* | Broiler Age: *Day ${age}*\n\n` +
        `Withdrawal Feed Active (Zero antibiotics/coccidiostats). Official food safety clearance granted for processing.\n\n` +
        `👉 *Buyer Clearance:* Certified withdrawal period complete for target slaughter off-take.\n\n` +
        `🔗 *Dispatch Live-Weight Harvest:* ${actionUrl}`;

      return { message, actionUrl, urgency: 'medium' };
    }
  }

  // 8. COMMERCIAL PIPELINE & QUOTATION MILESTONE ADVISORY
  if (ctx.commercial && ctx.commercial.projectStage !== 'Won') {
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}`);
    const estVal = ctx.commercial.estimatedProjectValueEUR ? `EUR ${ctx.commercial.estimatedProjectValueEUR.toLocaleString()}` : 'High-Value Project';
    const message =
      `💼 *STRATEGIC PIPELINE MILESTONE* 💼\n` +
      `Farm / Prospect: *${ctx.farmName}*\n` +
      `Stage: *${ctx.commercial.projectStage}* (${ctx.commercial.probabilityPct || 50}% Probability)\n` +
      `Project Value: *${estVal}* (~${ctx.commercial.projectedBirdCapacity || 0} Bird Capacity)\n\n` +
      `👉 *Next Tactical Action:* ${ctx.commercial.nextAction || 'Schedule executive review and align technical specifications.'}\n\n` +
      `🔗 *Open Deal Dashboard:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'strategic' };
  }

  // 9. UNSTOCKED SHEDS / EMPTY HOUSES
  if (ctx.houseCount === 0 || ctx.activeFlockCount === 0) {
    const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}?action=place_flock`);
    const message =
      `${greeting}\n` +
      `Farm infrastructure is configured for *${enterpriseLabel}*, but active batch placement is pending.\n\n` +
      `👉 *Next Step:* Record your bird placement to initiate feeding and mortality tracking.\n\n` +
      `🔗 *Stock Flock Batch:* ${actionUrl}`;

    return { message, actionUrl, urgency: 'medium' };
  }

  // 10. STANDARD OPERATIONAL STATUS ADVISORY
  const actionUrl = createAuthRedirectUrl(`/farm/${ctx.farmId}`);
  const message = greeting +
    `All operational metrics are within standard tolerances.\n\n` +
    `🔗 *Access Live Dashboard:* ${actionUrl}`;

  return { message, actionUrl, urgency: 'low' };
}

/**
 * Dispatches the composed advisory directly to WhatsApp Web / Mobile app
 */
export async function dispatchWhatsAppAdvisor(ctx: FarmTelemetryContext) {
  const { message, targetRecipientPhone } = await generateContextualAdvisoryMessage(ctx);
  const targetPhone = targetRecipientPhone || ctx.ownerPhone || (auth && auth.currentUser ? auth.currentUser.phoneNumber || '' : '');
  const cleanPhone = sanitizePhone(targetPhone);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}

/**
 * Dispatches a generated AI itinerary via WhatsApp for proactive resource utilization,
 * perfectly synchronized with route timing blocks, NEPQ scripts, and stakeholder fact sheets.
 */
export function dispatchItineraryWhatsAppAdvisor(itinerary: any[], recipientPhone?: string) {
  const greeting = `🚗 *AI Field Visit Itinerary & Route Plan* 🗺️\n\nOptimized schedule with synchronized timing blocks and NEPQ psychological playbooks for tomorrow:\n\n`;

  const body = itinerary.map((item, index) => {
    return `*${index + 1}. ${item.location}*\n` +
      `⏰ *Time Block:* ${item.timeBlock} (${item.phase || 'Scheduled Visit'})\n` +
      `📍 *Address:* ${item.address || 'Location Verified'}\n` +
      `🎯 *Objective:* ${item.objective}\n` +
      `📈 *Metric:* ${item.metric}\n` +
      (item.nepqScript ? `💡 *NEPQ Playbook ("No-Means-Yes"):* "${item.nepqScript}"\n` : '') +
      (item.objectionHandling ? `🛡️ *Objection Handling:* ${item.objectionHandling}\n` : '') +
      (item.stakeholderFactSheet ? `📋 *Fact Sheet:* ${item.stakeholderFactSheet}\n` : '') +
      `\n`;
  }).join('');

  const footer = `Ensure all documentation, quotations, and route maps are loaded. Let's maximize our field conversion impact!`;
  const message = greeting + body + footer;

  const targetPhone = recipientPhone || '+254711637374';
  const cleanPhone = sanitizePhone(targetPhone);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}

/**
 * Dispatches a proactive nudge message to a specific client/lead
 * based on geographic proximity or schedule gaps, leveraging NEPQ framing.
 */
export function dispatchProactiveNudge(leadItem: any) {
  const greeting = `Hi ${leadItem.decisionMakerName || 'there'},\n\n`;
  const body = `I'm actually going to be in the ${leadItem.location || leadItem.county || 'your'} area today and have a brief window in my schedule. `;
  const closing = `Would it be completely unreasonable for us to squeeze in a quick 15-minute catch-up while I'm nearby?\n\nNo worries if your day is already fully packed!`;

  const message = greeting + body + closing;
  const targetPhone = leadItem.phone || leadItem.googlePhone || '+254711637374';
  const cleanPhone = sanitizePhone(targetPhone);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}

function generateOvoCoreRecommendation(ctx: FarmTelemetryContext) {
  throw new Error('Function not implemented.');
}

export interface SuperAdminUpsellContext {
  targetOwnerName: string;
  targetFarmName: string;
  targetPhone: string;
  currentTier: 'Tier 1' | 'Tier 2' | 'Pro Elite' | string;
  recommendedUpgradeTier: 'Pro Elite' | 'Sovereign Syndicate' | string;
  estimatedMonthlySavingsKES: number;
}



/**
 * Generates a high-status, Machiavellian upsell dispatch for Super Admins
 */
export function generateSuperAdminUpsellMessage(ctx: SuperAdminUpsellContext): {
  message: string;
  cleanPhone: string;
  waUrl: string;
} {
  const greeting = `Habari ${ctx.targetOwnerName || 'Mkulima'}! 🦅\n*OvoCore Executive Dispatch* — *Institutional Scale Advisory*\n\n`;
  
  const body = 
    `Our telemetry audit for *${ctx.targetFarmName || 'your facility'}* indicates you are currently operating on *${ctx.currentTier}* governance.\n\n` +
    `Based on your regional bird capacity, manual tracking and unmonitored silo margins are introducing an estimated *KSh ${ctx.estimatedMonthlySavingsKES.toLocaleString()} / month* in avoidable feed spillage and invisible biological drift.\n\n` +
    `*The Sovereign Syndicate Standard:* \n` +
    `Leading commercial producers in your county have transitioned to *${ctx.recommendedUpgradeTier}*, unlocking automated IoT silo telemetry, predictive mortality watchdogs, and direct mill-gate procurement automation.\n\n` +
    `*Your Strategic Directive:* \n` +
    `Would it be completely unreasonable to provision your facility with automated telemetry this week to capture those margin leaks before the next production cycle?\n\n` +
    `👉 *Review & Authorize Upgrade:* ${createAuthRedirectUrl(`/ovocore/farm/upgrade?tier=${ctx.recommendedUpgradeTier.toLowerCase().replace(/\s+/g, '_')}`)}`;

  const cleanPhone = sanitizePhone(ctx.targetPhone);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting + body)}`;

  return {
    message: greeting + body,
    cleanPhone,
    waUrl
  };
}

/**
 * Direct action dispatcher for Super Admin dashboard UI
 */
export function dispatchSuperAdminUpsellWhatsApp(ctx: SuperAdminUpsellContext) {
  const { waUrl } = generateSuperAdminUpsellMessage(ctx);
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
