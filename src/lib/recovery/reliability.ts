import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { UUID } from "@/types/workflow";

export async function withConnectorRetry<T>(
  recoveryCaseId: UUID,
  actionLabel: string,
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const out = await fn();
      if (attempt > 1) {
        useCareWorkflowStore.getState().pushWorkflowEngineEvent({
          kind: "appeal_status_updated",
          title: `${actionLabel} recovered after retry`,
          detail: `Succeeded on attempt ${attempt}/${maxAttempts}.`,
          role: "system",
        });
      }
      return out;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 250));
      }
    }
  }
  const msg = lastError instanceof Error ? lastError.message : "connector operation failed";
  useCareWorkflowStore.getState().logExternalSyncCheckpoint({
    id: `dead_${Date.now()}`,
    recoveryCaseId,
    connectorKey: "mock_default",
    checkpointType: "status_poll",
    status: "error",
    checkedAt: new Date().toISOString(),
    notes: `Dead-letter candidate: ${actionLabel} -> ${msg}`,
  });
  throw new Error(msg);
}
