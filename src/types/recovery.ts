import type { ISODateTime, OwnerRole, TaskPriority, UUID } from "@/types/workflow";

export type RecoveryCaseStatus =
  | "detected"
  | "planning"
  | "executing"
  | "waiting_external"
  | "completed"
  | "escalated"
  | "failed";

export type RecoveryFailureKind =
  | "pa_denied"
  | "pa_more_info_needed"
  | "pickup_missed"
  | "follow_up_missed"
  | "adherence_missed"
  | "connector_error";

export type RecoveryActionKind =
  | "plan_created"
  | "suggest_alternative"
  | "draft_patient_outreach"
  | "generate_appeal_package"
  | "submit_appeal"
  | "hold_follow_up_slot"
  | "status_check"
  | "escalate_to_human"
  | "close_case";

export type RecoveryActionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ConnectorPayloadEnvelope {
  sourceSystem: string;
  externalIds: Record<string, string>;
  capabilities: string[];
  rawPayloadRef?: string;
}

export interface AppealBundle {
  id: UUID;
  recoveryCaseId: UUID;
  patientId: UUID;
  priorAuthCaseId?: UUID;
  generatedAt: ISODateTime;
  generatedBy: "pa_auto_fighter";
  denialSummary: string;
  clinicalJustification: string;
  supportingEvidenceChecklist: string[];
  letterMarkdown: string;
  pdfFileName: string;
  pdfBase64: string;
  submissionDeadlineAt?: ISODateTime;
}

export interface ConnectorRun {
  id: UUID;
  recoveryCaseId: UUID;
  connectorKey: string;
  operation:
    | "read_case"
    | "submit_appeal"
    | "upload_attachment"
    | "check_status"
    | "send_patient_message"
    | "create_appointment_hold";
  status: RecoveryActionStatus;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
  requestSummary?: string;
  responseSummary?: string;
  error?: string;
  idempotencyKey: string;
}

export interface ExternalSyncCheckpoint {
  id: UUID;
  recoveryCaseId: UUID;
  connectorKey: string;
  checkpointType: "status_poll" | "deadline_watch" | "submission_ack";
  status: "pending" | "ok" | "error";
  checkedAt: ISODateTime;
  notes?: string;
}

export interface SlaTimer {
  id: UUID;
  recoveryCaseId: UUID;
  label: string;
  dueAt: ISODateTime;
  status: "active" | "met" | "breached";
  breachedAt?: ISODateTime;
}

export interface RecoveryAction {
  id: UUID;
  recoveryCaseId: UUID;
  kind: RecoveryActionKind;
  status: RecoveryActionStatus;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  ownerRole: OwnerRole;
  priority: TaskPriority;
  summary: string;
  detail?: string;
  error?: string;
}

export interface RecoveryCase {
  id: UUID;
  patientId: UUID;
  appointmentId?: UUID;
  prescriptionId?: UUID;
  priorAuthCaseId?: UUID;
  status: RecoveryCaseStatus;
  failureKind: RecoveryFailureKind;
  title: string;
  summary: string;
  sourceEventId?: UUID;
  sourceEventKind?: string;
  ownerRole: OwnerRole;
  priority: TaskPriority;
  connectorPayload?: ConnectorPayloadEnvelope;
  openedAt: ISODateTime;
  updatedAt: ISODateTime;
  closedAt?: ISODateTime;
}
