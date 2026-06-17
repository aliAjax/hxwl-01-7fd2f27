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
