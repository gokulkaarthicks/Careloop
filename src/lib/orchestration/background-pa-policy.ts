"use client";

import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { UUID } from "@/types/workflow";
import { SEED_PAYER_PLANS } from "@/lib/benefits/seed-benefits-data";
import type { PolicyPaResolution } from "@/types/pa-policy";

/**
 * After finalize creates a PA case, runs **payer adjudication agent** in the background
 * (server Grok — no tag-based policy table).
 */
export function scheduleBackgroundPaPolicyResolution(args: {
  patientId: UUID;
  delayMs?: number;
}): void {
  const delay = args.delayMs ?? 2600;
  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    void runBackgroundPaPolicyResolution(args.patientId);
  }, delay);
}

type PaAdjudicateApiBody = {
  patientDisplayName: string;
  planName: string;
  planCode: string;
  planDocumentationNotes: string;
  drugLines: { drugName: string; lineIndex: number; caseId: string }[];
  clinicalSummaryJson: string;
};

export async function runBackgroundPaPolicyResolution(patientId: UUID): Promise<void> {
  const store = useCareWorkflowStore.getState();
  const snap = store.snapshot;
  const patient = snap.patients.find((p) => p.id === patientId);
  if (!patient) return;

  const pending = (snap.priorAuthCases ?? []).filter(
    (c) => c.status === "pending_review" && c.patientId === patientId,
  );
  if (pending.length === 0) return;

  store.pushWorkflowEngineEvent({
    kind: "background_pa_policy_started",
    title: "Payer policy agent — running",
    detail: "Automated adjudication (LLM; no human triage step).",
    patientId,
    prescriptionId: pending[0]?.prescriptionId,
    role: "payer",
  });

  const plan =
    SEED_PAYER_PLANS.find((p) => p.id === patient.insurancePlanId) ??
    SEED_PAYER_PLANS[0];

  const clinical = snap.clinicalByPatientId[patientId];
  const clinicalSummaryJson = clinical ?
    JSON.stringify({
      diagnoses: clinical.diagnoses,
      medications: clinical.medications,
      allergies: clinical.allergies,
      recentVitals: clinical.recentVitals,
    })
  : "{}";

  const body: PaAdjudicateApiBody = {
    patientDisplayName: patient.displayName,
    planName: plan.name,
    planCode: plan.planCode,
    planDocumentationNotes: plan.documentationNotes,
    drugLines: pending.map((c) => ({
      drugName: c.drugName,
      lineIndex: c.lineIndex,
      caseId: c.id,
    })),
    clinicalSummaryJson,
  };

  let finalPolicy: PolicyPaResolution;
  let adjudicationNotes: string | undefined;
  let nextWorkflowSteps: string[] | undefined;

  try {
    const res = await fetch("/api/ai/pa-adjudicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      decision?: PolicyPaResolution;
      adjudicationNotes?: string;
      nextWorkflowSteps?: string[];
    };
    if (!res.ok) {
      throw new Error(data.error ?? `PA adjudicate HTTP ${res.status}`);
    }
    if (!data.decision) {
      throw new Error("PA adjudicate: missing decision");
    }
    finalPolicy = data.decision;
    adjudicationNotes = data.adjudicationNotes;
    nextWorkflowSteps = data.nextWorkflowSteps;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PA adjudication failed";
    store.pushWorkflowEngineEvent({
      kind: "background_pa_policy_completed",
      title: "Payer policy agent — error",
      detail: msg,
      patientId,
      prescriptionId: pending[0]?.prescriptionId,
      role: "payer",
    });
    return;
  }

  if (finalPolicy === "manual_queue") {
    store.pushWorkflowEngineEvent({
      kind: "background_pa_policy_completed",
      title: "PA left in payer manual queue",
      detail:
        [adjudicationNotes, ...(nextWorkflowSteps ?? [])].filter(Boolean).join(" · ") ||
        "Agent routed to manual review queue.",
      patientId,
      prescriptionId: pending[0]?.prescriptionId,
      role: "payer",
    });
    return;
  }

  const resolution =
    finalPolicy === "approved" ? "approved"
    : finalPolicy === "denied" ? "denied"
    : "more_info";

  for (const c of pending) {
    store.resolvePriorAuthCase(c.id, resolution);
  }

  store.pushWorkflowEngineEvent({
    kind: "background_pa_policy_completed",
    title: `Payer policy agent — ${resolution}`,
    detail:
      [adjudicationNotes, ...(nextWorkflowSteps ?? []).slice(0, 3)].filter(Boolean).join(" · ") ||
      "Case processed by payer adjudication agent.",
    patientId,
    prescriptionId: pending[0]?.prescriptionId,
    role: "payer",
  });
}
