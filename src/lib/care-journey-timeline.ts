import type { CareLoopSnapshot, UUID } from "@/types/workflow";

export type CareJourneyStepState = "complete" | "current" | "upcoming";

export interface CareJourneyStep {
  id: string;
  label: string;
  state: CareJourneyStepState;
  /** Short context for tooltips / subtitles */
  hint?: string;
}

export type CareNotificationKind =
  | "missed_pickup"
  | "missed_followup"
  | "adherence_reminder"
  | "risk_escalation";

export interface CareNotificationBanner {
  id: string;
  kind: CareNotificationKind;
  title: string;
  description: string;
  tone: "warning" | "destructive" | "info";
}

function primaryAppointment(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
  appointmentId: UUID | null,
) {
  if (appointmentId) {
    const appt = snapshot.appointments.find(
      (a) => a.id === appointmentId && a.patientId === patientId,
    );
    if (appt) return appt;
  }
  const list = snapshot.appointments
    .filter((a) => a.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime(),
    );
  return list[0] ?? null;
}

function rxForAppointment(snapshot: CareLoopSnapshot, appointmentId: UUID) {
  return snapshot.prescriptions.find((p) => p.appointmentId === appointmentId) ?? null;
}

function orderForRx(snapshot: CareLoopSnapshot, prescriptionId: UUID | undefined) {
  if (!prescriptionId) return null;
  return snapshot.pharmacyOrders.find((o) => o.prescriptionId === prescriptionId) ?? null;
}

/**
 * Derives the closed-loop journey for dashboard timeline UI.
 * Step booleans are evaluated independently; the first incomplete step is marked `current`.
 */
export function buildCareJourneySteps(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
  appointmentId: UUID | null,
): CareJourneyStep[] {
  const appt = primaryAppointment(snapshot, patientId, appointmentId);
  if (!appt) {
    return [];
  }

  const draft = snapshot.providerVisitDrafts[appt.id];
  const ai = snapshot.aiSummaries[patientId];
  const chartInference = snapshot.chartInferenceByAppointment[appt.id];
  const rx = rxForAppointment(snapshot, appt.id);
  const order = orderForRx(snapshot, rx?.id);

  const payer = snapshot.payerStatuses.find((p) => p.appointmentId === appt.id) ?? null;

  const apptTasks = snapshot.followUpTasks.filter((t) => t.appointmentId === appt.id);

  const adherenceForVisit = snapshot.adherenceChecks.filter(
    (c) => c.patientId === patientId && (c.prescriptionId == null || c.prescriptionId === rx?.id),
  );
  const useConfirmed =
    adherenceForVisit.some((c) => c.status === "completed") ||
    snapshot.patientCareEvents.some(
      (e) =>
        e.patientId === patientId &&
        e.kind === "med_taken" &&
        (rx == null || e.prescriptionId === rx.id),
    );

  const booked =
    appt.status === "scheduled" ||
    appt.status === "in_progress" ||
    appt.status === "completed";

  const chartReady = !!ai;

  const risksReviewed =
    !!chartInference ||
    (appt.currentStage !== "intake" && appt.currentStage !== "ai_review");

  const soapSaved =
    !!draft?.finalizedAt ||
    snapshot.encounters.some(
      (e) => e.appointmentId === appt.id && e.status === "finished",
    );

  const rxSent =
    !!rx &&
    rx.status !== "draft" &&
    rx.status !== "cancelled";

  const pharmacyReady =
    order?.status === "ready_for_pickup" ||
    order?.status === "picked_up" ||
    rx?.status === "ready_for_pickup" ||
    rx?.status === "picked_up";

  const pickedUp = rx?.status === "picked_up" || order?.status === "picked_up";

  const followUpsDone =
    apptTasks.length === 0 ||
    apptTasks.every((t) => t.status === "completed" || t.status === "skipped");

  const payerClosed =
    !!payer &&
    (payer.claimStatus === "paid" ||
      payer.claimStatus === "approved" ||
      (payer.completedAt != null && payer.claimStatus !== "pending"));

  const flags: boolean[] = [
    booked,
    chartReady,
    risksReviewed,
    soapSaved,
    rxSent,
    pharmacyReady,
    pickedUp,
    useConfirmed,
    followUpsDone,
    payerClosed,
  ];

  const labels: { id: string; label: string; hint: string }[] = [
    { id: "booked", label: "Appointment booked", hint: "Visit scheduled in the chart" },
    { id: "chart", label: "Chart summary created", hint: "AI-assisted history & problem list" },
    { id: "risks", label: "Provider reviewed risks", hint: "Clinical risks acknowledged" },
    { id: "soap", label: "SOAP note saved", hint: "Assessment & plan documented" },
    { id: "rx", label: "Prescription sent", hint: "E-prescribe transmitted to pharmacy" },
    { id: "ready", label: "Pharmacy marked ready", hint: "Rx prepared for pickup" },
    { id: "pickup", label: "Patient picked up medication", hint: "Fulfillment confirmed" },
    { id: "adherence", label: "Patient confirmed use", hint: "Adherence or dose check-in" },
    { id: "followup", label: "Follow-up completed", hint: "Tasks closed or callbacks done" },
    { id: "payer", label: "Payer completion updated", hint: "Claim / closure milestone" },
  ];

  let firstIncomplete = flags.findIndex((f) => !f);
  if (firstIncomplete === -1) firstIncomplete = flags.length;

  return labels.map((meta, i) => {
    let state: CareJourneyStepState;
    if (flags[i]) state = "complete";
    else if (i === firstIncomplete) state = "current";
    else state = "upcoming";
    return {
      id: meta.id,
      label: meta.label,
      state,
      hint: meta.hint,
    };
  });
}

