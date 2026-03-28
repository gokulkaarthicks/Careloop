import type {
  CareLoopSnapshot,
  Patient,
  PrescriptionStatus,
  WorkflowStage,
} from "@/types/workflow";

export type StatusTone = "success" | "warning" | "muted" | "danger";

export type MissedCareAlert = {
  id: string;
  patientId: string;
  patientName: string;
  severity: "high" | "medium" | "low";
  label: string;
  detail: string;
};

export type PayerTimelineItem = {
  id: string;
  occurredAt: string;
  category: "Care loop" | "Patient" | "Pharmacy" | "Clinical";
  title: string;
  detail: string;
  patientName: string;
};

export type MemberLoopMetrics = {
  patient: Patient;
  payerRowId?: string;
  /** 0–100 visit / care pathway progress */
  careCompletionPct: number;
  careStatusLabel: string;
  careTone: StatusTone;
  /** 0–100 Rx fulfillment */
  pickupPct: number;
  pickupStatusLabel: string;
  pickupTone: StatusTone;
  followUpCompleted: number;
  followUpTotal: number;
  followUpPct: number;
  adherenceCompleted: number;
  adherenceTotal: number;
  adherencePct: number;
  /** From payer row when present */
  closureScore: number | null;
  /** Composite value-style score 0–100 */
  valueBasedCareScore: number;
  claimStatus?: string;
};

const STAGE_WEIGHT: Record<WorkflowStage, number> = {
  intake: 18,
  ai_review: 28,
  planning: 38,
  prescribing: 48,
  pharmacy: 62,
  patient_followup: 78,
  payer_closure: 92,
};

