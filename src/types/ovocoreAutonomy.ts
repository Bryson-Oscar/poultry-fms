// types/ovocoreAutonomy.ts
import { Timestamp } from 'firebase/firestore';

export type HouseSanitaryStatus = 
  | 'active_production'
  | 'depleted'
  | 'litter_removed'
  | 'wet_washed'
  | 'disinfected'
  | 'downtime_countdown'
  | 'swab_cleared';

export interface HouseSanitationState {
  status: HouseSanitaryStatus;
  depletedAt: Timestamp | null;
  downtimeEndAt: Timestamp | null;
  litterWeighbillId?: string;
  chemicalLotNumber?: string;
  disinfectantActiveIngredient?: string;
  swabLabClearanceId?: string;
  prePlacementFloorTempC?: number;
  prePlacementShavingsDepthCm?: number;
  clearedForPlacement: boolean;
  updatedAt?: Timestamp;
}

export interface BiologicalAnomalyAlert {
  id?: string;
  farmId: string;
  houseId: string;
  flockId: string;
  alertType: 
    | 'WATER_ANOMALY' 
    | 'CROP_FILL_FAILURE' 
    | 'WEIGHT_UNIFORMITY_DRIFT' 
    | 'EGG_QUALITY_DROP' 
    | 'FEED_DEPRESSION';
  severity: 'warning' | 'critical';
  headline: string;
  detail: string;
  recommendedSopAction: string;
  detectedAt: Timestamp;
  acknowledged: boolean;
}

export interface FeedDeliveryGuardrail {
  moisturePercentage: number;
  crudeProteinPercentage: number;
  aflatoxinPpb: number;
  qualityPassed: boolean;
  blockReason?: string;
}

export interface HarvestTraceabilityManifest {
  manifestId: string;
  farmId: string;
  flockId: string;
  houseId: string;
  depletionDate: Timestamp;
  totalBirdsLoaded: number;
  totalWeightKg: number;
  avgWeightG: number;
  finalFCR: number;
  withdrawalClearanceVerified: boolean;
  vaccineAuditSummary: string[];
  medicationHistory: Array<{ drug: string; administeredAt: Timestamp; withdrawalDays: number }>;
  attendingVetLicenseNumber?: string;
  tamperEvidentHash: string;
}
