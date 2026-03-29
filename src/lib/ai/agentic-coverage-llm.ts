import { createXaiClientOrThrow, getXaiWorkflowModel } from "@/lib/ai/xai-client";
import { isXaiApiKeyConfigured } from "@/lib/ai/config";
import { SEED_PAYER_PLANS } from "@/lib/benefits/seed-benefits-data";
import type { PrescriptionLine, UUID } from "@/types/workflow";
import type {
  CoverageEvaluationResult,
  LineCoverageDecision,
  MedicationUrgency,
} from "@/types/benefits";
import type { PatientClinicalSummary } from "@/types/workflow";

export type AgenticCoverageRequest = {
  patientId: string;
  insurancePlanId?: UUID;
  preferredPharmacyId?: UUID;
  pharmacyId: UUID;
  prescriptionLines: PrescriptionLine[];
  treatmentPlanText: string;
  clinicalSummary?: PatientClinicalSummary | null;
};

export type AgenticCoverageResponse = {
  coverage: CoverageEvaluationResult;
  documentationAddendum?: string;
  patientNotification?: { title: string; body: string };
};

const ROUTES = [
  "pharmacy_direct",
  "payer_prior_auth",
  "blocked_step_therapy",
] as const;

const URGENCY: MedicationUrgency[] = ["routine", "urgent", "high_risk"];

function planForPatient(insurancePlanId?: UUID) {
  return (
    SEED_PAYER_PLANS.find((p) => p.id === insurancePlanId) ?? SEED_PAYER_PLANS[0]
  );
}

function isRoute(s: string): s is LineCoverageDecision["route"] {
  return (ROUTES as readonly string[]).includes(s);
}

function isUrgency(s: string): s is MedicationUrgency {
  return (URGENCY as readonly string[]).includes(s);
}

