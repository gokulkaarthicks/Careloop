"use client";

import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { UUID } from "@/types/workflow";

/**
 * Chained agents after pickup — adherence tracking start + refill pipeline kickoff.
 * Invoked from store after medication pickup (dynamic import avoids circular deps).
 */
export function runPostPickupAgenticChain(
  patientId: UUID,
  prescriptionId: UUID,
): void {
  const store = useCareWorkflowStore.getState();
  store.pushWorkflowEngineEvent({
    kind: "medication_picked_up",
    title: "Fulfillment agent: pickup recorded",
    detail: "Starting adherence + refill monitoring chain.",
    patientId,
    prescriptionId,
    role: "system",
  });
  store.pushWorkflowEngineEvent({
    kind: "adherence_started",
    title: "Adherence agent: monitoring window open",
    detail: "Home dosing / check-in prompts enabled for this medication (demo).",
    patientId,
    prescriptionId,
    role: "patient",
  });

  /** Defer refill evaluation so state is settled */
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      void import("@/lib/orchestration/refill-agent").then((m) =>
        m.runRefillEligibilityAgent(patientId),
      );
    }, 400);
  }
}
