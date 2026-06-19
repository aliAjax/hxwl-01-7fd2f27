import { useEffect, useCallback, useRef } from "react";
import { useWorkflow } from "../../workflow/WorkflowContext";
import { syncWorkflowWithArchive } from "../workflowSync";
import type { CustomerAggregate } from "../../archive/archive.types";
import type { WorkflowFittingRecord } from "../../workflow/workflow.types";

interface UseWorkflowSyncParams {
  activeCustomerId: string | null;
  effectiveAggregate: CustomerAggregate | null;
  workflowRecords: WorkflowFittingRecord[];
  customersLength: number;
}

export function useWorkflowSync({
  activeCustomerId,
  effectiveAggregate,
  workflowRecords,
  customersLength
}: UseWorkflowSyncParams) {
  const { createRecord, updateRecord } = useWorkflow();

  const syncFnRef = useRef(syncWorkflowWithArchive);
  syncFnRef.current = syncWorkflowWithArchive;

  useEffect(() => {
    if (activeCustomerId && customersLength > 0) {
      syncFnRef.current(
        activeCustomerId,
        effectiveAggregate,
        workflowRecords,
        createRecord,
        updateRecord
      );
    }
  }, [
    activeCustomerId,
    customersLength,
    effectiveAggregate,
    workflowRecords,
    createRecord,
    updateRecord
  ]);

  const syncFlowWorkflow = useCallback(async () => {
    if (activeCustomerId) {
      syncWorkflowWithArchive(
        activeCustomerId,
        effectiveAggregate,
        workflowRecords,
        createRecord,
        updateRecord
      );
    }
  }, [activeCustomerId, effectiveAggregate, workflowRecords, createRecord, updateRecord]);

  return { syncFlowWorkflow };
}
