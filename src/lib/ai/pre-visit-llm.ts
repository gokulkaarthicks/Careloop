import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";
import type { PreVisitAgentInput, PreVisitAgentOutput } from "@/types/pre-visit-agent";
import type { ClinicalRisk, UUID } from "@/types/workflow";

function normalizeRisks(raw: unknown): ClinicalRisk[] {
  if (!Array.isArray(raw)) {
    throw new Error("Pre-visit agent: risks must be an array");
  }
  const out: ClinicalRisk[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    if (!label) throw new Error(`Pre-visit agent: risk ${i} missing label`);
    const severity =
      o.severity === "high" || o.severity === "moderate" || o.severity === "low" ?
        o.severity
      : (() => {
          throw new Error(`Pre-visit agent: invalid severity on risk ${i}`);
        })();
    const rationale =
      typeof o.rationale === "string" ? o.rationale : "";
    if (!rationale) throw new Error(`Pre-visit agent: risk ${i} missing rationale`);
    const id = (typeof o.id === "string" ? o.id : `pv_llm_${i}`) as UUID;
    out.push({ id, label, severity, rationale });
  }
  if (out.length < 1) {
    throw new Error("Pre-visit agent: at least one risk required");
  }
  return out.slice(0, 12);
}

/**
 * Pre-visit operational briefing agent (Grok). Produces huddle-ready output; throws on any failure.
 */
export async function resolvePreVisitBriefing(
  input: PreVisitAgentInput,
): Promise<PreVisitAgentOutput> {
  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for pre-visit agent");
  }

  const client = createXaiClientOrThrow();

  const system = `You are a primary care pre-visit operations agent (demo). You prepare the care team for rooming and closed-loop documentation — not a generic summary.
Return JSON only:
{
  "briefingBullets": [ string, string, string, string, string ],
  "risks": [ { "id": string, "label": string, "severity": "low"|"moderate"|"high", "rationale": string } ],
  "missingQuestions": string[],
  "clinicalTimeline": string,
  "visitReadinessScore": number,
  "nextOperationalSteps": string[]
}
Rules: Exactly five briefing bullets. Score 0–100. missingQuestions: gaps to close before prescribing. nextOperationalSteps: 3–6 concrete workflow actions (e.g. reconcile home meds, verify BP goal, queue PA packet). Do not invent diagnoses not supported by input.`;

  const user = JSON.stringify({
    patient: input.displayName,
    appointmentReason: input.appointmentReason,
    clinical: input.clinical,
    priorEncounters: input.priorEncounters.slice(0, 8),
  });

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
    throw new Error(`Pre-visit agent API error: ${msg}`);
  }

  if (!raw) {
    throw new Error("Pre-visit agent: empty model response");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Pre-visit agent: model returned non-JSON");
  }

  const bullets = parsed.briefingBullets;
  if (!Array.isArray(bullets) || bullets.length < 5) {
    throw new Error("Pre-visit agent: briefingBullets must have at least 5 entries");
  }
  const b = bullets.map((x) => (typeof x === "string" ? x : String(x)));
  const five = [b[0]!, b[1]!, b[2]!, b[3]!, b[4]!] as [
    string,
    string,
    string,
    string,
    string,
  ];

  const scoreRaw = parsed.visitReadinessScore;
  if (typeof scoreRaw !== "number" || scoreRaw < 0 || scoreRaw > 100) {
    throw new Error("Pre-visit agent: visitReadinessScore must be 0–100");
  }
  const visitReadinessScore = Math.round(scoreRaw);

  const missing = Array.isArray(parsed.missingQuestions) ?
    parsed.missingQuestions.map((x) => String(x)).filter(Boolean).slice(0, 12)
  : [];
  if (missing.length < 1) {
    throw new Error("Pre-visit agent: missingQuestions required");
  }

  const timeline =
    typeof parsed.clinicalTimeline === "string" && parsed.clinicalTimeline.trim() ?
      parsed.clinicalTimeline.trim()
    : (() => {
        throw new Error("Pre-visit agent: clinicalTimeline required");
      })();

  const steps = parsed.nextOperationalSteps;
  if (!Array.isArray(steps) || steps.length < 3) {
    throw new Error("Pre-visit agent: nextOperationalSteps must have at least 3 items");
  }
  const opSteps = steps.map((x) => String(x).trim()).filter(Boolean);
  if (opSteps.length < 3) {
    throw new Error("Pre-visit agent: nextOperationalSteps empty after parse");
  }

  /** Fold operational steps into clinical timeline for downstream readers */
  const clinicalTimeline = `${timeline}\n\nOperational queue:\n${opSteps.map((s) => `• ${s}`).join("\n")}`;

  return {
    briefingBullets: five,
    risks: normalizeRisks(parsed.risks),
    missingQuestions: missing,
    clinicalTimeline,
    visitReadinessScore,
    agentVersion: "llm-v1",
    generatedAt: new Date().toISOString(),
  };
}
