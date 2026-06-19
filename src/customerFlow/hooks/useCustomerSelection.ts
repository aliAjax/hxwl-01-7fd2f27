import { useState, useCallback } from "react";
import { useArchive } from "../../archive/ArchiveContext";
import type { FlowStep } from "./useFlowTypes";

export function useCustomerSelection() {
  const { selectCustomer, selectedCustomerId } = useArchive();
  const [activeCustomerId, setActiveCustomerIdState] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStep>("profile");

  const setActiveCustomerId = useCallback(
    async (id: string | null) => {
      setActiveCustomerIdState(id);
      if (id) {
        await selectCustomer(id);
      }
      setActiveStep("profile");
    },
    [selectCustomer]
  );

  const refreshFlow = useCallback(async () => {
    if (activeCustomerId) {
      await selectCustomer(activeCustomerId);
    }
  }, [activeCustomerId, selectCustomer]);

  const isConsistent = activeCustomerId === selectedCustomerId;

  return {
    activeCustomerId,
    activeStep,
    setActiveCustomerId,
    setActiveStep,
    refreshFlow,
    selectedCustomerId,
    isConsistent
  };
}
