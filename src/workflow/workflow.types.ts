export type RoleType = "audiologist" | "supervisor" | "assistant";

export const ROLE_LABELS: Record<RoleType, string> = {
  audiologist: "听力师",
  supervisor: "门店主管",
  assistant: "复诊助理"
};

export const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  audiologist: "创建验配记录，填写验配数据",
  supervisor: "审核关键字段，处理异常调整",
  assistant: "根据复诊天数跟进客户"
};

export type RecordStatus =
  | "draft"
  | "pending_review"
  | "review_approved"
  | "review_rejected"
  | "pending_followup"
  | "followup_in_progress"
  | "completed"
  | "cancelled";

export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "草稿",
  pending_review: "待审核",
  review_approved: "审核通过",
  review_rejected: "审核驳回",
  pending_followup: "待跟进",
  followup_in_progress: "跟进中",
  completed: "已完成",
  cancelled: "已取消"
};

export type FollowUpPriority = "high" | "medium" | "low";

export const PRIORITY_LABELS: Record<FollowUpPriority, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

export interface ReviewField {
  fieldName: string;
  fieldLabel: string;
  isKey: boolean;
  hasAbnormality: boolean;
  abnormalityNote?: string;
}

export interface RejectedField {
  fieldName: string;
  fieldLabel: string;
  oldValue: string | number;
  rejectReason: string;
  corrected?: boolean;
  correctedValue?: string | number;
  correctionNote?: string;
}

export interface RejectionRecord {
  id: string;
  rejectionId: string;
  rejectedBy: string;
  rejectedAt: number;
  overallComment: string;
  rejectedFields: RejectedField[];
  correctionStartedAt?: number;
  correctedBy?: string;
  correctedAt?: number;
  correctionFields?: Array<{
    fieldName: string;
    fieldLabel: string;
    oldValue: string | number;
    newValue: string | number;
  }>;
  resubmittedAt?: number;
}

export interface FieldChange {
  fieldName: string;
  fieldLabel: string;
  oldValue: string | number;
  newValue: string | number;
}

export interface OperationLog {
  id: string;
  recordId: string;
  operatorRole: RoleType;
  operatorName: string;
  action: string;
  actionType:
    | "create"
    | "update"
    | "submit"
    | "approve"
    | "reject"
    | "assign"
    | "followup"
    | "complete"
    | "status_change"
    | "resubmit"
    | "correct";
  oldStatus?: RecordStatus;
  newStatus?: RecordStatus;
  detail?: string;
  timestamp: number;
  ip?: string;
  rejectionId?: string;
  fieldChanges?: FieldChange[];
}

export interface WorkflowFittingRecord {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  hearingLossType: string;
  fittingStage: "初配" | "复调" | "复诊";
  hearingAidModel: string;
  gainAdjustment: string;
  userFeedback: string;
  speechRecognitionRate: number;
  leftPta: number;
  rightPta: number;
  status: RecordStatus;
  priority: FollowUpPriority;
  followUpDays: number;
  nextFollowUpDate: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewComment?: string;
  followUpAssignedTo?: string;
  followUpStartedAt?: number;
  followUpCompletedAt?: number;
  followUpNote?: string;
  reviewFields: ReviewField[];
  rejectionHistory: RejectionRecord[];
  version: number;
}

export interface WorkflowState {
  currentRole: RoleType;
  currentUserName: string;
  records: WorkflowFittingRecord[];
  operationLogs: OperationLog[];
  selectedRecordId: string | null;
}

export interface PermissionConfig {
  canCreateRecord: boolean;
  canEditRecord: boolean;
  canDeleteRecord: boolean;
  canSubmitForReview: boolean;
  canReview: boolean;
  canAssignFollowUp: boolean;
  canStartFollowUp: boolean;
  canCompleteFollowUp: boolean;
  canViewAllRecords: boolean;
  canViewOperationLogs: boolean;
  visibleStatuses: RecordStatus[];
}

export const ROLE_PERMISSIONS: Record<RoleType, PermissionConfig> = {
  audiologist: {
    canCreateRecord: true,
    canEditRecord: true,
    canDeleteRecord: true,
    canSubmitForReview: true,
    canReview: false,
    canAssignFollowUp: false,
    canStartFollowUp: false,
    canCompleteFollowUp: false,
    canViewAllRecords: true,
    canViewOperationLogs: true,
    visibleStatuses: ["draft", "pending_review", "review_approved", "review_rejected"]
  },
  supervisor: {
    canCreateRecord: false,
    canEditRecord: true,
    canDeleteRecord: false,
    canSubmitForReview: false,
    canReview: true,
    canAssignFollowUp: true,
    canStartFollowUp: false,
    canCompleteFollowUp: false,
    canViewAllRecords: true,
    canViewOperationLogs: true,
    visibleStatuses: ["pending_review", "review_approved", "review_rejected", "pending_followup"]
  },
  assistant: {
    canCreateRecord: false,
    canEditRecord: false,
    canDeleteRecord: false,
    canSubmitForReview: false,
    canReview: false,
    canAssignFollowUp: false,
    canStartFollowUp: true,
    canCompleteFollowUp: true,
    canViewAllRecords: false,
    canViewOperationLogs: true,
    visibleStatuses: ["pending_followup", "followup_in_progress", "completed"]
  }
};

export const STATUS_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["review_approved", "review_rejected", "draft"],
  review_approved: ["pending_followup", "completed"],
  review_rejected: ["pending_review", "draft", "cancelled"],
  pending_followup: ["followup_in_progress", "cancelled"],
  followup_in_progress: ["completed", "pending_followup"],
  completed: [],
  cancelled: []
};

export const KEY_REVIEW_FIELDS: string[] = [
  "hearingLossType",
  "hearingAidModel",
  "gainAdjustment",
  "speechRecognitionRate",
  "leftPta",
  "rightPta"
];

export function generateId(prefix = "wf"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function canTransition(
  status: RecordStatus,
  targetStatus: RecordStatus,
  role: RoleType
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[status];
  if (!allowedTransitions.includes(targetStatus)) return false;

  const permissions = ROLE_PERMISSIONS[role];

  if (targetStatus === "pending_review") return permissions.canSubmitForReview;
  if (targetStatus === "review_approved" || targetStatus === "review_rejected")
    return permissions.canReview;
  if (targetStatus === "pending_followup") return permissions.canAssignFollowUp;
  if (targetStatus === "followup_in_progress") return permissions.canStartFollowUp;
  if (targetStatus === "completed") {
    return permissions.canCompleteFollowUp || permissions.canReview;
  }
  if (targetStatus === "draft") {
    return permissions.canEditRecord;
  }

  return true;
}
