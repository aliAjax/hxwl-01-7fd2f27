import { useCallback } from "react";
import type { FlowStep } from "./useFlowTypes";
import { FLOW_STEPS } from "./useFlowTypes";
import type { CustomerAggregate } from "../../archive/archive.types";
import type { WorkflowFittingRecord } from "../../workflow/workflow.types";
import type { FittingSummaryData } from "../../summary/summary.types";

type StepStatus = "completed" | "current" | "pending" | "unavailable";

interface UseStepStatusParams {
  activeStep: FlowStep;
  effectiveAggregate: CustomerAggregate | null;
  activeWorkflowRecords: WorkflowFittingRecord[];
  activeLatestWorkflowRecord: WorkflowFittingRecord | null;
  summaryData: FittingSummaryData | null;
}

export function useStepStatus({
  activeStep,
  effectiveAggregate,
  activeWorkflowRecords,
  activeLatestWorkflowRecord,
  summaryData,
}: UseStepStatusParams) {
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

  const getStepStatus = useCallback((step: FlowStep): StepStatus => {
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

  return { getFlowProgress, getStepStatus };
}
