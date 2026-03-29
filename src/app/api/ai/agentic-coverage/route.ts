import { NextResponse } from "next/server";
import {
  resolveAgenticCoverage,
  type AgenticCoverageRequest,
} from "@/lib/ai/agentic-coverage-llm";
import {
  agentFailureResponse,
  agenticCoverageResponseSchema,
  classifyAgentErrorMessage,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgenticCoverageRequest;
    if (!body.patientId || !body.pharmacyId) {
      return NextResponse.json(
        { error: "patientId and pharmacyId are required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.prescriptionLines)) {
      return NextResponse.json(
        { error: "prescriptionLines must be an array", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const result = await resolveAgenticCoverage(body);
    const v = validateAgentOutput(agenticCoverageResponseSchema, result);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agentic coverage failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
