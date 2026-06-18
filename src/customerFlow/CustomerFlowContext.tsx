import { createContext, useContext, useCallback, useEffect, ReactNode } from "react";
import { useArchive } from "../archive/ArchiveContext";
import { useWorkflow } from "../workflow/WorkflowContext";
import type { CustomerAggregate, CustomerProfile, FittingRecord } from "../archive/archive.types";
import type { WorkflowFittingRecord } from "../workflow/workflow.types";
import { migrateSampleDataToArchive } from "./sampleMigrator";
import { useCustomerSelection } from "./hooks/useCustomerSelection";
import { useFlowAggregate } from "./hooks/useFlowAggregate";
import { useWorkflowSync } from "./hooks/useWorkflowSync";
import { useFlowSummary } from "./hooks/useFlowSummary";
import { useStepStatus } from "./hooks/useStepStatus";
import type { FlowStep } from "./hooks/useFlowTypes";
import { FLOW_STEPS } from "./hooks/useFlowTypes";
import type { FittingSummaryData } from "../summary/summary.types";

const LEGACY_RECORDS = [
  { id: "rec-001", customerId: "Liu-024", hearingLossType: "双耳高频下降", fittingStage: "初配", hearingAidModel: "Phonak Audeo Paradise P90", gainAdjustment: "RIC机型，2kHz后增益提高4dB，高频压缩比调整为1.8:1", userFeedback: "佩戴一周后听人声更清晰，但在嘈杂环境下仍有些吃力，需要继续调试。" },
  { id: "rec-002", customerId: "Chen-118", hearingLossType: "单侧传导性损失", fittingStage: "复调", hearingAidModel: "Signia Pure Charge&Go 7X", gainAdjustment: "低频压缩略降5dB，反馈啸叫抑制阈值调高至65dB", userFeedback: "之前打电话有啸叫，现在已经完全消失，看电视也比以前清楚多了。" },
  { id: "rec-003", customerId: "Zhao-077", hearingLossType: "老人语频区下降", fittingStage: "复诊", hearingAidModel: "Oticon More 3 miniRITE R", gainAdjustment: "500Hz-2kHz区间整体增益+3dB，噪声管理程序强度提升一档", userFeedback: "和家人交流明显顺畅了，言语识别率从64%提升到76%，非常满意。" },
];

const LEGACY_FOLLOW_UPS = [
  { id: "fu-001", customerId: "Liu-024", customerName: "刘先生", daysToNext: -5, priority: "high" as const, contactStatus: "pending" as const, lastFollowUpDate: "2026-05-20", nextFollowUpDate: "2026-06-12", hearingAidModel: "Phonak Audeo Paradise P90", notes: "初配后首次复诊，需确认佩戴适应情况" },
  { id: "fu-002", customerId: "Chen-118", customerName: "陈女士", daysToNext: -2, priority: "high" as const, contactStatus: "unreachable" as const, lastFollowUpDate: "2026-05-28", nextFollowUpDate: "2026-06-15", hearingAidModel: "Signia Pure Charge&Go 7X", notes: "反馈啸叫问题已解决，需确认近期使用情况" },
  { id: "fu-003", customerId: "Wang-056", customerName: "王阿姨", daysToNext: 0, priority: "high" as const, contactStatus: "pending" as const, lastFollowUpDate: "2026-05-17", nextFollowUpDate: "2026-06-17", hearingAidModel: "Oticon Ruby 2", notes: "月度常规复诊，需做言语识别率测试" },
  { id: "fu-004", customerId: "Zhang-091", customerName: "张大爷", daysToNext: 0, priority: "medium" as const, contactStatus: "contacted" as const, lastFollowUpDate: "2026-05-20", nextFollowUpDate: "2026-06-17", hearingAidModel: "Widex Moment 440", notes: "已电话确认今日下午到店" },
  { id: "fu-005", customerId: "Li-132", customerName: "李先生", daysToNext: 2, priority: "medium" as const, contactStatus: "pending" as const, lastFollowUpDate: "2026-06-01", nextFollowUpDate: "2026-06-19", hearingAidModel: "ReSound One 9", notes: "复调后两周复查" },
  { id: "fu-006", customerId: "Zhao-077", customerName: "赵奶奶", daysToNext: 4, priority: "medium" as const, contactStatus: "pending" as const, lastFollowUpDate: "2026-05-24", nextFollowUpDate: "2026-06-21", hearingAidModel: "Oticon More 3 miniRITE R", notes: "儿童患者需确认适应情况" },
  { id: "fu-007", customerId: "Sun-045", customerName: "孙先生", daysToNext: 5, priority: "low" as const, contactStatus: "contacted" as const, lastFollowUpDate: "2026-06-05", nextFollowUpDate: "2026-06-22", hearingAidModel: "Starkey Evolv AI 2400", notes: "已预约，患者表示目前使用良好" },
  { id: "fu-008", customerId: "Zhou-088", customerName: "周女士", daysToNext: 7, priority: "low" as const, contactStatus: "pending" as const, lastFollowUpDate: "2026-05-10", nextFollowUpDate: "2026-06-24", hearingAidModel: "Phonak Naida P90-UP", notes: "季度常规检查" },
  { id: "fu-009", customerId: "Wu-023", customerName: "吴先生", daysToNext: 15, priority: "low" as const, contactStatus: "pending" as const, lastFollowUpDate: "2026-06-02", nextFollowUpDate: "2026-07-02", hearingAidModel: "Signia Silk 7X", notes: "深耳道式机型适配检查" },
];

