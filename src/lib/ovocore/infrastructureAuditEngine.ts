// lib/ovocore/infrastructureAuditEngine.ts

export type TierLevel = 'Tier 1' | 'Tier 2' | 'Tier 3';

export interface FarmAuditInput {
  enterpriseType: 'layers' | 'broilers' | 'improved_kienyeji' | 'mixed';
  totalBirdCapacity: number;
  ventilationType: 'Natural (Open Sided)' | 'Tunnel' | 'Environmentally Controlled';
  biosecurityLevel: 'Standard Level 1' | 'Standard Level 2' | 'Strict Quarantine Level 3';
  hasIoTControllers: boolean;
}

export interface AuditResult {
  score: number; // 0 to 100
  tier: TierLevel;
  unlockedFeatures: string[];
  ellasVerdict: string;
  recommendation: string;
}

export function evaluateInfrastructureReadiness(input: FarmAuditInput): AuditResult {
  let score = 50; // baseline

  // Capacity weighting
  if (input.totalBirdCapacity >= 20000) score += 25;
  else if (input.totalBirdCapacity >= 5000) score += 15;
  else score += 5;

  // Ventilation weighting
  if (input.ventilationType === 'Environmentally Controlled') score += 15;
  else if (input.ventilationType === 'Tunnel') score += 10;
  else score += 5;

  // Biosecurity weighting
  if (input.biosecurityLevel === 'Strict Quarantine Level 3') score += 15;
  else if (input.biosecurityLevel === 'Standard Level 2') score += 10;
  else score += 3;

  if (input.hasIoTControllers) score += 10;

  // Determine Tier Assignment
  let tier: TierLevel = 'Tier 1';
  let unlockedFeatures: string[] = [];
  let ellasVerdict = '';
  let recommendation = '';

  if (score >= 80) {
    tier = 'Tier 3';
    unlockedFeatures = [
      'Sovereign Syndicate AI WhatsApp Advisor Engine',
      'Automated MQTT / IoT Climate Controller Stream',
      'Silo Load-Cell Telemetry & Automated Reorder',
      'Institutional Lenders & Bank Compliance PDF Dossiers',
      'Multi-Shed Epidemiological Geo-Fencing'
    ];
    ellasVerdict = "Infrastructure grade qualifies for Sovereign Syndicate institutional integration.";
    recommendation = "Your facility meets elite commercial thresholds. Full automation suite unlocked.";
  } else if (score >= 60) {
    tier = 'Tier 2';
    unlockedFeatures = [
      'Pro Elite Predictive Operations Banner',
      'Broiler Harvest Tipping Point & FCR Analytics',
      'Layer Pullet Capital Asset Amortization Ledger',
      'Offline-First PWA Field Worker Sync (Dexie.js)',
      'Smart Feed Quality & Aflatoxin Silo QA Gates'
    ];
    ellasVerdict = "Intermediate commercial setup detected. Pro Elite feature clusters provisioned.";
    recommendation = "Consider upgrading to tunnel ventilation or Level 2 biosecurity to unlock Tier 3 syndication.";
  } else {
    tier = 'Tier 1';
    unlockedFeatures = [
      'Standard Daily Log Capture & Mortality Tracking',
      'Automated Operational Schedule Milestones',
      'Basic Feed Inventory & Stock Ledger',
      'Manual Compliance Gating'
    ];
    ellasVerdict = "Standard operational baseline established. Core management tools active.";
    recommendation = "Increase flock capacity or upgrade sanitary infrastructure to qualify for automated IoT modules.";
  }

  return {
    score: Math.min(100, score),
    tier,
    unlockedFeatures,
    ellasVerdict,
    recommendation
  };
}
