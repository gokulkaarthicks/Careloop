import type { ConnectorPayloadEnvelope } from "@/types/recovery";
import type { UUID } from "@/types/workflow";

export type ConnectorCapability =
  | "read_case"
  | "submit_appeal"
  | "upload_attachment"
  | "check_status"
  | "send_patient_message"
  | "create_appointment_hold";

export type ConnectorOperation =
  | "read_case"
  | "submit_appeal"
  | "upload_attachment"
  | "check_status"
  | "send_patient_message"
  | "create_appointment_hold";

export type ConnectorResult = {
  ok: boolean;
  summary: string;
  externalReference?: string;
  raw?: Record<string, unknown>;
  error?: string;
};

export interface ConnectorContext {
  recoveryCaseId: UUID;
  patientId: UUID;
  appointmentId?: UUID;
  prescriptionId?: UUID;
  connectorPayload?: ConnectorPayloadEnvelope;
}

export interface RecoveryConnectorAdapter {
  key: string;
  label: string;
  capabilities: ConnectorCapability[];
  execute: (operation: ConnectorOperation, context: ConnectorContext) => Promise<ConnectorResult>;
}