export type { FlowStep };
export { FLOW_STEPS };

interface CustomerFlowContextValue {
  activeCustomerId: string | null;
  activeStep: FlowStep;
  aggregate: CustomerAggregate | null;
  activeWorkflowRecords: WorkflowFittingRecord[];
  activeLatestWorkflowRecord: WorkflowFittingRecord | null;
  activeCustomerProfile: CustomerProfile | null;
  summaryData: FittingSummaryData | null;
  setActiveCustomerId: (id: string | null) => void;
  setActiveStep: (step: FlowStep) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  createFittingFromFlow: (data: Partial<WorkflowFittingRecord> & { fittingId?: string }) => WorkflowFittingRecord | null;
  submitForReviewFromFlow: (recordId?: string) => void;
  generateSummaryFromFlow: () => Promise<FittingSummaryData | null>;
  refreshFlow: () => Promise<void>;
  syncWorkflowWithArchive: () => Promise<void>;
  getFlowProgress: () => { completed: FlowStep[]; current: FlowStep; remaining: FlowStep[] };
  getStepStatus: (step: FlowStep) => "completed" | "current" | "pending" | "unavailable";
  createFittingAndWorkflow: (fittingData: Partial<FittingRecord>, workflowData?: Partial<WorkflowFittingRecord>) => Promise<{ fitting: FittingRecord; workflow: WorkflowFittingRecord }>;
}

const CustomerFlowContext = createContext<CustomerFlowContextValue | null>(null);

