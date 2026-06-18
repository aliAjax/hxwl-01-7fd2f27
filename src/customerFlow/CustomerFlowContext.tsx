import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { useArchive } from "../archive/ArchiveContext";
import { useWorkflow } from "../workflow/WorkflowContext";
import type { CustomerAggregate, CustomerProfile, AudiogramRecord, FittingRecord, FollowUpRecord, ComparisonRecord } from "../archive/archive.types";
import type { WorkflowFittingRecord, RoleType, RecordStatus } from "../workflow/workflow.types";
import { getArchiveDB } from "../archive/archive.storage";
import { getSummaryByCustomerId } from "../summary/summary.sampleData";
import type { FittingSummaryData } from "../summary/summary.types";
import { comparisonToKeyMetrics, getComparisonSummaryText } from "../comparison/comparison.utils";
import { migrateSampleDataToArchive } from "./sampleMigrator";
import { syncWorkflowWithArchive } from "./workflowSync";

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

export type FlowStep = "profile" | "hearing" | "fitting" | "review" | "comparison" | "followup" | "summary";

export const FLOW_STEPS: { key: FlowStep; label: string; icon: string }[] = [
  { key: "profile", label: "客户档案", icon: "📋" },
  { key: "hearing", label: "听力录入", icon: "📈" },
  { key: "fitting", label: "验配记录", icon: "🔧" },
  { key: "review", label: "质控审核", icon: "✅" },
  { key: "comparison", label: "验配对比", icon: "📊" },
  { key: "followup", label: "安排复诊", icon: "📅" },
  { key: "summary", label: "摘要报告", icon: "🖨️" },
];

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
    aggregate,
    selectedCustomerId,
    selectCustomer,
    createAudiogram,
    createFitting,
    createFollowUp,
    createComparison,
    getLatestComparison,
    customers,
    listCustomers,
  } = useArchive();

  const {
    state: workflowState,
    createRecord,
    submitForReview,
    getFilteredRecords,
    updateRecord,
  } = useWorkflow();

  const [activeCustomerId, setActiveCustomerIdState] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStep>("profile");
  const [summaryData, setSummaryData] = useState<FittingSummaryData | null>(null);

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

  useEffect(() => {
    if (activeCustomerId && customers.length > 0) {
      syncWorkflowWithArchive(activeCustomerId, aggregate, workflowState.records, createRecord, updateRecord);
    }
  }, [activeCustomerId, customers.length]);

  const setActiveCustomerId = useCallback(async (id: string | null) => {
    setActiveCustomerIdState(id);
    if (id) {
      await selectCustomer(id);
    }
    setActiveStep("profile");
    setSummaryData(null);
  }, [selectCustomer]);

  const refreshFlow = useCallback(async () => {
    if (activeCustomerId) {
      await selectCustomer(activeCustomerId);
    }
  }, [activeCustomerId, selectCustomer]);

  const syncFlowWorkflow = useCallback(async () => {
    if (activeCustomerId) {
      await syncWorkflowWithArchive(activeCustomerId, aggregate, workflowState.records, createRecord, updateRecord);
    }
  }, [activeCustomerId, aggregate, workflowState.records, createRecord, updateRecord]);

  const effectiveAggregate = activeCustomerId === selectedCustomerId ? aggregate : null;
  const activeCustomerProfile = effectiveAggregate?.profile || null;

  const activeWorkflowRecords = useMemo(() => {
    if (!activeCustomerProfile) return [];
    const allRecords = getFilteredRecords();
    return allRecords.filter(
      (r) => r.customerId === activeCustomerProfile.id || r.customerId === activeCustomerProfile.customerNo
    ).sort((a, b) => b.createdAt - a.createdAt);
  }, [activeCustomerProfile, getFilteredRecords]);

  const activeLatestWorkflowRecord = activeWorkflowRecords.length > 0 ? activeWorkflowRecords[0] : null;

  const getFlowProgress = useCallback(() => {
    const steps = FLOW_STEPS.map((s) => s.key);
    const completed: FlowStep[] = [];
    const current = activeStep;
    const currentIdx = steps.indexOf(activeStep);

    for (let i = 0; i < currentIdx; i++) {
      completed.push(steps[i]);
    }

    const remaining = steps.slice(currentIdx + 1);
    return { completed, current, remaining };
  }, [activeStep]);

  const getStepStatus = useCallback((step: FlowStep): "completed" | "current" | "pending" | "unavailable" => {
    const steps = FLOW_STEPS.map((s) => s.key);
    const currentIdx = steps.indexOf(activeStep);
    const stepIdx = steps.indexOf(step);

    if (stepIdx === currentIdx) return "current";
    if (stepIdx < currentIdx) return "completed";

    if (!effectiveAggregate) return "unavailable";

    if (step === "hearing") {
      return effectiveAggregate.audiograms.length > 0 ? "completed" : "pending";
    }
    if (step === "fitting") {
      return effectiveAggregate.fittings.length > 0 || activeWorkflowRecords.length > 0 ? "completed" : "pending";
    }
    if (step === "review") {
      if (activeLatestWorkflowRecord) {
        if (activeLatestWorkflowRecord.status === "review_approved" || activeLatestWorkflowRecord.status === "completed") return "completed";
        if (activeLatestWorkflowRecord.status === "pending_review") return "current";
      }
      if (effectiveAggregate.fittings.length > 0) return "pending";
      return "unavailable";
    }
    if (step === "comparison") {
      return effectiveAggregate.comparisons.length > 0 ? "completed" : "pending";
    }
    if (step === "followup") {
      return effectiveAggregate.followUps.length > 0 ? "completed" : "pending";
    }
    if (step === "summary") {
      return summaryData ? "completed" : "pending";
    }

    return "pending";
  }, [activeStep, effectiveAggregate, activeWorkflowRecords, activeLatestWorkflowRecord, summaryData]);

  const goToNextStep = useCallback(() => {
    const steps = FLOW_STEPS.map((s) => s.key);
    const currentIdx = steps.indexOf(activeStep);
    if (currentIdx < steps.length - 1) {
      setActiveStep(steps[currentIdx + 1]);
    }
  }, [activeStep]);

  const goToPrevStep = useCallback(() => {
    const steps = FLOW_STEPS.map((s) => s.key);
    const currentIdx = steps.indexOf(activeStep);
    if (currentIdx > 0) {
      setActiveStep(steps[currentIdx - 1]);
    }
  }, [activeStep]);

  const createFittingAndWorkflow = useCallback(async (
    fittingData: Partial<FittingRecord>,
    workflowData?: Partial<WorkflowFittingRecord>
  ): Promise<{ fitting: FittingRecord; workflow: WorkflowFittingRecord }> => {
    if (!activeCustomerProfile) {
      throw new Error("未选择客户");
    }

    const customerId = activeCustomerProfile.id;
    const fitting = await createFitting({
      ...fittingData,
      customerId,
    });

    const hearingAidModel = fitting.hearingAid?.left?.model || fitting.hearingAid?.right?.model || "";
    const gainAdjustment = fitting.gainAdjustment?.binaural || fitting.gainAdjustment?.left || fitting.gainAdjustment?.right || "";

    const latestAudiogram = effectiveAggregate?.audiograms?.[0];
    const leftPta = latestAudiogram?.pta?.left || 0;
    const rightPta = latestAudiogram?.pta?.right || 0;
    const speechRecognitionRate = latestAudiogram?.speechRecognitionScore?.binaural || latestAudiogram?.speechRecognitionScore?.left || 0;

    const workflowRecordData: Partial<WorkflowFittingRecord> = {
      customerId,
      customerName: activeCustomerProfile.name,
      phone: activeCustomerProfile.phone,
      hearingLossType: activeCustomerProfile.hearingLossType,
      fittingStage: fitting.stage,
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
  }, [activeCustomerProfile, createFitting, createRecord, effectiveAggregate]);

  const createFittingFromFlow = useCallback((data: Partial<WorkflowFittingRecord> & { fittingId?: string }): WorkflowFittingRecord | null => {
    if (!activeCustomerProfile) return null;

    const existingRecord = activeLatestWorkflowRecord;
    if (existingRecord && existingRecord.status === "draft") {
      updateRecord(existingRecord.id, data);
      return { ...existingRecord, ...data } as WorkflowFittingRecord;
    }

    createRecord({
      ...data,
      customerId: activeCustomerProfile.id,
      customerName: activeCustomerProfile.name,
      phone: activeCustomerProfile.phone,
      hearingLossType: activeCustomerProfile.hearingLossType,
    });

    const allRecords = getFilteredRecords();
    return allRecords.find(
      (r) => r.customerId === activeCustomerProfile!.id || r.customerId === activeCustomerProfile!.customerNo
    ) || null;
  }, [activeCustomerProfile, createRecord, updateRecord, activeLatestWorkflowRecord, getFilteredRecords]);

  const submitForReviewFromFlow = useCallback((recordId?: string) => {
    const targetId = recordId || activeLatestWorkflowRecord?.id;
    if (!targetId) return;
    submitForReview(targetId);
  }, [activeLatestWorkflowRecord, submitForReview]);

  const generateSummaryFromFlow = useCallback(async (): Promise<FittingSummaryData | null> => {
    if (!activeCustomerProfile) return null;

    const profile = activeCustomerProfile;
    const agg = effectiveAggregate;

    let sampleSummary = getSummaryByCustomerId(profile.customerNo);
    if (!sampleSummary) {
      sampleSummary = getSummaryByCustomerId(profile.id);
    }

    let baseSummary: FittingSummaryData;

    if (sampleSummary) {
      baseSummary = {
        ...sampleSummary,
        customerId: profile.id,
        customerName: profile.name,
        hearingLossDescription: sampleSummary.hearingLossDescription || `${profile.hearingLossType}听力损失`,
        hearingAidModel: sampleSummary.hearingAidModel || (agg?.fittings[0]?.hearingAid?.left?.model) || "",
      };
    } else {
      const latestFitting = agg?.fittings[0];
      const latestAudiogram = agg?.audiograms[0];
      const latestWorkflow = activeLatestWorkflowRecord;

      baseSummary = {
        customerId: profile.id,
        customerName: profile.name,
        hearingLossDescription: `${profile.hearingLossType}听力损失`,
        hearingAidModel: latestFitting?.hearingAid?.left?.model || latestFitting?.hearingAid?.right?.model || latestWorkflow?.hearingAidModel || "",
        keyMetrics: [],
        adjustments: (agg?.fittings || []).map((f) => ({
          date: f.fittingDate,
          stage: f.stage,
          description: f.gainAdjustment?.left || f.gainAdjustment?.binaural || "验配调整",
          operator: f.fitter || "听力师",
        })),
        followUpAdvice: agg?.followUps[0]
          ? `下次复诊日期：${agg.followUps[0].scheduledDate}，请按时到店复查。`
          : "建议定期复查听力，关注助听器使用效果。",
        summaryDate: new Date().toISOString().slice(0, 10),
        audiologist: latestFitting?.fitter || latestWorkflow?.createdBy || "听力师",
      };

      if (latestAudiogram?.pta) {
        baseSummary.keyMetrics.push(
          { label: "左耳PTA", value: String(latestAudiogram.pta.left), unit: "dB", trend: "stable" },
          { label: "右耳PTA", value: String(latestAudiogram.pta.right), unit: "dB", trend: "stable" },
        );
      }

      if (latestAudiogram?.speechRecognitionScore) {
        const srs = latestAudiogram.speechRecognitionScore;
        if (srs.binaural) {
          baseSummary.keyMetrics.push({ label: "言语识别率", value: String(srs.binaural), unit: "%", trend: "up" });
        } else if (srs.left) {
          baseSummary.keyMetrics.push({ label: "左耳言语识别率", value: String(srs.left), unit: "%", trend: "up" });
        }
      }

      if (latestWorkflow && baseSummary.keyMetrics.length === 0) {
        if (latestWorkflow.leftPta) {
          baseSummary.keyMetrics.push({ label: "左耳PTA", value: String(latestWorkflow.leftPta), unit: "dB", trend: "stable" });
        }
        if (latestWorkflow.rightPta) {
          baseSummary.keyMetrics.push({ label: "右耳PTA", value: String(latestWorkflow.rightPta), unit: "dB", trend: "stable" });
        }
        if (latestWorkflow.speechRecognitionRate) {
          baseSummary.keyMetrics.push({ label: "言语识别率", value: String(latestWorkflow.speechRecognitionRate), unit: "%", trend: "up" });
        }
      }
    }

    try {
      const comparison = await getLatestComparison(profile.id);
      if (comparison) {
        const comparisonMetrics = comparisonToKeyMetrics(comparison);
        const existingLabels = baseSummary.keyMetrics.map((m) => m.label);
        const newMetrics = comparisonMetrics.filter((m) => !existingLabels.includes(m.label));
        baseSummary.keyMetrics = [...baseSummary.keyMetrics, ...newMetrics];

        const comparisonText = getComparisonSummaryText(comparison);
        if (comparisonText && comparisonText !== "暂无足够对比数据") {
          baseSummary.followUpAdvice = comparisonText + "\n\n" + baseSummary.followUpAdvice;
        }
      }
    } catch (e) {
      console.warn("加载对比数据失败:", e);
    }

    setSummaryData(baseSummary);
    return baseSummary;
  }, [activeCustomerProfile, effectiveAggregate, activeLatestWorkflowRecord, getLatestComparison]);

  const value: CustomerFlowContextValue = {
    activeCustomerId,
    activeStep,
    aggregate: effectiveAggregate,
    activeWorkflowRecords,
    activeLatestWorkflowRecord,
    activeCustomerProfile,
    summaryData,
    setActiveCustomerId,
    setActiveStep,
    goToNextStep,
    goToPrevStep,
    createFittingFromFlow,
    submitForReviewFromFlow,
    generateSummaryFromFlow,
    refreshFlow,
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
