import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Tool definitions for xAI function calling — workflow actions stay bounded and
 * server-dispatched (no free-form agent control of the app).
 *
 * Handlers: see `dispatchWorkflowToolCall` in `./workflow-tool-dispatcher.ts`.
 */
export const WORKFLOW_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "record_workflow_audit",
      description:
        "Append one human-readable audit line for the care loop (demo / traceability).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          phase: {
            type: "string",
            description: "Workflow phase id, e.g. chart_summary, pharmacy_fulfillment",
          },
          message: {
            type: "string",
            description: "Short audit message shown in logs or future event store",
          },
        },
        required: ["phase", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_review",
      description:
        "Flag that the clinician should confirm before a sensitive action (demo safety valve).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "string" },
          context: { type: "string" },
        },
        required: ["reason"],
      },
    },
  },
];

export type WorkflowToolName = "record_workflow_audit" | "request_human_review";
