import type { PrescriptionLine } from "@/types/workflow";
import type { PaLineDecision } from "@/types/agentic";

/** Mock plan — demo only */
export const MOCK_PLAN_LABEL = "Commercial PPO (demo benefits)";

const PA_DRUG_PATTERNS =
  /\b(humira|ozempic|wegovy|skyrizi|cosentyx|dupixent|biologic|specialty)\b/i;

const PA_PROCEDURE_PATTERNS =
  /\b(mri|pet\s*scan|ct\s*abdomen|surgery|surgical|inpatient\s+admission|infusion\s+center)\b/i;

/**
 * Rule-based PA hints — replace with payer formulary API in production.
 */
export function evaluatePaForPrescriptionLines(
  lines: PrescriptionLine[],
  treatmentPlanText: string,
): PaLineDecision[] {
  const procedurePa = PA_PROCEDURE_PATTERNS.test(treatmentPlanText);
  return lines.map((line) => {
    const drug = line.drugName.trim();
    if (!drug) {
      return {
        drugName: "(empty line)",
        paRequired: false,
        reason: "No medication name — skipped",
        route: "pharmacy_direct",
      };
    }
    if (PA_DRUG_PATTERNS.test(drug)) {
      return {
        drugName: drug,
        paRequired: true,
        reason: "Specialty / GLP-1 / biologic tier — prior auth required per plan",
        route: "payer_prior_auth",
      };
    }
    if (procedurePa) {
      return {
        drugName: drug,
        paRequired: true,
        reason: "Visit includes procedure/imaging that may require PA per plan",
        route: "payer_prior_auth",
      };
    }
    return {
      drugName: drug,
      paRequired: false,
      reason: "Tier-1 / generic pathway — no PA for this line (demo rule)",
      route: "pharmacy_direct",
    };
  });
}
