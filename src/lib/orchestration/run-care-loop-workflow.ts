"use client";

import {
  buildPreVisitAgentInput,
  runPreVisitAgent,
} from "@/lib/agents/pre-visit-agent";
import { buildOrchestrationSteps } from "@/lib/orchestration/step-definitions";
import { SEED } from "@/lib/seed-data";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { PrescriptionLine, UUID } from "@/types/workflow";
import type { PreVisitAgentOutput } from "@/types/pre-visit-agent";

export type RunCareLoopWorkflowInput = {
  patientId: UUID;
  appointmentId: UUID;
  providerId: UUID;
  pharmacyId: UUID;
  soapNote: string;
  treatmentPlan: string;
  prescriptionLines: PrescriptionLine[];
  /** Pause between steps so the UI can show progress (ms). */
  stepDelayMs?: number;
};

export type RunCareLoopWorkflowOptions = {
  /** When true, do not update `careLoopOrchestration` (e.g. judge demo drives its own UI). */
  silent?: boolean;
};

const ts = () => new Date().toISOString();

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function ensureOrchestrationSnap(snap: typeof SEED) {
  if (!snap.workflowTimeline) snap.workflowTimeline = [];
  if (!snap.patientWorkflowNotifications) snap.patientWorkflowNotifications = [];
  if (!snap.preVisitBriefingsByAppointment) snap.preVisitBriefingsByAppointment = {};
}

/**
 * Single entry point: simulates visit prep → plan → Rx → pharmacy → patient → payer
 * using the shared Zustand store so all portals update together.
 */
