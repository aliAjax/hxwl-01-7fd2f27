import type {
  ComparisonStatus as ArchiveComparisonStatus,
  FittingComparisonItem,
  ComparisonRecord
} from "../archive/archive.types";

export type ComparisonStatus = ArchiveComparisonStatus;

export type FittingRecord = FittingComparisonItem;

export type ComparisonData = ComparisonRecord;

export interface ComparisonResultItem {
  label: string;
  initialValue: string;
  followUpValue: string;
  status: ComparisonStatus;
  changeValue?: string;
}
