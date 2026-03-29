import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";
import type { PolicyPaResolution } from "@/types/pa-policy";

export type PaAdjudicateLlmInput = {
  patientDisplayName: string;
  planName: string;
  planCode: string;
  planDocumentationNotes: string;
  drugLines: { drugName: string; lineIndex: number; caseId: string }[];
  clinicalSummaryJson: string;
};

export type PaAdjudicationResult = {
  decision: PolicyPaResolution;
  /** Payer case documentation / medical necessity narrative */
  adjudicationNotes: string;
  /** Concrete next actions in the US PA workflow (e.g. notify member, request labs) */
  nextWorkflowSteps: string[];
};

function parseDecision(raw: string): PolicyPaResolution | null {
  const d = raw.toLowerCase();
  if (d === "approve" || d === "approved") return "approved";
  if (d === "deny" || d === "denied") return "denied";
  if (d === "more_info" || d === "more information") return "more_info";
  if (d === "manual" || d === "manual_queue") return "manual_queue";
  return null;
}

/**
 * Payer PA adjudication agent — structured decision + workflow steps. No deterministic fallback.
 */
export async function adjudicatePaPolicyWithLlm(
  args: PaAdjudicateLlmInput,
): Promise<PaAdjudicationResult> {
  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for payer PA adjudication");
  }

  const client = createXaiClientOrThrow();

  const system = `You are a US health plan prior authorization clinical reviewer agent (demo).
You adjudicate open PA cases using plan policy and chart context. Act as the payer: decide, document, and specify automated next steps — not as a summarizer only.
Return JSON only:
{
  "decision": "approve"|"deny"|"more_info"|"manual",
  "adjudicationNotes": string,
  "nextWorkflowSteps": string[]
}
Rules:
- approve: medical necessity and benefit design support release to pharmacy routing.
- deny: clear lack of medical necessity or benefit exclusion (state briefly in notes).
- more_info: need specific clinical documentation, labs, or step-therapy proof.
- manual: specialty/case requires human medical director or external vendor (rare).
- nextWorkflowSteps: 2–6 imperative steps (e.g. "Notify member of determination", "Release e-Rx if approved", "Open clinical question to prescriber").`;

  const user = `Member: ${args.patientDisplayName}
Plan: ${args.planName} (${args.planCode})
Plan policy notes: ${args.planDocumentationNotes}

Open PA lines:
${JSON.stringify(args.drugLines)}

Clinical context (JSON):
${args.clinicalSummaryJson.slice(0, 12000)}`;

  const completion = await client.chat.completions.create({
    model: getXaiWorkflowModel(),
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("PA adjudication: empty model response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PA adjudication: model returned non-JSON");
  }

  const o = parsed as Record<string, unknown>;
  const decision = parseDecision(String(o.decision ?? ""));
  if (!decision) {
    throw new Error(`PA adjudication: invalid decision in JSON: ${String(o.decision)}`);
  }

  const notes =
    typeof o.adjudicationNotes === "string" ? o.adjudicationNotes.trim() : "";
  if (!notes) {
    throw new Error("PA adjudication: adjudicationNotes required");
  }

  const stepsRaw = o.nextWorkflowSteps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length < 1) {
    throw new Error("PA adjudication: nextWorkflowSteps must be a non-empty array");
  }
  const nextWorkflowSteps = stepsRaw.map((x) => String(x).trim()).filter(Boolean);
  if (nextWorkflowSteps.length < 1) {
    throw new Error("PA adjudication: nextWorkflowSteps empty after parse");
  }

  return { decision, adjudicationNotes: notes, nextWorkflowSteps };
}
