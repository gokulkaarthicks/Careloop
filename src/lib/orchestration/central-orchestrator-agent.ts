"use client";

import { runBackgroundPaPolicyResolution } from "@/lib/orchestration/background-pa-policy";
import { ORCHESTRATION_TIMING } from "@/lib/orchestration/orchestration-timing";
import { runRecoveryAutopilot } from "@/lib/recovery/recovery-orchestrator";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { CareLoopSnapshot, FollowUpTask, UUID } from "@/types/workflow";
import type { WorkflowEngineEvent } from "@/types/benefits";

const HISTORY_CACHE = new Map<
  UUID,
  { fingerprint: string; packet: PatientHistoryPacket; updatedAt: string }
>();

const PA_IN_FLIGHT = new Set<UUID>();

export type PatientHistoryPacket = {
  patientId: UUID;
  generatedAt: string;
  priorEncounterCount: number;
  activeMedicationCount: number;
  activeAllergyCount: number;
  diagnosisCount: number;
  recentEvents: string[];
  priorPaDenials: number;
  riskSignals: string[];
  summary: string;
};

export type AgentDecision = {
  trigger: string;
  decision: string;
  action: string;
  result: string;
  reason?: string;
};

export type AgentOutcome = {
  changed: boolean;
  decision?: AgentDecision;
};

export type OrchestratorRunOptions = {
  patientId?: UUID;
  source?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toMs(iso?: string): number {
  if (!iso) return Number.NaN;
  return Date.parse(iso);
}

function isRecent(iso: string | undefined, withinMs: number): boolean {
  const at = toMs(iso);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at <= withinMs;
}

function ensureWorkflowArrays(snap: CareLoopSnapshot) {
  if (!snap.workflowTimeline) snap.workflowTimeline = [];
  if (!snap.workflowEngineEvents) snap.workflowEngineEvents = [];
  if (!snap.patientWorkflowNotifications) snap.patientWorkflowNotifications = [];
  if (!snap.patientCareEvents) snap.patientCareEvents = [];
}

function pushEngineEvent(
  partial: Omit<WorkflowEngineEvent, "id" | "occurredAt">,
): void {
  useCareWorkflowStore.getState().pushWorkflowEngineEvent({
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
    role: partial.role,
  });
}

function hasRecentMatchingEvent(
  events: WorkflowEngineEvent[],
  match: {
    kind?: WorkflowEngineEvent["kind"];
    patientId?: UUID;
    prescriptionId?: UUID;
    titleIncludes?: string;
  },
  withinMs: number,
): boolean {
  return events.some((e) => {
    if (match.kind && e.kind !== match.kind) return false;
    if (match.patientId && e.patientId !== match.patientId) return false;
    if (match.prescriptionId && e.prescriptionId !== match.prescriptionId) return false;
    if (
      match.titleIncludes &&
      !e.title.toLowerCase().includes(match.titleIncludes.toLowerCase())
    ) {
      return false;
    }
    return isRecent(e.occurredAt, withinMs);
  });
}

function historyFingerprint(snap: CareLoopSnapshot, patientId: UUID): string {
  const clinical = snap.clinicalByPatientId[patientId];
  const encounters = snap.encounters.filter((e) => e.patientId === patientId).length;
  const pa = (snap.priorAuthCases ?? []).filter((c) => c.patientId === patientId).length;
  const meds = clinical?.medications.length ?? 0;
  const allergies = clinical?.allergies.length ?? 0;
  const dx = clinical?.diagnoses.length ?? 0;
  return `${encounters}|${pa}|${meds}|${allergies}|${dx}`;
}

export function runPatientHistoryAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): { packet: PatientHistoryPacket; changed: boolean } {
  const clinical = snapshot.clinicalByPatientId[patientId];
  const patient = snapshot.patients.find((p) => p.id === patientId);
  const encounters = snapshot.encounters
    .filter((e) => e.patientId === patientId)
    .sort((a, b) =>
      (b.endedAt ?? b.updatedAt ?? b.createdAt).localeCompare(
        a.endedAt ?? a.updatedAt ?? a.createdAt,
      ),
    );
  const recentEvents = (snapshot.patientCareEvents ?? [])
    .filter((e) => e.patientId === patientId)
    .slice(0, 4)
    .map((e) => e.summary);
  const priorPaDenials = (snapshot.priorAuthCases ?? []).filter(
    (c) => c.patientId === patientId && c.status === "denied",
  ).length;

  const riskSignals: string[] = [];
  if ((clinical?.allergies.length ?? 0) > 0) riskSignals.push("Active allergy history");
  if (priorPaDenials > 0) riskSignals.push("Prior authorization denial history");
  if ((clinical?.diagnoses.length ?? 0) >= 4) riskSignals.push("Multi-condition complexity");
  if ((snapshot.adherenceChecks ?? []).some((c) => c.patientId === patientId && c.status !== "completed")) {
    riskSignals.push("Open adherence checks");
  }

  const packet: PatientHistoryPacket = {
    patientId,
    generatedAt: nowIso(),
    priorEncounterCount: encounters.length,
    activeMedicationCount: clinical?.medications.length ?? 0,
    activeAllergyCount: clinical?.allergies.length ?? 0,
    diagnosisCount: clinical?.diagnoses.length ?? 0,
    recentEvents,
    priorPaDenials,
    riskSignals,
    summary: `${patient?.displayName ?? "Patient"}: ${encounters.length} prior encounters, ${
      clinical?.diagnoses.length ?? 0
    } diagnoses, ${(clinical?.medications.length ?? 0)} meds, ${
      clinical?.allergies.length ?? 0
    } allergies.`,
  };

  const fp = historyFingerprint(snapshot, patientId);
  const prev = HISTORY_CACHE.get(patientId);
  const changed = !prev || prev.fingerprint !== fp;
  if (changed) {
    HISTORY_CACHE.set(patientId, { fingerprint: fp, packet, updatedAt: nowIso() });
  }
  return { packet, changed };
}

export async function runPaInsuranceReasoningAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
  history: PatientHistoryPacket,
): Promise<AgentOutcome> {
  const pendingPa = (snapshot.priorAuthCases ?? []).filter(
    (c) => c.patientId === patientId && c.status === "pending_review",
  );
  if (pendingPa.length === 0) return { changed: false };

  const riskScore =
    (history.priorPaDenials > 0 ? 2 : 0) +
    (history.diagnosisCount >= 4 ? 1 : 0) +
    (history.activeMedicationCount >= 5 ? 1 : 0);
  const denialRisk = riskScore >= 3 ? "high" : riskScore === 2 ? "moderate" : "low";

  const events = snapshot.workflowEngineEvents ?? [];
  if (
    !hasRecentMatchingEvent(
      events,
      {
        kind: "payer_alerted",
        patientId,
        titleIncludes: "PA reasoning",
      },
      ORCHESTRATION_TIMING.paReasoningEventDedupeMs,
    )
  ) {
    pushEngineEvent({
      kind: "payer_alerted",
      title: `PA reasoning agent: ${denialRisk} denial risk`,
      detail: `Pending PA cases: ${pendingPa.length}. History signals: ${
        history.riskSignals.join(", ") || "none"
      }.`,
      trigger: "Pending prior-auth case detected",
      decision: `Prioritize payer adjudication (${denialRisk} risk)`,
      action: "Run payer PA adjudication agent in background",
      result: "PA queue processing started automatically",
      reason: history.summary,
      patientId,
      prescriptionId: pendingPa[0]?.prescriptionId,
      role: "payer",
    });
  }

  if (!PA_IN_FLIGHT.has(patientId)) {
    PA_IN_FLIGHT.add(patientId);
    try {
      await runBackgroundPaPolicyResolution(patientId);
    } finally {
      PA_IN_FLIGHT.delete(patientId);
    }
    return {
      changed: true,
      decision: {
        trigger: "Pending PA cases",
        decision: "Background payer adjudication",
        action: "Execute PA policy agent",
        result: "Cases resolved or queued for more info",
        reason: `Risk=${denialRisk}`,
      },
    };
  }

  return { changed: false };
}

export function runPharmacyFulfillmentAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): AgentOutcome {
  const candidate = snapshot.prescriptions.find((rx) => {
    if (rx.patientId !== patientId) return false;
    if (rx.status !== "received_by_pharmacy" && rx.status !== "sent") return false;
    const order = snapshot.pharmacyOrders.find((o) => o.prescriptionId === rx.id);
    if (!order) return false;
    if (order.status !== "received" && order.status !== "sent_to_pharmacy") return false;
    return !isRecent(rx.updatedAt, ORCHESTRATION_TIMING.pharmacyAutoReadyMinRxAgeMs);
  });
  if (!candidate) return { changed: false };

  useCareWorkflowStore.getState().pharmacyMarkReady(candidate.id);
  pushEngineEvent({
    kind: "orchestrator_tick",
    title: "Pharmacy fulfillment agent: auto-ready",
    detail: `${candidate.lines[0]?.drugName ?? "Medication"} moved to ready_for_pickup.`,
    trigger: "Order in received queue without blockers",
    decision: "Advance fulfillment automatically",
    action: "Mark prescription ready for pickup",
    result: "Patient pickup reminder sequence can start",
    patientId,
    prescriptionId: candidate.id,
    role: "pharmacy",
  });
  return { changed: true };
}

export function runPatientReminderAdherenceAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): AgentOutcome {
  const readyRx = snapshot.prescriptions.filter(
    (rx) => rx.patientId === patientId && rx.status === "ready_for_pickup",
  );
  if (readyRx.length === 0) return { changed: false };

  let changed = false;
  useCareWorkflowStore.setState((s) => {
    const snap = structuredClone(s.snapshot);
    ensureWorkflowArrays(snap);
    const now = nowIso();
    for (const rx of snap.prescriptions) {
      if (rx.patientId !== patientId || rx.status !== "ready_for_pickup") continue;
      const hasRecentReminder = snap.patientWorkflowNotifications.some(
        (n) =>
          n.patientId === patientId &&
          n.title.toLowerCase().includes("pickup reminder") &&
          isRecent(n.createdAt, ORCHESTRATION_TIMING.pickupReminderDedupeMs),
      );
      if (hasRecentReminder) continue;
      snap.patientWorkflowNotifications.unshift({
        id: `pwn_pickup_rem_${Date.now()}_${rx.id.slice(-4)}`,
        patientId,
        createdAt: now,
        title: "Pickup reminder",
        body: `Your medication ${rx.lines[0]?.drugName ?? ""} is ready. Please pick up ${ORCHESTRATION_TIMING.pickupReminderDeadlineText}`,
        source: "care_team",
      });
      changed = true;
    }
    return changed ? { snapshot: snap } : s;
  });

  if (changed) {
    pushEngineEvent({
      kind: "patient_notified",
      title: "Reminder agent: pickup reminders sent",
      detail: "Patient received automated reminders for ready medications.",
      trigger: "Medication is ready_for_pickup",
      decision: "Send pickup reminder before escalation deadline",
      action: "Create patient notification",
      result: "Reminder visible in patient portal",
      patientId,
      role: "patient",
    });
  }
  return { changed };
}

export function runOrderCancellationEscalationAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): AgentOutcome {
  const overdueRx = snapshot.prescriptions.find((rx) => {
    if (rx.patientId !== patientId || rx.status !== "ready_for_pickup") return false;
    const pickupTask = snapshot.followUpTasks.find(
      (t) => t.prescriptionId === rx.id && t.taskType === "pharmacy_pickup",
    );
    if (!pickupTask) return false;
    const due = toMs(pickupTask.dueAt);
    return (
      Number.isFinite(due) && Date.now() - due > ORCHESTRATION_TIMING.pickupCancelAfterDueMs
    );
  });
  if (!overdueRx) return { changed: false };

  useCareWorkflowStore.setState((s) => {
    const snap = structuredClone(s.snapshot);
    ensureWorkflowArrays(snap);
    const now = nowIso();
    const rx = snap.prescriptions.find((p) => p.id === overdueRx.id);
    if (!rx || rx.status !== "ready_for_pickup") return s;
    rx.status = "cancelled";
    rx.nextAction = "Provider to review unresolved medication order";
    rx.ownerRole = "provider";
    rx.updatedAt = now;
    const order = snap.pharmacyOrders.find((o) => o.prescriptionId === rx.id);
    if (order && order.status !== "picked_up") {
      order.status = "cancelled";
      order.updatedAt = now;
      order.nextAction = "Cancelled after unresolved pickup";
      order.ownerRole = "provider";
    }
    for (const task of snap.followUpTasks) {
      if (task.prescriptionId === rx.id && task.status !== "completed") {
        task.status = "cancelled";
        task.updatedAt = now;
      }
    }
    snap.workflowTimeline.unshift({
      id: `wt_cancel_${Date.now()}`,
      occurredAt: now,
      title: "Orchestrator: unresolved pickup cancelled",
      detail:
        "Order was not picked up by deadline. Workflow escalated to provider and payer.",
      patientId,
      prescriptionId: rx.id,
      appointmentId: rx.appointmentId,
    });
    snap.patientWorkflowNotifications.unshift({
      id: `pwn_cancel_${Date.now()}`,
      patientId,
      createdAt: now,
      title: "Medication order cancelled",
      body: "Pickup deadline was missed. Your care team will contact you to restart treatment safely.",
      source: "care_team",
    });
    return { snapshot: snap };
  });

  pushEngineEvent({
    kind: "provider_alerted",
    title: "Escalation agent: unresolved pickup cancelled",
    detail: overdueRx.lines[0]?.drugName ?? "Medication",
    trigger: "Pickup deadline exceeded",
    decision: "Cancel unresolved order and escalate",
    action: "Cancel pharmacy order + alert provider and payer",
    result: "Order moved to cancelled, follow-up required",
    patientId,
    prescriptionId: overdueRx.id,
    role: "provider",
  });
  pushEngineEvent({
    kind: "payer_alerted",
    title: "Payer notified: unresolved medication order",
    detail: "Order cancelled after missed pickup deadline.",
    patientId,
    prescriptionId: overdueRx.id,
    role: "payer",
  });
  return { changed: true };
}

