export type ReviewStatus = "pending" | "approved" | "rejected";
export type QcFilter = "all" | "pending" | "approved" | "rejected" | "incomplete" | "abnormal" | "feedbackMissing";

export interface RequiredField {
  key: string;
  label: string;
  value: string;
  completed: boolean;
}

export interface GainAdjustmentDetail {
  frequency: string;
  baseline: number;
  adjusted: number;
  deviation: number;
  isAbnormal: boolean;
  reason: string;
}

export interface QcRecord {
  id: string;
  recordId: string;
  customerId: string;
  customerName: string;
  hearingLossType: string;
  fittingStage: string;
  hearingAidModel: string;
  audiologist: string;
  fittingDate: string;
  submittedDate: string;
  requiredFields: RequiredField[];
  fieldCompleteness: number;
  gainAdjustments: GainAdjustmentDetail[];
  hasAbnormalGain: boolean;
  userFeedback: string;
  feedbackMissing: boolean;
  feedbackMissingReason: string;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
}

export interface ReviewAction {
  recordId: string;
  status: ReviewStatus;
  rejectReason?: string;
  timestamp: string;
}

export const reviewStatusLabelMap: Record<ReviewStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已退回"
};

export const qcFilterOptions: { key: QcFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已退回" },
  { key: "incomplete", label: "字段不完整" },
  { key: "abnormal", label: "增益异常" },
  { key: "feedbackMissing", label: "反馈缺失" }
];