function coerceEstimatedCopay(raw: unknown, lineIndex: number): number | null {
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Coverage agent: invalid estimatedCopayUsd at line ${lineIndex}`);
}

function normalizeLine(
  raw: Record<string, unknown>,
  lineIndex: number,
  defaultDrug: string,
): LineCoverageDecision {
  const drugName =
    typeof raw.drugName === "string" && raw.drugName.trim() ?
      raw.drugName.trim()
    : defaultDrug;
  const route =
    typeof raw.route === "string" && isRoute(raw.route) ?
      raw.route
    : (() => {
        throw new Error(`Coverage agent: invalid route for line ${lineIndex}`);
      })();
  const urgency =
    typeof raw.urgency === "string" && isUrgency(raw.urgency) ?
      raw.urgency
    : (() => {
        throw new Error(`Coverage agent: invalid urgency for line ${lineIndex}`);
      })();
  const reason =
    typeof raw.reason === "string" && raw.reason.trim() ?
      raw.reason.trim()
    : (() => {
        throw new Error(`Coverage agent: missing reason for line ${lineIndex}`);
      })();
  return {
    lineIndex,
    drugName,
    paRequired: Boolean(raw.paRequired),
    stepTherapyRequired: Boolean(raw.stepTherapyRequired),
    stepTherapyMet: Boolean(raw.stepTherapyMet),
    formularyTierLabel:
      typeof raw.formularyTierLabel === "string" ? raw.formularyTierLabel
      : "Formulary (agent)",
    coveredAlternativeToken:
      raw.coveredAlternativeToken === null ? null
      : typeof raw.coveredAlternativeToken === "string" ?
        raw.coveredAlternativeToken
      : null,
    estimatedCopayUsd: coerceEstimatedCopay(raw.estimatedCopayUsd, lineIndex),
    copayHigh: Boolean(raw.copayHigh),
    preferredPharmacyInNetwork: raw.preferredPharmacyInNetwork !== false,
    urgency,
    route,
    reason,
  };
}

function aggregate(lines: LineCoverageDecision[]): Pick<
  CoverageEvaluationResult,
  | "anyPaRequired"
  | "anyStepTherapyBlock"
  | "holdForPriorAuth"
  | "anyHighCopay"
> {
  const anyPaRequired = lines.some(
    (l) => l.paRequired && l.route === "payer_prior_auth",
  );
  const anyStepTherapyBlock = lines.some((l) => l.route === "blocked_step_therapy");
  const holdGate =
    anyPaRequired || lines.some((l) => l.route === "payer_prior_auth");
  return {
    anyPaRequired,
    anyStepTherapyBlock,
    holdForPriorAuth: holdGate && !anyStepTherapyBlock,
    anyHighCopay: lines.some((l) => l.copayHigh),
  };
}

/**
 * Benefits adjudication agent (Grok). Throws on missing key, API failure, or invalid JSON — no fallback.
 */
export async function resolveAgenticCoverage(
  args: AgenticCoverageRequest,
): Promise<AgenticCoverageResponse> {
  if (!isXaiApiKeyConfigured()) {
    throw new Error("XAI_API_KEY is required for agentic coverage adjudication");
  }
  if (args.prescriptionLines.length === 0) {
    throw new Error("Coverage agent: at least one prescription line is required");
  }

  const client = createXaiClientOrThrow();
  const plan = planForPatient(args.insurancePlanId);
  const clinicalJson = args.clinicalSummary ?
    JSON.stringify({
      diagnoses: args.clinicalSummary.diagnoses,
      allergies: args.clinicalSummary.allergies,
      medications: args.clinicalSummary.medications,
    })
  : "{}";

  const linesPayload = args.prescriptionLines.map((l, i) => ({
    lineIndex: i,
    drugName: l.drugName,
    sig: l.sig,
    quantity: l.quantity,
  }));

  const system = `You are a US commercial pharmacy benefits adjudication agent integrated into clinical workflow (demo).
You decide per-line routing, network alignment, and PA/step-therapy posture so downstream systems can auto-route e-prescribe and member comms without human triage.
Return JSON only with this shape:
{
  "lines": [ {
    "lineIndex": number,
    "drugName": string,
    "paRequired": boolean,
    "stepTherapyRequired": boolean,
    "stepTherapyMet": boolean,
    "formularyTierLabel": string,
    "coveredAlternativeToken": string | null,
    "estimatedCopayUsd": number | null,
    "copayHigh": boolean,
    "preferredPharmacyInNetwork": boolean,
    "urgency": "routine"|"urgent"|"high_risk",
    "route": "pharmacy_direct"|"payer_prior_auth"|"blocked_step_therapy",
    "reason": string
  } ],
  "anyNetworkMismatch": boolean,
  "documentationAddendum": string,
  "patientNotification": { "title": string, "body": string } | null
}
Rules: Output exactly one lines[] entry per input line in order. Infer network mismatch when transmit pharmacy id differs from member preferred pharmacy id.`;

  const user = `Plan: ${plan.name} (${plan.planCode}). Plan documentation policy: ${plan.documentationNotes}
Treatment plan:
${args.treatmentPlanText.slice(0, 8000)}
Clinical snapshot:
${clinicalJson}
Prescription lines:
${JSON.stringify(linesPayload)}
Transmit pharmacy id: ${args.pharmacyId}
Member preferred pharmacy id: ${args.preferredPharmacyId ?? "none"}`;

  let raw: string;
  try {
    const completion = await client.chat.completions.create({
      model: getXaiWorkflowModel(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "xAI request failed";
    throw new Error(`Coverage agent API error: ${msg}`);
  }

  if (!raw) {
    throw new Error("Coverage agent: empty model response");
  }

  let parsed: {
    lines?: unknown[];
    anyNetworkMismatch?: boolean;
    documentationAddendum?: string;
    patientNotification?: { title?: string; body?: string };
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Coverage agent: model returned non-JSON");
  }

  if (!Array.isArray(parsed.lines) || parsed.lines.length !== args.prescriptionLines.length) {
    throw new Error(
      `Coverage agent: expected ${args.prescriptionLines.length} line(s), got ${parsed.lines?.length ?? 0}`,
    );
  }

  const lines: LineCoverageDecision[] = parsed.lines.map((row, i) => {
    if (!row || typeof row !== "object") {
      throw new Error(`Coverage agent: invalid line object at index ${i}`);
    }
    const rec = normalizeLine(
      row as Record<string, unknown>,
      i,
      args.prescriptionLines[i]!.drugName,
    );
    if (rec.lineIndex !== i) rec.lineIndex = i;
    return rec;
  });

  const agg = aggregate(lines);
  const coverage: CoverageEvaluationResult = {
    plan,
    lines,
    ...agg,
    anyNetworkMismatch: Boolean(parsed.anyNetworkMismatch),
  };

  const doc =
    typeof parsed.documentationAddendum === "string" ?
      parsed.documentationAddendum.trim()
    : undefined;
  const pn = parsed.patientNotification;
  const patientNotification =
    pn && typeof pn.title === "string" && typeof pn.body === "string" ?
      { title: pn.title, body: pn.body }
    : undefined;

  return {
    coverage,
    documentationAddendum: doc || undefined,
    patientNotification,
  };
}
