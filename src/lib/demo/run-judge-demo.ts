"use client";

import { DEMO_RX_LINES, DEMO_SOAP_NOTE, DEMO_TREATMENT_PLAN } from "@/lib/demo/canned-plan";
import { captureDemoMetrics } from "@/lib/demo/metrics";
import {
  buildJudgeDemoSteps,
} from "@/lib/demo/step-definitions";
import { runCareLoopWorkflow } from "@/lib/orchestration/run-care-loop-workflow";
import { SEED_DEMO_ROUTE } from "@/lib/seed-data";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";

const STEP_PAUSE_MS = 260;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Single-click demo for judges: resets cohort, runs chart → plan → Rx → pharmacy →
 * patient → payer using canned inputs, with visible step progress on the dashboard.
 * Target wall time: well under 60 seconds.
 */
export async function runJudgeDemo(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const gen = useCareWorkflowStore.getState().judgeDemo.runGeneration + 1;

  useCareWorkflowStore.getState().setJudgeDemo({
    runGeneration: gen,
    status: "running",
    currentStepIndex: 0,
    steps: buildJudgeDemoSteps(0),
    beforeMetrics: null,
    afterMetrics: null,
    errorMessage: undefined,
  });

  const stale = () =>
    useCareWorkflowStore.getState().judgeDemo.runGeneration !== gen;

  const progress = (finishedCount: number) => {
    if (stale()) return;
    useCareWorkflowStore.getState().setJudgeDemo({
      steps: buildJudgeDemoSteps(finishedCount),
      currentStepIndex: Math.min(finishedCount, 7),
      status: "running",
    });
  };

  try {
    for (let step = 0; step < 8; step++) {
      progress(step);
      await sleep(STEP_PAUSE_MS);
      if (stale()) return { ok: false, error: "A newer demo run started." };

      const api = useCareWorkflowStore.getState();

      switch (step) {
        case 0: {
          api.resetDemo();
          await sleep(80);
          const before = captureDemoMetrics(
            useCareWorkflowStore.getState().snapshot,
            SEED_DEMO_ROUTE.patientId,
          );
          if (stale()) return { ok: false, error: "Cancelled." };
          useCareWorkflowStore.getState().setJudgeDemo({ beforeMetrics: before });
          break;
        }
        case 1: {
          api.selectPatient(SEED_DEMO_ROUTE.patientId);
          api.setSelectedAppointmentId(SEED_DEMO_ROUTE.appointmentId);
          api.openAppointment(SEED_DEMO_ROUTE.appointmentId);
          break;
        }
        case 2: {
          await api.generateChartSummary(SEED_DEMO_ROUTE.patientId);
          break;
        }
        case 3: {
          const inner = await runCareLoopWorkflow(
            {
              patientId: SEED_DEMO_ROUTE.patientId,
              appointmentId: SEED_DEMO_ROUTE.appointmentId,
              providerId: SEED_DEMO_ROUTE.providerId,
              pharmacyId: SEED_DEMO_ROUTE.pharmacyId,
              soapNote: DEMO_SOAP_NOTE,
              treatmentPlan: DEMO_TREATMENT_PLAN,
              prescriptionLines: DEMO_RX_LINES,
              stepDelayMs: 0,
            },
            { silent: true },
          );
          if (!inner.ok) throw new Error(inner.error);
          break;
        }
        case 4: {
          api.pharmacyMarkReady(SEED_DEMO_ROUTE.rxId);
          break;
        }
        case 5: {
          api.pharmacyMarkPickedUp(SEED_DEMO_ROUTE.rxId);
          break;
        }
        case 6: {
          const st = useCareWorkflowStore.getState();
          st.patientLogMedicationTaken(SEED_DEMO_ROUTE.patientId);
          const pending = st.snapshot.adherenceChecks.filter(
            (c) =>
              c.patientId === SEED_DEMO_ROUTE.patientId &&
              c.status === "pending",
          );
          for (const c of pending) {
            useCareWorkflowStore.getState().patientCompleteAdherenceCheck(c.id);
          }
          break;
        }
        case 7:
        default:
          break;
      }

      progress(step + 1);
    }

    if (stale()) return { ok: false, error: "Cancelled." };

    const after = captureDemoMetrics(
      useCareWorkflowStore.getState().snapshot,
      SEED_DEMO_ROUTE.patientId,
    );

    useCareWorkflowStore.getState().setJudgeDemo({
      status: "complete",
      currentStepIndex: 8,
      steps: buildJudgeDemoSteps(8),
      afterMetrics: after,
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Demo failed.";
    useCareWorkflowStore.getState().setJudgeDemo({
      status: "error",
      errorMessage: msg,
    });
    return { ok: false, error: msg };
  }
}
