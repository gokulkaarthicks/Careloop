"use client";

import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { UUID } from "@/types/workflow";

/**
 * Refill coordination agent — server Grok evaluates each active Rx and emits workflow events.
 */
export function runRefillEligibilityAgent(patientId: UUID): void {
  void runRefillEligibilityAgentAsync(patientId);
}

export async function runRefillEligibilityAgentAsync(
  patientId: UUID,
): Promise<void> {
  const store = useCareWorkflowStore.getState();
  const snap = store.snapshot;
  const patient = snap.patients.find((p) => p.id === patientId);
  if (!patient) return;

  const rxList = snap.prescriptions.filter((r) => r.patientId === patientId);

  store.pushWorkflowEngineEvent({
    kind: "orchestrator_tick",
    title: "Orchestrator: patient portal check-in",
    detail: "Running refill coordination agent (LLM).",
    patientId,
    role: "system",
  });

  const active = rxList.filter(
    (r) =>
      r.status === "picked_up" ||
      r.status === "ready_for_pickup" ||
      r.status === "received_by_pharmacy",
  );

  if (active.length === 0) {
    store.pushWorkflowEngineEvent({
      kind: "refill_eligibility_evaluated",
      title: "Refill agent: no active fill",
      detail: "Awaiting pharmacy fulfillment or pickup before scheduling refill.",
      patientId,
      role: "system",
    });
    return;
  }

  const lines = active.flatMap((rx) =>
    rx.lines.map((l) => ({
      prescriptionId: rx.id,
      drugName: l.drugName,
      quantity: l.quantity,
      refills: l.refills ?? 0,
      status: rx.status,
    })),
  );

  try {
    const res = await fetch("/api/ai/refill-eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientDisplayName: patient.displayName,
        lines,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      evaluations?: {
        prescriptionId: string;
        eligible: boolean;
        patientInstructions: string;
        nextWorkflowSteps: string[];
        suggestedDaysUntilRefill?: number;
      }[];
    };
    if (!res.ok) {
      throw new Error(data.error ?? `Refill agent HTTP ${res.status}`);
    }
    if (!data.evaluations?.length) {
      throw new Error("Refill agent: empty evaluations");
    }

    for (const ev of data.evaluations) {
      const detail = [
        ev.patientInstructions,
        `Eligible: ${ev.eligible ? "yes" : "no"}`,
        ev.suggestedDaysUntilRefill != null ?
          `Suggested days until refill request: ~${ev.suggestedDaysUntilRefill}`
        : null,
        `Workflow: ${ev.nextWorkflowSteps.join("; ")}`,
      ]
        .filter(Boolean)
        .join(" · ");

      store.pushWorkflowEngineEvent({
        kind: "refill_eligibility_evaluated",
        title: `Refill agent: ${ev.prescriptionId}`,
        detail,
        patientId,
        prescriptionId: ev.prescriptionId as UUID,
        role: "system",
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refill agent failed";
    store.pushWorkflowEngineEvent({
      kind: "refill_eligibility_evaluated",
      title: "Refill agent: error",
      detail: msg,
      patientId,
      role: "system",
    });
  }
}
