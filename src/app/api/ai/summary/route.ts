import { NextResponse } from "next/server";
import { generateChartSummaryWithXai } from "@/lib/ai/generate-chart-summary-llm";
import {
  isXaiApiKeyConfigured,
  isXaiApiKeyRequired,
} from "@/lib/ai/config";
import type { PatientClinicalSummary } from "@/types/workflow";
import {
  agentFailureResponse,
  chartSummaryApiResponseSchema,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { patientId?: string; clinical?: PatientClinicalSummary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", code: "PARSE_ERROR" },
      { status: 400 },
    );
  }

  const patientId = body.patientId;
  const clinical = body.clinical;
  if (!patientId || !clinical) {
    return NextResponse.json(
      { error: "patientId and clinical required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (isXaiApiKeyRequired() && !isXaiApiKeyConfigured()) {
    return agentFailureResponse(
      "MISSING_XAI_API_KEY",
      "XAI_API_KEY is required when REQUIRE_XAI_API_KEY=true",
    );
  }

  const result = await generateChartSummaryWithXai(patientId, clinical);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `${result.code}: ${result.message}`,
        code: result.code,
      },
      { status: 503 },
    );
  }

  const payload = {
    summary: result.summary,
    meta: { source: "xai" as const },
  };
  const v = validateAgentOutput(chartSummaryApiResponseSchema, payload);
  if (!v.ok) return v.response;
  return NextResponse.json(v.data);
}