export function runProviderFollowUpAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): AgentOutcome {
  const overdue = snapshot.followUpTasks.filter((t) => {
    if (t.patientId !== patientId) return false;
    if (t.status === "completed" || t.status === "cancelled") return false;
    const due = toMs(t.dueAt);
    return Number.isFinite(due) && Date.now() > due;
  });
  if (overdue.length === 0) return { changed: false };

  const hasRescheduleTask = snapshot.followUpTasks.some(
    (t) =>
      t.patientId === patientId &&
      t.title.toLowerCase().includes("reschedule") &&
      t.status !== "completed" &&
      t.status !== "cancelled",
  );
  if (hasRescheduleTask) return { changed: false };

  useCareWorkflowStore.setState((s) => {
    const snap = structuredClone(s.snapshot);
    ensureWorkflowArrays(snap);
    const now = nowIso();
    const pivot = overdue[0];
    const task: FollowUpTask = {
      id: `fut_reschedule_${Date.now()}`,
      patientId,
      appointmentId: pivot.appointmentId,
      prescriptionId: pivot.prescriptionId,
      title: "Reschedule missed follow-up appointment",
      description: "Patient missed follow-up milestone; schedule next available visit.",
      taskType: "callback",
      status: "scheduled",
      dueAt: new Date(
        Date.now() + ORCHESTRATION_TIMING.providerRescheduleTaskDueOffsetMs,
      ).toISOString(),
      priority: "high",
      ownerRole: "provider",
      nextAction: "Contact patient and confirm a new appointment time",
      notes: "Generated automatically by provider follow-up agent.",
      createdAt: now,
      updatedAt: now,
    };
    snap.followUpTasks.unshift(task);
    return { snapshot: snap };
  });

  pushEngineEvent({
    kind: "provider_alerted",
    title: "Provider follow-up agent: task created",
    detail: "Rescheduling task created due to missed follow-up.",
    trigger: "Follow-up milestone overdue",
    decision: "Escalate to provider outreach",
    action: "Create high-priority rescheduling task",
    result: "Provider queue now includes rescheduling work",
    patientId,
    role: "provider",
  });
  return { changed: true };
}

export function runAppointmentReschedulingAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): AgentOutcome {
  const dueTask = snapshot.followUpTasks.find((t) => {
    if (t.patientId !== patientId) return false;
    if (!t.title.toLowerCase().includes("reschedule")) return false;
    if (t.status !== "scheduled" && t.status !== "open") return false;
    const due = toMs(t.dueAt);
    return Number.isFinite(due) && Date.now() > due;
  });
  if (!dueTask) return { changed: false };

  useCareWorkflowStore.setState((s) => {
    const snap = structuredClone(s.snapshot);
    ensureWorkflowArrays(snap);
    const now = nowIso();
    const task = snap.followUpTasks.find((t) => t.id === dueTask.id);
    if (!task || (task.status !== "scheduled" && task.status !== "open")) return s;
    task.status = "completed";
    task.updatedAt = now;
    task.nextAction = "Rescheduled automatically";

    const base = task.appointmentId
      ? snap.appointments.find((a) => a.id === task.appointmentId)
      : undefined;
    const providerId = base?.providerId ?? snap.providers[0]?.id;
    if (!providerId) return s;

    const newApptId = `appt_resched_${Date.now()}`;
    snap.appointments.push({
      id: newApptId,
      patientId,
      providerId,
      title: "Automated follow-up reschedule",
      scheduledFor: new Date(
        Date.now() + ORCHESTRATION_TIMING.rescheduledAppointmentOffsetMs,
      ).toISOString(),
      status: "scheduled",
      currentStage: "intake",
      priority: "high",
      nextAction: "Provider to reopen visit after missed follow-up",
      ownerRole: "provider",
      notes: "Created by appointment rescheduling agent.",
      createdAt: now,
      updatedAt: now,
    });
    snap.patientWorkflowNotifications.unshift({
      id: `pwn_resched_${Date.now()}`,
      patientId,
      createdAt: now,
      title: "Follow-up appointment rescheduled",
      body: "We scheduled your next follow-up automatically because your previous follow-up was missed.",
      source: "care_team",
    });
    return { snapshot: snap };
  });

  pushEngineEvent({
    kind: "patient_notified",
    title: "Appointment rescheduling agent: new visit created",
    detail: "Missed follow-up triggered automatic rescheduling.",
    trigger: "Reschedule task overdue",
    decision: "Create next available follow-up slot",
    action: "Schedule new appointment + notify patient",
    result: "Care loop remains active with recovery path",
    patientId,
    role: "care_coordinator",
  });
  return { changed: true };
}