export async function runCareLoopWorkflow(
  input: RunCareLoopWorkflowInput,
  options?: RunCareLoopWorkflowOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const silent = options?.silent ?? false;
  const delay = silent
    ? (input.stepDelayMs ?? 0)
    : (input.stepDelayMs ?? 420);
  const store = useCareWorkflowStore.getState();
  const runGen = store.careLoopOrchestration.runGeneration + 1;

  if (!silent) {
    store.setCareLoopOrchestration({
      runGeneration: runGen,
      status: "running",
      currentStepIndex: 0,
      steps: buildOrchestrationSteps(0),
      errorMessage: undefined,
    });
  }

  const stale = () => {
    if (silent) return false;
    return (
      useCareWorkflowStore.getState().careLoopOrchestration.runGeneration !== runGen
    );
  };

  const setProgress = (finishedCount: number) => {
    if (silent || stale()) return;
    useCareWorkflowStore.getState().setCareLoopOrchestration({
      steps: buildOrchestrationSteps(finishedCount),
      currentStepIndex: Math.min(finishedCount, 7),
      status: "running",
    });
  };

  const patchSnap = (fn: (snap: typeof SEED) => void) => {
    useCareWorkflowStore.setState((s) => {
      const snap = structuredClone(s.snapshot);
      ensureOrchestrationSnap(snap);
      fn(snap);
      return { snapshot: snap };
    });
  };

  let preVisitBriefing: PreVisitAgentOutput | undefined;

  try {
    for (let step = 0; step < 8; step++) {
      setProgress(step);
      await sleep(delay);
      if (stale()) return { ok: false, error: "A newer workflow run started." };

      switch (step) {
        case 0: {
          const snap = useCareWorkflowStore.getState().snapshot;
          const clinical = snap.clinicalByPatientId[input.patientId];
          if (!clinical) throw new Error("No chart data for this patient.");
          const appt = snap.appointments.find((a) => a.id === input.appointmentId);
          if (!appt) throw new Error("Appointment not found.");
          if (appt.patientId !== input.patientId) {
            throw new Error("Appointment does not match the selected patient.");
          }
          if (appt.status === "scheduled") {
            useCareWorkflowStore.getState().openAppointment(input.appointmentId);
          }
          break;
        }
        case 1: {
          const snap = useCareWorkflowStore.getState().snapshot;
          const patient = snap.patients.find((p) => p.id === input.patientId);
          const appt = snap.appointments.find((a) => a.id === input.appointmentId);
          if (!patient || !appt) throw new Error("Patient or appointment missing.");
          const priorEncounters = snap.encounters
            .filter((e) => e.patientId === input.patientId)
            .sort((a, b) =>
              (b.endedAt ?? b.createdAt).localeCompare(a.endedAt ?? a.createdAt),
            );
          const clinical = snap.clinicalByPatientId[input.patientId];
          const pvInput = buildPreVisitAgentInput({
            patientId: patient.id,
            displayName: patient.displayName,
            appointmentReason: appt.title,
            clinical,
            priorEncounters,
          });
          preVisitBriefing = runPreVisitAgent(pvInput);
          break;
        }
        case 2: {
          if (!preVisitBriefing) throw new Error("Pre-visit agent did not produce a briefing.");
          useCareWorkflowStore
            .getState()
            .setPreVisitBriefingForAppointment(input.appointmentId, preVisitBriefing);
          break;
        }
        case 3: {
          useCareWorkflowStore.getState().saveProviderVisitDraft(input.appointmentId, {
            soapNote: input.soapNote,
            treatmentPlan: input.treatmentPlan,
          });
          break;
        }
        case 4: {
          const rx = useCareWorkflowStore.getState().snapshot.prescriptions.find(
            (p) => p.appointmentId === input.appointmentId,
          );
          if (!rx || rx.status !== "draft") {
            throw new Error("Prescription must be in draft to run the full loop.");
          }
          if (!input.prescriptionLines.length) {
            throw new Error("Add at least one medication line before running the workflow.");
          }
          useCareWorkflowStore.getState().finalizeEncounter({
            appointmentId: input.appointmentId,
            patientId: input.patientId,
            providerId: input.providerId,
            pharmacyId: input.pharmacyId,
            soapNote: input.soapNote,
            treatmentPlan: input.treatmentPlan,
            prescriptionLines: input.prescriptionLines,
          });
          break;
        }
        case 5: {
          const name =
            useCareWorkflowStore.getState().snapshot.patients.find(
              (p) => p.id === input.patientId,
            )?.displayName ?? "Patient";
          patchSnap((snap) => {
            snap.workflowTimeline.unshift({
              id: `orch_pharm_${Date.now()}`,
              occurredAt: ts(),
              title: "Orchestration: pharmacy routed",
              detail: `${name} — prescription queued for fulfillment (demo).`,
              patientId: input.patientId,
              appointmentId: input.appointmentId,
            });
          });
          break;
        }
        case 6: {
          const name =
            useCareWorkflowStore.getState().snapshot.patients.find(
              (p) => p.id === input.patientId,
            )?.displayName ?? "Patient";
          patchSnap((snap) => {
            snap.patientWorkflowNotifications.unshift({
              id: `orch_rem_${Date.now()}`,
              patientId: input.patientId,
              createdAt: ts(),
              title: "Reminders are on",
              body: "We’ll nudge you about pickup and quick check-ins after this visit.",
              source: "care_team",
            });
            snap.workflowTimeline.unshift({
              id: `orch_rem_tl_${Date.now()}`,
              occurredAt: ts(),
              title: "Orchestration: patient reminders",
              detail: `Reminder channels initialized for ${name}.`,
              patientId: input.patientId,
              appointmentId: input.appointmentId,
            });
          });
          break;
        }
        case 7: {
          const payer = useCareWorkflowStore.getState().snapshot.payerStatuses.find(
            (p) => p.appointmentId === input.appointmentId,
          );
          const score = payer?.closureCompletionScore ?? "—";
          patchSnap((snap) => {
            snap.workflowTimeline.unshift({
              id: `orch_pay_${Date.now()}`,
              occurredAt: ts(),
              title: "Orchestration: payer metrics",
              detail: `Closure tracking updated (demo score ${score}).`,
              patientId: input.patientId,
              appointmentId: input.appointmentId,
            });
          });
          break;
        }
        default:
          break;
      }

      setProgress(step + 1);
    }

    if (!silent && stale()) return { ok: false, error: "A newer workflow run started." };

    if (!silent) {
      useCareWorkflowStore.getState().setCareLoopOrchestration({
        status: "complete",
        currentStepIndex: 8,
        steps: buildOrchestrationSteps(8),
      });
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Workflow failed.";
    if (!silent) {
      const st = useCareWorkflowStore.getState().careLoopOrchestration;
      useCareWorkflowStore.getState().setCareLoopOrchestration({
        status: "error",
        errorMessage: msg,
        steps: st.steps.map((s) =>
          s.status === "active" ? { ...s, status: "error" as const } : s,
        ),
      });
    }
    return { ok: false, error: msg };
  }
}
