"use client";

import type { CoverageEvaluationResult, WorkflowEngineEvent } from "@/types/benefits";
import type { CareLoopSnapshot, UUID } from "@/types/workflow";

export type BranchDecision = {
  trigger: string;
  decision: string;
  reason: string;
  action: string;
  result: string;
};

export function deriveCoverageBranch(
  coverage?: CoverageEvaluationResult,
): BranchDecision {
  if (!coverage) {
    return {
      trigger: "Finalize encounter with no coverage bundle",
      decision: "Default direct pharmacy route",
      reason: "Coverage adjudication was unavailable for this finalize run.",
      action: "Release e-prescription to pharmacy queue",
      result: "Pharmacy can begin fulfillment immediately",
    };
  }

  if (coverage.anyStepTherapyBlock) {
    const blockedDrugs = coverage.lines
      .filter((l) => l.route === "blocked_step_therapy")
      .map((l) => l.drugName)
      .join(", ");
    return {
      trigger: "Coverage tool detected a step-therapy gate",
      decision: "Hold prescription for documentation/therapy revision",
      reason:
        blockedDrugs ?
          `Step-therapy requirement on ${blockedDrugs}.`
        : "One or more lines require prior step-therapy evidence.",
      action: "Create provider hold and keep encounter in prescribing stage",
      result: "No pharmacy handoff until provider updates plan",
    };
  }

  if (coverage.holdForPriorAuth) {
    const paDrugs = coverage.lines
      .filter((l) => l.route === "payer_prior_auth")
      .map((l) => l.drugName)
      .join(", ");
    return {
      trigger: "Coverage tool flagged prior authorization",
      decision: "Route to payer prior-auth queue",
      reason:
        paDrugs ?
          `Prior authorization required for ${paDrugs}.`
        : "Plan rules require payer review before release.",
      action: "Create PA case(s) and notify payer/provider/patient",
      result: "Prescription remains on hold pending payer decision",
    };
  }

  return {
    trigger: "Coverage tool cleared prescription",
    decision: "Direct pharmacy release",
    reason: "No PA hold or step-therapy gate was detected.",
    action: "Transmit e-prescription and create pharmacy handoff",
    result: "Pharmacy queue now owns next action",
  };
}

export function decisionDetail(decision: BranchDecision): string {
  return `Trigger: ${decision.trigger} · Decision: ${decision.decision} · Action: ${decision.action} · Result: ${decision.result}`;
}

type EscalationContext = {
  patientId?: UUID;
  appointmentId?: UUID;
  prescriptionId?: UUID;
};

/** Lightweight rule engine for missed pickup / follow-up / adherence in demo mode. */
export function collectEscalations(
  snapshot: CareLoopSnapshot,
  context: EscalationContext,
): Array<{
  kind: WorkflowEngineEvent["kind"];
  title: string;
  detail: string;
  reason: string;
  patientId?: UUID;
  prescriptionId?: UUID;
  role: WorkflowEngineEvent["role"];
}> {
  const now = Date.now();
  const out: Array<{
    kind: WorkflowEngineEvent["kind"];
    title: string;
    detail: string;
    reason: string;
    patientId?: UUID;
    prescriptionId?: UUID;
    role: WorkflowEngineEvent["role"];
  }> = [];

  for (const task of snapshot.followUpTasks) {
    if (context.patientId && task.patientId !== context.patientId) continue;
    if (task.status === "completed" || task.status === "cancelled") continue;
    const due = Date.parse(task.dueAt);
    if (!Number.isFinite(due) || due > now) continue;

    if (task.taskType === "pharmacy_pickup") {
      out.push({
        kind: "follow_up_missed",
        title: "Medication pickup follow-up missed",
        detail:
          "Pickup task is overdue. Escalating to care team and patient reminder channel.",
        reason: "Pickup due time passed without completion.",
        patientId: task.patientId,
        prescriptionId: task.prescriptionId,
        role: "care_coordinator" as WorkflowEngineEvent["role"],
      });
    } else {
      out.push({
        kind: "follow_up_missed",
        title: "Follow-up task overdue",
        detail: `${task.title} is overdue and needs outreach.`,
        reason: "Task due time passed without completion.",
        patientId: task.patientId,
        prescriptionId: task.prescriptionId,
        role: "care_coordinator" as WorkflowEngineEvent["role"],
      });
    }
  }

  for (const check of snapshot.adherenceChecks) {
    if (context.patientId && check.patientId !== context.patientId) continue;
    if (check.status === "completed" || check.status === "waived") continue;
    const due = Date.parse(check.scheduledFor);
    if (!Number.isFinite(due) || due > now) continue;
    out.push({
      kind: "adherence_missed",
      title: "Adherence check missed",
      detail: "A scheduled medication check-in was missed.",
      reason: "Adherence checkpoint is overdue.",
      patientId: check.patientId,
      prescriptionId: check.prescriptionId,
      role: "patient",
    });
  }

  return out;
}

