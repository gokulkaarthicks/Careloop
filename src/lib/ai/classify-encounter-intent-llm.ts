import { createXaiClient, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";

export type EncounterIntentKind = "soap" | "plan" | "rx" | "search";

const SYSTEM = `You are a classifier for a clinical encounter chat (hackathon demo).
Return JSON only: {"intent":"soap"|"plan"|"rx"|"search"}
Rules:
- soap: user wants SOAP note, clinical documentation, or dictation to be formatted as SOAP; mentions subjective/objective/assessment or "soap note(s)".
- plan: user wants ONLY a treatment / care plan (not SOAP); explicit "treatment plan" or "care plan" as the main ask without SOAP.
- rx: user wants to prescribe, add a drug, or says "prescription X" / "prescribe X".
- search: chart lookup, question about patient data, medication info lookup, ICd search, or unclear short query.
If both SOAP and treatment content appear but user asks to document the visit as SOAP, choose soap.`;

/**
 * Optional LLM pass when regex routing is ambiguous.
 */
export async function classifyEncounterIntentWithLlm(
  message: string,
): Promise<{ intent: EncounterIntentKind; source: "xai" | "mock" }> {
  const trimmed = message.trim();
  if (!trimmed) return { intent: "search", source: "mock" };

  if (!isXaiApiKeyConfigured()) {
    return { intent: mockClassify(trimmed), source: "mock" };
  }

  const client = createXaiClient();
  if (!client) {
    return { intent: mockClassify(trimmed), source: "mock" };
  }

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
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(raw) as { intent?: string };
    const i = parsed.intent?.toLowerCase();
    if (i === "soap" || i === "plan" || i === "rx" || i === "search") {
      return { intent: i, source: "xai" };
    }
  } catch {
    /* fall through */
  }
  return { intent: mockClassify(trimmed), source: "mock" };
}

function mockClassify(t: string): EncounterIntentKind {
  const s = t.toLowerCase();
  if (
    /\bprescribe\b|\bprescription\s+\w|\brx\s+\w|add\s+(a\s+)?med|new\s+med/.test(s)
  ) {
    return "rx";
  }
  if (
    /\bsoap\b|dictation|document\s+(the\s+)?visit|subjective|o\/a\/p|\bs\/o\/a\/p\b/.test(
      s,
    )
  ) {
    return "soap";
  }
  if (/\btreatment\s+plan\b|\bcare\s+plan\b/.test(s) && !/\bsoap\b/.test(s)) {
    return "plan";
  }
  if (/\bwhat\b|\bshow\b|\blist\b|\bsearch\b|medication|allergy|lab|icd/i.test(s)) {
    return "search";
  }
  return "search";
}
