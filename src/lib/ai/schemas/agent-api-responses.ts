import { z } from "zod";
import { NextResponse } from "next/server";

/** Machine-readable failure codes for agent API routes (HTTP 503). */
export type AgentFailureCode =
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "AGENT_ERROR"
  | "MISSING_XAI_API_KEY"
  | "api_error"
  | "parse_error"
  | "validation_error"
  | "missing_key";

const clinicalRiskSchema = z.object({
  id: z.string(),
  label: z.string(),
  severity: z.enum(["low", "moderate", "high"]),
  rationale: z.string(),
});

export const insurancePlanSchema = z.object({
  id: z.string(),
  payerId: z.string(),
  name: z.string(),
  planCode: z.string(),
  paTurnaroundBusinessDays: z.number(),
  highCopayThresholdUsd: z.number(),
  documentationNotes: z.string(),
});

export const lineCoverageDecisionSchema = z.object({
  lineIndex: z.number().int().nonnegative(),
  drugName: z.string(),
  paRequired: z.boolean(),
  stepTherapyRequired: z.boolean(),
  stepTherapyMet: z.boolean(),
  formularyTierLabel: z.string(),
  coveredAlternativeToken: z.string().nullable(),
  estimatedCopayUsd: z.number().nullable(),
  copayHigh: z.boolean(),
  preferredPharmacyInNetwork: z.boolean(),
  urgency: z.enum(["routine", "urgent", "high_risk"]),
  route: z.enum(["pharmacy_direct", "payer_prior_auth", "blocked_step_therapy"]),
  reason: z.string(),
});

export const coverageEvaluationResultSchema = z.object({
  plan: insurancePlanSchema,
  lines: z.array(lineCoverageDecisionSchema),
  anyPaRequired: z.boolean(),
  anyStepTherapyBlock: z.boolean(),
  anyNetworkMismatch: z.boolean(),
  anyHighCopay: z.boolean(),
  holdForPriorAuth: z.boolean(),
});

/** Response body for `POST /api/ai/agentic-coverage` */
export const agenticCoverageResponseSchema = z.object({
  coverage: coverageEvaluationResultSchema,
  documentationAddendum: z.string().optional(),
  patientNotification: z
    .object({
      title: z.string(),
      body: z.string(),
    })
    .optional(),
});

/** Output of `generateSoapNoteWithLlm` before wrapping with `source` */
export const soapNoteLlmResultSchema = z.object({
  soap: z.string().min(1),
  chatAcknowledgment: z.string().min(1),
});

/** Successful JSON from `POST /api/ai/soap-note` */
export const soapNoteApiResponseSchema = z.object({
  soap: z.string().min(1),
  chatAcknowledgment: z.string().min(1),
  source: z.literal("xai"),
});

export const preVisitAgentOutputSchema = z.object({
  briefingBullets: z.tuple([
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string(),
  ]),
  risks: z.array(clinicalRiskSchema).min(1),
  missingQuestions: z.array(z.string()).min(1),
  clinicalTimeline: z.string().min(1),
  visitReadinessScore: z.number().min(0).max(100),
  agentVersion: z.literal("llm-v1"),
  generatedAt: z.string().min(1),
});

export const paAdjudicationResultSchema = z.object({
  decision: z.enum(["approved", "denied", "more_info", "manual_queue"]),
  adjudicationNotes: z.string().min(1),
  nextWorkflowSteps: z.array(z.string()).min(1),
});

export const chartInferenceReviewSchema = z.object({
  appointmentId: z.string(),
  patientId: z.string(),
  generatedAt: z.string(),
  source: z.literal("llm-v1"),
  allergies: z.array(
    z.object({ substance: z.string(), severity: z.string() }),
  ),
  medications: z.array(
    z.object({
      name: z.string(),
      dose: z.string(),
      frequency: z.string(),
    }),
  ),
  problems: z.array(z.string()),
  vitalsNarrative: z.string().nullable(),
  attentionFlags: z
    .array(z.object({ label: z.string(), detail: z.string() }))
    .min(1),
});

export const refillEligibilityResponseSchema = z.object({
  evaluations: z
    .array(
      z.object({
        prescriptionId: z.string(),
        eligible: z.boolean(),
        patientInstructions: z.string().min(1),
        nextWorkflowSteps: z.array(z.string()).min(2),
        suggestedDaysUntilRefill: z.number().optional(),
      }),
    )
    .min(1),
});

export const encounterIntentResponseSchema = z.object({
  intent: z.enum(["soap", "plan", "rx", "search"]),
  source: z.literal("xai"),
});

export const aiHistorySummarySchema = z.object({
  patientId: z.string(),
  generatedAt: z.string(),
  narrative: z.string(),
  risks: z.array(clinicalRiskSchema),
  suggestedFocus: z.array(z.string()),
  suggestedQuestions: z.array(z.string()),
  mock: z.boolean(),
});

export const chartSummaryApiResponseSchema = z.object({
  summary: aiHistorySummarySchema,
  meta: z.object({ source: z.literal("xai") }),
});

/**
 * Classify thrown agent errors for stable API codes (best-effort).
 */
export function classifyAgentErrorMessage(message: string): AgentFailureCode {
  const m = message.toLowerCase();
  if (
    m.includes("non-json") ||
    m.includes("returned non-json") ||
    (m.includes("json") && (m.includes("parse") || m.includes("invalid")))
  ) {
    return "PARSE_ERROR";
  }
  if (
    m.includes("validation") ||
    (m.includes("invalid") &&
      (m.includes("field") || m.includes("line") || m.includes("intent")))
  ) {
    return "VALIDATION_ERROR";
  }
  if (m.includes("missing_key") || m.includes("xai_api_key")) {
    return "missing_key";
  }
  return "AGENT_ERROR";
}

export function agentFailureResponse(
  code: AgentFailureCode,
  message: string,
  details?: unknown,
): NextResponse {
  const body: Record<string, unknown> = { error: message, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status: 503 });
}

export function validateAgentOutput<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const r = schema.safeParse(data);
  if (!r.success) {
    return {
      ok: false,
      response: agentFailureResponse(
        "VALIDATION_ERROR",
        "Agent output failed schema validation",
        r.error.flatten(),
      ),
    };
  }
  return { ok: true, data: r.data };
}
