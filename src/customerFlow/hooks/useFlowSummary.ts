import { useState, useCallback } from "react";
import { useArchive } from "../../archive/ArchiveContext";
import { getSummaryByCustomerId } from "../../summary/summary.sampleData";
import type { FittingSummaryData } from "../../summary/summary.types";
import { comparisonToKeyMetrics, getComparisonSummaryText } from "../../comparison/comparison.utils";
import type { CustomerAggregate, CustomerProfile, FittingRecord } from "../../archive/archive.types";
import type { WorkflowFittingRecord } from "../../workflow/workflow.types";

interface UseFlowSummaryParams {
  activeCustomerProfile: CustomerProfile | null;
  effectiveAggregate: CustomerAggregate | null;
  activeLatestWorkflowRecord: WorkflowFittingRecord | null;
}

export function useFlowSummary({
  activeCustomerProfile,
  effectiveAggregate,
  activeLatestWorkflowRecord,
}: UseFlowSummaryParams) {
  const { getLatestComparison } = useArchive();
  const [summaryData, setSummaryData] = useState<FittingSummaryData | null>(null);

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
      baseSummary = buildSummaryFromAggregate(profile, agg, activeLatestWorkflowRecord);
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

  const resetSummary = useCallback(() => {
    setSummaryData(null);
  }, []);

  return { summaryData, generateSummaryFromFlow, resetSummary };
}

function buildSummaryFromAggregate(
  profile: CustomerProfile,
  agg: CustomerAggregate | null,
  latestWorkflow: WorkflowFittingRecord | null
): FittingSummaryData {
  const latestFitting = agg?.fittings[0];
  const latestAudiogram = agg?.audiograms[0];

  const baseSummary: FittingSummaryData = {
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

  return baseSummary;
}
