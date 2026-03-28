import type { CareLoopSnapshot } from "@/types/workflow";
import type { DemoMetrics } from "./types";

export function captureDemoMetrics(
  snapshot: CareLoopSnapshot,
  patientId: string,
): DemoMetrics {
  const appt = snapshot.appointments
    .filter((a) => a.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    )[0];
  const rx = snapshot.prescriptions.find((p) => p.patientId === patientId);
  const order = rx
    ? snapshot.pharmacyOrders.find((o) => o.prescriptionId === rx.id)
    : undefined;
  const payer = snapshot.payerStatuses.find((p) => p.patientId === patientId);
  const tasks = snapshot.followUpTasks.filter((t) => t.patientId === patientId);
  const checks = snapshot.adherenceChecks.filter((c) => c.patientId === patientId);

  return {
    capturedAt: new Date().toISOString(),
    workflowStage: appt?.currentStage ?? "—",
    appointmentStatus: appt?.status ?? "—",
    rxStatus: rx?.status ?? "—",
    pharmacyOrderStatus: order?.status ?? "—",
    pickedUp: rx?.status === "picked_up",
    followUpsDone: tasks.filter((t) => t.status === "completed").length,
    followUpsTotal: tasks.length,
    adherenceDone: checks.filter((c) => c.status === "completed").length,
    adherenceTotal: checks.length,
    payerClosureScore: payer?.closureCompletionScore ?? null,
    payerClaimStatus: payer?.claimStatus ?? "—",
  };
}
