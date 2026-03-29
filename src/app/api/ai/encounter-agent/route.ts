import { NextResponse } from "next/server";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";
import { runEncounterAgentOrchestration } from "@/lib/ai/encounter-agent";
import type { RunPipelineInput } from "@/types/agentic";
import {
  agentFailureResponse,
  classifyAgentErrorMessage,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isXaiApiKeyConfigured()) {
    return NextResponse.json(
      { error: "XAI_API_KEY is required for the encounter agent", code: "MISSING_XAI_API_KEY" },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as Partial<RunPipelineInput>;
    if (!body.patientId || !body.appointmentId || !body.pharmacyId) {
      return NextResponse.json(
        { error: "patientId, appointmentId, and pharmacyId are required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.prescriptionLines) || body.prescriptionLines.length === 0) {
      return NextResponse.json(
        { error: "prescriptionLines must be a non-empty array" },
        { status: 400 },
      );
    }

    const input: RunPipelineInput = {
      patientDisplayName: String(body.patientDisplayName ?? ""),
      patientId: body.patientId,
      appointmentId: body.appointmentId,
      clinical: body.clinical ?? null,
      prescriptionLines: body.prescriptionLines,
      treatmentPlan: String(body.treatmentPlan ?? ""),
      pharmacyId: body.pharmacyId,
      insurancePlanId: body.insurancePlanId,
      preferredPharmacyId: body.preferredPharmacyId,
      priorAuthCases: Array.isArray(body.priorAuthCases) ? body.priorAuthCases : [],
    };

    const result = await runEncounterAgentOrchestration(input);

    return NextResponse.json({
      coverage: result.coverage,
      documentationAddendum: result.documentationAddendum,
      patientNotification: result.patientNotification,
      trace: result.trace,
      timelineSuggestions: result.timelineSuggestions,
      finalAssistantText: result.finalAssistantText,
      stoppedReason: result.stoppedReason,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Encounter agent failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
