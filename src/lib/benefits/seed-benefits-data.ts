import type { FormularyDrugRow, InsurancePlan } from "@/types/benefits";

export const SEED_PAYER_PLANS: InsurancePlan[] = [
  {
    id: "plan_ppo_summit_001",
    payerId: "payer_seed_001",
    name: "Summit Preferred PPO",
    planCode: "SM-PPO-2026",
    paTurnaroundBusinessDays: 3,
    highCopayThresholdUsd: 75,
    documentationNotes:
      "Specialty/biologic PA requires chart notes + labs; step therapy for GLP-1 and anti-TNF.",
  },
  {
    id: "plan_hmo_river_002",
    payerId: "payer_seed_001",
    name: "River Valley HMO Rx",
    planCode: "RV-HMO-RX",
    paTurnaroundBusinessDays: 5,
    highCopayThresholdUsd: 50,
    documentationNotes: "Narrow network; out-of-area retail may require transition to preferred pharmacy.",
  },
  {
    id: "plan_ppo_horizon_003",
    payerId: "payer_seed_002",
    name: "Horizon Select PPO",
    planCode: "HZ-PPO-PLUS",
    paTurnaroundBusinessDays: 2,
    highCopayThresholdUsd: 90,
    documentationNotes:
      "Specialty biologics require PA; preferred alternatives can bypass review when criteria met.",
  },
];

/**
 * Normalized tokens (lowercase) → formulary behavior for Summit PPO.
 * Missing tokens default to tier-1 generic / no PA.
 */
export const SUMMIT_PPO_FORMULARY: FormularyDrugRow[] = [
  {
    drugToken: "lisinopril",
    tierLabel: "Tier 1 generic",
    genericAvailable: true,
    paRequired: false,
    stepTherapyRequired: false,
    estimatedCopayUsd: 5,
  },
  {
    drugToken: "metformin",
    tierLabel: "Tier 1 generic",
    genericAvailable: true,
    paRequired: false,
    stepTherapyRequired: false,
    estimatedCopayUsd: 4,
  },
  {
    drugToken: "aspirin",
    tierLabel: "Tier 1 OTC-preferred",
    genericAvailable: true,
    paRequired: false,
    stepTherapyRequired: false,
    estimatedCopayUsd: 0,
  },
  {
    drugToken: "atorvastatin",
    tierLabel: "Tier 2 preferred brand",
    genericAvailable: true,
    paRequired: false,
    stepTherapyRequired: false,
    estimatedCopayUsd: 12,
  },
  {
    drugToken: "ozempic",
    tierLabel: "Specialty GLP-1",
    genericAvailable: false,
    paRequired: true,
    stepTherapyRequired: true,
    preferredAlternativeToken: "metformin",
    estimatedCopayUsd: 95,
  },
  {
    drugToken: "wegovy",
    tierLabel: "Specialty weight management",
    genericAvailable: false,
    paRequired: true,
    stepTherapyRequired: true,
    preferredAlternativeToken: "metformin",
    estimatedCopayUsd: 120,
  },
  {
    drugToken: "humira",
    tierLabel: "Specialty anti-TNF",
    genericAvailable: false,
    paRequired: true,
    stepTherapyRequired: true,
    estimatedCopayUsd: 250,
  },
  {
    drugToken: "dupixent",
    tierLabel: "Specialty biologic",
    genericAvailable: false,
    paRequired: true,
    stepTherapyRequired: false,
    estimatedCopayUsd: 180,
  },
];

export function tokenizeDrugName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)[0] ?? "";
}
