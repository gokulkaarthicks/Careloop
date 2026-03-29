import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";
import type { ChartInferenceReview, PatientClinicalSummary, UUID } from "@/types/workflow";

/**
 * Post-encounter chart review agent — structures chart data for QA / continuity (LLM-only).
 */
export async function runChartInferenceAgent(args: {
  appointmentId: UUID;
  patientId: UUID;
  clinical: PatientClinicalSummary | undefined;
  soapNote: string;
  treatmentPlan: string;
}): Promise<ChartInferenceReview> {
  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for chart inference");
  }

  const client = createXaiClientOrThrow();
  const clinicalJson = args.clinical ?
    JSON.stringify({
      diagnoses: args.clinical.diagnoses,
      medications: args.clinical.medications,
      allergies: args.clinical.allergies,
      recentVitals: args.clinical.recentVitals,
    })
  : "{}";

  const system = `You are a clinical documentation integrity agent for a US ambulatory practice (demo).
After a signed encounter, produce a structured chart review artifact for downstream QA and payer documentation — not a summary essay.
Return JSON only:
{
  "allergies": [ { "substance": string, "severity": string } ],
  "medications": [ { "name": string, "dose": string, "frequency": string } ],
  "problems": string[],
  "vitalsNarrative": string | null,
  "attentionFlags": [ { "label": string, "detail": string } ]
}
Rules: Mirror chart data where present; do not invent allergies or meds not supported by input. attentionFlags: safety/continuity items a reviewer must verify (3–8 items).`;

  const user = `Appointment: ${args.appointmentId}
Patient: ${args.patientId}
Clinical snapshot:
${clinicalJson}
SOAP (excerpt):
${args.soapNote.slice(0, 6000)}
Treatment plan (excerpt):
${args.treatmentPlan.slice(0, 4000)}`;

  const completion = await client.chat.completions.create({
    model: getXaiWorkflowModel(),
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Chart inference: empty model response");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Chart inference: model returned non-JSON");
  }

  const allergies: ChartInferenceReview["allergies"] = [];
  if (Array.isArray(parsed.allergies)) {
    for (const a of parsed.allergies) {
      if (a && typeof a === "object") {
        const o = a as Record<string, unknown>;
        const substance = String(o.substance ?? "");
        const severity = String(o.severity ?? "");
        if (substance) allergies.push({ substance, severity });
      }
    }
  }

  const medications: ChartInferenceReview["medications"] = [];
  if (Array.isArray(parsed.medications)) {
    for (const m of parsed.medications) {
      if (m && typeof m === "object") {
        const o = m as Record<string, unknown>;
        medications.push({
          name: String(o.name ?? ""),
          dose: String(o.dose ?? ""),
          frequency: String(o.frequency ?? ""),
        });
      }
    }
  }

  const problems = Array.isArray(parsed.problems) ?
    parsed.problems.map((p) => String(p)).filter(Boolean)
  : [];

  const vitalsNarrative =
    parsed.vitalsNarrative === null ? null
    : typeof parsed.vitalsNarrative === "string" ? parsed.vitalsNarrative
    : null;

  const attentionFlags: ChartInferenceReview["attentionFlags"] = [];
  if (Array.isArray(parsed.attentionFlags)) {
    for (const f of parsed.attentionFlags) {
      if (f && typeof f === "object") {
        const o = f as Record<string, unknown>;
        const label = String(o.label ?? "");
        const detail = String(o.detail ?? "");
        if (label && detail) attentionFlags.push({ label, detail });
      }
    }
  }

  if (attentionFlags.length < 1) {
    throw new Error("Chart inference: attentionFlags required");
  }

  return {
    appointmentId: args.appointmentId,
    patientId: args.patientId,
    generatedAt: new Date().toISOString(),
    source: "llm-v1",
    allergies,
    medications,
    problems,
    vitalsNarrative,
    attentionFlags,
  };
}
