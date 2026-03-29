import { NextResponse } from "next/server";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";
import { runWorkflowToolLoop } from "@/lib/ai/run-workflow-tool-loop";
import { PATIENT_SAFE_WORKFLOW_TOOL_DEFINITIONS } from "@/lib/ai/tools/workflow-tools";
import type { EncounterToolDispatchContext } from "@/lib/ai/tools/workflow-tool-context";

export const runtime = "nodejs";

const PATIENT_SYSTEM = `You are a patient-facing Care Orchestrator assistant (demo only). Use tools to read medications and coverage-related cases from the demo snapshot. Explain in plain language. Never diagnose or change medications. For emergencies, tell the user to call local emergency services. Do not invent clinical facts beyond tool outputs. Keep replies brief.`;

export async function POST(req: Request) {
  if (!isXaiApiKeyConfigured()) {
    return NextResponse.json(
      { disabled: true, error: "Assistant unavailable (demo API key not set)." },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as Partial<EncounterToolDispatchContext> & {
      message?: string;
    };

    const message = String(body.message ?? "").trim();
    if (!message || message.length > 4000) {
      return NextResponse.json(
        { error: "message required (max 4000 chars)" },
        { status: 400 },
      );
    }

    const context: EncounterToolDispatchContext = {
      patientDisplayName: String(body.patientDisplayName ?? "Patient"),
      patientId: String(body.patientId ?? ""),
      appointmentId: String(body.appointmentId ?? "patient-chat"),
      prescriptionLines: Array.isArray(body.prescriptionLines) ?
        body.prescriptionLines
      : [],
      clinical: body.clinical ?? null,
      treatmentPlan: String(body.treatmentPlan ?? ""),
      priorAuthCases: Array.isArray(body.priorAuthCases) ? body.priorAuthCases : [],
      pharmacyId: String(body.pharmacyId ?? ""),
      insurancePlanId: body.insurancePlanId,
      preferredPharmacyId: body.preferredPharmacyId,
    };

    if (!context.patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    const userMessage = `Patient question:\n${message}\n\nAnswer using tools when helpful.`;

    const result = await runWorkflowToolLoop({
      context,
      systemPrompt: PATIENT_SYSTEM,
      userMessage,
      tools: PATIENT_SAFE_WORKFLOW_TOOL_DEFINITIONS,
      maxTurns: 5,
    });

    if (result.stoppedReason === "no_api_key") {
      return NextResponse.json({ disabled: true }, { status: 503 });
    }

    const reply =
      result.finalAssistantText?.trim() ||
      (result.trace.length ?
        "Here’s what I pulled from your Care Orchestrator demo record (see tools above). Ask your care team to confirm anything clinical."
      : "I couldn’t generate a reply. Try again or message your care team.");

    return NextResponse.json({
      reply,
      trace: result.trace,
      stoppedReason: result.stoppedReason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Patient assistant failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
