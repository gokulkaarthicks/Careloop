import type {
  ConnectorContext,
  ConnectorOperation,
  ConnectorResult,
  RecoveryConnectorAdapter,
} from "@/lib/recovery/connectors/types";

async function runMockOperation(
  operation: ConnectorOperation,
  context: ConnectorContext,
): Promise<ConnectorResult> {
  const tag = context.connectorPayload?.sourceSystem ?? "mock-system";
  switch (operation) {
    case "submit_appeal":
      return {
        ok: true,
        summary: `Appeal submitted to ${tag}`,
        externalReference: `APL-${Date.now()}`,
      };
    case "check_status":
      return {
        ok: true,
        summary: `Status check completed from ${tag}`,
        raw: { status: "pending_review" },
      };
    case "send_patient_message":
      return { ok: true, summary: `Patient outreach queued in ${tag}` };
    case "create_appointment_hold":
      return { ok: true, summary: `Follow-up slot hold requested in ${tag}` };
    case "upload_attachment":
      return { ok: true, summary: `Attachment uploaded to ${tag}` };
    case "read_case":
    default:
      return { ok: true, summary: `Case loaded from ${tag}` };
  }
}

export const MOCK_RECOVERY_CONNECTOR: RecoveryConnectorAdapter = {
  key: "mock_default",
  label: "Mock Recovery Connector",
  capabilities: [
    "read_case",
    "submit_appeal",
    "upload_attachment",
    "check_status",
    "send_patient_message",
    "create_appointment_hold",
  ],
  execute: runMockOperation,
};
