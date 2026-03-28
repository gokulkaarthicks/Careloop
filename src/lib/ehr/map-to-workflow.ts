import type * as schema from "@/lib/ehr/schema";
import type {
  Appointment,
  WorkflowStage,
  AppointmentStatus,
  TaskPriority,
  OwnerRole,
} from "@/types/workflow";

export function mapDbAppointmentToWorkflow(
  row: typeof schema.appointments.$inferSelect,
): Appointment {
  return {
    id: row.id,
    patientId: row.patientId,
    providerId: row.providerId ?? "",
    title: row.title,
    scheduledFor: row.scheduledFor,
    status: row.status as AppointmentStatus,
    currentStage: row.currentStage as WorkflowStage,
    priority: row.priority as TaskPriority,
    nextAction: row.nextAction,
    ownerRole: row.ownerRole as OwnerRole,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
