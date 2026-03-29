import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";

export type EncounterIntentKind = "soap" | "plan" | "rx" | "search";

const SYSTEM = `You are a classifier for a clinical encounter chat (hackathon demo).
Return JSON only: {"intent":"soap"|"plan"|"rx"|"search"}
Rules:
- soap: user wants SOAP note, clinical documentation, or dictation formatted as SOAP.
- plan: user wants ONLY a treatment / care plan (not SOAP).
- rx: user wants to prescribe, add a drug, or discusses prescription lines.
- search: chart lookup, patient data questions, or unclear short query.
If both SOAP and treatment content appear but user asks to document the visit as SOAP, choose soap.`;

/**
 * Intent routing agent (Grok). Required for encounter chat — no regex fallback.
 */
export async function classifyEncounterIntentWithLlm(
  message: string,
): Promise<EncounterIntentKind> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Encounter intent: empty message");
  }

  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for encounter intent classification");
  }

  const client = createXaiClientOrThrow();

  let raw: string;
  try {
    const completion = await client.chat.completions.create({
      model: getXaiWorkflowModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Classify this provider message:\n\n${trimmed.slice(0, 4000)}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "xAI request failed";
    throw new Error(`Encounter intent API error: ${msg}`);
  }

  if (!raw) {
    throw new Error("Encounter intent: empty model response");
  }

  let parsed: { intent?: string };
  try {
    parsed = JSON.parse(raw) as { intent?: string };
  } catch {
    throw new Error("Encounter intent: model returned non-JSON");
  }

  const i = parsed.intent?.toLowerCase();
  if (i === "soap" || i === "plan" || i === "rx" || i === "search") {
    return i;
  }
  throw new Error(`Encounter intent: invalid intent "${String(parsed.intent)}"`);
}
