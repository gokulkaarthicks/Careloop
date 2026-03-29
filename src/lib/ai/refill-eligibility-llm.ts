import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";

export type RefillAgentLineInput = {
  prescriptionId: string;
  drugName: string;
  quantity: string;
  refills: number;
  status: string;
};

export type RefillAgentLineResult = {
  prescriptionId: string;
  eligible: boolean;
  /** Member-facing next action */
  patientInstructions: string;
  /** Payer/pharmacy/system workflow steps */
  nextWorkflowSteps: string[];
  /** Estimated days until refill request is appropriate (if applicable) */
  suggestedDaysUntilRefill?: number;
};

export type RefillEligibilityAgentResponse = {
  evaluations: RefillAgentLineResult[];
};

/**
 * Refill coordination agent — decides eligibility posture and downstream workflow (LLM-only).
 */
export async function runRefillEligibilityAgentLlm(args: {
  patientDisplayName: string;
  lines: RefillAgentLineInput[];
}): Promise<RefillEligibilityAgentResponse> {
  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for refill eligibility agent");
  }
  if (args.lines.length === 0) {
    throw new Error("Refill agent: no prescription lines supplied");
  }

  const client = createXaiClientOrThrow();

  const system = `You are a US pharmacy benefits refill coordination agent (demo). For each prescription line, decide operational next steps in a real retail/mail workflow — do not merely summarize.
Return JSON only:
{
  "evaluations": [
    {
      "prescriptionId": string,
      "eligible": boolean,
      "patientInstructions": string,
      "nextWorkflowSteps": string[],
      "suggestedDaysUntilRefill": number | null
    }
  ]
}
Rules: One evaluation per input line; prescriptionId must match input. nextWorkflowSteps: 2–5 imperative steps (e.g., "Queue automated refill request", "Notify prescriber if zero refills", "Schedule 340B eligibility check"). eligible=false when renewal or PA may be needed.`;

  const user = `Member: ${args.patientDisplayName}
Prescription snapshot:
${JSON.stringify(args.lines)}`;

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
  if (!raw) throw new Error("Refill agent: empty model response");

  let parsed: { evaluations?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { evaluations?: unknown[] };
  } catch {
    throw new Error("Refill agent: model returned non-JSON");
  }

  const evals = parsed.evaluations;
  if (!Array.isArray(evals) || evals.length !== args.lines.length) {
    throw new Error(
      `Refill agent: expected ${args.lines.length} evaluation(s), got ${Array.isArray(evals) ? evals.length : 0}`,
    );
  }

  const evaluations: RefillAgentLineResult[] = [];
  for (let i = 0; i < evals.length; i++) {
    const row = evals[i];
    if (!row || typeof row !== "object") {
      throw new Error(`Refill agent: invalid evaluation at ${i}`);
    }
    const o = row as Record<string, unknown>;
    const prescriptionId = String(o.prescriptionId ?? "");
    if (prescriptionId !== args.lines[i]!.prescriptionId) {
      throw new Error(`Refill agent: prescriptionId mismatch at index ${i}`);
    }
    const patientInstructions = String(o.patientInstructions ?? "").trim();
    if (!patientInstructions) {
      throw new Error(`Refill agent: patientInstructions required for ${prescriptionId}`);
    }
    const steps = o.nextWorkflowSteps;
    if (!Array.isArray(steps) || steps.length < 2) {
      throw new Error(`Refill agent: nextWorkflowSteps required for ${prescriptionId}`);
    }
    const nextWorkflowSteps = steps.map((s) => String(s).trim()).filter(Boolean);
    if (nextWorkflowSteps.length < 2) {
      throw new Error(`Refill agent: nextWorkflowSteps empty for ${prescriptionId}`);
    }
    const eligible = Boolean(o.eligible);
    let suggestedDaysUntilRefill: number | undefined;
    if (o.suggestedDaysUntilRefill === null || o.suggestedDaysUntilRefill === undefined) {
      suggestedDaysUntilRefill = undefined;
    } else if (typeof o.suggestedDaysUntilRefill === "number") {
      suggestedDaysUntilRefill = o.suggestedDaysUntilRefill;
    } else {
      throw new Error(`Refill agent: invalid suggestedDaysUntilRefill for ${prescriptionId}`);
    }
    evaluations.push({
      prescriptionId,
      eligible,
      patientInstructions,
      nextWorkflowSteps,
      suggestedDaysUntilRefill,
    });
  }

  return { evaluations };
}
