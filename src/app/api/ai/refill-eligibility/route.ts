import { NextResponse } from "next/server";
import {
  runRefillEligibilityAgentLlm,
  type RefillAgentLineInput,
} from "@/lib/ai/refill-eligibility-llm";
import {
  agentFailureResponse,
  classifyAgentErrorMessage,
  refillEligibilityResponseSchema,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      patientDisplayName?: string;
      lines?: RefillAgentLineInput[];
    };
    if (!body.patientDisplayName?.trim() || !Array.isArray(body.lines)) {
      return NextResponse.json(
        { error: "patientDisplayName and lines required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const result = await runRefillEligibilityAgentLlm({
      patientDisplayName: body.patientDisplayName.trim(),
      lines: body.lines,
    });
    const v = validateAgentOutput(refillEligibilityResponseSchema, result);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refill agent failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
