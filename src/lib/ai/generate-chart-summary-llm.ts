import type { AiHistorySummary, PatientClinicalSummary } from "@/types/workflow";
import {
  chartSummaryStructuredSchema,
  type ChartSummaryStructured,
} from "@/lib/ai/schemas/chart-summary";
import { createXaiClient, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";

const SYSTEM = `You are a clinical decision support assistant for a hackathon demo (not a licensed clinician).
You must respond with structured JSON only, matching the provided schema. No markdown.
Severity must be one of: low, moderate, high.
Include 2–5 risks, 3–5 suggestedFocus items, 4–6 suggestedQuestions.`;

export type ChartSummaryLlmResult =
  | { ok: true; summary: AiHistorySummary }
  | {
      ok: false;
      code: "missing_key" | "api_error" | "parse_error" | "validation_error";
      message: string;
    };

/**
 * xAI Grok with structured outputs: JSON schema (strict) when supported, else json_object + Zod.
 */
export async function generateChartSummaryWithXai(
  patientId: string,
  clinical: PatientClinicalSummary,
): Promise<ChartSummaryLlmResult> {
  if (!isXaiApiKeyConfigured()) {
    return {
      ok: false,
      code: "missing_key",
      message: "XAI_API_KEY is not configured",
    };
  }

  const client = createXaiClient();
  if (!client) {
    return {
      ok: false,
      code: "missing_key",
      message: "xAI client could not be created",
    };
  }

  const user = `Patient clinical snapshot (JSON):\n${JSON.stringify(clinical, null, 2)}`;

  const chartSummaryJsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["narrative", "risks", "suggestedFocus", "suggestedQuestions"],
    properties: {
      narrative: { type: "string" },
      risks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "severity", "rationale"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            severity: { type: "string", enum: ["low", "moderate", "high"] },
            rationale: { type: "string" },
          },
        },
      },
      suggestedFocus: { type: "array", items: { type: "string" } },
      suggestedQuestions: { type: "array", items: { type: "string" } },
    },
  } as const;

  let raw: string;

  try {
    const completion = await client.chat.completions.create({
      model: getXaiWorkflowModel(),
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chart_summary",
          strict: true,
          schema: chartSummaryJsonSchema as unknown as Record<string, unknown>,
        },
      },
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch {
    try {
      const completion = await client.chat.completions.create({
        model: getXaiWorkflowModel(),
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `${SYSTEM}\nReturn a single JSON object with keys: narrative, risks, suggestedFocus, suggestedQuestions.`,
          },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      raw = completion.choices[0]?.message?.content ?? "";
    } catch (secondErr) {
      const msg =
        secondErr instanceof Error
          ? secondErr.message
          : "xAI chat completion failed";
      return { ok: false, code: "api_error", message: msg };
    }
  }

  if (!raw.trim()) {
    return {
      ok: false,
      code: "parse_error",
      message: "Empty model response",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      code: "parse_error",
      message: "Model returned non-JSON content",
    };
  }

  const parsed = chartSummaryStructuredSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation_error",
      message: parsed.error.message,
    };
  }

  const data: ChartSummaryStructured = parsed.data;
  return {
    ok: true,
    summary: {
      patientId,
      generatedAt: new Date().toISOString(),
      narrative: data.narrative,
      risks: data.risks.map((r, i) => ({
        ...r,
        id: r.id || `risk_${i}`,
      })),
      suggestedFocus: data.suggestedFocus,
      suggestedQuestions: data.suggestedQuestions,
      mock: false,
    },
  };
}
