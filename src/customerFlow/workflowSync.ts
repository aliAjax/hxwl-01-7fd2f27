import type { CustomerAggregate, FittingRecord } from "../archive/archive.types";
import type { WorkflowFittingRecord } from "../workflow/workflow.types";

const SYNCED_FLAG_PREFIX = "wf_archive_synced_";

export function isWorkflowRecordSynced(customerId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SYNCED_FLAG_PREFIX + customerId) === "true";
}

export function markWorkflowRecordSynced(customerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNCED_FLAG_PREFIX + customerId, "true");
}

export function syncWorkflowWithArchive(
  customerId: string,
  aggregate: CustomerAggregate | null,
  workflowRecords: WorkflowFittingRecord[],
  createRecord: (data: Partial<WorkflowFittingRecord>) => WorkflowFittingRecord | void,
  updateRecord: (recordId: string, updates: Partial<WorkflowFittingRecord>) => void
): void {
  if (!aggregate || !customerId) return;

  const hasWorkflowRecord = workflowRecords.some(
    (r) => r.customerId === customerId
  );

  if (hasWorkflowRecord) return;

  const hasLegacyWorkflowRecord = workflowRecords.some(
    (r) => r.customerId === aggregate.profile.customerNo
  );

  if (hasLegacyWorkflowRecord) return;

  if (aggregate.fittings.length === 0) return;

  if (isWorkflowRecordSynced(customerId)) return;

  const latestFitting = aggregate.fittings[0];
  const latestAudiogram = aggregate.audiograms[0];

  const hearingAidModel = latestFitting.hearingAid?.left?.model || latestFitting.hearingAid?.right?.model || "";
  const gainAdjustment = latestFitting.gainAdjustment?.binaural || latestFitting.gainAdjustment?.left || latestFitting.gainAdjustment?.right || "";

  const leftPta = latestAudiogram?.pta?.left || 0;
  const rightPta = latestAudiogram?.pta?.right || 0;
  const speechRecognitionRate = latestAudiogram?.speechRecognitionScore?.binaural || latestAudiogram?.speechRecognitionScore?.left || 0;

  const workflowData: Partial<WorkflowFittingRecord> = {
    customerId,
    customerName: aggregate.profile.name,
    phone: aggregate.profile.phone,
    hearingLossType: aggregate.profile.hearingLossType,
    fittingStage: latestFitting.stage as "初配" | "复调" | "复诊",
    hearingAidModel,
    gainAdjustment,
    userFeedback: latestFitting.userFeedback || "",
    speechRecognitionRate: typeof speechRecognitionRate === 'number' ? speechRecognitionRate : 0,
    leftPta: typeof leftPta === 'number' ? leftPta : 0,
    rightPta: typeof rightPta === 'number' ? rightPta : 0,
    status: "draft",
    createdBy: latestFitting.fitter || "数据同步",
  };

  createRecord(workflowData);
  markWorkflowRecordSynced(customerId);
}

export function convertFittingToWorkflow(
  fitting: FittingRecord,
  customerName: string,
  phone: string,
  hearingLossType: string,
  audiogramData?: {
    leftPta: number;
    rightPta: number;
    speechRecognitionRate: number;
  }
): Partial<WorkflowFittingRecord> {
  const hearingAidModel = fitting.hearingAid?.left?.model || fitting.hearingAid?.right?.model || "";
  const gainAdjustment = fitting.gainAdjustment?.binaural || fitting.gainAdjustment?.left || fitting.gainAdjustment?.right || "";

  return {
    customerId: fitting.customerId,
    customerName,
    phone,
    hearingLossType,
    fittingStage: fitting.stage as "初配" | "复调" | "复诊",
    hearingAidModel,
    gainAdjustment,
    userFeedback: fitting.userFeedback || "",
    speechRecognitionRate: audiogramData?.speechRecognitionRate || 0,
    leftPta: audiogramData?.leftPta || 0,
    rightPta: audiogramData?.rightPta || 0,
    status: "draft",
    createdBy: fitting.fitter || "听力师",
    createdAt: fitting.createdAt,
  };
}

export function resetSyncFlag(customerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SYNCED_FLAG_PREFIX + customerId);
}
