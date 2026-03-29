import { NextResponse } from "next/server";
import {
  classifyEncounterIntentWithLlm,
  type EncounterIntentKind,
} from "@/lib/ai/classify-encounter-intent-llm";
import {
  agentFailureResponse,
  classifyAgentErrorMessage,
  encounterIntentResponseSchema,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { message?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON", code: "PARSE_ERROR" },
        { status: 400 },
      );
    }
    const message = body.message?.trim() ?? "";
    if (!message) {
      return NextResponse.json(
        { error: "message required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const intent: EncounterIntentKind = await classifyEncounterIntentWithLlm(message);
    const payload = { intent, source: "xai" as const };
    const v = validateAgentOutput(encounterIntentResponseSchema, payload);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encounter intent failed";
    return agentFailureResponse(classifyAgentErrorMessage(msg), msg);
  }
}
