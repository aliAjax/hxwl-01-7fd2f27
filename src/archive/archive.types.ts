export type Gender = "male" | "female" | "other";

export type FittingStage = "初配" | "复调" | "复诊" | "随访";

export type HearingLossType =
  | "感音神经性"
  | "传导性"
  | "混合性"
  | "中枢性"
  | "未知";

export type FollowUpPriority = "high" | "medium" | "low";

export type FollowUpStatus = "pending" | "contacted" | "unreachable" | "completed";

export type ConflictResolution = "local" | "remote" | "manual";

export type SyncStatus = "local" | "synced" | "conflict" | "pending";

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface VersionMeta {
  version: number;
  versionId: string;
  parentVersionId?: string;
  editedBy: string;
  editedAt: number;
  changeNote?: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  remoteVersionId?: string;
  remoteEditedAt?: number;
  remoteEditedBy?: string;
  remoteEntity?: unknown;
  resolution?: ConflictResolution;
  resolvedAt?: number;
}

export interface SyncMeta {
  syncStatus: SyncStatus;
  serverId?: string;
  lastSyncedAt?: number;
  conflict?: ConflictInfo;
}

export interface CustomerProfile extends BaseEntity, VersionMeta, SyncMeta {
  entityType: "customer";
  customerNo: string;
  name: string;
  gender: Gender;
  birthDate?: string;
  age?: number;
  phone: string;
  email?: string;
  address?: string;
  occupation?: string;
  hearingLossType: HearingLossType;
  hearingLossOnsetDate?: string;
  medicalHistory?: string;
  earSurgeryHistory?: string;
  tinnitus: boolean;
  vertigo: boolean;
  otorrhea: boolean;
  allergies?: string;
  tags?: string[];
  remark?: string;
}

export type Frequency = 250 | 500 | 1000 | 2000 | 4000 | 8000;
export type EarSide = "left" | "right";
export type ConductionType = "air" | "bone";

export interface ThresholdPoint {
  frequency: Frequency;
  value: number | null;
  masked?: boolean;
  valid?: boolean;
}

export interface EarAudiogram {
  air: ThresholdPoint[];
  bone: ThresholdPoint[];
  ucl?: ThresholdPoint[];
  mcl?: ThresholdPoint[];
}

export interface AudiogramRecord extends BaseEntity, VersionMeta, SyncMeta {
  entityType: "audiogram";
  customerId: string;
  testDate: string;
  tester?: string;
  testEnvironment?: string;
  left: EarAudiogram;
  right: EarAudiogram;
  speechRecognitionScore?: {
    left?: number;
    right?: number;
    binaural?: number;
  };
  impedance?: {
    left?: string;
    right?: string;
  };
  pta?: {
    left: number;
    right: number;
  };
  remark?: string;
}

export interface FittingRecord extends BaseEntity, VersionMeta, SyncMeta {
  entityType: "fitting";
  customerId: string;
  audiogramId?: string;
  fittingDate: string;
  fitter?: string;
  stage: FittingStage;
  hearingAid: {
    left?: {
      brand?: string;
      model: string;
      type?: string;
      serialNo?: string;
    };
    right?: {
      brand?: string;
      model: string;
      type?: string;
      serialNo?: string;
    };
  };
  earMold?: {
    left?: string;
    right?: string;
  };
  gainAdjustment?: {
    left?: string;
    right?: string;
    binaural?: string;
  };
  programSettings?: string;
  noiseManagement?: string;
  feedbackSuppression?: string;
  wirelessConnectivity?: string;
  userFeedback?: string;
  selfAssessment?: {
    satisfaction?: number;
    soundQuality?: number;
    comfort?: number;
    appearance?: number;
  };
  nextFollowUpDate?: string;
  remark?: string;
}

export interface FollowUpRecord extends BaseEntity, VersionMeta, SyncMeta {
  entityType: "followup";
  customerId: string;
  relatedFittingId?: string;
  scheduledDate: string;
  actualDate?: string;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  purpose?: string;
  contactMethod?: string;
  result?: string;
  actionsTaken?: string;
  nextScheduledDate?: string;
  operator?: string;
  remark?: string;
}

export type ArchiveEntity =
  | CustomerProfile
  | AudiogramRecord
  | FittingRecord
  | FollowUpRecord
  | ComparisonRecord;

export type EntityType = "customer" | "audiogram" | "fitting" | "followup" | "comparison";

export type ComparisonStatus = "improved" | "stable" | "worsened";

