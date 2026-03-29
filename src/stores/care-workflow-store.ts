/**
 * Care Orchestrator global state — single Zustand store + persist.
 * Provider, patient, pharmacy, and payer routes subscribe to the same `snapshot`
 * so workflow changes propagate everywhere. Prefer `useCareLoop()` for derived
 * slices (patient, appointment, Rx, order, tasks, responses, payer row).
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AiHistorySummary,
  Appointment,
  CarePlanDraft,
  ChartInferenceReview,
  Patient,
  PayerClaimStatus,
  PharmacyOrder,
  Prescription,
  PrescriptionLine,
  ProviderVisitDraft,
  UUID,
  WorkflowStage,
  WorkflowTimelineEntry,
} from "@/types/workflow";
import type { AgentActivityState, EncounterAgentRunInput } from "@/types/agentic";
import { initialAgentActivity } from "@/types/agentic";
import type {
  CoverageEvaluationResult,
  PriorAuthCase,
  WorkflowEngineEvent,
  WorkflowEngineEventKind,
} from "@/types/benefits";
import type {
  AppealBundle,
  ConnectorRun,
  ExternalSyncCheckpoint,
  RecoveryAction,
  RecoveryCase,
  RecoveryCaseStatus,
  SlaTimer,
} from "@/types/recovery";
import {
  buildPatientFacingVisitSummary,
  buildPharmacyHandoffPayload,
} from "@/lib/agents/during-visit";
import { buildIdleJudgeSteps } from "@/lib/demo/step-definitions";
import { getInitialGuidedStory } from "@/lib/demo/guided-story-types";
import type { GuidedStoryState } from "@/lib/demo/guided-story-types";
import type { JudgeDemoState } from "@/lib/demo/types";
import {
  buildIdleOrchestrationSteps,
} from "@/lib/orchestration/step-definitions";
import type { CareLoopOrchestrationState } from "@/lib/orchestration/types";
import type { PreVisitAgentOutput } from "@/types/pre-visit-agent";
import { SEED } from "@/lib/seed-data";
import {
  collectEscalations,
  decisionDetail,
  deriveCoverageBranch,
} from "@/lib/orchestration/workflow-engine";

export type PatientSymptomCheckInPayload = {
  overall: "better" | "same" | "worse";
  concerns: string[];
  note: string;
};

function cloneSeed() {
  return structuredClone(SEED) as typeof SEED;
}

/** First scheduled appointment for patient — drives “current visit” in portals. */
export function defaultAppointmentIdForPatient(
  snapshot: typeof SEED,
  patientId: UUID | null,
): UUID | null {
  if (!patientId) return null;
  const appts = snapshot.appointments
    .filter((a) => a.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );
  return appts[0]?.id ?? null;
}

type CareWorkflowState = {
  /** No member selected until the user picks one (no default cohort face). */
  selectedPatientId: UUID | null;
  /** Active appointment for the selected patient (all portals read the same slice). */
  selectedAppointmentId: UUID | null;
  snapshot: typeof SEED;
  aiLoading: boolean;
  /** Last chart summary API outcome (not persisted) — for demo / error banners */
  lastChartSummaryMeta: {
    patientId: UUID;
    source: "xai";
    error?: string;
  } | null;
  /** Demo: auto-open encounter when wall clock passes this ISO time */
  demoEncounterUnlockAt: string | null;
  mergeEhrPatientDirectory: (patients: Patient[]) => void;
  hydrateFromEhrApi: (patientId: UUID | null) => Promise<void>;
  scheduleDemoEncounter: (secondsFromNow?: number) => void;
  clearDemoEncounterSchedule: () => void;
  /** Visit-specific briefing lines from EHR API (deterministic, not LLM) */
  ehrVisitBriefingLines: Record<string, string[]>;
  setSelectedPatientId: (id: UUID | null) => void;
  setSelectedAppointmentId: (appointmentId: UUID | null) => void;
  /** Sets patient + default appointment for that patient */
  selectPatient: (patientId: UUID) => void;
  openAppointment: (appointmentId: UUID) => void;
  setAiSummary: (patientId: UUID, summary: AiHistorySummary) => void;
  setAiLoading: (v: boolean) => void;
  saveCarePlan: (draft: CarePlanDraft) => void;
  updatePrescription: (
    id: UUID,
    patch: Partial<
      Pick<
        Prescription,
        | "status"
        | "sentAt"
        | "pharmacyId"
        | "externalPharmacyOrderId"
        | "pharmacyOrderId"
        | "updatedAt"
      >
    >,
  ) => void;
  sendPrescriptionToPharmacy: (prescriptionId: UUID, pharmacyId: UUID) => void;
  scheduleFollowUpReminders: (appointmentId: UUID) => void;
  markFollowUpTaskComplete: (taskId: UUID) => void;
  pharmacyMarkReady: (prescriptionId: UUID) => void;
  pharmacyMarkPickedUp: (prescriptionId: UUID) => void;
  /** Same fulfillment as pharmacy counter — from patient app */
  patientConfirmMedicationPickedUp: (prescriptionId: UUID) => void;
  patientLogMedicationTaken: (patientId: UUID) => void;
  patientCompleteAdherenceCheck: (checkId: UUID) => void;
  patientSubmitSymptomCheckIn: (
    patientId: UUID,
    payload: PatientSymptomCheckInPayload,
  ) => void;
  payerMarkComplete: (payerStatusId: UUID, status: PayerClaimStatus) => void;
  advanceAppointmentStage: (appointmentId: UUID, stage: WorkflowStage) => void;
  saveProviderVisitDraft: (
    appointmentId: UUID,
    partial: Partial<ProviderVisitDraft>,
  ) => void;
  finalizeEncounter: (args: {
    appointmentId: UUID;
    patientId: UUID;
    providerId: UUID;
    pharmacyId: UUID;
    soapNote: string;
    treatmentPlan: string;
    prescriptionLines: PrescriptionLine[];
    coverage?: CoverageEvaluationResult;
    /** Persisted agentic proof bundle (Provider finalize). */
    agentRun?: EncounterAgentRunInput;
  }) => void;
  resolvePriorAuthCase: (
    caseId: UUID,
    resolution: "approved" | "denied" | "more_info",
  ) => void;
  pushWorkflowEngineEvent: (partial: {
    kind: WorkflowEngineEventKind;
    title: string;
    detail?: string;
    trigger?: string;
    decision?: string;
    action?: string;
    result?: string;
    reason?: string;
    patientId?: UUID;
    prescriptionId?: UUID;
    role?: WorkflowEngineEvent["role"];
  }) => void;
  openRecoveryCase: (
    payload: Omit<RecoveryCase, "id" | "openedAt" | "updatedAt"> & { id?: UUID },
  ) => RecoveryCase;
  updateRecoveryCaseStatus: (
    caseId: UUID,
    status: RecoveryCaseStatus,
    patch?: Partial<Pick<RecoveryCase, "summary" | "title" | "closedAt">>,
  ) => void;
  appendRecoveryAction: (action: Omit<RecoveryAction, "id" | "createdAt"> & { id?: UUID }) => void;
  saveAppealBundle: (bundle: AppealBundle) => void;
  logConnectorRun: (run: ConnectorRun) => void;
  logExternalSyncCheckpoint: (checkpoint: ExternalSyncCheckpoint) => void;
  upsertSlaTimer: (timer: SlaTimer) => void;
  workflowDockPrimaryAction: {
    label: string;
    disabled: boolean;
    loading?: boolean;
    onClick: () => void;
  } | null;
  setWorkflowDockPrimaryAction: (
    action: {
      label: string;
      disabled: boolean;
      loading?: boolean;
      onClick: () => void;
    } | null,
  ) => void;
  /** POST /api/ai/summary (xAI Grok structured JSON when XAI_API_KEY set) + setAiSummary */
  generateChartSummary: (patientId: UUID) => Promise<void>;
  /** Persist SOAP/plan draft (alias of saveProviderVisitDraft) */
  saveEncounter: (
    appointmentId: UUID,
    partial: Partial<ProviderVisitDraft>,
  ) => void;
  /** Replace draft Rx lines before finalize */
  createPrescription: (args: {
    appointmentId: UUID;
    lines: PrescriptionLine[];
  }) => void;
  /** Unified pickup — pharmacy counter vs patient app */
  markPharmacyPickup: (
    prescriptionId: UUID,
    source?: "pharmacy" | "patient",
  ) => void;
  /** Alias for adherence completion from any portal */
  confirmAdherence: (checkId: UUID) => void;
  /** Adjust payer closure score and/or claim status */
  updatePayerCompletion: (
    payerStatusId: UUID,
    patch: {
      closureCompletionScore?: number;
      claimStatus?: PayerClaimStatus;
    },
  ) => void;
  /** Full-loop orchestration progress (not persisted — resets on reload). */
  careLoopOrchestration: CareLoopOrchestrationState;
  setCareLoopOrchestration: (partial: Partial<CareLoopOrchestrationState>) => void;
  resetCareLoopOrchestration: () => void;
  setPreVisitBriefingForAppointment: (
    appointmentId: UUID,
    briefing: PreVisitAgentOutput,
  ) => void;
  setChartInferenceForAppointment: (
    appointmentId: UUID,
    review: ChartInferenceReview,
  ) => void;
  /** One-click judge demo (dashboard) — end-to-end simulated loop */
  judgeDemo: JudgeDemoState;
  setJudgeDemo: (partial: Partial<JudgeDemoState>) => void;
  resetJudgeDemo: () => void;
  /** Step-by-step guided demo (dashboard) — not persisted */
  guidedStory: GuidedStoryState;
  setGuidedStory: (partial: Partial<GuidedStoryState>) => void;
  resetGuidedStory: () => void;
  /** Reset workflow snapshot; by default clears judge-demo UI. Use `preserveJudgeDemo` from automated judge runs. */
  resetDemo: (options?: { preserveJudgeDemo?: boolean }) => void;
  /** Bottom overlay — agentic encounter pipeline */
  agentActivity: AgentActivityState;
  setAgentActivity: (
    partial:
      | Partial<AgentActivityState>
      | ((prev: AgentActivityState) => AgentActivityState),
  ) => void;
  pushWorkflowTimelineEntry: (
    entry: Omit<WorkflowTimelineEntry, "id" | "occurredAt"> & {
      id?: UUID;
    },
  ) => void;
  pushAgenticPatientNotification: (
    patientId: UUID,
    title: string,
    body: string,
  ) => void;
};

