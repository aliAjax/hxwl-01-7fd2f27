export interface KeyMetric {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "stable";
}

export interface AdjustmentRecord {
  date: string;
  stage: string;
  description: string;
  operator?: string;
}

export interface FittingSummaryData {
  customerId: string;
  customerName?: string;
  hearingLossDescription: string;
  hearingAidModel: string;
  keyMetrics: KeyMetric[];
  adjustments: AdjustmentRecord[];
  followUpAdvice: string;
  summaryDate?: string;
  audiologist?: string;
}

export interface SummaryPreviewConfig {
  showKeyMetrics: boolean;
  showAdjustments: boolean;
  showFollowUpAdvice: boolean;
  showEnglishSubtitle: boolean;
}

export const DEFAULT_SUMMARY_CONFIG: SummaryPreviewConfig = {
  showKeyMetrics: true,
  showAdjustments: true,
  showFollowUpAdvice: true,
  showEnglishSubtitle: true
};
