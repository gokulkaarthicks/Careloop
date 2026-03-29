"use client";

import { DEMO_RX_LINES, DEMO_SOAP_NOTE, DEMO_TREATMENT_PLAN } from "@/lib/demo/canned-plan";
import { captureDemoMetrics } from "@/lib/demo/metrics";
import { buildJudgeDemoSteps, JUDGE_DEMO_STEP_DEFS } from "@/lib/demo/step-definitions";
import { runPaAppealsNavigator } from "@/lib/recovery/pa-auto-fighter";
import { runRecoveryAutopilot } from "@/lib/recovery/recovery-orchestrator";
import { runCareLoopWorkflow } from "@/lib/orchestration/run-care-loop-workflow";
import { runCentralOrchestratorAgent } from "@/lib/orchestration/central-orchestrator-agent";
import { SEED_DEMO_ROUTE } from "@/lib/seed-data";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { UUID } from "@/types/workflow";

const STEP_PAUSE_MS = 320;
const PORTAL_SWITCH_PAUSE_MS = 10_000;

const STEP_PORTAL_BY_ID: Record<
  string,
  "/dashboard" | "/provider" | "/pharmacy" | "/patient" | "/payer"
> = {
  reset: "/dashboard",
  admission: "/provider",
  ai: "/provider",
  soap: "/provider",
  plan: "/provider",
  rx: "/provider",
  runreport: "/provider",
  clinical: "/provider",
  dash1: "/dashboard",
  pharmacy_hold: "/pharmacy",
  payer_approve: "/payer",
  pharmacy_ready: "/pharmacy",
  patient_checkin: "/patient",
  timefast: "/provider",
  paopen: "/payer",
  recovery: "/dashboard",
  dashboard: "/dashboard",
};

const STEP_SCRIPT: Record<
  string,
  {
    activePortal: "dashboard" | "provider" | "pharmacy" | "patient" | "payer";
    inputFocus: string;
    expectedUpdate: string;
  }
