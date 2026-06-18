import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { useArchive } from "../archive/ArchiveContext";
import { useWorkflow } from "../workflow/WorkflowContext";
import type { CustomerAggregate, CustomerProfile, AudiogramRecord, FittingRecord, FollowUpRecord, ComparisonRecord } from "../archive/archive.types";
import type { WorkflowFittingRecord, RoleType, RecordStatus, FieldChange } from "../workflow/workflow.types";
import { getArchiveDB } from "../archive/archive.storage";
import { getSummaryByCustomerId } from "../summary/summary.sampleData";
import type { FittingSummaryData } from "../summary/summary.types";
import { comparisonToKeyMetrics, getComparisonSummaryText } from "../comparison/comparison.utils";
import { migrateSampleDataToArchive } from "./sampleMigrator";

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

interface DataConsistencyInfo {
  isConsistent: boolean;
  issues: string[];
  workflowCount: number;
  archiveCount: number;
}

interface CustomerFlowContextValue {
  activeCustomerId: string | null;
  activeStep: FlowStep;
  aggregate: CustomerAggregate | null;
  activeWorkflowRecord: WorkflowFittingRecord | null;
  activeCustomerProfile: CustomerProfile | null;
  summaryData: FittingSummaryData | null;
  dataConsistency: DataConsistencyInfo;
  isLoading: boolean;
  setActiveCustomerId: (id: string | null) => Promise<void>;
  setActiveStep: (step: FlowStep) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  createFittingFromFlow: (data: Partial<WorkflowFittingRecord>) => Promise<{ workflowId: string; archiveId: string } | null>;
  submitForReviewFromFlow: () => void;
  generateSummaryFromFlow: () => Promise<FittingSummaryData | null>;
  refreshFlow: () => Promise<void>;
  getFlowProgress: () => { completed: FlowStep[]; current: FlowStep; remaining: FlowStep[] };
  getStepStatus: (step: FlowStep) => "completed" | "current" | "pending" | "unavailable";
  getCustomerWorkflowRecords: () => WorkflowFittingRecord[];
  syncWorkflowToArchive: (workflowRecordId: string) => Promise<void>;
  syncAllWorkflowToArchive: () => Promise<void>;
  checkDataConsistency: () => DataConsistencyInfo;
  fixDataConsistency: () => Promise<void>;
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
    updateFitting,
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
  const [isLoading, setIsLoading] = useState(false);
  const [dataConsistency, setDataConsistency] = useState<DataConsistencyInfo>({
    isConsistent: true,
    issues: [],
    workflowCount: 0,
    archiveCount: 0,
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

  useEffect(() => {
    if (activeCustomerId) {
      const consistency = checkDataConsistencyInternal();
      setDataConsistency(consistency);
    }
  }, [activeCustomerId, workflowState.records, aggregate]);

  const normalizeCustomerId = useCallback((customerId: string, profile?: CustomerProfile | null): string => {
    if (!profile) return customerId;
    if (customerId === profile.customerNo || customerId === profile.id) {
      return profile.id;
    }
    return customerId;
  }, []);

  const findMatchingCustomerProfile = useCallback((customerId: string): CustomerProfile | undefined => {
    return customers.find(
      (c) => c.id === customerId || c.customerNo === customerId
    );
  }, [customers]);

  const checkDataConsistencyInternal = useCallback((): DataConsistencyInfo => {
    const issues: string[] = [];
    const profile = aggregate?.profile;

    if (!profile) {
      return {
        isConsistent: true,
        issues: [],
        workflowCount: 0,
        archiveCount: 0,
      };
    }

    const workflowRecords = workflowState.records.filter(
      (r) => r.customerId === profile.id || r.customerId === profile.customerNo
    );

    const archiveFittings = aggregate?.fittings || [];

    for (const wfRec of workflowRecords) {
      const hasMatchingArchive = archiveFittings.some(
        (af) =>
          af.id === wfRec.id ||
          af.id === `fit-${wfRec.id}` ||
          (wfRec.hearingAidModel &&
            (af.hearingAid?.left?.model === wfRec.hearingAidModel ||
              af.hearingAid?.right?.model === wfRec.hearingAidModel) &&
            af.fittingDate === new Date(wfRec.createdAt).toISOString().slice(0, 10))
      );

      if (!hasMatchingArchive) {
        issues.push(`工作流记录「${wfRec.fittingStage}」未同步到档案库`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
      workflowCount: workflowRecords.length,
      archiveCount: archiveFittings.length,
    };
  }, [aggregate, workflowState.records]);

  const checkDataConsistency = useCallback((): DataConsistencyInfo => {
    return checkDataConsistencyInternal();
  }, [checkDataConsistencyInternal]);

  const syncWorkflowToArchive = useCallback(async (workflowRecordId: string) => {
    const wfRec = workflowState.records.find((r) => r.id === workflowRecordId);
    if (!wfRec) return;

    const profile = findMatchingCustomerProfile(wfRec.customerId);
    if (!profile) return;

    const normalizedCustomerId = normalizeCustomerId(wfRec.customerId, profile);

    const existingFitting = aggregate?.fittings.find(
      (af) =>
        af.id === wfRec.id ||
        af.id === `fit-${wfRec.id}`
    );

    const fittingData: Partial<FittingRecord> = {
      id: existingFitting?.id || `fit-${wfRec.id}`,
      customerId: normalizedCustomerId,
      fittingDate: new Date(wfRec.createdAt).toISOString().slice(0, 10),
      fitter: wfRec.createdBy,
      stage: wfRec.fittingStage,
      hearingAid: {
        left: { model: wfRec.hearingAidModel },
        right: { model: wfRec.hearingAidModel },
      },
      gainAdjustment: { binaural: wfRec.gainAdjustment },
      userFeedback: wfRec.userFeedback,
      nextFollowUpDate: wfRec.nextFollowUpDate,
    };

    try {
      if (existingFitting) {
        await updateFitting({ ...existingFitting, ...fittingData } as FittingRecord, "从工作流同步更新");
      } else {
        await createFitting(fittingData);
      }
    } catch (e) {
      console.error("同步工作流记录到档案库失败:", e);
      throw e;
    }
  }, [workflowState.records, findMatchingCustomerProfile, normalizeCustomerId, aggregate?.fittings, updateFitting, createFitting]);

  const syncAllWorkflowToArchive = useCallback(async () => {
    if (!activeCustomerId) return;

    const profile = aggregate?.profile;
    if (!profile) return;

    const workflowRecords = workflowState.records.filter(
      (r) => r.customerId === profile.id || r.customerId === profile.customerNo
    );

    for (const rec of workflowRecords) {
      try {
        await syncWorkflowToArchive(rec.id);
      } catch (e) {
        console.error(`同步记录 ${rec.id} 失败:`, e);
      }
    }

    await refreshFlow();
  }, [activeCustomerId, aggregate?.profile, workflowState.records, syncWorkflowToArchive]);

  const fixDataConsistency = useCallback(async () => {
    await syncAllWorkflowToArchive();
    const consistency = checkDataConsistencyInternal();
    setDataConsistency(consistency);
  }, [syncAllWorkflowToArchive, checkDataConsistencyInternal]);

  const setActiveCustomerId = useCallback(async (id: string | null) => {
    setIsLoading(true);
    try {
      setActiveCustomerIdState(id);
      if (id) {
        await selectCustomer(id);
      }
      setActiveStep("profile");
      setSummaryData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectCustomer]);

  const refreshFlow = useCallback(async () => {
    if (activeCustomerId) {
      setIsLoading(true);
      try {
        await selectCustomer(activeCustomerId);
        const consistency = checkDataConsistencyInternal();
        setDataConsistency(consistency);
      } finally {
        setIsLoading(false);
      }
    }
  }, [activeCustomerId, selectCustomer, checkDataConsistencyInternal]);

  const effectiveAggregate = activeCustomerId === selectedCustomerId ? aggregate : null;
  const activeCustomerProfile = effectiveAggregate?.profile || null;

  const getCustomerWorkflowRecords = useCallback((): WorkflowFittingRecord[] => {
    if (!activeCustomerProfile) return [];
    return workflowState.records.filter(
      (r) => r.customerId === activeCustomerProfile.id || r.customerId === activeCustomerProfile.customerNo
    );
  }, [activeCustomerProfile, workflowState.records]);

  const activeWorkflowRecord = useMemo(() => {
    if (!activeCustomerProfile) return null;
    const records = getCustomerWorkflowRecords();
    return records.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  }, [activeCustomerProfile, getCustomerWorkflowRecords]);

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
      const hasFitting = effectiveAggregate.fittings.length > 0 || getCustomerWorkflowRecords().length > 0;
      return hasFitting ? "completed" : "pending";
    }
    if (step === "review") {
      const records = getCustomerWorkflowRecords();
      if (records.length === 0) return "pending";
      const latest = records.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (latest) {
        if (latest.status === "review_approved" || latest.status === "completed") return "completed";
        if (latest.status === "pending_review") return "current";
        if (latest.status === "review_rejected") return "pending";
      }
      return "pending";
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
  }, [activeStep, effectiveAggregate, summaryData, getCustomerWorkflowRecords]);

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

  const createFittingFromFlow = useCallback(async (data: Partial<WorkflowFittingRecord>): Promise<{ workflowId: string; archiveId: string } | null> => {
    if (!activeCustomerProfile) return null;

    const normalizedCustomerId = activeCustomerProfile.id;

    const workflowData: Partial<WorkflowFittingRecord> = {
      ...data,
      customerId: normalizedCustomerId,
      customerName: activeCustomerProfile.name,
      phone: activeCustomerProfile.phone,
      hearingLossType: activeCustomerProfile.hearingLossType,
    };

    createRecord(workflowData);

    const latestWfRecord = workflowState.records[0];

    try {
      const archiveFitting = await createFitting({
        customerId: normalizedCustomerId,
        fittingDate: new Date().toISOString().slice(0, 10),
        fitter: workflowState.currentUserName,
        stage: (data.fittingStage as FittingRecord["stage"]) || "初配",
        hearingAid: {
          left: { model: data.hearingAidModel || "" },
          right: { model: data.hearingAidModel || "" },
        },
        gainAdjustment: { binaural: data.gainAdjustment || "" },
        userFeedback: data.userFeedback || "",
      });

      await refreshFlow();

      return {
        workflowId: latestWfRecord?.id || "",
        archiveId: archiveFitting.id,
      };
    } catch (e) {
      console.error("创建验配记录失败:", e);
      throw e;
    }
  }, [activeCustomerProfile, createRecord, createFitting, workflowState.records, workflowState.currentUserName, refreshFlow]);

  const submitForReviewFromFlow = useCallback(() => {
    if (!activeWorkflowRecord) return;
    submitForReview(activeWorkflowRecord.id);
  }, [activeWorkflowRecord, submitForReview]);

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
      const workflowRec = activeWorkflowRecord;

      baseSummary = {
        customerId: profile.id,
        customerName: profile.name,
        hearingLossDescription: `${profile.hearingLossType}听力损失`,
        hearingAidModel:
          latestFitting?.hearingAid?.left?.model ||
          latestFitting?.hearingAid?.right?.model ||
          workflowRec?.hearingAidModel ||
          "",
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
        audiologist:
          latestFitting?.fitter ||
          workflowRec?.createdBy ||
          "听力师",
      };

      if (latestAudiogram?.pta) {
        baseSummary.keyMetrics.push(
          { label: "左耳PTA", value: String(latestAudiogram.pta.left), unit: "dB", trend: "stable" },
          { label: "右耳PTA", value: String(latestAudiogram.pta.right), unit: "dB", trend: "stable" },
        );
      } else if (workflowRec) {
        if (workflowRec.leftPta) {
          baseSummary.keyMetrics.push({ label: "左耳PTA", value: String(workflowRec.leftPta), unit: "dB", trend: "stable" });
        }
        if (workflowRec.rightPta) {
          baseSummary.keyMetrics.push({ label: "右耳PTA", value: String(workflowRec.rightPta), unit: "dB", trend: "stable" });
        }
      }

      if (latestAudiogram?.speechRecognitionScore) {
        const srs = latestAudiogram.speechRecognitionScore;
        if (srs.binaural) {
          baseSummary.keyMetrics.push({ label: "言语识别率", value: String(srs.binaural), unit: "%", trend: "up" });
        } else if (srs.left) {
          baseSummary.keyMetrics.push({ label: "左耳言语识别率", value: String(srs.left), unit: "%", trend: "up" });
        }
      } else if (workflowRec?.speechRecognitionRate) {
        baseSummary.keyMetrics.push({ label: "言语识别率", value: String(workflowRec.speechRecognitionRate), unit: "%", trend: "up" });
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
  }, [activeCustomerProfile, effectiveAggregate, activeWorkflowRecord, getLatestComparison]);

  const value: CustomerFlowContextValue = {
    activeCustomerId,
    activeStep,
    aggregate: effectiveAggregate,
    activeWorkflowRecord,
    activeCustomerProfile,
    summaryData,
    dataConsistency,
    isLoading,
    setActiveCustomerId,
    setActiveStep,
    goToNextStep,
    goToPrevStep,
    createFittingFromFlow,
    submitForReviewFromFlow,
    generateSummaryFromFlow,
    refreshFlow,
    getFlowProgress,
    getStepStatus,
    getCustomerWorkflowRecords,
    syncWorkflowToArchive,
    syncAllWorkflowToArchive,
    checkDataConsistency,
    fixDataConsistency,
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
