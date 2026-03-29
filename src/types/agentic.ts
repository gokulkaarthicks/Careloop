/**
 * Agentic encounter workflow — overlay + pipeline types (hackathon demo).
 */

import type { CoverageEvaluationResult, PriorAuthCase } from "@/types/benefits";
import type { PatientClinicalSummary, PrescriptionLine } from "@/types/workflow";

export type AgentActivityStatus = "idle" | "running" | "success" | "error";

/** One row from the encounter tool loop (demo trace). */
export type ToolTraceEntry = {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  detail?: string;
  error?: string;
};

export type AgentActivityState = {
  visible: boolean;
  status: AgentActivityStatus;
  /** e.g. "Chart & history agent" */
  headline: string;
  /** Current action line */
  subline: string;
  /** Steps finished (for success summary) */
  completedStepLabels: string[];
  /** Tool loop trace from finalize (when available) */
  toolTrace?: ToolTraceEntry[];
  errorMessage?: string;
};

export const initialAgentActivity: AgentActivityState = {
  visible: false,
  status: "idle",
  headline: "",
  subline: "",
  completedStepLabels: [],
  toolTrace: [],
};

export type AgentPipelineStep = {
  agent: string;
  action: string;
};

export type PaLineDecision = {
  drugName: string;
  paRequired: boolean;
  reason: string;
  route: "pharmacy_direct" | "payer_prior_auth" | "blocked_step_therapy";
  formularyAlternative?: string | null;
  networkIssue?: boolean;
  copayHigh?: boolean;
};

export type RunPipelineInput = {
  patientDisplayName: string;
  patientId: string;
  appointmentId: string;
  clinical: PatientClinicalSummary | null;
  prescriptionLines: PrescriptionLine[];
  treatmentPlan: string;
  pharmacyId: string;
  insurancePlanId?: string;
  preferredPharmacyId?: string;
  /** Demo store PA rows for this patient — feeds get_pa_case */
  priorAuthCases?: PriorAuthCase[];
};

export type AgenticEncounterResult = {
  soapAddendum: string;
  paDecisions: PaLineDecision[];
  anyPaRequired: boolean;
  coverage: CoverageEvaluationResult;
  timelineEntries: { title: string; detail: string }[];
  patientNotification?: { title: string; body: string };
  /** Multi-turn tool loop (pre-coverage) when API succeeded */
  toolLoopTrace?: ToolTraceEntry[];
  /** Optional model summary after tools */
  toolLoopNarrative?: string;
};

/** Persisted proof bundle for one agentic finalize — keyed by appointment in `CareLoopSnapshot`. */
export type EncounterAgentOutcome =
  | "pharmacy_e_rx"
  | "prior_auth_hold"
  | "step_therapy_hold";

export interface EncounterAgentRun {
  runId: string;
  appointmentId: string;
  patientId: string;
  prescriptionId?: string;
  encounterId?: string;
  finishedAt: string;
  coveragePlanName: string;
  outcomeLabel: EncounterAgentOutcome;
  tools: ToolTraceEntry[];
  routingSummary: PaLineDecision[];
  soapAddendum: string;
  timelineEntryTitles: string[];
}

/** Passed into finalizeEncounter; store sets finishedAt, encounterId, prescriptionId. */
export type EncounterAgentRunInput = Omit<
  EncounterAgentRun,
  "finishedAt" | "encounterId" | "prescriptionId"
> &
  Partial<Pick<EncounterAgentRun, "prescriptionId">>;

export function outcomeLabelFromCoverage(args: {
  holdForPriorAuth: boolean;
  anyStepTherapyBlock: boolean;
}): EncounterAgentOutcome {
  if (args.anyStepTherapyBlock) return "step_therapy_hold";
  if (args.holdForPriorAuth) return "prior_auth_hold";
  return "pharmacy_e_rx";
}

export function newEncounterRunId(): string {
  return `car_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