const MS_DAY = 86400000;

/**
 * Operational banners derived from mock state (missed windows, reminders, escalations).
 */
export function buildCareNotificationBanners(
  snapshot: CareLoopSnapshot,
  patientId: UUID,
  appointmentId: UUID | null,
  nowMs: number = Date.now(),
): CareNotificationBanner[] {
  const out: CareNotificationBanner[] = [];
  const appt = primaryAppointment(snapshot, patientId, appointmentId);
  if (!appt) return out;

  const rx = rxForAppointment(snapshot, appt.id);
  const order = orderForRx(snapshot, rx?.id);
  const ai = snapshot.aiSummaries[patientId];
  const chartInference = snapshot.chartInferenceByAppointment[appt.id];

  const pickupTask = snapshot.followUpTasks.find(
    (t) =>
      t.patientId === patientId &&
      t.taskType === "pharmacy_pickup" &&
      (t.appointmentId === appt.id || t.appointmentId == null),
  );
  const callbackTask = snapshot.followUpTasks.find(
    (t) =>
      t.patientId === patientId &&
      t.taskType === "callback" &&
      t.appointmentId === appt.id,
  );

  const pendingAdherence = snapshot.adherenceChecks.find(
    (c) =>
      c.patientId === patientId &&
      (c.status === "pending" || c.status === "overdue") &&
      new Date(c.scheduledFor).getTime() <= nowMs + MS_DAY,
  );

  // Missed pickup: ready at pharmacy but not collected, and pickup task past due
  if (
    order?.status === "ready_for_pickup" &&
    rx &&
    rx.status !== "picked_up" &&
    pickupTask &&
    pickupTask.status !== "completed" &&
    new Date(pickupTask.dueAt).getTime() < nowMs
  ) {
    out.push({
      id: "banner_missed_pickup",
      kind: "missed_pickup",
      title: "Missed pickup window",
      description:
        "Medication is ready but pickup wasn’t confirmed before the due time. Consider a gentle nudge or alternate pickup.",
      tone: "warning",
    });
  }

  // Missed follow-up: callback overdue
  if (
    callbackTask &&
    callbackTask.status !== "completed" &&
    callbackTask.status !== "skipped" &&
    new Date(callbackTask.dueAt).getTime() < nowMs
  ) {
    out.push({
      id: "banner_missed_followup",
      kind: "missed_followup",
      title: "Follow-up overdue",
      description:
        "A post-visit check-in is past due. The care team can reach out or reschedule the touchpoint.",
      tone: "warning",
    });
  }

  if (pendingAdherence) {
    out.push({
      id: `banner_adh_${pendingAdherence.id}`,
      kind: "adherence_reminder",
      title: "Adherence check-in due",
      description:
        pendingAdherence.status === "overdue"
          ? "Patient owes a medication check-in — escalate if no response."
          : "Reminder: patient should confirm medication use or home readings.",
      tone: pendingAdherence.status === "overdue" ? "destructive" : "info",
    });
  }

  const highAiRisk = ai?.risks?.some((r) => r.severity === "high");
  const highChartFlag = chartInference?.attentionFlags?.some((f) =>
    /high|urgent|critical/i.test(`${f.label} ${f.detail}`),
  );
  if (highAiRisk || highChartFlag) {
    out.push({
      id: "banner_risk_escalation",
      kind: "risk_escalation",
      title: "Risk escalation",
      description:
        "Elevated clinical risk flagged in chart review. Ensure provider acknowledgement and documented mitigation.",
      tone: "destructive",
    });
  }

  return out;
}
