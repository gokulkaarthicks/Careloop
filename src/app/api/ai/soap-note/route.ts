import { NextResponse } from "next/server";
import { generateSoapNoteWithLlm } from "@/lib/ai/generate-soap-note-llm";
import type { PatientClinicalSummary } from "@/types/workflow";

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.patientDisplayName?.trim() || !body.appointmentTitle?.trim()) {
    return NextResponse.json(
      { error: "patientDisplayName and appointmentTitle required" },
      { status: 400 },
    );
  }

  const result = await generateSoapNoteWithLlm({
    patientDisplayName: body.patientDisplayName.trim(),
    appointmentTitle: body.appointmentTitle.trim(),
    clinical: body.clinical ?? null,
    providerMessage: body.providerMessage,
  });

  return NextResponse.json({
    soap: result.soap,
    source: result.source,
  });
}
