import { runPaAutoFighter } from "@/lib/recovery/pa-auto-fighter";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { RecoveryCase, RecoveryFailureKind } from "@/types/recovery";

type FailureSignal = {
  patientId: string;
  prescriptionId?: string;
  title: string;
  summary: string;
  failureKind: RecoveryFailureKind;
  sourceEventId?: string;
  sourceEventKind?: string;
};

function collectFailureSignals(patientId?: string): FailureSignal[] {
  const snap = useCareWorkflowStore.getState().snapshot;
  const events = (snap.workflowEngineEvents ?? []).filter((e) => !patientId || e.patientId === patientId);
  const out: FailureSignal[] = [];
  for (const e of events) {
    if (!e.patientId) continue;
    if (e.kind === "pa_denied") {
      out.push({
        patientId: e.patientId,
        prescriptionId: e.prescriptionId,
        title: "PA denial requires autonomous recovery",
        summary: e.detail ?? "Denied PA case detected.",
        failureKind: "pa_denied",
        sourceEventId: e.id,
        sourceEventKind: e.kind,
      });
    }
    if (e.kind === "pa_more_info_needed") {
      out.push({
        patientId: e.patientId,
        prescriptionId: e.prescriptionId,
        title: "PA more-info request requires recovery",
        summary: e.detail ?? "Payer requested additional documentation.",
        failureKind: "pa_more_info_needed",
        sourceEventId: e.id,
        sourceEventKind: e.kind,
      });
    }
    if (e.kind === "provider_alerted" && e.title.toLowerCase().includes("pickup")) {
      out.push({
        patientId: e.patientId,
        prescriptionId: e.prescriptionId,
        title: "Missed pickup requires recovery",
        summary: e.detail ?? "Missed pickup escalation detected.",
        failureKind: "pickup_missed",
        sourceEventId: e.id,
        sourceEventKind: e.kind,
      });
    }
    if (e.kind === "follow_up_missed") {
      out.push({
        patientId: e.patientId,
        prescriptionId: e.prescriptionId,
        title: "Missed follow-up requires recovery",
        summary: e.detail ?? "Follow-up overdue.",
        failureKind: "follow_up_missed",
        sourceEventId: e.id,
        sourceEventKind: e.kind,
      });
    }
  }
  return out;
}

function findExistingRecoveryCase(signal: FailureSignal): RecoveryCase | undefined {
  const snap = useCareWorkflowStore.getState().snapshot;
  return snap.recoveryCases.find(
    (c) =>
      c.patientId === signal.patientId &&
      c.failureKind === signal.failureKind &&
      c.status !== "completed" &&
      c.status !== "failed",
  );
}

export async function runRecoveryAutopilot(patientId?: string): Promise<void> {
  const store = useCareWorkflowStore.getState();
  const signals = collectFailureSignals(patientId);
  for (const signal of signals) {
    if (findExistingRecoveryCase(signal)) continue;
    const pa = store.snapshot.priorAuthCases.find(
      (x) => x.patientId === signal.patientId && x.prescriptionId === signal.prescriptionId,
    );
    const recovery = store.openRecoveryCase({
      patientId: signal.patientId,
      prescriptionId: signal.prescriptionId,
      appointmentId: pa?.appointmentId,
      priorAuthCaseId: pa?.id,
      status: "detected",
      failureKind: signal.failureKind,
      title: signal.title,
      summary: signal.summary,
      sourceEventId: signal.sourceEventId,
      sourceEventKind: signal.sourceEventKind,
      ownerRole: "care_coordinator",
      priority: signal.failureKind.startsWith("pa_") ? "high" : "normal",
      connectorPayload: {
        sourceSystem: "careloop_demo",
        externalIds: {},
        capabilities: ["submit_appeal", "check_status", "send_patient_message"],
      },
    });
    store.pushWorkflowEngineEvent({
      kind: "recovery_case_opened",
      title: "Autonomous Recovery case opened",
      detail: `${recovery.failureKind} · ${recovery.title}`,
      trigger: `Detected ${signal.sourceEventKind ?? "workflow failure event"}`,
      decision: "Create RecoveryCase and launch planning",
      action: "Queue recovery planning/execution chain",
      result: "Failure is now actively managed by recovery control-plane",
      patientId: recovery.patientId,
      prescriptionId: recovery.prescriptionId,
      role: "care_coordinator",
    });

    store.updateRecoveryCaseStatus(recovery.id, "planning");
    store.appendRecoveryAction({
      recoveryCaseId: recovery.id,
      kind: "plan_created",
      status: "completed",
      ownerRole: "care_coordinator",
      priority: recovery.priority,
      summary: "Recovery plan created",
      detail: recovery.failureKind.startsWith("pa_")
        ? "Generate appeal package, submit via connector, and hold follow-up slot."
        : "Create patient outreach + follow-up hold + status verification.",
      completedAt: new Date().toISOString(),
    });
    store.pushWorkflowEngineEvent({
      kind: "recovery_plan_created",
      title: "Recovery plan drafted",
      detail: "Plan includes connector execution and SLA tracking.",
      patientId: recovery.patientId,
      prescriptionId: recovery.prescriptionId,
      role: "care_coordinator",
    });

    store.updateRecoveryCaseStatus(recovery.id, "executing");
    if (recovery.failureKind === "pa_denied" || recovery.failureKind === "pa_more_info_needed") {
      await runPaAutoFighter(recovery);
    } else {
      store.appendRecoveryAction({
        recoveryCaseId: recovery.id,
        kind: "draft_patient_outreach",
        status: "completed",
        ownerRole: "patient",
        priority: recovery.priority,
        summary: "Patient outreach drafted",
        detail: "Automated outreach prepared for missed milestone recovery.",
        completedAt: new Date().toISOString(),
      });
    }

    store.upsertSlaTimer({
      id: `sla_${recovery.id}`,
      recoveryCaseId: recovery.id,
      label: "Recovery resolution target",
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
    });
    store.logExternalSyncCheckpoint({
      id: `sync_${Date.now()}`,
      recoveryCaseId: recovery.id,
      connectorKey: "mock_default",
      checkpointType: "status_poll",
      status: "pending",
      checkedAt: new Date().toISOString(),
      notes: "Waiting for external status confirmation.",
    });
    store.updateRecoveryCaseStatus(recovery.id, "waiting_external");
  }
}
