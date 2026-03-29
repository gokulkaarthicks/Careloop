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
      name: "get_rx_snapshot",
      description:
        "Read-only: current prescription lines for this encounter (drug, strength, quantity). Use before reasoning about routing or documentation.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjudicate_benefits_coverage",
      description:
        "Run structured per-line benefits adjudication (formulary, PA, step therapy, network). Call when you have reviewed Rx and chart context — required to finalize routing for this encounter.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pa_case",
      description:
        "Read-only: prior-auth cases on file for this patient in the demo store. Optionally filter by drug name.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          drugNameContains: {
            type: "string",
            description: "Optional substring to filter cases (e.g. brand name)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_encounter_context",
      description:
        "Read-only: one short paragraph summarizing diagnoses, allergies, and active meds from the chart snapshot (demo).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "append_timeline_note",
      description:
        "Propose a patient-visible workflow timeline row (demo). Does not write to a real EHR — returned to the app for display.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Short timeline title" },
          detail: { type: "string", description: "One or two sentences" },
        },
        required: ["title", "detail"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_clarifying_question",
      description:
        "Draft a concise question the clinician could ask the patient or payer (demo copy only — human must send).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: {
            type: "string",
            description: "What needs clarification, e.g. PA status, allergy, pharmacy choice",
          },
        },
        required: ["topic"],
      },
    },
  },
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

/** Subset for patient-facing assistant — read-only + harmless audit only. */
const PATIENT_SAFE_NAMES = new Set([
  "get_rx_snapshot",
  "get_pa_case",
  "summarize_encounter_context",
  "record_workflow_audit",
]);

export const PATIENT_SAFE_WORKFLOW_TOOL_DEFINITIONS: ChatCompletionTool[] =
  WORKFLOW_TOOL_DEFINITIONS.filter((t) => {
    if (t.type !== "function") return false;
    return PATIENT_SAFE_NAMES.has(t.function.name);
  });

export type WorkflowToolName =
  | "adjudicate_benefits_coverage"
  | "get_rx_snapshot"
  | "get_pa_case"
  | "summarize_encounter_context"
  | "append_timeline_note"
  | "draft_clarifying_question"
  | "record_workflow_audit"
  | "request_human_review";
