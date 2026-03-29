import { NextResponse } from "next/server";
import { resolvePreVisitBriefing } from "@/lib/ai/pre-visit-llm";
import type { PreVisitAgentInput } from "@/types/pre-visit-agent";
import {
  agentFailureResponse,
  classifyAgentErrorMessage,
  preVisitAgentOutputSchema,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PreVisitAgentInput;
    if (!body.patientId || !body.displayName) {
      return NextResponse.json(
        { error: "patientId and displayName are required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const result = await resolvePreVisitBriefing(body);
    const v = validateAgentOutput(preVisitAgentOutputSchema, result);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pre-visit agent failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
