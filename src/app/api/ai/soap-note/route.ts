import { NextResponse } from "next/server";
import { generateSoapNoteWithLlm } from "@/lib/ai/generate-soap-note-llm";
import type { PatientClinicalSummary } from "@/types/workflow";
import {
  agentFailureResponse,
  classifyAgentErrorMessage,
  soapNoteApiResponseSchema,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    patientDisplayName?: string;
    appointmentTitle?: string;
    clinical?: PatientClinicalSummary | null;
    providerMessage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", code: "PARSE_ERROR" },
      { status: 400 },
    );
  }
  if (!body.patientDisplayName?.trim() || !body.appointmentTitle?.trim()) {
    return NextResponse.json(
      { error: "patientDisplayName and appointmentTitle required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const result = await generateSoapNoteWithLlm({
      patientDisplayName: body.patientDisplayName.trim(),
      appointmentTitle: body.appointmentTitle.trim(),
      clinical: body.clinical ?? null,
      providerMessage: body.providerMessage,
    });
    const payload = {
      soap: result.soap,
      chatAcknowledgment: result.chatAcknowledgment,
      source: "xai" as const,
    };
    const v = validateAgentOutput(soapNoteApiResponseSchema, payload);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "SOAP generation failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
