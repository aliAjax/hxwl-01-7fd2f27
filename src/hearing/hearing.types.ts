export type Frequency = 250 | 500 | 1000 | 2000 | 4000 | 8000;

export type EarSide = "left" | "right";

export type ConductionType = "air" | "bone";

export interface ThresholdPoint {
  frequency: Frequency;
  value: number | null;
  valid: boolean;
  warning?: string;
}

export interface EarData {
  air: ThresholdPoint[];
  bone: ThresholdPoint[];
}

export interface HearingRecord {
  left: EarData;
  right: EarData;
  meta?: {
    patientName?: string;
    testDate?: string;
    tester?: string;
    notes?: string;
  };
}

export const FREQUENCIES: Frequency[] = [250, 500, 1000, 2000, 4000, 8000];

export const THRESHOLD_MIN = -10;
export const THRESHOLD_MAX = 130;
export const THRESHOLD_NORMAL_MAX = 25;
