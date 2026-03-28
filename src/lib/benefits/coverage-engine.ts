import type { PrescriptionLine, UUID } from "@/types/workflow";
import type {
  CoverageEvaluationResult,
  CoveragePatientInput,
  FormularyDrugRow,
  InsurancePlan,
  LineCoverageDecision,
  CoverageDemoTag,
} from "@/types/benefits";
import { SEED_PAYER_PLANS, SUMMIT_PPO_FORMULARY, tokenizeDrugName } from "./seed-benefits-data";

const PA_PATTERN =
  /\b(humira|ozempic|wegovy|skyrizi|cosentyx|dupixent|biologic|specialty)\b/i;
const PROCEDURE_PA = /\b(mri|pet\s*scan|ct\s*abdomen|surgery|infusion\s+center)\b/i;

function rowForToken(
  token: string,
  formulary: FormularyDrugRow[],
): FormularyDrugRow | undefined {
  return formulary.find((r) => r.drugToken === token);
}

function defaultRow(token: string): FormularyDrugRow {
  return {
    drugToken: token || "unknown",
    tierLabel: "Tier 1 / preferred generic",
    genericAvailable: true,
    paRequired: PA_PATTERN.test(token),
    stepTherapyRequired: false,
    estimatedCopayUsd: 10,
  };
}

/**
 * Deterministic coverage — same inputs always yield same branch labels.
 */
export function evaluatePrescriptionCoverage(args: {
  patient: CoveragePatientInput;
  pharmacyId: UUID;
  prescriptionLines: PrescriptionLine[];
  treatmentPlanText: string;
  /** When patient has no plan, default to Summit PPO */
  planOverride?: InsurancePlan;
  formularyOverride?: FormularyDrugRow[];
  /** Demo-only tag to force network / PA teaching scenarios */
  coverageDemoTag?: CoverageDemoTag;
}): CoverageEvaluationResult {
  const plan =
    args.planOverride ??
    SEED_PAYER_PLANS.find((p) => p.id === args.patient.insurancePlanId) ??
    SEED_PAYER_PLANS[0];
  const formulary = args.formularyOverride ?? SUMMIT_PPO_FORMULARY;
  const demoTag = args.coverageDemoTag ?? args.patient.coverageDemoTag;

  const preferredPharmacyId = args.patient.preferredPharmacyId;
  let networkMismatch =
    demoTag === "network_mismatch" ? true : false;
  if (preferredPharmacyId && preferredPharmacyId !== args.pharmacyId) {
    networkMismatch = true;
  }

  const procedurePa = PROCEDURE_PA.test(args.treatmentPlanText);
  const lines: LineCoverageDecision[] = args.prescriptionLines.map((line, lineIndex) => {
    const drugName = line.drugName.trim();
    const token = tokenizeDrugName(drugName) || "unknown";
    const row = rowForToken(token, formulary) ?? defaultRow(token);

    let paRequired = row.paRequired || procedurePa;
    let stepTherapyRequired = row.stepTherapyRequired;
    const stepTherapyMet =
      /\b(metformin|lifestyle|diet|exercise)\b/i.test(args.treatmentPlanText) &&
      /\b(ozempic|wegovy|humira)\b/i.test(drugName);

    if (demoTag === "formulary_alt" && /\bozempic\b/i.test(drugName)) {
      paRequired = true;
      stepTherapyRequired = true;
    }

    let route: LineCoverageDecision["route"] = "pharmacy_direct";
    if (stepTherapyRequired && !stepTherapyMet) {
      route = "blocked_step_therapy";
    } else if (paRequired) {
      route = "payer_prior_auth";
    }

    const copayHigh =
      row.estimatedCopayUsd >= plan.highCopayThresholdUsd;

    let urgency: LineCoverageDecision["urgency"] = "routine";
    if (/\burgent|stat\b/i.test(drugName + args.treatmentPlanText)) {
      urgency = "urgent";
    }
    if (PA_PATTERN.test(drugName) || row.paRequired) {
      urgency = "high_risk";
    }

    let reason = row.paRequired
      ? `Plan ${plan.planCode}: ${row.tierLabel} — PA required`
      : `Plan ${plan.planCode}: ${row.tierLabel} — no PA`;

    if (route === "blocked_step_therapy") {
      reason = `Step therapy not documented — try ${row.preferredAlternativeToken ?? "preferred alternative"} first or attach chart notes.`;
    } else if (procedurePa && !row.paRequired) {
      reason = "Procedure/imaging in visit plan may require separate PA (demo).";
    }

    return {
      lineIndex,
      drugName: drugName || "(empty)",
      paRequired,
      stepTherapyRequired,
      stepTherapyMet,
      formularyTierLabel: row.tierLabel,
      coveredAlternativeToken:
        demoTag === "formulary_alt" && /\bozempic\b/i.test(drugName) ?
          "semaglutide (preferred formulary alternative — demo)"
        : row.preferredAlternativeToken
          ? `${row.preferredAlternativeToken} (step-1)`
          : null,
      estimatedCopayUsd: row.estimatedCopayUsd,
      copayHigh,
      preferredPharmacyInNetwork: !networkMismatch,
      urgency,
      route,
      reason,
    };
  });

  const anyPaRequired = lines.some((l) => l.paRequired && l.route === "payer_prior_auth");
  const anyStepTherapyBlock = lines.some((l) => l.route === "blocked_step_therapy");
  const holdForPriorAuth =
    anyPaRequired ||
    lines.some((l) => l.route === "payer_prior_auth");

  return {
    plan,
    lines,
    anyPaRequired,
    anyStepTherapyBlock,
    anyNetworkMismatch: networkMismatch,
    anyHighCopay: lines.some((l) => l.copayHigh),
    holdForPriorAuth: holdForPriorAuth && !anyStepTherapyBlock,
  };
}
