import { MOCK_RECOVERY_CONNECTOR } from "@/lib/recovery/connectors/mock-connector";
import type {
  ConnectorCapability,
  ConnectorContext,
  ConnectorOperation,
  ConnectorResult,
  RecoveryConnectorAdapter,
} from "@/lib/recovery/connectors/types";

const CONNECTORS: RecoveryConnectorAdapter[] = [MOCK_RECOVERY_CONNECTOR];

export function listRecoveryConnectors(): RecoveryConnectorAdapter[] {
  return CONNECTORS;
}

export function pickConnectorByCapability(
  capability: ConnectorCapability,
): RecoveryConnectorAdapter | null {
  return CONNECTORS.find((c) => c.capabilities.includes(capability)) ?? null;
}

export async function executeConnectorOperation(
  operation: ConnectorOperation,
  context: ConnectorContext,
): Promise<{ connector: RecoveryConnectorAdapter | null; result: ConnectorResult }> {
  const connector = pickConnectorByCapability(operation);
  if (!connector) {
    return {
      connector: null,
      result: { ok: false, summary: "No connector found for operation", error: operation },
    };
  }
  const result = await connector.execute(operation, context);
  return { connector, result };
}