export interface FittingComparisonItem {
  speechRecognitionRate: number | null;
  feedbackWhistle: string;
  gainAdjustment: string;
  recordDate?: string;
  fittingStage?: string;
}

export interface ComparisonRecord extends BaseEntity, VersionMeta, SyncMeta {
  entityType: "comparison";
  customerId: string;
  customerName?: string;
  hearingLossType?: string;
  hearingAidModel?: string;
  initial: FittingComparisonItem;
  followUp: FittingComparisonItem;
}

export interface VersionSnapshot<T = ArchiveEntity> {
  id: string;
  entityId: string;
  entityType: EntityType;
  version: number;
  versionId: string;
  parentVersionId?: string;
  editedBy: string;
  editedAt: number;
  changeNote?: string;
  data: T;
  isCurrent?: boolean;
}

export interface ConflictDiff {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
}

export interface CustomerAggregate {
  profile: CustomerProfile;
  audiograms: AudiogramRecord[];
  fittings: FittingRecord[];
  followUps: FollowUpRecord[];
  comparisons: ComparisonRecord[];
  versionCount: number;
}

export const FREQUENCIES: Frequency[] = [250, 500, 1000, 2000, 4000, 8000];

export const DEFAULT_EAR_AUDIOGRAM: EarAudiogram = {
  air: FREQUENCIES.map((f) => ({ frequency: f, value: null, valid: false })),
  bone: FREQUENCIES.map((f) => ({ frequency: f, value: null, valid: false }))
};

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateVersionId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function calcPta(points: ThresholdPoint[]): number {
  const keyFreqs: Frequency[] = [500, 1000, 2000];
  const valid = points.filter(
    (p) => keyFreqs.includes(p.frequency) && p.value !== null && p.valid !== false
  );
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, p) => acc + (p.value as number), 0);
  return Math.round(sum / valid.length);
}

export function createEmptyCustomer(): CustomerProfile {
  const now = Date.now();
  const versionId = generateVersionId();
  return {
    id: generateId("cust"),
    entityType: "customer",
    customerNo: `C${String(Math.floor(Math.random() * 9000) + 1000)}`,
    name: "",
    gender: "male",
    phone: "",
    hearingLossType: "未知",
    tinnitus: false,
    vertigo: false,
    otorrhea: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
    versionId,
    editedBy: "当前用户",
    editedAt: now,
    syncStatus: "local"
  };
}

export function createEmptyAudiogram(customerId: string): AudiogramRecord {
  const now = Date.now();
  const versionId = generateVersionId();
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: generateId("aud"),
    entityType: "audiogram",
    customerId,
    testDate: today,
    left: JSON.parse(JSON.stringify(DEFAULT_EAR_AUDIOGRAM)),
    right: JSON.parse(JSON.stringify(DEFAULT_EAR_AUDIOGRAM)),
    createdAt: now,
    updatedAt: now,
    version: 1,
    versionId,
    editedBy: "当前用户",
    editedAt: now,
    syncStatus: "local"
  };
}

export function createEmptyFitting(customerId: string): FittingRecord {
  const now = Date.now();
  const versionId = generateVersionId();
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: generateId("fit"),
    entityType: "fitting",
    customerId,
    fittingDate: today,
    stage: "初配",
    hearingAid: {},
    createdAt: now,
    updatedAt: now,
    version: 1,
    versionId,
    editedBy: "当前用户",
    editedAt: now,
    syncStatus: "local"
  };
}

export function createEmptyFollowUp(customerId: string): FollowUpRecord {
  const now = Date.now();
  const versionId = generateVersionId();
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: generateId("fu"),
    entityType: "followup",
    customerId,
    scheduledDate: today,
    priority: "medium",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    version: 1,
    versionId,
    editedBy: "当前用户",
    editedAt: now,
    syncStatus: "local"
  };
}

export function createEmptyComparison(customerId: string): ComparisonRecord {
  const now = Date.now();
  const versionId = generateVersionId();
  return {
    id: generateId("cmp"),
    entityType: "comparison",
    customerId,
    initial: {
      speechRecognitionRate: null,
      feedbackWhistle: "",
      gainAdjustment: "",
      fittingStage: "初配"
    },
    followUp: {
      speechRecognitionRate: null,
      feedbackWhistle: "",
      gainAdjustment: "",
      fittingStage: "复调"
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
    versionId,
    editedBy: "当前用户",
    editedAt: now,
    syncStatus: "local"
  };
}