function pickupPctFromRx(status: PrescriptionStatus | undefined): number {
  if (!status) return 0;
  switch (status) {
    case "picked_up":
      return 100;
    case "ready_for_pickup":
      return 72;
    case "received_by_pharmacy":
    case "sent":
      return 42;
    case "pending_prior_auth":
      return 18;
    case "pa_denied":
      return 0;
    case "draft":
      return 5;
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

function toneFromPct(pct: number, emptyOk = false): StatusTone {
  if (emptyOk && pct >= 99) return "success";
  if (pct >= 85) return "success";
  if (pct >= 55) return "warning";
  if (pct >= 20) return "warning";
  return "muted";
}

export function computeMemberLoopMetrics(
  snapshot: CareLoopSnapshot,
  patient: Patient,
): MemberLoopMetrics {
  const appt = snapshot.appointments.find((a) => a.patientId === patient.id);
  const draft = appt ? snapshot.providerVisitDrafts[appt.id] : undefined;
  let carePct = appt ? STAGE_WEIGHT[appt.currentStage] ?? 0 : 0;
  if (draft?.finalizedAt) carePct = Math.max(carePct, 58);
  if (appt?.status === "completed") carePct = 100;

  const rx = snapshot.prescriptions.find((r) => r.patientId === patient.id);
  const pickupPct = rx ? pickupPctFromRx(rx.status) : 0;

  const tasks = snapshot.followUpTasks.filter((t) => t.patientId === patient.id);
  const fuTotal = tasks.length;
  const fuDone = tasks.filter((t) => t.status === "completed").length;
  const followUpPct =
    fuTotal === 0 ? 100 : Math.round((fuDone / fuTotal) * 100);

  const checks = snapshot.adherenceChecks.filter((c) => c.patientId === patient.id);
  const adTotal = checks.length;
  const adDone = checks.filter((c) => c.status === "completed").length;
  const adherencePct =
    adTotal === 0 ? 100 : Math.round((adDone / adTotal) * 100);

  const payerRow = snapshot.payerStatuses.find((p) => p.patientId === patient.id);
  const closure = payerRow?.closureCompletionScore ?? null;

  const closureForBlend = closure ?? carePct * 0.45 + pickupPct * 0.35;

  const valueBasedCareScore = Math.min(
    100,
    Math.round(
      0.28 * closureForBlend +
        0.22 * carePct +
        0.22 * pickupPct +
        0.16 * followUpPct +
        0.12 * adherencePct,
    ),
  );

  let careStatusLabel = "Visit not started";
  if (appt?.status === "completed") careStatusLabel = "Episode closed";
  else if (draft?.finalizedAt && appt)
    careStatusLabel = `Visit finalized · ${appt.currentStage.replaceAll("_", " ")}`;
  else if (appt) careStatusLabel = appt.currentStage.replaceAll("_", " ");

  let pickupStatusLabel = "No prescription on file";
  if (rx) {
    pickupStatusLabel = rx.status.replaceAll("_", " ");
  }

  return {
    patient,
    payerRowId: payerRow?.id,
    careCompletionPct: Math.min(100, Math.round(carePct)),
    careStatusLabel,
    careTone: toneFromPct(carePct, true),
    pickupPct,
    pickupStatusLabel,
    pickupTone: toneFromPct(pickupPct, !rx),
    followUpCompleted: fuDone,
    followUpTotal: fuTotal,
    followUpPct,
    adherenceCompleted: adDone,
    adherenceTotal: adTotal,
    adherencePct,
    closureScore: closure,
    valueBasedCareScore,
    claimStatus: payerRow?.claimStatus,
  };
}

export function collectMissedCareAlerts(
  snapshot: CareLoopSnapshot,
): MissedCareAlert[] {
  const now = Date.now();
  const out: MissedCareAlert[] = [];

  for (const patient of snapshot.patients) {
    const name = patient.displayName;
    const pid = patient.id;

    for (const c of snapshot.adherenceChecks) {
      if (c.patientId !== pid || c.status !== "pending") continue;
      if (new Date(c.scheduledFor).getTime() < now) {
        out.push({
          id: `adh-${c.id}`,
          patientId: pid,
          patientName: name,
          severity: "medium",
          label: "Overdue check-in",
          detail: c.notes ?? "Adherence check-in was due — patient has not completed it.",
        });
      }
    }

    for (const t of snapshot.followUpTasks) {
      if (t.patientId !== pid) continue;
      if (t.status !== "open" && t.status !== "scheduled") continue;
      if (new Date(t.dueAt).getTime() < now) {
        out.push({
          id: `task-${t.id}`,
          patientId: pid,
          patientName: name,
          severity: t.priority === "urgent" || t.priority === "high" ? "high" : "medium",
          label: "Follow-up past due",
          detail: t.title,
        });
      }
    }

    const rx = snapshot.prescriptions.find((r) => r.patientId === pid);
    if (rx?.status === "ready_for_pickup") {
      out.push({
        id: `rx-ready-${rx.id}`,
        patientId: pid,
        patientName: name,
        severity: "low",
        label: "Pickup ready",
        detail: "Medication is ready for pickup — confirm patient or pharmacy handoff.",
      });
    }
  }

  return out;
}

export function buildPayerCompletedTimeline(
  snapshot: CareLoopSnapshot,
  limit = 40,
): PayerTimelineItem[] {
  const rows: PayerTimelineItem[] = [];

  for (const e of snapshot.workflowTimeline ?? []) {
    const p = snapshot.patients.find((x) => x.id === e.patientId);
    let category: PayerTimelineItem["category"] = "Care loop";
    if (e.title.toLowerCase().includes("pharmacy")) category = "Pharmacy";
    if (e.title.toLowerCase().includes("patient") || e.title.toLowerCase().includes("symptom"))
      category = "Clinical";
    rows.push({
      id: `wf-${e.id}`,
      occurredAt: e.occurredAt,
      category,
      title: e.title,
      detail: e.detail,
      patientName: p?.displayName ?? "Member",
    });
  }

  for (const e of snapshot.patientCareEvents ?? []) {
    const p = snapshot.patients.find((x) => x.id === e.patientId);
    rows.push({
      id: `pce-${e.id}`,
      occurredAt: e.at,
      category: "Patient",
      title: e.summary,
      detail: e.detail ?? "",
      patientName: p?.displayName ?? "Member",
    });
  }

  rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return rows.slice(0, limit);
}

export function cohortAverageVbc(members: MemberLoopMetrics[]): number {
  if (members.length === 0) return 0;
  const sum = members.reduce((s, m) => s + m.valueBasedCareScore, 0);
  return Math.round(sum / members.length);
}
