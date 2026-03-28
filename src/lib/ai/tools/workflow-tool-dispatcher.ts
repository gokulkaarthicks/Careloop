import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

export type WorkflowToolDispatchResult =
  | { ok: true; tool: string; detail: string }
  | { ok: false; tool: string; error: string };

/**
 * Deterministic handling of model tool calls — extend with real side effects (DB, queue) later.
 */
export function dispatchWorkflowToolCall(
  call: ChatCompletionMessageToolCall,
): WorkflowToolDispatchResult {
  if (call.type !== "function") {
    return { ok: false, tool: "unknown", error: "Unsupported tool call type" };
  }
  const name = call.function.name;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, tool: name, error: "Invalid JSON arguments" };
  }

  switch (name) {
    case "record_workflow_audit": {
      const phase = String(args.phase ?? "");
      const message = String(args.message ?? "");
      if (!phase || !message) {
        return { ok: false, tool: name, error: "phase and message required" };
      }
      return {
        ok: true,
        tool: name,
        detail: `[${phase}] ${message}`,
      };
    }
    case "request_human_review": {
      const reason = String(args.reason ?? "");
      return {
        ok: true,
        tool: name,
        detail: `Review requested: ${reason}`,
      };
    }
    default:
      return { ok: false, tool: name, error: "Unknown tool" };
  }
}