function findAppointment(
  snapshot: typeof SEED,
  appointmentId: UUID,
): Appointment | undefined {
  return snapshot.appointments.find((a) => a.id === appointmentId);
}

const ts = () => new Date().toISOString();

function ensureWorkflowFields(snap: typeof SEED) {
  if (!snap.workflowTimeline) snap.workflowTimeline = [];
  if (!snap.patientWorkflowNotifications) snap.patientWorkflowNotifications = [];
  if (!snap.patientCareEvents) snap.patientCareEvents = [];
  if (!snap.preVisitBriefingsByAppointment) snap.preVisitBriefingsByAppointment = {};
  if (!snap.workflowEngineEvents) snap.workflowEngineEvents = [];
  if (!snap.priorAuthCases) snap.priorAuthCases = [];
  if (!snap.insurancePlans) snap.insurancePlans = [];
  if (!snap.encounterAgentRunsByAppointment) snap.encounterAgentRunsByAppointment = {};
  if (!snap.recoveryCases) snap.recoveryCases = [];
  if (!snap.recoveryActions) snap.recoveryActions = [];
  if (!snap.appealBundles) snap.appealBundles = {};
  if (!snap.connectorRuns) snap.connectorRuns = [];
  if (!snap.externalSyncCheckpoints) snap.externalSyncCheckpoints = [];
  if (!snap.slaTimers) snap.slaTimers = [];
}

function pushWorkflowEngineEventImpl(
  snap: typeof SEED,
  partial: {
    kind: WorkflowEngineEventKind;
    title: string;
    detail?: string;
    trigger?: string;
    decision?: string;
    action?: string;
    result?: string;
    reason?: string;
    patientId?: UUID;
    prescriptionId?: UUID;
    role?: WorkflowEngineEvent["role"];
  },
) {
  ensureWorkflowFields(snap);
  const id = `wfe_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  snap.workflowEngineEvents.unshift({
    id,
    occurredAt: ts(),
    kind: partial.kind,
    title: partial.title,
    detail: partial.detail,
    trigger: partial.trigger,
    decision: partial.decision,
    action: partial.action,
    result: partial.result,
    reason: partial.reason,
    patientId: partial.patientId,
    prescriptionId: partial.prescriptionId,
    role: partial.role ?? "system",
  });
  if (snap.workflowEngineEvents.length > 48) snap.workflowEngineEvents.length = 48;
}

function applyEscalationEvents(
  snap: typeof SEED,
  context: { patientId?: UUID; appointmentId?: UUID; prescriptionId?: UUID },
) {
  const rows = collectEscalations(snap, context);
  for (const row of rows) {
    const alreadyExists = (snap.workflowEngineEvents ?? []).some(
      (e) =>
        e.kind === row.kind &&
        e.patientId === row.patientId &&
        e.prescriptionId === row.prescriptionId &&
        e.title === row.title,
    );
    if (alreadyExists) continue;
    pushWorkflowEngineEventImpl(snap, {
      kind: row.kind,
      title: row.title,
      detail: row.detail,
      trigger: "Escalation rule engine",
      decision: "Escalate missed milestone",
      action: "Create visible workflow alert",
      result: "Role queues can react to overdue care activity",
      reason: row.reason,
      patientId: row.patientId,
      prescriptionId: row.prescriptionId,
      role: row.role,
    });
  }
}

const initialCareLoopOrchestration: CareLoopOrchestrationState = {
  status: "idle",
  currentStepIndex: -1,
  steps: buildIdleOrchestrationSteps(),
  runGeneration: 0,
};

function getInitialJudgeDemo(): JudgeDemoState {
  return {
    status: "idle",
    currentStepIndex: -1,
    steps: buildIdleJudgeSteps(),
    beforeMetrics: null,
    afterMetrics: null,
    runGeneration: 0,
  };
}

/** Shared Rx pickup — pharmacy counter or patient app (guards on ready_for_pickup). */
function runMedicationPickup(
  snap: typeof SEED,
  prescriptionId: UUID,
  via: "pharmacy_counter" | "patient_app",
): boolean {
  ensureWorkflowFields(snap);
  const rx = snap.prescriptions.find((p) => p.id === prescriptionId);
  if (!rx || rx.status !== "ready_for_pickup") return false;

  rx.status = "picked_up";
  rx.nextAction = "Payer reconciliation";
  rx.ownerRole = "payer";
  rx.updatedAt = ts();

  const order = snap.pharmacyOrders.find(
    (o) => o.prescriptionId === prescriptionId,
  );
  if (order) {
    order.status = "picked_up";
    order.pickedUpAt = ts();
    order.nextAction = "Complete";
    order.updatedAt = ts();
  }

  const appt = snap.appointments.find((a) => a.id === rx.appointmentId);
  if (appt) {
    appt.currentStage = "payer_closure";
    appt.nextAction = "Payer to finalize claim";
    appt.updatedAt = ts();
  }

  const patient = snap.patients.find((p) => p.id === rx.patientId);
  const pharmacyEntity =
    snap.pharmacies.find((p) => p.id === order?.pharmacyId) ??
    snap.pharmacies[0];
  const payerRow = snap.payerStatuses.find(
    (p) => p.appointmentId === rx.appointmentId,
  );
  if (payerRow) {
    payerRow.closureCompletionScore = Math.min(
      100,
      (payerRow.closureCompletionScore ?? 52) + 28,
    );
    payerRow.nextAction =
      "Review claim — professional and pharmacy components may now be released";
    payerRow.updatedAt = ts();
  }

  for (const t of snap.followUpTasks) {
    if (
      t.prescriptionId === prescriptionId &&
      t.taskType === "pharmacy_pickup"
    ) {
      t.status = "completed";
      t.updatedAt = ts();
      t.nextAction = "Picked up — thank you";
    }
  }

  const drugLine = rx.lines[0]?.drugName ?? "your medication";
  const tline =
    via === "pharmacy_counter"
      ? {
          title: "Pharmacy: patient picked up",
          detail: `${patient?.displayName ?? "Patient"} collected ${drugLine} from ${pharmacyEntity?.name ?? "pharmacy"}. Payer closure can proceed.`,
        }
      : {
          title: "Patient confirmed pickup",
          detail: `${patient?.displayName ?? "Patient"} confirmed in Care Orchestrator that they picked up ${drugLine}. Same milestone as pharmacy counter.`,
        };

  snap.workflowTimeline.unshift({
    id: `wfe_pu_${via}_${Date.now()}`,
    occurredAt: ts(),
    title: tline.title,
    detail: tline.detail,
    patientId: rx.patientId,
    prescriptionId: rx.id,
    appointmentId: rx.appointmentId,
  });

  const notifBody =
    via === "pharmacy_counter"
      ? `We recorded your pickup at ${pharmacyEntity?.name ?? "the pharmacy"}. Follow your clinician's instructions and complete any home monitoring tasks.`
      : `You told us you have your medication. If something doesn’t look right on the label, call the pharmacy or your clinic.`;

  snap.patientWorkflowNotifications.unshift({
    id: `pwn_pu_${via}_${Date.now()}`,
    patientId: rx.patientId,
    createdAt: ts(),
    title: via === "pharmacy_counter" ? "Pickup confirmed" : "We got it",
    body: notifBody,
    source: via === "pharmacy_counter" ? "pharmacy" : "patient",
  });

  snap.patientCareEvents.unshift({
    id: `pce_pu_${Date.now()}`,
    patientId: rx.patientId,
    at: ts(),
    kind: "med_picked_up",
    summary:
      via === "pharmacy_counter"
        ? `Picked up ${drugLine} at the pharmacy`
        : `You confirmed you picked up ${drugLine}`,
    prescriptionId: rx.id,
  });

  queueMicrotask(() => {
    void import("@/lib/orchestration/post-pickup-agent").then((m) =>
      m.runPostPickupAgenticChain(rx.patientId, rx.id),
    );
  });

  return true;
}

