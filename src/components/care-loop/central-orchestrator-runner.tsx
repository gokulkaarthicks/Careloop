"use client";

import { runCentralOrchestratorAgent } from "@/lib/orchestration/central-orchestrator-agent";
import { ORCHESTRATION_TIMING } from "@/lib/orchestration/orchestration-timing";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { useEffect, useRef } from "react";

/**
 * Keeps the care loop progressing without requiring manual button presses.
 * The orchestrator is lightweight and idempotent, so periodic ticks are safe.
 */
export function CentralOrchestratorRunner() {
  const selectedPatientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async (source: string) => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await runCentralOrchestratorAgent({
          patientId: selectedPatientId ?? undefined,
          source,
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick("route mount");
    const id = window.setInterval(() => {
      void tick("interval");
    }, ORCHESTRATION_TIMING.runnerTickMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedPatientId]);

  return null;
}

