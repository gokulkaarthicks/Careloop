import { NextResponse } from "next/server";
import {
  adjudicatePaPolicyWithLlm,
  type PaAdjudicateLlmInput,
} from "@/lib/ai/pa-policy-adjudicate-llm";
import {
  agentFailureResponse,
  classifyAgentErrorMessage,
  paAdjudicationResultSchema,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<PaAdjudicateLlmInput>;
    if (!body.patientDisplayName?.trim() || !body.drugLines?.length) {
      return NextResponse.json(
        { error: "patientDisplayName and drugLines required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const result = await adjudicatePaPolicyWithLlm(body as PaAdjudicateLlmInput);
    const v = validateAgentOutput(paAdjudicationResultSchema, result);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "PA adjudication failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