> = {
  reset: {
    activePortal: "dashboard",
    inputFocus: "No input. Reset baseline.",
    expectedUpdate: "Fresh state seeded for the demo.",
  },
  admission: {
    activePortal: "provider",
    inputFocus: "Provider opens encounter.",
    expectedUpdate: "Encounter becomes active.",
  },
  ai: {
    activePortal: "provider",
    inputFocus: "Provider waits for AI summary.",
    expectedUpdate: "Chart context appears in workspace.",
  },
  soap: {
    activePortal: "provider",
    inputFocus: "Provider types SOAP section.",
    expectedUpdate: "SOAP draft saved.",
  },
  plan: {
    activePortal: "provider",
    inputFocus: "Provider types treatment plan.",
    expectedUpdate: "Plan draft saved.",
  },
  rx: {
    activePortal: "provider",
    inputFocus: "Provider enters Rx details.",
    expectedUpdate: "Prescription draft appears.",
  },
  runreport: {
    activePortal: "provider",
    inputFocus: "Provider run-report view cue.",
    expectedUpdate: "Run report context visible after finalize.",
  },
  clinical: {
    activePortal: "provider",
    inputFocus: "Provider clicks Finalize encounter.",
    expectedUpdate: "Routing decision is generated.",
  },
  dash1: {
    activePortal: "dashboard",
    inputFocus: "No input. Observe dashboard progress.",
    expectedUpdate: "Closed-loop checkpoint updates.",
  },
  pharmacy_hold: {
    activePortal: "pharmacy",
    inputFocus: "No input. Observe PA hold state.",
    expectedUpdate: "Pharmacy waits on payer approval.",
  },
  payer_approve: {
    activePortal: "payer",
    inputFocus: "Payer approval action simulated.",
    expectedUpdate: "Medication released to pharmacy.",
  },
  pharmacy_ready: {
    activePortal: "pharmacy",
    inputFocus: "Pharmacy marks ready/picked-up.",
    expectedUpdate: "Fulfillment milestones complete.",
  },
  patient_checkin: {
    activePortal: "patient",
    inputFocus: "Patient logs adherence/check-in.",
    expectedUpdate: "Patient timeline and payer score update.",
  },
  timefast: {
    activePortal: "provider",
    inputFocus: "No input. Time jump simulation.",
    expectedUpdate: "Auto-reschedule is triggered.",
  },
  paopen: {
    activePortal: "payer",
    inputFocus: "Worst-case denial is forced.",
    expectedUpdate: "Recovery trigger event created.",
  },
  recovery: {
    activePortal: "dashboard",
    inputFocus: "No input. Recovery autopilot runs.",
    expectedUpdate: "Recovery inbox + appeal + SLA updates appear.",
  },
  dashboard: {
    activePortal: "dashboard",
    inputFocus: "No input. Final command-center review.",
    expectedUpdate: "End-to-end journey visible across roles.",
  },
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export type RunJudgeDemoOptions = {
  /** If set, navigates to the matching portal at each step so the demo is visible on Provider, Pharmacy, Patient, Payer, etc. */
  navigate?: (path: string) => void;
  /** Extra delay after navigation so the page can paint (default 420). */
  navSettleMs?: number;
};

function routeForPatient(patientId: UUID): {
  patientId: UUID;
  appointmentId: UUID;
  providerId: UUID;
  pharmacyId: UUID;
} {
  const snap = useCareWorkflowStore.getState().snapshot;
  const appt = snap.appointments.find((a) => a.patientId === patientId);
  const patient = snap.patients.find((p) => p.id === patientId);
  if (!appt) {
    throw new Error(`No appointment available for patient ${patientId}`);
  }
  return {
    patientId,
    appointmentId: appt.id,
    providerId: appt.providerId,
    pharmacyId: patient?.preferredPharmacyId ?? snap.pharmacies[0]?.id ?? SEED_DEMO_ROUTE.pharmacyId,
  };
}

function fastForwardFollowUps(patientId: UUID): void {
  useCareWorkflowStore.setState((s) => {
    const snap = structuredClone(s.snapshot);
    const now = Date.now();
    for (const task of snap.followUpTasks) {
      if (task.patientId !== patientId) continue;
      if (task.status === "completed" || task.status === "cancelled") continue;
      task.dueAt = new Date(now - 5 * 60 * 1000).toISOString();
      task.updatedAt = new Date(now - 4 * 60 * 1000).toISOString();
      task.nextAction = "Fast-forwarded in pitch demo to trigger immediate escalation";
    }
    return { snapshot: snap };
  });
  useCareWorkflowStore.getState().pushWorkflowEngineEvent({
    kind: "orchestrator_tick",
    title: "Pitch demo: time advanced for follow-up simulation",
    detail: "Overdue follow-up windows were simulated to demonstrate immediate escalations.",
    trigger: "Demo control",
    decision: "Fast-forward due times",
    action: "Force overdue follow-up conditions",
    result: "Orchestrator can show follow-up recovery without waiting hours/days",
    patientId,
    role: "system",
  });
}

function forceRescheduleTaskOverdue(patientId: UUID): void {
  useCareWorkflowStore.setState((s) => {
    const snap = structuredClone(s.snapshot);
    for (const task of snap.followUpTasks) {
      if (task.patientId !== patientId) continue;
      if (!task.title.toLowerCase().includes("reschedule")) continue;
      if (task.status === "completed" || task.status === "cancelled") continue;
      task.dueAt = new Date(Date.now() - 60_000).toISOString();
      task.updatedAt = new Date().toISOString();
      task.nextAction = "Forced overdue in pitch demo to trigger immediate auto-reschedule";
    }
    return { snapshot: snap };
  });
}

function seedDeniedPaCaseForPatient(patientId: UUID): string {
  const api = useCareWorkflowStore.getState();
  const snap = api.snapshot;
  const appt = snap.appointments.find((a) => a.patientId === patientId);
  const rx = snap.prescriptions.find((r) => r.patientId === patientId);
  if (!appt || !rx) throw new Error("Missing appointment or prescription for PA denial simulation.");
  const payerId = snap.payers[0]?.id ?? "payer_seed_001";
  const planId = snap.patients.find((p) => p.id === patientId)?.insurancePlanId ?? "plan_ppo_summit_001";
  const caseId = `pa_pitch_${Date.now()}`;
  useCareWorkflowStore.setState((s) => {
    const next = structuredClone(s.snapshot);
    const rxRow = next.prescriptions.find((r) => r.id === rx.id);
    next.priorAuthCases.unshift({
      id: caseId,
      patientId,
      appointmentId: appt.id,
      prescriptionId: rx.id,
      payerId,
      planId,
      status: "pending_review",
      drugName: rx.lines[0]?.drugName ?? "Medication",
      lineIndex: 0,
      submittedAt: new Date().toISOString(),
      notes: "Pitch demo forced-denial case for recovery chain demonstration.",
    });
    if (rxRow) {
      rxRow.status = "pending_prior_auth";
      rxRow.ownerRole = "payer";
      rxRow.nextAction = "Await payer prior authorization";
      rxRow.updatedAt = new Date().toISOString();
    }
    return { snapshot: next };
  });
  api.pushWorkflowEngineEvent({
    kind: "pa_submitted",
    title: "Pitch demo: forced PA submission",
    detail: "A payer-review case was created to trigger worst-case denial and recovery.",
    trigger: "Pitch demo control",
    decision: "Route to PA queue",
    action: "Create pending PA case for same patient",
    result: "Payer review required before release",
    patientId,
    prescriptionId: rx.id,
    role: "payer",
  });
  return caseId;
}

function pushDemoActionVisual(
  patientId: UUID,
  title: string,
  detail: string,
  role: "provider" | "patient" | "pharmacy" | "payer" | "system" = "system",
) {
  useCareWorkflowStore.getState().pushWorkflowEngineEvent({
    kind: "encounter_agent_trace",
    title,
    detail,
    trigger: "Pitch demo scripted action",
    decision: "Advance the visible role handoff",
    action: "Apply role-specific workflow mutation",
    result: "Audience sees this exact step in role UI + workflow dock",
    patientId,
    role,
  });
}

async function navigateToStepPortal(
  stepId: string,
  opts: RunJudgeDemoOptions,
  stale: () => boolean,
  prevPath: string | null,
): Promise<boolean> {
  const nav = opts.navigate;
  if (!nav) return true;
  const path = STEP_PORTAL_BY_ID[stepId];
  if (!path) return true;
  nav(path);
  await sleep(opts.navSettleMs ?? 420);
  if (prevPath !== null && prevPath !== path) {
    await sleep(PORTAL_SWITCH_PAUSE_MS);
  }
  return !stale();
}

/**
 * Single-click demo for judges: resets cohort, runs chart → plan → Rx → pharmacy →
 * patient → payer using canned inputs, with visible step progress (dashboard panel + optional tour bar).
 * Target wall time: well under 60 seconds.
 */
export async function runJudgeDemo(
  opts: RunJudgeDemoOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gen = useCareWorkflowStore.getState().judgeDemo.runGeneration + 1;
  const totalSteps = JUDGE_DEMO_STEP_DEFS.length;

  useCareWorkflowStore.getState().setJudgeDemo({
    runGeneration: gen,
    status: "running",
    currentStepIndex: 0,
    steps: buildJudgeDemoSteps(0),
    beforeMetrics: null,
    afterMetrics: null,
    activePortal: undefined,
    inputFocus: undefined,
    expectedUpdate: undefined,
    lastResult: undefined,
    errorMessage: undefined,
  });

  const stale = () =>
    useCareWorkflowStore.getState().judgeDemo.runGeneration !== gen;

  const progress = (finishedCount: number) => {
    if (stale()) return;
    useCareWorkflowStore.getState().setJudgeDemo({
      steps: buildJudgeDemoSteps(finishedCount),
      currentStepIndex: Math.min(finishedCount, totalSteps - 1),
      status: "running",
    });
  };

  try {
    let prevPortalPath: string | null = null;
    for (let step = 0; step < totalSteps; step++) {
      const stepId = JUDGE_DEMO_STEP_DEFS[step]?.id ?? "";
      progress(step);
      await sleep(STEP_PAUSE_MS);
      if (stale()) return { ok: false, error: "A newer demo run started." };

      if (!(await navigateToStepPortal(stepId, opts, stale, prevPortalPath))) {
        return { ok: false, error: "Cancelled." };
      }
      prevPortalPath = STEP_PORTAL_BY_ID[stepId] ?? prevPortalPath;

      const script = STEP_SCRIPT[stepId];
      if (script) {
        useCareWorkflowStore.getState().setJudgeDemo({
          activePortal: script.activePortal,
          inputFocus: script.inputFocus,
          expectedUpdate: script.expectedUpdate,
          lastResult: undefined,
        });
      }

      const api = useCareWorkflowStore.getState();
      const base = routeForPatient(SEED_DEMO_ROUTE.patientId);

      switch (stepId) {
        case "reset": {
          // Must not reset judgeDemo here — it clears runGeneration and makes the demo "stale".
          api.resetDemo({ preserveJudgeDemo: true });
          await sleep(80);
          const before = captureDemoMetrics(
            useCareWorkflowStore.getState().snapshot,
            SEED_DEMO_ROUTE.patientId,
          );
          if (stale()) return { ok: false, error: "Cancelled." };
          useCareWorkflowStore.getState().setJudgeDemo({ beforeMetrics: before });
          break;
        }
        case "admission": {
          api.selectPatient(base.patientId);
          api.setSelectedAppointmentId(base.appointmentId);
          api.openAppointment(base.appointmentId);
          pushDemoActionVisual(
            base.patientId,
            "Provider action: encounter opened",
            "Provider opened the visit from admission and entered active encounter workspace.",
            "provider",
          );
          break;
        }
        case "ai": {
          await api.generateChartSummary(base.patientId);
          pushDemoActionVisual(
            base.patientId,
            "Provider action: chart summary loaded",
            "AI chart summary + briefing populated risk context before drafting the plan.",
            "provider",
          );
          break;
        }
        case "soap": {
          api.saveEncounter(base.appointmentId, {
            soapNote: `${DEMO_SOAP_NOTE}\n\nProvider typed in demo: focused assessment and rationale.`,
          });
          pushDemoActionVisual(
            base.patientId,
            "Provider typed SOAP note",
            "SOAP section was entered directly in Provider workspace.",
            "provider",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "SOAP draft updated in provider encounter workspace.",
          });
          await sleep(220);
          break;
        }
        case "plan": {
          api.saveEncounter(base.appointmentId, {
            treatmentPlan: `${DEMO_TREATMENT_PLAN}\n\nProvider typed in demo: continue therapy and monitor response.`,
          });
          pushDemoActionVisual(
            base.patientId,
            "Provider typed treatment plan",
            "Plan section updated with specific follow-up and medication guidance.",
            "provider",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Treatment plan draft updated.",
          });
          await sleep(220);
          break;
        }
        case "rx": {
          api.createPrescription({
            appointmentId: base.appointmentId,
            lines: DEMO_RX_LINES,
          });
          pushDemoActionVisual(
            base.patientId,
            "Provider added prescription line",
            "Medication line, sig, and refill fields were added before finalize.",
            "provider",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Prescription draft line added.",
          });
          await sleep(220);
          break;
        }
        case "runreport": {
          pushDemoActionVisual(
            base.patientId,
            "Provider run report cue",
            "Finalization will populate the agent run report for this encounter.",
            "provider",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Run report cue shown. Next step finalizes and populates report.",
          });
          break;
        }
        case "clinical": {
          api.saveEncounter(base.appointmentId, {
            soapNote: `${DEMO_SOAP_NOTE}\n\nProvider typed in demo: focused assessment and rationale.`,
            treatmentPlan: `${DEMO_TREATMENT_PLAN}\n\nProvider typed in demo: continue therapy and monitor response.`,
          });
          const inner = await runCareLoopWorkflow(
            {
              patientId: base.patientId,
              appointmentId: base.appointmentId,
              providerId: base.providerId,
              pharmacyId: base.pharmacyId,
              soapNote: DEMO_SOAP_NOTE,
              treatmentPlan: DEMO_TREATMENT_PLAN,
              prescriptionLines: DEMO_RX_LINES,
              stepDelayMs: 0,
            },
            { silent: true },
          );
          if (!inner.ok) throw new Error(inner.error);
          pushDemoActionVisual(
            base.patientId,
            "Provider finalize clicked",
            "Finalize triggered workflow routing and handed the medication to payer/pharmacy workflow.",
            "provider",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Encounter finalized. Run report and routing output available.",
          });
          break;
        }
        case "dash1": {
          await runCentralOrchestratorAgent({
            patientId: base.patientId,
            source: "pitch-demo dashboard checkpoint",
          });
          pushDemoActionVisual(
            base.patientId,
            "Dashboard checkpoint",
            "Closed-loop status updated after provider finalize so progress is visible centrally.",
            "system",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Dashboard checkpoint updated with first cross-role progress.",
          });
          break;
        }
        case "pharmacy_hold": {
          pushDemoActionVisual(
            base.patientId,
            "Pharmacy view: awaiting payer approval",
            "Pharmacy sees the medication pending PA decision before fill can begin.",
            "pharmacy",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Pharmacy wait-state visible pending payer action.",
          });
          break;
        }
        case "payer_approve": {
          const st = useCareWorkflowStore.getState().snapshot;
          const pendingPa = st.priorAuthCases.find(
            (c) => c.patientId === base.patientId && c.status === "pending_review",
          );
          if (pendingPa) {
            useCareWorkflowStore.getState().resolvePriorAuthCase(pendingPa.id, "approved");
            pushDemoActionVisual(
              base.patientId,
              "Payer action: approve PA",
              "Payer approval action released the medication to pharmacy fulfillment.",
              "payer",
            );
            useCareWorkflowStore.getState().setJudgeDemo({
              lastResult: "PA approved and medication released to pharmacy.",
            });
          }
          break;
        }
        case "pharmacy_ready": {
          api.pharmacyMarkReady(SEED_DEMO_ROUTE.rxId);
          api.pharmacyMarkPickedUp(SEED_DEMO_ROUTE.rxId);
          pushDemoActionVisual(
            base.patientId,
            "Pharmacy action: ready + picked up",
            "Medication moved from ready-for-pickup to picked-up with shared state updates.",
            "pharmacy",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Medication marked ready and picked-up.",
          });
          break;
        }
        case "patient_checkin": {
          const st = useCareWorkflowStore.getState();
          st.patientLogMedicationTaken(base.patientId);
          const pending = st.snapshot.adherenceChecks.filter(
            (c) =>
              c.patientId === base.patientId &&
              c.status === "pending",
          );
          for (const c of pending) {
            useCareWorkflowStore.getState().patientCompleteAdherenceCheck(c.id);
          }
          pushDemoActionVisual(
            base.patientId,
            "Patient action: check-in submitted",
            "Patient completed adherence check-in and confirmed treatment progress.",
            "patient",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Patient adherence/check-in complete and reflected across portals.",
          });
          break;
        }
        case "timefast": {
          fastForwardFollowUps(base.patientId);
          await runCentralOrchestratorAgent({
            patientId: base.patientId,
            source: "pitch-demo fast-forward follow-up",
          });
          forceRescheduleTaskOverdue(base.patientId);
          await runCentralOrchestratorAgent({
            patientId: base.patientId,
            source: "pitch-demo immediate auto-reschedule",
          });
          pushDemoActionVisual(
            base.patientId,
            "Time jump: follow-up auto-reschedule triggered",
            "Demo fast-forward forced overdue follow-up and auto-created a rescheduled appointment.",
            "system",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Time jump triggered overdue follow-up and auto-reschedule.",
          });
          break;
        }
        case "paopen": {
          seedDeniedPaCaseForPatient(base.patientId);
          const st = useCareWorkflowStore.getState().snapshot;
          const pending = st.priorAuthCases.find(
            (c) => c.patientId === base.patientId && c.status === "pending_review",
          );
          if (pending) {
            useCareWorkflowStore.getState().resolvePriorAuthCase(pending.id, "denied");
          }
          await runCentralOrchestratorAgent({
            patientId: base.patientId,
            source: "pitch-demo worst-case denial",
          });
          pushDemoActionVisual(
            base.patientId,
            "Worst case: PA denied",
            "A denial was simulated to force autonomous recovery and appeal flow.",
            "payer",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Worst-case denial created to force recovery workflow.",
          });
          break;
        }
        case "recovery": {
          await runRecoveryAutopilot(base.patientId);
          const st = useCareWorkflowStore.getState().snapshot;
          const rc = st.recoveryCases.find(
            (c) => c.patientId === base.patientId && c.failureKind.startsWith("pa_"),
          );
          if (rc) {
            await runPaAppealsNavigator(rc);
            await runPaAppealsNavigator(rc);
            useCareWorkflowStore.getState().pushWorkflowEngineEvent({
              kind: "appeal_status_updated",
              title: "Pitch demo: appeal and re-appeal monitoring active",
              detail:
                "Appeal package generated/submitted, re-submission simulated, and SLA tracking is active.",
              trigger: "Recovery case reached waiting_external",
              decision: "Continue autonomous verification loop",
              action: "Track external PA appeal status and deadlines",
              result: "Operations can see live progress in Recovery Inbox and dock",
              patientId: rc.patientId,
              prescriptionId: rc.prescriptionId,
              role: "payer",
            });
            useCareWorkflowStore.getState().setJudgeDemo({
              lastResult:
                "Recovery inbox updated: appeal + re-appeal submitted with SLA tracking.",
            });
          }
          break;
        }
        case "dashboard": {
          await runCentralOrchestratorAgent({
            patientId: base.patientId,
            source: "pitch-demo final dashboard checkpoint",
          });
          pushDemoActionVisual(
            base.patientId,
            "Dashboard final: closed-loop journey visible",
            "All roles, PA approval, denial recovery, appeal/re-appeal, and SLA tracking are visible in one synchronized timeline.",
            "system",
          );
          useCareWorkflowStore.getState().setJudgeDemo({
            lastResult: "Final command center shows full closed-loop journey.",
          });
          break;
        }
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
      currentStepIndex: totalSteps,
      steps: buildJudgeDemoSteps(totalSteps),
      afterMetrics: after,
      activePortal: "dashboard",
      inputFocus: "Review end-to-end result.",
      expectedUpdate: "All role updates and recovery outcomes are visible.",
    });

    if (opts.navigate) {
      opts.navigate("/dashboard");
      await sleep(Math.min(opts.navSettleMs ?? 420, 280));
    }

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