export function CustomerFlowProvider({ children }: { children: ReactNode }) {
  const {
    customers,
    listCustomers,
    createFitting,
    getLatestComparison,
  } = useArchive();

  const {
    createRecord,
    updateRecord,
    submitForReview,
    getFilteredRecords,
  } = useWorkflow();

  const selection = useCustomerSelection();

  const aggregate = useFlowAggregate({
    activeCustomerId: selection.activeCustomerId,
    isConsistent: selection.isConsistent,
  });

  const { syncFlowWorkflow } = useWorkflowSync({
    activeCustomerId: selection.activeCustomerId,
    effectiveAggregate: aggregate.effectiveAggregate,
    workflowRecords: aggregate.workflowRecords,
    customersLength: customers.length,
  });

  const { summaryData, generateSummaryFromFlow, resetSummary } = useFlowSummary({
    activeCustomerProfile: aggregate.activeCustomerProfile,
    effectiveAggregate: aggregate.effectiveAggregate,
    activeLatestWorkflowRecord: aggregate.activeLatestWorkflowRecord,
  });

  const { getFlowProgress, getStepStatus } = useStepStatus({
    activeStep: selection.activeStep,
    effectiveAggregate: aggregate.effectiveAggregate,
    activeWorkflowRecords: aggregate.activeWorkflowRecords,
    activeLatestWorkflowRecord: aggregate.activeLatestWorkflowRecord,
    summaryData,
  });

  useEffect(() => {
    (async () => {
      try {
        const count = await migrateSampleDataToArchive(LEGACY_RECORDS, LEGACY_FOLLOW_UPS);
        if (count > 0) {
          await listCustomers();
        }
      } catch (e) {
        console.warn("样例数据迁移异常:", e);
      }
    })();
  }, [listCustomers]);

  const setActiveCustomerId = useCallback(async (id: string | null) => {
    resetSummary();
    await selection.setActiveCustomerId(id);
  }, [selection, resetSummary]);

  const goToNextStep = useCallback(() => {
    const steps = FLOW_STEPS.map((s) => s.key);
    const currentIdx = steps.indexOf(selection.activeStep);
    if (currentIdx < steps.length - 1) {
      selection.setActiveStep(steps[currentIdx + 1]);
    }
  }, [selection.activeStep, selection.setActiveStep]);

  const goToPrevStep = useCallback(() => {
    const steps = FLOW_STEPS.map((s) => s.key);
    const currentIdx = steps.indexOf(selection.activeStep);
    if (currentIdx > 0) {
      selection.setActiveStep(steps[currentIdx - 1]);
    }
  }, [selection.activeStep, selection.setActiveStep]);

  const createFittingAndWorkflow = useCallback(async (
    fittingData: Partial<FittingRecord>,
    workflowData?: Partial<WorkflowFittingRecord>
  ): Promise<{ fitting: FittingRecord; workflow: WorkflowFittingRecord }> => {
    if (!aggregate.activeCustomerProfile) {
      throw new Error("未选择客户");
    }

    const customerId = aggregate.activeCustomerProfile.id;
    const fitting = await createFitting({
      ...fittingData,
      customerId,
    });

    const hearingAidModel = fitting.hearingAid?.left?.model || fitting.hearingAid?.right?.model || "";
    const gainAdjustment = fitting.gainAdjustment?.binaural || fitting.gainAdjustment?.left || fitting.gainAdjustment?.right || "";

    const latestAudiogram = aggregate.effectiveAggregate?.audiograms?.[0];
    const leftPta = latestAudiogram?.pta?.left || 0;
    const rightPta = latestAudiogram?.pta?.right || 0;
    const speechRecognitionRate = latestAudiogram?.speechRecognitionScore?.binaural || latestAudiogram?.speechRecognitionScore?.left || 0;

    const workflowStage = (fitting.stage === "随访" ? "复诊" : fitting.stage) as "初配" | "复调" | "复诊" | undefined;
    const workflowRecordData: Partial<WorkflowFittingRecord> = {
      customerId,
      customerName: aggregate.activeCustomerProfile.name,
      phone: aggregate.activeCustomerProfile.phone,
      hearingLossType: aggregate.activeCustomerProfile.hearingLossType,
      fittingStage: workflowStage,
      hearingAidModel,
      gainAdjustment,
      userFeedback: fitting.userFeedback || "",
      speechRecognitionRate: typeof speechRecognitionRate === 'number' ? speechRecognitionRate : 0,
      leftPta: typeof leftPta === 'number' ? leftPta : 0,
      rightPta: typeof rightPta === 'number' ? rightPta : 0,
      ...workflowData,
    };

    const workflow = createRecord(workflowRecordData);

    return { fitting, workflow };
  }, [aggregate.activeCustomerProfile, aggregate.effectiveAggregate, createFitting, createRecord]);

  const createFittingFromFlow = useCallback((data: Partial<WorkflowFittingRecord> & { fittingId?: string }): WorkflowFittingRecord | null => {
    if (!aggregate.activeCustomerProfile) return null;

    const existingRecord = aggregate.activeLatestWorkflowRecord;
    if (existingRecord && existingRecord.status === "draft") {
      updateRecord(existingRecord.id, data);
      return { ...existingRecord, ...data } as WorkflowFittingRecord;
    }

    createRecord({
      ...data,
      customerId: aggregate.activeCustomerProfile.id,
      customerName: aggregate.activeCustomerProfile.name,
      phone: aggregate.activeCustomerProfile.phone,
      hearingLossType: aggregate.activeCustomerProfile.hearingLossType,
    });

    const allRecords = getFilteredRecords();
    return allRecords.find(
      (r) => r.customerId === aggregate.activeCustomerProfile!.id || r.customerId === aggregate.activeCustomerProfile!.customerNo
    ) || null;
  }, [aggregate.activeCustomerProfile, aggregate.activeLatestWorkflowRecord, createRecord, updateRecord, getFilteredRecords]);

  const submitForReviewFromFlow = useCallback((recordId?: string) => {
    const targetId = recordId || aggregate.activeLatestWorkflowRecord?.id;
    if (!targetId) return;
    submitForReview(targetId);
  }, [aggregate.activeLatestWorkflowRecord, submitForReview]);

  const value: CustomerFlowContextValue = {
    activeCustomerId: selection.activeCustomerId,
    activeStep: selection.activeStep,
    aggregate: aggregate.effectiveAggregate,
    activeWorkflowRecords: aggregate.activeWorkflowRecords,
    activeLatestWorkflowRecord: aggregate.activeLatestWorkflowRecord,
    activeCustomerProfile: aggregate.activeCustomerProfile,
    summaryData,
    setActiveCustomerId,
    setActiveStep: selection.setActiveStep,
    goToNextStep,
    goToPrevStep,
    createFittingFromFlow,
    submitForReviewFromFlow,
    generateSummaryFromFlow,
    refreshFlow: selection.refreshFlow,
    syncWorkflowWithArchive: syncFlowWorkflow,
    getFlowProgress,
    getStepStatus,
    createFittingAndWorkflow,
  };

  return (
    <CustomerFlowContext.Provider value={value}>
      {children}
    </CustomerFlowContext.Provider>
  );
}

export function useCustomerFlow(): CustomerFlowContextValue {
  const ctx = useContext(CustomerFlowContext);
  if (!ctx) {
    throw new Error("useCustomerFlow must be used within CustomerFlowProvider");
  }
  return ctx;
}
