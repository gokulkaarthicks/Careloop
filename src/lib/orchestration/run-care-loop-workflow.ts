"use client";

import { buildPreVisitAgentInput } from "@/lib/agents/pre-visit-agent";
import { fetchPreVisitOutput } from "@/lib/agents/pre-visit-fetch";
import { runAgenticEncounterPipeline } from "@/lib/agentic/encounter-pipeline";
import { runBackgroundPaPolicyResolution } from "@/lib/orchestration/background-pa-policy";
import { buildOrchestrationSteps } from "@/lib/orchestration/step-definitions";
import { SEED } from "@/lib/seed-data";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { newEncounterRunId, outcomeLabelFromCoverage } from "@/types/agentic";
import {
  type ChartInferenceReview,
  type PrescriptionLine,
  type UUID,
} from "@/types/workflow";
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
          preVisitBriefing = await fetchPreVisitOutput(pvInput);
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

          const patient =
            useCareWorkflowStore
              .getState()
              .snapshot.patients.find((p) => p.id === input.patientId) ?? null;
          const priorAuthCases = useCareWorkflowStore
            .getState()
            .snapshot.priorAuthCases.filter((c) => c.patientId === input.patientId);

          let pipeline: Awaited<ReturnType<typeof runAgenticEncounterPipeline>> | null =
            null;
          try {
            pipeline = await runAgenticEncounterPipeline(
              {
                patientDisplayName: patient?.displayName ?? "Patient",
                patientId: input.patientId,
                appointmentId: input.appointmentId,
                clinical:
                  useCareWorkflowStore.getState().snapshot.clinicalByPatientId[
                    input.patientId
                  ] ?? null,
                prescriptionLines: input.prescriptionLines,
                treatmentPlan: input.treatmentPlan,
                pharmacyId: input.pharmacyId,
                insurancePlanId: patient?.insurancePlanId,
                preferredPharmacyId: patient?.preferredPharmacyId,
                priorAuthCases,
              },
              () => {},
            );
          } catch (e) {
            useCareWorkflowStore.getState().pushWorkflowEngineEvent({
              kind: "encounter_agent_trace",
              title: "Encounter finalize fallback",
              detail:
                e instanceof Error ? e.message : "Encounter pipeline unavailable",
              trigger: "Judge/demo orchestration step",
              decision: "Fallback to deterministic finalize",
              action: "Finalize without agent bundle",
              result: "Demo continues with workflow state transitions",
              reason: "Allows one-click demo even when AI credentials are missing.",
              patientId: input.patientId,
              role: "system",
            });
          }

          const mergedSoap = pipeline ?
            `${input.soapNote.trim()}\n${pipeline.soapAddendum}`.trim()
          : input.soapNote;
          const runId = newEncounterRunId();
          useCareWorkflowStore.getState().finalizeEncounter({
            appointmentId: input.appointmentId,
            patientId: input.patientId,
            providerId: input.providerId,
            pharmacyId: input.pharmacyId,
            soapNote: mergedSoap,
            treatmentPlan: input.treatmentPlan,
            prescriptionLines: input.prescriptionLines,
            coverage: pipeline?.coverage,
            agentRun: pipeline ?
              {
                runId,
                appointmentId: input.appointmentId,
                patientId: input.patientId,
                tools: pipeline.toolLoopTrace ?? [],
                routingSummary: pipeline.paDecisions,
                soapAddendum: pipeline.soapAddendum,
                coveragePlanName: pipeline.coverage.plan.name,
                outcomeLabel: outcomeLabelFromCoverage({
                  holdForPriorAuth: pipeline.coverage.holdForPriorAuth,
                  anyStepTherapyBlock: pipeline.coverage.anyStepTherapyBlock,
                }),
                timelineEntryTitles: pipeline.timelineEntries.map((e) => e.title),
              }
            : undefined,
          });

          useCareWorkflowStore.getState().pushWorkflowEngineEvent({
            kind: "encounter_agent_trace",
            title: `Orchestrator run ${runId.slice(-14)}`,
            detail:
              "Demo orchestrator used the same encounter workflow pipeline as Provider finalize.",
            trigger: "Judge/demo orchestration step",
            decision: "Use encounter finalize workflow path",
            action: "Run tool loop + coverage adjudication before state mutation",
            result: "Demo and provider paths now share branching semantics",
            patientId: input.patientId,
            role: "system",
          });

          if (pipeline?.coverage.holdForPriorAuth) {
            await runBackgroundPaPolicyResolution(input.patientId);
          }

          const postSnap = useCareWorkflowStore.getState().snapshot;
          const postClinical = postSnap.clinicalByPatientId[input.patientId];
          const chartRes = await fetch("/api/ai/chart-inference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appointmentId: input.appointmentId,
              patientId: input.patientId,
              clinical: postClinical,
              soapNote: mergedSoap,
              treatmentPlan: input.treatmentPlan,
            }),
          });
          const chartPayload = (await chartRes.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!chartRes.ok) {
            throw new Error(chartPayload.error ?? `Chart inference failed (${chartRes.status})`);
          }
          useCareWorkflowStore
            .getState()
            .setChartInferenceForAppointment(
              input.appointmentId,
              chartPayload as ChartInferenceReview,
            );

          if (pipeline) {
            for (const row of pipeline.timelineEntries) {
              useCareWorkflowStore.getState().pushWorkflowTimelineEntry({
                title: row.title,
                detail: row.detail,
                patientId: input.patientId,
                appointmentId: input.appointmentId,
              });
            }
            if (pipeline.patientNotification) {
              useCareWorkflowStore.getState().pushAgenticPatientNotification(
                input.patientId,
                pipeline.patientNotification.title,
                pipeline.patientNotification.body,
              );
            }
          }
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
