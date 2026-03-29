/**
 * Synthetic insurance / formulary / PA models — deterministic mock layer.
 * Replace with real payer APIs in production.
 */

import type { ISODateTime, UUID } from "@/types/workflow";

export type CoverageDemoTag =
  | "standard"
  | "pa_auto_approve"
  | "pa_auto_deny"
  | "pa_more_info"
  | "network_mismatch"
  | "formulary_alt"
  | "refill_story"
  | "adherence_gap";

/** Minimal patient fields for coverage — avoids circular imports with workflow snapshot */
export type CoveragePatientInput = {
  id: UUID;
  preferredPharmacyId?: UUID;
  insurancePlanId?: UUID;
  coverageDemoTag?: CoverageDemoTag;
};

export type PriorAuthCaseStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "denied"
  | "more_info_needed";

/** Plan-level metadata */
export interface InsurancePlan {
  id: UUID;
  payerId: UUID;
  name: string;
  planCode: string;
  /** Business days for PA turnaround (demo SLA label) */
  paTurnaroundBusinessDays: number;
  /** Copay alert threshold in USD for “high” copay flag */
  highCopayThresholdUsd: number;
  documentationNotes: string;
}

/** One formulary row — keyed by normalized drug token in engine */
export interface FormularyDrugRow {
  drugToken: string;
  tierLabel: string;
  genericAvailable: boolean;
  paRequired: boolean;
  stepTherapyRequired: boolean;
  /** Preferred covered substitute when brand is non-preferred */
  preferredAlternativeToken?: string;
  estimatedCopayUsd: number;
}

export type CoverageRoute =
  | "pharmacy_direct"
  | "payer_prior_auth"
  | "blocked_step_therapy";

export type MedicationUrgency = "routine" | "urgent" | "high_risk";

/** Per-Rx-line deterministic coverage outcome */
export interface LineCoverageDecision {
  lineIndex: number;
  drugName: string;
  paRequired: boolean;
  stepTherapyRequired: boolean;
  stepTherapyMet: boolean;
  formularyTierLabel: string;
  coveredAlternativeToken: string | null;
  estimatedCopayUsd: number | null;
  copayHigh: boolean;
  preferredPharmacyInNetwork: boolean;
  urgency: MedicationUrgency;
  route: CoverageRoute;
  reason: string;
}

export interface CoverageEvaluationResult {
  plan: InsurancePlan;
  lines: LineCoverageDecision[];
  anyPaRequired: boolean;
  anyStepTherapyBlock: boolean;
  anyNetworkMismatch: boolean;
  anyHighCopay: boolean;
  /** When true, finalize should hold e-Rx until PA resolves */
  holdForPriorAuth: boolean;
}

export interface PriorAuthCase {
  id: UUID;
  patientId: UUID;
  appointmentId: UUID;
  prescriptionId: UUID;
  payerId: UUID;
  planId: UUID;
  status: PriorAuthCaseStatus;
  drugName: string;
  lineIndex: number;
  submittedAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  denialReason?: string;
  suggestedAlternative?: string;
  moreInfoQuestion?: string;
  notes?: string;
}

export type WorkflowEngineEventKind =
  | "patient_selected"
  | "chart_loaded"
  | "provider_briefing_ready"
  | "prescription_created"
  | "insurance_checked"
  | "pa_required"
  | "pa_submitted"
  | "pa_approved"
  | "pa_denied"
  | "pa_more_info_needed"
  | "pharmacy_order_created"
  | "pharmacy_order_sent"
  | "network_mismatch"
  | "formulary_alternative"
  | "medication_ready"
  | "medication_picked_up"
  | "adherence_started"
  | "adherence_missed"
  | "follow_up_missed"
  | "provider_alerted"
  | "payer_alerted"
  | "patient_notified"
  | "care_completed"
  | "background_pa_policy_started"
  | "background_pa_policy_completed"
  | "refill_eligibility_evaluated"
  | "orchestrator_tick"
  | "encounter_agent_trace"
  | "recovery_case_opened"
  | "recovery_plan_created"
  | "appeal_generated"
  | "appeal_submitted"
  | "appeal_status_updated"
  | "recovery_escalated"
  | "recovery_closed";

export interface WorkflowEngineEvent {
  id: UUID;
  occurredAt: ISODateTime;
  kind: WorkflowEngineEventKind;
  title: string;
  detail?: string;
  /** Why this event happened (plain language). */
  trigger?: string;
  /** What branch was selected. */
  decision?: string;
  /** Action taken by the workflow engine. */
  action?: string;
  /** Visible outcome after the action. */
  result?: string;
  /** Optional policy/clinical rationale text. */
  reason?: string;
  patientId?: UUID;
  prescriptionId?: UUID;
  role?:
    | "provider"
    | "payer"
    | "pharmacy"
    | "patient"
    | "care_coordinator"
    | "system";
}