export const useCareWorkflowStore = create<CareWorkflowState>()(
  persist(
    (set, get) => ({
      selectedPatientId: null,
      selectedAppointmentId: null,
      snapshot: cloneSeed(),
      aiLoading: false,
      lastChartSummaryMeta: null,
      demoEncounterUnlockAt: null,
      ehrVisitBriefingLines: {},
      careLoopOrchestration: initialCareLoopOrchestration,
      judgeDemo: getInitialJudgeDemo(),
      guidedStory: getInitialGuidedStory(),
      agentActivity: initialAgentActivity,
      workflowDockPrimaryAction: null,

      setWorkflowDockPrimaryAction: (action) => set({ workflowDockPrimaryAction: action }),

      pushWorkflowEngineEvent: (partial) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          pushWorkflowEngineEventImpl(snap, partial);
          return { snapshot: snap };
        }),

      openRecoveryCase: (payload) => {
        const newCase: RecoveryCase = {
          ...payload,
          id: payload.id ?? `rc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          openedAt: ts(),
          updatedAt: ts(),
        };
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.recoveryCases.unshift(newCase);
          return { snapshot: snap };
        });
        return newCase;
      },

      updateRecoveryCaseStatus: (caseId, status, patch) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const row = snap.recoveryCases.find((c) => c.id === caseId);
          if (!row) return s;
          row.status = status;
          row.updatedAt = ts();
          if (patch?.summary) row.summary = patch.summary;
          if (patch?.title) row.title = patch.title;
          if (patch?.closedAt) row.closedAt = patch.closedAt;
          return { snapshot: snap };
        }),

      appendRecoveryAction: (action) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.recoveryActions.unshift({
            ...action,
            id: action.id ?? `ra_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            createdAt: ts(),
          });
          return { snapshot: snap };
        }),

      saveAppealBundle: (bundle) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.appealBundles[bundle.recoveryCaseId] = bundle;
          return { snapshot: snap };
        }),

      logConnectorRun: (run) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const idx = snap.connectorRuns.findIndex((r) => r.id === run.id);
          if (idx >= 0) snap.connectorRuns[idx] = run;
          else snap.connectorRuns.unshift(run);
          return { snapshot: snap };
        }),

      logExternalSyncCheckpoint: (checkpoint) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.externalSyncCheckpoints.unshift(checkpoint);
          return { snapshot: snap };
        }),

      upsertSlaTimer: (timer) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const idx = snap.slaTimers.findIndex((x) => x.id === timer.id);
          if (idx >= 0) snap.slaTimers[idx] = timer;
          else snap.slaTimers.unshift(timer);
          return { snapshot: snap };
        }),

      setAgentActivity: (partial) =>
        set((s) => {
          const next =
            typeof partial === "function" ? partial(s.agentActivity) : partial;
          return {
            agentActivity: { ...s.agentActivity, ...next },
          };
        }),

      pushWorkflowTimelineEntry: (entry) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const row: WorkflowTimelineEntry = {
            id: entry.id ?? `wfe_ag_${Date.now()}`,
            occurredAt: ts(),
            title: entry.title,
            detail: entry.detail,
            patientId: entry.patientId,
            appointmentId: entry.appointmentId,
            prescriptionId: entry.prescriptionId,
          };
          snap.workflowTimeline.unshift(row);
          return { snapshot: snap };
        }),

      pushAgenticPatientNotification: (patientId, title, body) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.patientWorkflowNotifications.unshift({
            id: `pwn_ag_${Date.now()}`,
            patientId,
            createdAt: ts(),
            title,
            body,
            source: "care_team",
          });
          return { snapshot: snap };
        }),

      setGuidedStory: (partial) =>
        set((s) => ({
          guidedStory: { ...s.guidedStory, ...partial },
        })),

      resetGuidedStory: () => set({ guidedStory: getInitialGuidedStory() }),

      setJudgeDemo: (partial) =>
        set((s) => ({
          judgeDemo: { ...s.judgeDemo, ...partial },
        })),

      resetJudgeDemo: () => set({ judgeDemo: getInitialJudgeDemo() }),

      setCareLoopOrchestration: (partial) =>
        set((s) => ({
          careLoopOrchestration: { ...s.careLoopOrchestration, ...partial },
        })),

      resetCareLoopOrchestration: () =>
        set({ careLoopOrchestration: initialCareLoopOrchestration }),

      setPreVisitBriefingForAppointment: (appointmentId, briefing) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.preVisitBriefingsByAppointment[appointmentId] = briefing;
          return { snapshot: snap };
        }),

      setChartInferenceForAppointment: (appointmentId, review) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          snap.chartInferenceByAppointment[appointmentId] = review;
          return { snapshot: snap };
        }),

      setSelectedPatientId: (id) =>
        set((s) => ({
          selectedPatientId: id,
          selectedAppointmentId: defaultAppointmentIdForPatient(s.snapshot, id),
        })),

      setSelectedAppointmentId: (appointmentId) =>
        set((s) => {
          if (appointmentId == null) return { selectedAppointmentId: null };
          if (s.selectedPatientId == null) return s;
          const appt = s.snapshot.appointments.find((a) => a.id === appointmentId);
          if (!appt || appt.patientId !== s.selectedPatientId) return s;
          return { selectedAppointmentId: appointmentId };
        }),

      selectPatient: (patientId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const p = snap.patients.find((x) => x.id === patientId);
          pushWorkflowEngineEventImpl(snap, {
            kind: "patient_selected",
            title: `Context: ${p?.displayName ?? "Member"}`,
            detail: "Orchestrator switched cohort context.",
            patientId,
            role: "system",
          });
          if (snap.clinicalByPatientId[patientId]) {
            pushWorkflowEngineEventImpl(snap, {
              kind: "chart_loaded",
              title: "Chart agent: clinical snapshot available",
              detail: "Allergies, meds, diagnoses ready for agents.",
              patientId,
              role: "provider",
            });
          }
          applyEscalationEvents(snap, { patientId });
          return {
            snapshot: snap,
            selectedPatientId: patientId,
            selectedAppointmentId: defaultAppointmentIdForPatient(snap, patientId),
          };
        }),

      openAppointment: (appointmentId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const appt = snap.appointments.find((a) => a.id === appointmentId);
          if (!appt) return s;
          appt.status = "in_progress";
          appt.currentStage = "ai_review";
          appt.updatedAt = ts();
          appt.nextAction = "Load AI summary and review risks";
          return { snapshot: snap };
        }),

      setAiSummary: (patientId, summary) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          snap.aiSummaries[patientId] = summary;
          const appt = snap.appointments.find((a) => a.patientId === patientId);
          if (appt) {
            appt.currentStage = "planning";
            appt.nextAction = "Draft care plan and medications";
            appt.updatedAt = ts();
          }
          return { snapshot: snap };
        }),

      setAiLoading: (v) => set({ aiLoading: v }),

      mergeEhrPatientDirectory: (patients) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          snap.patients = patients;
          const sel = s.selectedPatientId;
          const selectionStillValid = sel && patients.some((p) => p.id === sel);
          return {
            snapshot: snap,
            ...(!sel || selectionStillValid ?
              {}
            : {
                selectedPatientId: null,
                selectedAppointmentId: null,
              }),
          };
        }),

      hydrateFromEhrApi: async (patientId) => {
        if (!patientId) return;
        try {
          const res = await fetch(`/api/ehr/context/${patientId}`);
          if (!res.ok) return;
          const data = (await res.json()) as {
            clinical?: (typeof SEED)["clinicalByPatientId"][string];
            appointments?: Appointment[];
            patient?: Patient;
            cachedChartSummary?: AiHistorySummary;
            visitBriefing?: { briefingLines: string[] };
          };
          if (!data.clinical) return;
          set((s) => {
            const snap = structuredClone(s.snapshot);
            snap.clinicalByPatientId[patientId] = data.clinical!;
            const appts = data.appointments ?? [];
            snap.appointments = [
              ...snap.appointments.filter((a) => a.patientId !== patientId),
              ...appts,
            ];
            if (data.patient) {
              const ix = snap.patients.findIndex((p) => p.id === patientId);
              if (ix >= 0) snap.patients[ix] = data.patient;
              else snap.patients.push(data.patient);
            }
            let selectedAppointmentId = s.selectedAppointmentId;
            if (s.selectedPatientId === patientId) {
              const valid =
                selectedAppointmentId &&
                appts.some((a) => a.id === selectedAppointmentId);
              if (!valid) {
                const sorted = [...appts].sort(
                  (a, b) =>
                    new Date(a.scheduledFor).getTime() -
                    new Date(b.scheduledFor).getTime(),
                );
                selectedAppointmentId = sorted[0]?.id ?? null;
              }
            }
            const lines = data.visitBriefing?.briefingLines;
            const ehrVisitBriefingLines =
              lines && lines.length ?
                { ...s.ehrVisitBriefingLines, [patientId]: lines }
              : s.ehrVisitBriefingLines;
            return {
              snapshot: snap,
              selectedAppointmentId,
              ehrVisitBriefingLines,
            };
          });
          if (data.cachedChartSummary) {
            get().setAiSummary(patientId, data.cachedChartSummary);
          }
        } catch {
          /* offline / no DB */
        }
      },

      scheduleDemoEncounter: (secondsFromNow = 30) => {
        set({
          demoEncounterUnlockAt: new Date(
            Date.now() + secondsFromNow * 1000,
          ).toISOString(),
        });
      },

      clearDemoEncounterSchedule: () => set({ demoEncounterUnlockAt: null }),

      saveCarePlan: (draft) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          snap.carePlans[draft.appointmentId] = {
            ...draft,
            updatedAt: new Date().toISOString(),
          };
          const appt = snap.appointments.find((a) => a.id === draft.appointmentId);
          if (appt) {
            appt.currentStage = "prescribing";
            appt.nextAction = "Sign and transmit prescription";
            appt.updatedAt = ts();
          }
          return { snapshot: snap };
        }),

      updatePrescription: (id, patch) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const rx = snap.prescriptions.find((p) => p.id === id);
          if (rx) Object.assign(rx, { ...patch, updatedAt: ts() });
          return { snapshot: snap };
        }),

      sendPrescriptionToPharmacy: (prescriptionId, pharmacyId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const rx = snap.prescriptions.find((p) => p.id === prescriptionId);
          if (rx) {
            rx.status = "received_by_pharmacy";
            rx.sentAt = ts();
            rx.pharmacyId = pharmacyId;
            rx.pharmacyOrderId =
              rx.pharmacyOrderId ??
              snap.pharmacyOrders.find((o) => o.prescriptionId === prescriptionId)?.id;
            rx.externalPharmacyOrderId = `MOCK-NCPDP-${prescriptionId.slice(-6)}`;
            rx.nextAction = "Pharmacy to fill and mark ready";
            rx.ownerRole = "pharmacy";
            rx.updatedAt = ts();
          }
          const order = snap.pharmacyOrders.find(
            (o) => o.prescriptionId === prescriptionId,
          );
          if (order) {
            order.status = "received";
            order.sentAt = ts();
            order.receivedAt = ts();
            order.pharmacyId = pharmacyId;
            order.nextAction = "Fill prescription and notify patient";
            order.ownerRole = "pharmacy";
            order.externalFulfillmentId = rx?.externalPharmacyOrderId;
            order.updatedAt = ts();
          }
          const appt = snap.appointments.find((a) => a.id === rx?.appointmentId);
          if (appt) {
            appt.currentStage = "pharmacy";
            appt.nextAction = "Await pharmacy fulfillment";
            appt.updatedAt = ts();
          }
          return { snapshot: snap };
        }),

      scheduleFollowUpReminders: (appointmentId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const appt = findAppointment(snap, appointmentId);
          if (!appt) return s;
          appt.currentStage = "patient_followup";
          appt.nextAction = "Patient follow-up and adherence checks";
          appt.updatedAt = ts();
          const existing = snap.followUpTasks.filter(
            (t) => t.appointmentId === appointmentId,
          );
          if (existing.length === 0) {
            snap.followUpTasks.push({
              id: `fut_gen_${Date.now()}`,
              patientId: appt.patientId,
              appointmentId,
              title: "Post-visit check-in",
              description: "Confirm understanding of care plan.",
              taskType: "callback",
              status: "scheduled",
              dueAt: new Date(Date.now() + 86400000).toISOString(),
              priority: "normal",
              ownerRole: "patient",
              nextAction: "Respond to Care Orchestrator message or call clinic",
              notes: "Generated when Rx sent to pharmacy.",
              createdAt: ts(),
              updatedAt: ts(),
            });
          } else {
            for (const t of existing) {
              if (
                t.taskType === "callback" &&
                (t.status === "scheduled" || t.status === "open")
              ) {
                t.status = "completed";
                t.updatedAt = ts();
                t.nextAction = "Done";
              }
            }
          }
          return { snapshot: snap };
        }),

      markFollowUpTaskComplete: (taskId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const t = snap.followUpTasks.find((x) => x.id === taskId);
          if (t) {
            t.status = "completed";
            t.updatedAt = ts();
            t.nextAction = "Acknowledged";
          }
          return { snapshot: snap };
        }),

      pharmacyMarkReady: (prescriptionId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const rx = snap.prescriptions.find((p) => p.id === prescriptionId);
          if (rx) {
            rx.status = "ready_for_pickup";
            rx.nextAction = "Patient pickup";
            rx.updatedAt = ts();
          }
          const order = snap.pharmacyOrders.find(
            (o) => o.prescriptionId === prescriptionId,
          );
          if (order) {
            order.status = "ready_for_pickup";
            order.readyAt = ts();
            order.nextAction = "Patient to pick up at will-call";
            order.updatedAt = ts();
          }
          if (rx) {
            const patient = snap.patients.find((p) => p.id === rx.patientId);
            const pharmacyEntity =
              snap.pharmacies.find((p) => p.id === order?.pharmacyId) ??
              snap.pharmacies[0];
            const payerRow = snap.payerStatuses.find(
              (p) => p.appointmentId === rx.appointmentId,
            );
            if (payerRow) {
              payerRow.closureCompletionScore = Math.min(
                100,
                (payerRow.closureCompletionScore ?? 35) + 12,
              );
              payerRow.updatedAt = ts();
            }
            for (const t of snap.followUpTasks) {
              if (
                t.prescriptionId === prescriptionId &&
                t.taskType === "pharmacy_pickup" &&
                t.status !== "completed"
              ) {
                t.nextAction = "Ready at will-call — bring photo ID";
                t.updatedAt = ts();
              }
            }
            const drugLine = rx.lines[0]?.drugName ?? "Medication";
            snap.workflowTimeline.unshift({
              id: `wfe_ready_${Date.now()}`,
              occurredAt: ts(),
              title: "Pharmacy: prescription ready",
              detail: `${patient?.displayName ?? "Patient"} — ${drugLine} is bagged and ready for pickup (${pharmacyEntity?.name ?? "Pharmacy"}).`,
              patientId: rx.patientId,
              prescriptionId: rx.id,
              appointmentId: rx.appointmentId,
            });
            snap.patientWorkflowNotifications.unshift({
              id: `pwn_ready_${Date.now()}`,
              patientId: rx.patientId,
              createdAt: ts(),
              title: "Prescription ready",
              body: `${pharmacyEntity?.name ?? "Your pharmacy"}: your prescription is ready for pickup. Bring a valid ID.`,
              source: "pharmacy",
            });
            pushWorkflowEngineEventImpl(snap, {
              kind: "medication_ready",
              title: "Medication ready for pickup",
              detail: `${drugLine} is ready at ${pharmacyEntity?.name ?? "the pharmacy"}.`,
              trigger: "Pharmacy marked order ready",
              decision: "Notify patient and await pickup",
              action: "Advance prescription to ready_for_pickup",
              result: "Patient pickup is now the next critical step",
              reason: "Fulfillment completed at pharmacy counter.",
              patientId: rx.patientId,
              prescriptionId,
              role: "pharmacy",
            });
            applyEscalationEvents(snap, {
              patientId: rx.patientId,
              appointmentId: rx.appointmentId,
              prescriptionId: rx.id,
            });
          }
          return { snapshot: snap };
        }),

      pharmacyMarkPickedUp: (prescriptionId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          runMedicationPickup(snap, prescriptionId, "pharmacy_counter");
          return { snapshot: snap };
        }),

      patientConfirmMedicationPickedUp: (prescriptionId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          runMedicationPickup(snap, prescriptionId, "patient_app");
          return { snapshot: snap };
        }),

      patientLogMedicationTaken: (patientId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const t = ts();
          const pending = snap.adherenceChecks.filter(
            (c) => c.patientId === patientId && c.status === "pending",
          );
          for (const c of pending) {
            c.status = "completed";
            c.completedAt = t;
            c.updatedAt = t;
            c.responseSummary = "Logged in Care Orchestrator";
            c.nextAction = "Thanks — you’re set for this check-in";
          }
          const payerRow = snap.payerStatuses.find((p) => p.patientId === patientId);
          if (payerRow) {
            payerRow.closureCompletionScore = Math.min(
              100,
              (payerRow.closureCompletionScore ?? 50) + 4,
            );
            payerRow.updatedAt = t;
          }
          const rx = snap.prescriptions.find((r) => r.patientId === patientId);
          const name =
            snap.patients.find((p) => p.id === patientId)?.displayName ?? "Patient";
          snap.workflowTimeline.unshift({
            id: `wfe_med_${Date.now()}`,
            occurredAt: t,
            title: "Patient logged medication",
            detail: `${name} confirmed taking medication as directed in Care Orchestrator.`,
            patientId,
            prescriptionId: rx?.id,
          });
          snap.patientCareEvents.unshift({
            id: `pce_mt_${Date.now()}`,
            patientId,
            at: t,
            kind: "med_taken",
            summary: "You logged that you took your medication",
            prescriptionId: rx?.id,
          });
          snap.patientWorkflowNotifications.unshift({
            id: `pwn_mt_${Date.now()}`,
            patientId,
            createdAt: t,
            title: "Thanks for checking in",
            body: "We shared this with your care team. Keep following your plan unless your clinician tells you otherwise.",
            source: "care_team",
          });
          applyEscalationEvents(snap, { patientId, prescriptionId: rx?.id });
          return { snapshot: snap };
        }),

      patientCompleteAdherenceCheck: (checkId) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const c = snap.adherenceChecks.find((x) => x.id === checkId);
          if (!c || c.status !== "pending") return s;
          const t = ts();
          c.status = "completed";
          c.completedAt = t;
          c.updatedAt = t;
          c.responseSummary = "Completed in Care Orchestrator";
          c.nextAction = "Recorded";
          ensureWorkflowFields(snap);
          const name =
            snap.patients.find((p) => p.id === c.patientId)?.displayName ??
            "Patient";
          snap.workflowTimeline.unshift({
            id: `wfe_adh_${Date.now()}`,
            occurredAt: t,
            title: "Adherence check-in completed",
            detail: `${name} finished a scheduled check-in (${c.checkType.replaceAll("_", " ")}).`,
            patientId: c.patientId,
            prescriptionId: c.prescriptionId,
          });
          const payerRow = snap.payerStatuses.find(
            (p) => p.patientId === c.patientId,
          );
          if (payerRow) {
            payerRow.closureCompletionScore = Math.min(
              100,
              (payerRow.closureCompletionScore ?? 50) + 3,
            );
            payerRow.updatedAt = t;
          }
          applyEscalationEvents(snap, {
            patientId: c.patientId,
            prescriptionId: c.prescriptionId,
          });
          return { snapshot: snap };
        }),

      patientSubmitSymptomCheckIn: (patientId, payload) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const t = ts();
          const detail = JSON.stringify(payload);
          const name =
            snap.patients.find((p) => p.id === patientId)?.displayName ?? "Patient";
          snap.patientCareEvents.unshift({
            id: `pce_sym_${Date.now()}`,
            patientId,
            at: t,
            kind: "symptom_checkin",
            summary: `Quick check-in: you’re feeling ${payload.overall} than before`,
            detail,
          });
          snap.workflowTimeline.unshift({
            id: `wfe_sym_${Date.now()}`,
            occurredAt: t,
            title: "Patient symptom check-in",
            detail: `${name} shared how they’re feeling (${payload.overall}). ${payload.note ? `They added: “${payload.note}”` : ""} Concerns: ${payload.concerns.length ? payload.concerns.join(", ") : "none listed"}.`,
            patientId,
          });
          const payerRow = snap.payerStatuses.find((p) => p.patientId === patientId);
          if (payerRow) {
            payerRow.closureCompletionScore = Math.min(
              100,
              (payerRow.closureCompletionScore ?? 50) + 2,
            );
            payerRow.updatedAt = t;
          }
          snap.patientWorkflowNotifications.unshift({
            id: `pwn_sym_${Date.now()}`,
            patientId,
            createdAt: t,
            title: "We received your check-in",
            body: "Your care team can see this in Care Orchestrator. Call your clinic if symptoms get worse or worry you.",
            source: "care_team",
          });
          applyEscalationEvents(snap, { patientId });
          return { snapshot: snap };
        }),

      payerMarkComplete: (payerStatusId, status) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const t = ts();
          const row = snap.payerStatuses.find((e) => e.id === payerStatusId);
          if (row) {
            row.claimStatus = status;
            row.completedAt = t;
            row.updatedAt = t;
            row.externalClaimId = row.externalClaimId ?? `CLM-${Date.now()}`;
            if (status === "approved" || status === "paid") {
              row.authorizedAmountUsd = 185;
              row.paidAmountUsd = status === "paid" ? 185 : undefined;
              row.closureCompletionScore = Math.max(
                row.closureCompletionScore ?? 0,
                88,
              );
            }
            row.nextAction =
              status === "paid" ? "Closed" : "Awaiting remittance";
          }
          const appt = snap.appointments.find((a) => a.id === row?.appointmentId);
          if (appt && (status === "paid" || status === "approved")) {
            appt.status = "completed";
            appt.currentStage = "payer_closure";
            appt.nextAction = "Loop complete";
            appt.updatedAt = t;
          }

          /** Link payer adjudication to the pharmacy queue (demo): unstick orders + audit trail. */
          if (row && (status === "paid" || status === "approved")) {
            const rx =
              (row.appointmentId ?
                snap.prescriptions.find(
                  (p) => p.appointmentId === row.appointmentId,
                )
              : undefined) ??
              snap.prescriptions.find((p) => p.patientId === row.patientId) ??
              null;

            let detail: string;
            if (rx && rx.status !== "draft" && rx.status !== "cancelled") {
              const order = snap.pharmacyOrders.find(
                (o) => o.prescriptionId === rx.id,
              );
              if (
                order &&
                (order.status === "queued" || order.status === "sent_to_pharmacy")
              ) {
                order.status = "received";
                order.sentAt = order.sentAt ?? t;
                order.receivedAt = t;
                order.updatedAt = t;
                order.ownerRole = "pharmacy";
                order.nextAction =
                  "Fill prescription — payer claim cleared (demo)";
                if (rx.pharmacyId) order.pharmacyId = rx.pharmacyId;
                if (rx.externalPharmacyOrderId) {
                  order.externalFulfillmentId =
                    order.externalFulfillmentId ?? rx.externalPharmacyOrderId;
                }
              }
              rx.updatedAt = t;
              const drugs =
                rx.lines.map((l) => l.drugName).filter(Boolean).join(", ") ||
                "medications";
              detail = `Claim closed in payer demo. Linked e-Rx (${drugs}) appears on the Pharmacy tab — use Incoming queue to fill and release.`;
            } else if (rx && rx.status === "draft") {
              const drugs =
                rx.lines.map((l) => l.drugName).filter(Boolean).join(", ") ||
                "medications";
              detail = `Claim marked ${status === "paid" ? "paid" : "approved"} (demo). Prescription is still draft — finalize the visit on Provider to transmit ${drugs} to Pharmacy.`;
            } else {
              detail =
                "Claim closed (demo). No prescription linked to this payer row — finalize on Provider to create e-Rx, then use Pharmacy.";
            }

            snap.workflowTimeline.unshift({
              id: `wfe_payer_${Date.now()}`,
              occurredAt: t,
              title:
                status === "paid" ? "Payer: claim paid" : "Payer: claim approved",
              detail,
              patientId: row.patientId,
              appointmentId: row.appointmentId,
              prescriptionId: rx?.id,
            });
          }

          return { snapshot: snap };
        }),

      advanceAppointmentStage: (appointmentId, stage) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const appt = findAppointment(snap, appointmentId);
          if (appt) {
            appt.currentStage = stage;
            appt.updatedAt = ts();
          }
          return { snapshot: snap };
        }),

      saveProviderVisitDraft: (appointmentId, partial) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const prev = snap.providerVisitDrafts[appointmentId] ?? {
            soapNote: "",
            treatmentPlan: "",
          };
          snap.providerVisitDrafts[appointmentId] = { ...prev, ...partial };
          return { snapshot: snap };
        }),

      finalizeEncounter: ({
        appointmentId,
        patientId,
        providerId,
        pharmacyId,
        soapNote,
        treatmentPlan,
        prescriptionLines,
        coverage,
        agentRun,
      }) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const appt = findAppointment(snap, appointmentId);
          if (!appt || appt.patientId !== patientId) return s;

          let rx = snap.prescriptions.find((p) => p.appointmentId === appointmentId);
          if (rx && rx.status !== "draft") return s;

          const t = ts();

          /** EHR / SQLite cohorts often have no seed Rx row; agentic finalize still runs from UI state. */
          if (!rx) {
            const rxId = `rx_ehr_${Date.now()}`;
            const phOrderId = `phord_ehr_${Date.now()}`;
            const stub: Prescription = {
              id: rxId,
              appointmentId,
              patientId,
              prescriberId: providerId,
              status: "draft",
              priority: "normal",
              notes:
                "Created at finalize — no prior workflow Rx for this appointment (EHR cohort).",
              nextAction: "Transmit to pharmacy",
              ownerRole: "provider",
              createdAt: t,
              updatedAt: t,
              lines: [
                {
                  id: `rxl_stub_${Date.now()}`,
                  drugName: "—",
                  strength: "",
                  quantity: "30",
                  refills: 0,
                  sig: "",
                },
              ],
            };
            const orderStub: PharmacyOrder = {
              id: phOrderId,
              patientId,
              prescriptionId: rxId,
              pharmacyId,
              status: "queued",
              priority: "normal",
              notes: "Linked when encounter finalizes (demo).",
              nextAction: "Await prescriber e-send",
              ownerRole: "pharmacy",
              createdAt: t,
              updatedAt: t,
            };
            snap.prescriptions.push(stub);
            snap.pharmacyOrders.push(orderStub);
            rx = stub;
          }

          const encId = `enc_fin_${Date.now()}`;

          const linesWithIds: PrescriptionLine[] = prescriptionLines.map((line, i) => ({
            ...line,
            id: line.id || `rxl_${Date.now()}_${i}`,
          }));
          rx.lines = linesWithIds;

          snap.encounters.push({
            id: encId,
            patientId,
            providerId,
            appointmentId,
            encounterType: "office",
            status: "finished",
            chiefComplaint: appt.title,
            notes: `SOAP / Assessment:\n${soapNote}\n\nTreatment plan:\n${treatmentPlan}`,
            priority: "normal",
            nextAction: "Encounter signed — pharmacy handoff",
            ownerRole: "provider",
            startedAt: appt.scheduledFor,
            endedAt: t,
            createdAt: t,
            updatedAt: t,
          });

          snap.providerVisitDrafts[appointmentId] = {
            soapNote,
            treatmentPlan,
            finalizedAt: t,
          };

          const planLines = treatmentPlan
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          snap.carePlans[appointmentId] = {
            appointmentId,
            goals: planLines.length > 0 ? planLines.slice(0, 12) : ["See treatment plan"],
            interventions: [],
            followUpInDays: 14,
            patientEducation: "",
            updatedAt: t,
          };

          const patientRow = snap.patients.find((p) => p.id === patientId);
          const pharmacyEntity = snap.pharmacies.find((p) => p.id === pharmacyId);
          if (patientRow && pharmacyEntity) {
            snap.patientFacingSummariesByAppointment[appointmentId] =
              buildPatientFacingVisitSummary({
                appointmentId,
                patientId,
                patientDisplayName: patientRow.displayName,
                treatmentPlan,
                pharmacy: pharmacyEntity,
                prescriptionLines: linesWithIds,
              });
          }

          const payerIdStub = coverage?.plan.payerId ?? snap.payers[0]?.id;
          if (payerIdStub) {
            const hasPayerRow = snap.payerStatuses.some(
              (p) => p.appointmentId === appointmentId,
            );
            if (!hasPayerRow) {
              snap.payerStatuses.unshift({
                id: `paystat_${Date.now()}`,
                patientId,
                payerId: payerIdStub,
                appointmentId,
                encounterId: encId,
                claimStatus: "pending",
                priority: "normal",
                ownerRole: "payer",
                nextAction:
                  "Track professional + pharmacy milestones after finalize (demo)",
                notes: "Claim stub created when encounter was finalized.",
                createdAt: t,
                updatedAt: t,
                closureCompletionScore: 22,
              });
            }
          }

          const stepBlock = coverage?.anyStepTherapyBlock;
          const paHold = coverage?.holdForPriorAuth;
          const coverageBranch = deriveCoverageBranch(coverage);

          if (coverage) {
            pushWorkflowEngineEventImpl(snap, {
              kind: "insurance_checked",
              title: `Insurance: ${coverage.plan.name}`,
              detail: decisionDetail(coverageBranch),
              trigger: coverageBranch.trigger,
              decision: coverageBranch.decision,
              action: coverageBranch.action,
              result: coverageBranch.result,
              reason: coverageBranch.reason,
              patientId,
              prescriptionId: rx.id,
              role: "system",
            });
          }

          let order = snap.pharmacyOrders.find((o) => o.prescriptionId === rx.id);

          if (stepBlock) {
            rx.status = "pending_prior_auth";
            rx.coverageNotes =
              "Step therapy / documentation gate — update chart or change therapy before transmit (demo).";
            rx.updatedAt = t;
            rx.nextAction = "Provider: satisfy step therapy or revise Rx";
            rx.ownerRole = "provider";
            appt.currentStage = "prescribing";
            appt.nextAction = "Complete step therapy documentation — then revise Rx";
            appt.updatedAt = t;
            pushWorkflowEngineEventImpl(snap, {
              kind: "pa_required",
              title: "Step therapy gate",
              detail: "E-prescribe held pending documentation (deterministic demo).",
              trigger: coverageBranch.trigger,
              decision: coverageBranch.decision,
              action: coverageBranch.action,
              result: coverageBranch.result,
              reason: coverageBranch.reason,
              patientId,
              prescriptionId: rx.id,
              role: "provider",
            });
          } else if (paHold && coverage) {
            rx.status = "pending_prior_auth";
            rx.coverageNotes = "Prior authorization submitted — awaiting payer.";
            rx.updatedAt = t;
            rx.nextAction = "Await payer prior authorization";
            rx.ownerRole = "payer";
            appt.currentStage = "planning";
            appt.nextAction = "Await payer PA decision";
            appt.updatedAt = t;

            const paLines = coverage.lines.filter((line) => line.route === "payer_prior_auth");
            const targets =
              paLines.length > 0 ?
                paLines
              : [
                  {
                    drugName: linesWithIds.map((l) => l.drugName).join(", "),
                    lineIndex: 0,
                    reason: "Coverage hold required payer review.",
                  },
                ];
            for (const target of targets) {
              const paCase: PriorAuthCase = {
                id: `pa_${Date.now()}_${target.lineIndex}`,
                patientId,
                appointmentId,
                prescriptionId: rx.id,
                payerId: coverage.plan.payerId,
                planId: coverage.plan.id,
                status: "pending_review",
                drugName: target.drugName,
                lineIndex: target.lineIndex,
                submittedAt: t,
                notes: `Submitted from encounter finalize. ${target.reason ?? ""}`.trim(),
              };
              snap.priorAuthCases.unshift(paCase);
              pushWorkflowEngineEventImpl(snap, {
                kind: "payer_alerted",
                title: "Payer queue: new PA case",
                detail: `${paCase.id} · ${paCase.drugName}`,
                trigger: "Coverage branch selected PA route",
                decision: "Create PA case",
                action: "Queued case for payer review",
                result: "Payer queue has a new pending case",
                reason: target.reason,
                patientId,
                prescriptionId: rx.id,
                role: "payer",
              });
            }

            pushWorkflowEngineEventImpl(snap, {
              kind: "pa_submitted",
              title: "PA submitted to payer",
              detail: `Drugs: ${targets.map((x) => x.drugName).join(", ")}. SLA ~${coverage.plan.paTurnaroundBusinessDays} business days (mock).`,
              trigger: coverageBranch.trigger,
              decision: coverageBranch.decision,
              action: coverageBranch.action,
              result: coverageBranch.result,
              reason: coverageBranch.reason,
              patientId,
              prescriptionId: rx.id,
              role: "payer",
            });
            pushWorkflowEngineEventImpl(snap, {
              kind: "patient_notified",
              title: "Patient: PA in progress",
              detail: "We’ll message you when your plan finishes review.",
              patientId,
              prescriptionId: rx.id,
              role: "patient",
            });

            const payerRowPa = snap.payerStatuses.find((p) => p.appointmentId === appointmentId);
            if (payerRowPa) {
              payerRowPa.claimStatus = "submitted";
              payerRowPa.encounterId = encId;
              payerRowPa.nextAction = "Prior authorization review queue";
              payerRowPa.notes = "PA required before pharmacy release (demo).";
              payerRowPa.updatedAt = t;
              payerRowPa.closureCompletionScore = 35;
            }
          } else {
            rx.status = "received_by_pharmacy";
            rx.writtenAt = t;
            rx.sentAt = t;
            rx.pharmacyId = pharmacyId;
            rx.pharmacyOrderId =
              rx.pharmacyOrderId ?? order?.id;
            rx.externalPharmacyOrderId = `MOCK-NCPDP-${rx.id.slice(-6)}`;
            rx.nextAction = "Pharmacy to fill and notify patient";
            rx.ownerRole = "pharmacy";
            rx.updatedAt = t;

            if (patientRow && pharmacyEntity) {
              snap.pharmacyHandoffsByPrescription[rx.id] = buildPharmacyHandoffPayload({
                prescription: rx,
                patientDisplayName: patientRow.displayName,
                patientDob: patientRow.dateOfBirth,
                pharmacy: pharmacyEntity,
              });
            }

            order = snap.pharmacyOrders.find((o) => o.prescriptionId === rx.id);
            if (order) {
              order.status = "received";
              order.sentAt = t;
              order.receivedAt = t;
              order.pharmacyId = pharmacyId;
              order.nextAction = "Fill prescription and notify patient";
              order.ownerRole = "pharmacy";
              order.externalFulfillmentId = rx.externalPharmacyOrderId;
              order.updatedAt = t;
            }

            appt.currentStage = "pharmacy";
            appt.nextAction = "Await pharmacy fulfillment";
            appt.updatedAt = t;

            pushWorkflowEngineEventImpl(snap, {
              kind: "pharmacy_order_sent",
              title: "E-Rx released to pharmacy",
              detail: coverage?.anyNetworkMismatch ?
                `${pharmacyEntity?.name ?? "Pharmacy"} (network mismatch detected for at least one line)` :
                (pharmacyEntity?.name ?? "Pharmacy"),
              trigger: coverageBranch.trigger,
              decision: coverageBranch.decision,
              action: coverageBranch.action,
              result: coverageBranch.result,
              reason: coverageBranch.reason,
              patientId,
              prescriptionId: rx.id,
              role: "pharmacy",
            });
            if (coverage?.anyNetworkMismatch) {
              pushWorkflowEngineEventImpl(snap, {
                kind: "network_mismatch",
                title: "Pharmacy network check",
                detail:
                  "At least one medication line prefers an in-network pharmacy. Continue in demo or reroute provider selection.",
                trigger: "Coverage returned preferredPharmacyInNetwork=false",
                decision: "Flag network mismatch",
                action: "Keep current route but surface warning",
                result: "Provider and pharmacy see network risk",
                reason: "Selected pharmacy may be out-of-network for part of this fill.",
                patientId,
                prescriptionId: rx.id,
                role: "system",
              });
            }

            const payerRowDirect = snap.payerStatuses.find((p) => p.appointmentId === appointmentId);
            if (payerRowDirect) {
              payerRowDirect.claimStatus = "pending";
              payerRowDirect.submittedAt = undefined;
              payerRowDirect.completedAt = undefined;
              payerRowDirect.encounterId = encId;
              payerRowDirect.nextAction =
                "Completion tracking pending: pharmacy → patient pickup → payer closure";
              payerRowDirect.ownerRole = "payer";
              payerRowDirect.notes =
                "Encounter finalized; claim file held pending downstream milestones (demo).";
              payerRowDirect.updatedAt = t;
              payerRowDirect.closureCompletionScore = 40;
            }

            const pickup = snap.followUpTasks.find(
              (ft) =>
                ft.appointmentId === appointmentId &&
                ft.taskType === "pharmacy_pickup",
            );
            if (pickup) {
              pickup.prescriptionId = rx.id;
              pickup.pharmacyOrderId = order?.id;
              pickup.updatedAt = t;
              pickup.nextAction = "Pick up when pharmacy marks ready";
            }
          }

          if (stepBlock && !paHold) {
            const payerRowSt = snap.payerStatuses.find((p) => p.appointmentId === appointmentId);
            if (payerRowSt) {
              payerRowSt.encounterId = encId;
              payerRowSt.nextAction = "Await clinical documentation / therapy revision";
              payerRowSt.updatedAt = t;
            }
          }

          if (patientRow) patientRow.updatedAt = t;

          const hasCallback = snap.followUpTasks.some(
            (ft) =>
              ft.appointmentId === appointmentId && ft.taskType === "callback",
          );
          if (!hasCallback) {
            snap.followUpTasks.push({
              id: `fut_fin_${Date.now()}`,
              patientId,
              appointmentId,
              title: "Post-visit check-in",
              description: "Confirm understanding of medications and follow-up.",
              taskType: "callback",
              status: "scheduled",
              dueAt: new Date(Date.now() + 86400000).toISOString(),
              priority: "normal",
              ownerRole: "patient",
              nextAction: "Respond in Care Orchestrator or call clinic if questions",
              notes: "Created when encounter was finalized.",
              createdAt: t,
              updatedAt: t,
            });
          }

          snap.followUpTasks.push({
            id: `fut_edu_${Date.now()}`,
            patientId,
            appointmentId,
            prescriptionId: rx.id,
            title: "Read your visit summary in Care Orchestrator",
            description: "Plain-language recap from your clinician.",
            taskType: "education",
            status: "scheduled",
            dueAt: new Date(Date.now() + 3600000).toISOString(),
            priority: "low",
            ownerRole: "patient",
            nextAction: "Open patient summary in app",
            notes: "Generated at finalize.",
            createdAt: t,
            updatedAt: t,
          });

          pushWorkflowEngineEventImpl(snap, {
            kind: "prescription_created",
            title: "Encounter signed — Rx updated",
            detail: rx.status,
            trigger: "Provider finalized visit",
            decision: stepBlock ?
              "Hold for step therapy"
            : paHold ?
              "Submit prior authorization"
            : "Release to pharmacy",
            action: "Workflow state advanced by finalize",
            result: `Prescription status is now ${rx.status}`,
            reason: coverageBranch.reason,
            patientId,
            prescriptionId: rx.id,
            role: "provider",
          });

          applyEscalationEvents(snap, { patientId, appointmentId, prescriptionId: rx.id });

          if (agentRun) {
            snap.encounterAgentRunsByAppointment[appointmentId] = {
              ...agentRun,
              finishedAt: t,
              encounterId: encId,
              prescriptionId: agentRun.prescriptionId ?? rx.id,
            };
          }

          return { snapshot: snap };
        }),

      resolvePriorAuthCase: (caseId, resolution) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          ensureWorkflowFields(snap);
          const pa = snap.priorAuthCases.find((c) => c.id === caseId);
          if (!pa || pa.status !== "pending_review") return s;

          const t = ts();
          const rx = snap.prescriptions.find((p) => p.id === pa.prescriptionId);
          const patientRow = snap.patients.find((p) => p.id === pa.patientId);
          const pharmacyEntity =
            snap.pharmacies.find((ph) => ph.id === patientRow?.preferredPharmacyId) ??
            snap.pharmacies[0];

          if (resolution === "approved") {
            pa.status = "approved";
            pa.resolvedAt = t;
            if (rx) {
              rx.status = "received_by_pharmacy";
              rx.writtenAt = rx.writtenAt ?? t;
              rx.sentAt = t;
              rx.pharmacyId = pharmacyEntity?.id;
              rx.pharmacyOrderId =
                rx.pharmacyOrderId ??
                snap.pharmacyOrders.find((o) => o.prescriptionId === rx.id)?.id;
              rx.externalPharmacyOrderId =
                rx.externalPharmacyOrderId ?? `MOCK-NCPDP-${rx.id.slice(-6)}`;
              rx.nextAction = "Pharmacy to fill and notify patient";
              rx.ownerRole = "pharmacy";
              rx.coverageNotes = undefined;
              rx.updatedAt = t;
              if (patientRow && pharmacyEntity) {
                snap.pharmacyHandoffsByPrescription[rx.id] = buildPharmacyHandoffPayload({
                  prescription: rx,
                  patientDisplayName: patientRow.displayName,
                  patientDob: patientRow.dateOfBirth,
                  pharmacy: pharmacyEntity,
                });
              }
              const order = snap.pharmacyOrders.find((o) => o.prescriptionId === rx.id);
              if (order) {
                order.status = "received";
                order.sentAt = t;
                order.receivedAt = t;
                order.pharmacyId = pharmacyEntity.id;
                order.nextAction = "Fill prescription and notify patient";
                order.ownerRole = "pharmacy";
                order.externalFulfillmentId = rx.externalPharmacyOrderId;
                order.updatedAt = t;
              }
              const appt = findAppointment(snap, pa.appointmentId);
              if (appt) {
                appt.currentStage = "pharmacy";
                appt.nextAction = "Await pharmacy fulfillment";
                appt.updatedAt = t;
              }
              const pickup = snap.followUpTasks.find(
                (ft) =>
                  ft.appointmentId === pa.appointmentId &&
                  ft.taskType === "pharmacy_pickup",
              );
              if (pickup && order) {
                pickup.prescriptionId = rx.id;
                pickup.pharmacyOrderId = order.id;
                pickup.updatedAt = t;
                pickup.nextAction = "Pick up when pharmacy marks ready";
              }
            }
            pushWorkflowEngineEventImpl(snap, {
              kind: "pa_approved",
              title: "PA approved — e-Rx released",
              detail: pa.drugName,
              trigger: "Payer adjudication completed",
              decision: "Approve PA",
              action: "Release prescription to pharmacy",
              result: "Pharmacy queue now owns fill workflow",
              reason: "Plan approved required medication.",
              patientId: pa.patientId,
              prescriptionId: pa.prescriptionId,
              role: "payer",
            });
            pushWorkflowEngineEventImpl(snap, {
              kind: "provider_alerted",
              title: "Provider inbox: PA approved",
              detail: `You may tell the patient ${pa.drugName} is cleared.`,
              patientId: pa.patientId,
              prescriptionId: pa.prescriptionId,
              role: "provider",
            });
            snap.patientWorkflowNotifications.unshift({
              id: `pwn_pa_${Date.now()}`,
              patientId: pa.patientId,
              createdAt: t,
              title: "Medication approved",
              body: `Your plan approved ${pa.drugName}. The pharmacy will prepare it for pickup.`,
              source: "care_team",
            });
          } else if (resolution === "denied") {
            pa.status = "denied";
            pa.resolvedAt = t;
            pa.denialReason =
              "Does not meet formulary criteria — trial of preferred agent required (demo).";
            pa.suggestedAlternative = "Preferred formulary alternative per plan policy (demo).";
            if (rx) {
              rx.status = "pa_denied";
              rx.nextAction = "Prescriber: appeal or change therapy";
              rx.coverageNotes = pa.denialReason;
              rx.updatedAt = t;
            }
            pushWorkflowEngineEventImpl(snap, {
              kind: "pa_denied",
              title: "PA denied",
              detail: pa.denialReason,
              trigger: "Payer adjudication completed",
              decision: "Deny PA",
              action: "Return to provider for appeal/alternative",
              result: "Prescription remains blocked from pharmacy release",
              reason: pa.denialReason,
              patientId: pa.patientId,
              prescriptionId: pa.prescriptionId,
              role: "payer",
            });
            pushWorkflowEngineEventImpl(snap, {
              kind: "formulary_alternative",
              title: "Alternative suggested",
              detail: pa.suggestedAlternative,
              patientId: pa.patientId,
              prescriptionId: pa.prescriptionId,
              role: "system",
            });
          } else {
            pa.status = "more_info_needed";
            pa.resolvedAt = t;
            pa.moreInfoQuestion =
              "Please upload chart notes showing 3-month A1c trend and contraindications (demo).";
            if (rx) {
              rx.status = "pending_prior_auth";
              rx.nextAction = "Provider: supply additional information to payer";
              rx.updatedAt = t;
            }
            snap.followUpTasks.push({
              id: `fut_pa_info_${Date.now()}`,
              patientId: pa.patientId,
              appointmentId: pa.appointmentId,
              prescriptionId: pa.prescriptionId,
              title: "Payer needs more information",
              description: pa.moreInfoQuestion,
              taskType: "referral",
              status: "scheduled",
              dueAt: new Date(Date.now() + 172800000).toISOString(),
              priority: "high",
              ownerRole: "provider",
              nextAction: "Upload documentation and resubmit PA",
              notes: "PA hold (demo).",
              createdAt: t,
              updatedAt: t,
            });
            pushWorkflowEngineEventImpl(snap, {
              kind: "pa_more_info_needed",
              title: "PA: more information requested",
              detail: pa.moreInfoQuestion,
              trigger: "Payer adjudication completed",
              decision: "Need more information",
              action: "Create provider documentation task",
              result: "PA case remains blocked pending chart upload",
              reason: pa.moreInfoQuestion,
              patientId: pa.patientId,
              prescriptionId: pa.prescriptionId,
              role: "provider",
            });
          }

          applyEscalationEvents(snap, {
            patientId: pa.patientId,
            appointmentId: pa.appointmentId,
            prescriptionId: pa.prescriptionId,
          });

          return { snapshot: snap };
        }),

      generateChartSummary: async (patientId) => {
        const clinical = get().snapshot.clinicalByPatientId[patientId];
        if (!clinical) return;
        set({ aiLoading: true, lastChartSummaryMeta: null });
        try {
          const res = await fetch("/api/ai/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, clinical }),
          });
          let data: {
            summary?: AiHistorySummary;
            error?: string;
            code?: string;
          };
          try {
            data = (await res.json()) as typeof data;
          } catch {
            set({
              lastChartSummaryMeta: {
                patientId,
                source: "xai",
                error: "Summary API returned invalid JSON",
              },
            });
            return;
          }
          if (!res.ok || !data.summary) {
            set({
              lastChartSummaryMeta: {
                patientId,
                source: "xai",
                error: data.error ?? `Summary request failed (${res.status})`,
              },
            });
            return;
          }
          get().setAiSummary(patientId, data.summary);
          set({
            lastChartSummaryMeta: {
              patientId,
              source: "xai",
            },
          });
        } finally {
          set({ aiLoading: false });
        }
      },

      saveEncounter: (appointmentId, partial) => {
        get().saveProviderVisitDraft(appointmentId, partial);
      },

      createPrescription: ({ appointmentId, lines }) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const rx = snap.prescriptions.find((p) => p.appointmentId === appointmentId);
          if (!rx || rx.status !== "draft") return s;
          rx.lines = lines.map((line, i) => ({
            ...line,
            id: line.id || `rxl_${Date.now()}_${i}`,
          }));
          rx.updatedAt = ts();
          return { snapshot: snap };
        }),

      markPharmacyPickup: (prescriptionId, source = "pharmacy") =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const ok = runMedicationPickup(
            snap,
            prescriptionId,
            source === "patient" ? "patient_app" : "pharmacy_counter",
          );
          if (!ok) return s;
          return { snapshot: snap };
        }),

      confirmAdherence: (checkId) => {
        get().patientCompleteAdherenceCheck(checkId);
      },

      updatePayerCompletion: (payerStatusId, patch) =>
        set((s) => {
          const snap = structuredClone(s.snapshot);
          const row = snap.payerStatuses.find((r) => r.id === payerStatusId);
          if (!row) return s;
          if (patch.closureCompletionScore != null) {
            row.closureCompletionScore = Math.min(
              100,
              Math.max(0, patch.closureCompletionScore),
            );
          }
          if (patch.claimStatus != null) {
            row.claimStatus = patch.claimStatus;
          }
          row.updatedAt = ts();
          return { snapshot: snap };
        }),

      resetDemo: (options) => {
        const snap = cloneSeed();
        const preserveJudgeDemo = options?.preserveJudgeDemo === true;
        set((s) => ({
          selectedPatientId: null,
          selectedAppointmentId: null,
          snapshot: snap,
          aiLoading: false,
          lastChartSummaryMeta: null,
          demoEncounterUnlockAt: null,
          ehrVisitBriefingLines: {},
          careLoopOrchestration: initialCareLoopOrchestration,
          judgeDemo: preserveJudgeDemo ? s.judgeDemo : getInitialJudgeDemo(),
          guidedStory: getInitialGuidedStory(),
          agentActivity: initialAgentActivity,
          workflowDockPrimaryAction: null,
        }));
      },
    }),
    {
      name: "careloop-workflow",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPatientId: state.selectedPatientId,
        selectedAppointmentId: state.selectedAppointmentId,
        snapshot: state.snapshot,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<CareWorkflowState> | undefined;
        const cur = current as CareWorkflowState;
        if (!p) return cur;
        const snap = structuredClone(p.snapshot ?? cur.snapshot) as typeof SEED;
        ensureWorkflowFields(snap);
        const pid =
          p.selectedPatientId !== undefined ? p.selectedPatientId : cur.selectedPatientId;
        let aid =
          p.selectedAppointmentId !== undefined ?
            p.selectedAppointmentId
          : cur.selectedAppointmentId;
        if (pid == null) {
          aid = null;
        } else if (
          aid == null ||
          !snap.appointments.some((a) => a.id === aid && a.patientId === pid)
        ) {
          aid = defaultAppointmentIdForPatient(snap, pid);
        }
        return {
          ...cur,
          ...p,
          snapshot: snap,
          selectedPatientId: pid,
          selectedAppointmentId: aid,
        };
      },
      skipHydration: true,
    },
  ),
);

export function rehydrateCareWorkflowStore() {
  useCareWorkflowStore.persist.rehydrate();
}