export function runPayerFollowUpAgent(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
): AgentOutcome {
  const row = snapshot.payerStatuses.find((p) => p.patientId === patientId);
  if (!row) return { changed: false };

  const rxPickedUp = snapshot.prescriptions.some(
    (rx) => rx.patientId === patientId && rx.status === "picked_up",
  );
  const pendingPa = (snapshot.priorAuthCases ?? []).some(
    (c) => c.patientId === patientId && c.status === "pending_review",
  );
  if (!rxPickedUp || pendingPa || row.claimStatus === "paid") return { changed: false };

  useCareWorkflowStore.getState().payerMarkComplete(row.id, "paid");
  pushEngineEvent({
    kind: "care_completed",
    title: "Payer follow-up agent: care loop closed",
    detail: "Medication picked up and payer closure finalized.",
    trigger: "Downstream milestones complete",
    decision: "Auto-close payer claim path",
    action: "Mark payer status paid",
    result: "Appointment loop complete",
    patientId,
    role: "payer",
  });
  return { changed: true };
}

function activePatients(snapshot: CareLoopSnapshot, selectedPatientId: UUID | null): UUID[] {
  if (selectedPatientId) return [selectedPatientId];
  const ids = new Set<UUID>();
  for (const rx of snapshot.prescriptions) {
    if (rx.status !== "picked_up" && rx.status !== "cancelled") ids.add(rx.patientId);
  }
  for (const pa of snapshot.priorAuthCases ?? []) {
    if (pa.status === "pending_review") ids.add(pa.patientId);
  }
  for (const t of snapshot.followUpTasks) {
    if (t.status !== "completed" && t.status !== "cancelled") ids.add(t.patientId);
  }
  return Array.from(ids);
}

/**
 * Central orchestrator agent:
 * reads workflow state, runs specialized sub-agents, applies branch actions,
 * and emits trigger/decision/action/result events for the live dock stream.
 */
export async function runCentralOrchestratorAgent(
  options: OrchestratorRunOptions = {},
): Promise<void> {
  const store = useCareWorkflowStore.getState();
  const source = options.source ?? "automation loop";
  const snapshot = store.snapshot;
  const targets =
    options.patientId ? [options.patientId] : activePatients(snapshot, store.selectedPatientId);
  if (targets.length === 0) return;

  pushEngineEvent({
    kind: "orchestrator_tick",
    title: "Central orchestrator tick",
    detail: `Evaluating ${targets.length} active patient workflow(s).`,
    trigger: source,
    decision: "Run modular sub-agents by state",
    action: "History → PA → pharmacy → reminders → escalations → payer closure",
    result: "Workflow branches auto-advanced where eligible",
    role: "system",
  });

  for (const patientId of targets) {
    const current = useCareWorkflowStore.getState().snapshot;
    const { packet, changed: packetChanged } = runPatientHistoryAgent(current, patientId);
    if (packetChanged) {
      pushEngineEvent({
        kind: "chart_loaded",
        title: "Patient history agent: context packet refreshed",
        detail: packet.summary,
        trigger: "State change in patient chart/timeline",
        decision: "Refresh semantic history packet",
        action: "Recompute contextual risk signals",
        result: "Provider and payer agents can reason from latest history",
        reason: packet.riskSignals.join(", "),
        patientId,
        role: "provider",
      });
    }

    await runPaInsuranceReasoningAgent(useCareWorkflowStore.getState().snapshot, patientId, packet);
    runPharmacyFulfillmentAgent(useCareWorkflowStore.getState().snapshot, patientId);
    runPatientReminderAdherenceAgent(useCareWorkflowStore.getState().snapshot, patientId);
    runOrderCancellationEscalationAgent(useCareWorkflowStore.getState().snapshot, patientId);
    runProviderFollowUpAgent(useCareWorkflowStore.getState().snapshot, patientId);
    runAppointmentReschedulingAgent(useCareWorkflowStore.getState().snapshot, patientId);
    runPayerFollowUpAgent(useCareWorkflowStore.getState().snapshot, patientId);
    await runRecoveryAutopilot(patientId);
  }
}

