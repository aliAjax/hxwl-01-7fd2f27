import { useMemo } from "react";
import { useArchive } from "../../archive/ArchiveContext";
import { useWorkflow } from "../../workflow/WorkflowContext";
import type { CustomerAggregate, CustomerProfile } from "../../archive/archive.types";
import type { WorkflowFittingRecord } from "../../workflow/workflow.types";

interface UseFlowAggregateParams {
  activeCustomerId: string | null;
  isConsistent: boolean;
}

export function useFlowAggregate({ activeCustomerId, isConsistent }: UseFlowAggregateParams) {
  const { aggregate } = useArchive();
  const { state: workflowState, getFilteredRecords } = useWorkflow();

  const effectiveAggregate = useMemo(
    () => (isConsistent ? aggregate : null),
    [isConsistent, aggregate]
  );

  const activeCustomerProfile = useMemo(
    () => effectiveAggregate?.profile || null,
    [effectiveAggregate]
  );

  const activeWorkflowRecords = useMemo(() => {
    if (!activeCustomerProfile) return [];
    const allRecords = getFilteredRecords();
    return allRecords
      .filter(
        (r) =>
          r.customerId === activeCustomerProfile.id ||
          r.customerId === activeCustomerProfile.customerNo
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [activeCustomerProfile, getFilteredRecords]);

  const activeLatestWorkflowRecord =
    activeWorkflowRecords.length > 0 ? activeWorkflowRecords[0] : null;

  return {
    effectiveAggregate,
    activeCustomerProfile,
    activeWorkflowRecords,
    activeLatestWorkflowRecord,
    workflowRecords: workflowState.records
  };
}
