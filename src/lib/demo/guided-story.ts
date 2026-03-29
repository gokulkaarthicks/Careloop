"use client";

import {
  DEMO_RX_LINES,
  DEMO_SOAP_NOTE,
  DEMO_TREATMENT_PLAN,
} from "@/lib/demo/canned-plan";
import type { GuidedStoryStepDef } from "@/lib/demo/guided-story-types";
import { SEED_DEMO_ROUTE } from "@/lib/seed-data";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";

const TOTAL_STEPS = 8;

export const GUIDED_STORY_STEPS: GuidedStoryStepDef[] = [
  {
    id: "open",
    title: "Open encounter",
    description: "Provider opens the scheduled visit and moves chart context into the visit lane.",
  },
  {
    id: "ai",
    title: "AI summarizes chart",
    description: "History, problems, and narrative summary load for shared situational awareness.",
  },
  {
    id: "risks",
    title: "Review gaps & risks",
    description: "Suggested questions and risk flags are visible; draft SOAP, plan, and Rx lines are prepared.",
  },
  {
    id: "finalize",
    title: "Finalize treatment",
    description: "Encounter is signed — care plan and prescription are committed to the record.",
  },
  {
    id: "route",
    title: "Prescription routed",
    description: "E-Rx is transmitted to the pharmacy queue and appears on fulfillment screens.",
  },
  {
    id: "patient",
    title: "Patient instructions",
    description: "Visit summary and pickup cues surface in the patient app inbox.",
  },
  {
    id: "pharmacy",
    title: "Pharmacy pickup",
    description: "Pharmacy marks the order ready and confirms handoff at the counter.",
  },
  {
    id: "payer",
    title: "Payer closure",
    description: "Claim and closure metrics update on the payer reporting dashboard.",
  },
];

function ensureWorkflowArrays(snap: ReturnType<typeof useCareWorkflowStore.getState>["snapshot"]) {
  if (!snap.workflowTimeline) snap.workflowTimeline = [];
  if (!snap.patientWorkflowNotifications) snap.patientWorkflowNotifications = [];
}

const ts = () => new Date().toISOString();

/**
 * Runs the next scripted action in the guided story (Jordan cohort).
 */
export async function advanceGuidedStoryStep(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const store = useCareWorkflowStore.getState();
  const gs = store.guidedStory;
  if (gs.nextStepIndex >= TOTAL_STEPS) {
    return { ok: false, error: "Story is already complete." };
  }
  if (gs.status === "advancing") {
    return { ok: false, error: "Wait for the current step to finish." };
  }

  store.setGuidedStory({
    status: "advancing",
    errorMessage: undefined,
  });

  const route = SEED_DEMO_ROUTE;

  try {
    const step = useCareWorkflowStore.getState().guidedStory.nextStepIndex;
    const api = useCareWorkflowStore.getState();

    switch (step) {
      case 0: {
        api.selectPatient(route.patientId);
        api.setSelectedAppointmentId(route.appointmentId);
        api.openAppointment(route.appointmentId);
        break;
      }
      case 1: {
        await api.generateChartSummary(route.patientId);
        break;
      }
      case 2: {
        api.saveProviderVisitDraft(route.appointmentId, {
          soapNote: DEMO_SOAP_NOTE,
          treatmentPlan: DEMO_TREATMENT_PLAN,
        });
        api.createPrescription({
          appointmentId: route.appointmentId,
          lines: DEMO_RX_LINES,
        });
        break;
      }
      case 3: {
        api.finalizeEncounter({
          appointmentId: route.appointmentId,
          patientId: route.patientId,
          providerId: route.providerId,
          pharmacyId: route.pharmacyId,
          soapNote: DEMO_SOAP_NOTE,
          treatmentPlan: DEMO_TREATMENT_PLAN,
          prescriptionLines: DEMO_RX_LINES,
        });
        const rxAfter = useCareWorkflowStore.getState().snapshot.prescriptions.find(
          (p) => p.id === route.rxId,
        );
        if (rxAfter?.status === "draft") {
          throw new Error(
            "Encounter did not finalize — reset cohort with “Restart story” and try again.",
          );
        }
        break;
      }
      case 4: {
        useCareWorkflowStore.setState((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowArrays(snap);
          snap.workflowTimeline.unshift({
            id: `wt_guided_rx_${Date.now()}`,
            occurredAt: ts(),
            title: "E-Rx transmitted",
            detail:
              "Prescription routed to pharmacy — visible in Harborview queue and patient timeline.",
            patientId: route.patientId,
            prescriptionId: route.rxId,
            appointmentId: route.appointmentId,
          });
          return { snapshot: snap };
        });
        break;
      }
      case 5: {
        useCareWorkflowStore.setState((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowArrays(snap);
          snap.patientWorkflowNotifications.unshift({
            id: `pwn_guided_sum_${Date.now()}`,
            patientId: route.patientId,
            createdAt: ts(),
            title: "Your visit summary is ready",
            body: "Tap Care Orchestrator for medication instructions and next steps from today’s visit.",
            source: "care_team",
          });
          return { snapshot: snap };
        });
        break;
      }
      case 6: {
        api.pharmacyMarkReady(route.rxId);
        api.pharmacyMarkPickedUp(route.rxId);
        break;
      }
      case 7: {
        api.payerMarkComplete(route.payerStatusId, "paid");
        break;
      }
      default:
        break;
    }

    const next = step + 1;
    useCareWorkflowStore.getState().setGuidedStory({
      nextStepIndex: next,
      status: next >= TOTAL_STEPS ? "complete" : "idle",
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Step failed.";
    useCareWorkflowStore.getState().setGuidedStory({
      status: "error",
      errorMessage: msg,
    });
    return { ok: false, error: msg };
  }
}

/** Full reset: cohort + story index (use before a fresh guided run). */
export function restartGuidedStoryWithCohortReset(): void {
  useCareWorkflowStore.getState().resetDemo();
}

export { TOTAL_STEPS as GUIDED_STORY_TOTAL_STEPS };
