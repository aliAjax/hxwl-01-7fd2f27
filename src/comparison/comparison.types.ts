export type ComparisonStatus = "improved" | "stable" | "worsened";

export interface FittingRecord {
  speechRecognitionRate: number | null;
  feedbackWhistle: string;
  gainAdjustment: string;
  recordDate?: string;
  fittingStage?: string;
}

export interface ComparisonData {
  customerId: string;
  customerName?: string;
  hearingLossType?: string;
  hearingAidModel?: string;
  initial: FittingRecord;
  followUp: FittingRecord;
}

export interface ComparisonResultItem {
  label: string;
  initialValue: string;
  followUpValue: string;
  status: ComparisonStatus;
  changeValue?: string;
}
