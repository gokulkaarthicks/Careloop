import type { PatientClinicalSummary } from "@/types/workflow";
import { createXaiClient, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";

export type SoapNoteRequest = {
  patientDisplayName: string;
  appointmentTitle: string;
  clinical: PatientClinicalSummary | null;
  providerMessage?: string;
};

/**
 * Generates a patient-specific SOAP note via xAI Grok. Falls back to a deterministic stub if no API key.
 */
export async function generateSoapNoteWithLlm(
  input: SoapNoteRequest,
): Promise<{ soap: string; source: "xai" | "mock" }> {
  const clinical = input.clinical;
  const ctx = clinical
    ? [
        `Problems: ${clinical.diagnoses.map((d) => `${d.code} ${d.description}`).join("; ") || "None coded"}`,
        `Allergies: ${clinical.allergies.length ? clinical.allergies.map((a) => `${a.substance} (${a.severity})`).join("; ") : "NKDA"}`,
        `Medications: ${clinical.medications.map((m) => `${m.name} ${m.dose}`).join("; ") || "None"}`,
      ].join("\n")
    : "Limited chart data.";

  const userExtra = input.providerMessage?.trim()
    ? `\nProvider instructions for this note: ${input.providerMessage.trim()}`
    : "";

  const system = `You are assisting a licensed clinician in a hackathon demo with documentation only.
Write a concise SOAP note for ONE ambulatory visit. Use US clinical style.
Output plain text with exactly these section headers on their own lines: S:  O:  A:  P:
If the provider message is free-text dictation (e.g. "the soap is …", "update soap …"), or a structured visit outline (lines starting with Problem:, Medications:, Lifestyle:, Follow-up:), convert it into proper S/O/A/P using the chart context — fold Problem into S/A as appropriate, Medications and Lifestyle into P, Follow-up into P — do not drop clinical content they stated.
Keep each section focused (no filler). Do not invent dangerous allergies or contraindications not in the data.`;

  const user = `Patient: ${input.patientDisplayName}
Visit: ${input.appointmentTitle}

Chart context:
${ctx}${userExtra}`;

  if (!isXaiApiKeyConfigured()) {
    return {
      source: "mock",
      soap: buildMockSoap(
        input.patientDisplayName,
        input.appointmentTitle,
        clinical,
        input.providerMessage,
      ),
    };
  }

  const client = createXaiClient();
  if (!client) {
    return {
      source: "mock",
      soap: buildMockSoap(
        input.patientDisplayName,
        input.appointmentTitle,
        clinical,
        input.providerMessage,
      ),
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: getXaiWorkflowModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      return {
        source: "mock",
        soap: buildMockSoap(
          input.patientDisplayName,
          input.appointmentTitle,
          clinical,
          input.providerMessage,
        ),
      };
    }
    return { source: "xai", soap: raw };
  } catch {
    return {
      source: "mock",
      soap: buildMockSoap(
        input.patientDisplayName,
        input.appointmentTitle,
        clinical,
        input.providerMessage,
      ),
    };
  }
}

function buildMockSoap(
  name: string,
  title: string,
  clinical: PatientClinicalSummary | null,
  providerMessage?: string,
) {
  const dx =
    clinical?.diagnoses
      .slice(0, 2)
      .map((d) => d.description)
      .join("; ") || "Chronic conditions per chart";
  const pm = providerMessage?.trim();
  const subjective =
    pm ?
      (pm.length > 420 ? `${pm.slice(0, 420)}…` : pm)
    : `${name} here for ${title.toLowerCase()}. Interval history reviewed; no acute red flags documented in this demo.`;
  return `S: ${subjective}
O: Vitals and exam: align with clinic protocol before signing.
A: ${dx}.
P: Continue home monitoring; reconcile medications; follow-up per clinic standard.`;
}
