import type { PatientClinicalSummary } from "@/types/workflow";
import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";

export type SoapNoteRequest = {
  patientDisplayName: string;
  appointmentTitle: string;
  clinical: PatientClinicalSummary | null;
  providerMessage?: string;
};

export type SoapNoteAgentResult = {
  soap: string;
  /** Short line for the encounter chat UI — how the note was derived (no client-side regex). */
  chatAcknowledgment: string;
};

/**
 * SOAP documentation agent (Grok). Returns note + chat acknowledgment in one structured call.
 */
export async function generateSoapNoteWithLlm(
  input: SoapNoteRequest,
): Promise<SoapNoteAgentResult> {
  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for SOAP generation");
  }

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
You must respond with JSON only (no markdown) using this exact shape:
{
  "soap": string,
  "chatAcknowledgment": string
}

Field rules:
- soap: A concise SOAP note for ONE ambulatory visit. US clinical style. Plain text with section headers on their own lines: S:  O:  A:  P:
  If the provider message is free-text dictation or a structured visit outline (Problems/Medications/etc.), convert it into proper S/O/A/P using chart context — do not drop stated clinical content.
- chatAcknowledgment: One or two short sentences (max ~280 characters) for an in-app chat bubble. Explain briefly whether you converted the user's dictation/structured outline, expanded a brief request using chart context, or similar. Do not repeat the full SOAP. Professional, second person ("your note") or neutral.

Do not invent dangerous allergies or contraindications not supported by the data.`;

  const user = `Patient: ${input.patientDisplayName}
Visit: ${input.appointmentTitle}

Chart context:
${ctx}${userExtra}`;

  const client = createXaiClientOrThrow();

  let raw: string;
  try {
    const completion = await client.chat.completions.create({
      model: getXaiWorkflowModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "xAI request failed";
    throw new Error(`SOAP agent API error: ${msg}`);
  }

  if (!raw) {
    throw new Error("SOAP agent returned empty content");
  }

  let parsed: { soap?: unknown; chatAcknowledgment?: unknown };
  try {
    parsed = JSON.parse(raw) as { soap?: unknown; chatAcknowledgment?: unknown };
  } catch {
    throw new Error("SOAP agent returned non-JSON");
  }

  const soap = typeof parsed.soap === "string" ? parsed.soap.trim() : "";
  if (!soap || !/S:\s*/im.test(soap)) {
    throw new Error("SOAP agent: invalid or empty soap field (expected S: section)");
  }

  let chatAcknowledgment =
    typeof parsed.chatAcknowledgment === "string" ?
      parsed.chatAcknowledgment.trim()
    : "";
  if (!chatAcknowledgment) {
    throw new Error("SOAP agent: chatAcknowledgment required");
  }
  if (chatAcknowledgment.length > 400) {
    chatAcknowledgment = `${chatAcknowledgment.slice(0, 397)}…`;
  }

  return { soap, chatAcknowledgment };
}
