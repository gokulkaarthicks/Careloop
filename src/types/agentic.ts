/**
 * Agentic encounter workflow — overlay + pipeline types (hackathon demo).
 */

export type AgentActivityStatus = "idle" | "running" | "success" | "error";

export type AgentActivityState = {
  visible: boolean;
  status: AgentActivityStatus;
  /** e.g. "Chart & history agent" */
  headline: string;
  /** Current action line */
  subline: string;
  /** Steps finished (for success summary) */
  completedStepLabels: string[];
  errorMessage?: string;
};

export const initialAgentActivity: AgentActivityState = {
  visible: false,
  status: "idle",
  headline: "",
  subline: "",
  completedStepLabels: [],
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

import type { CoverageEvaluationResult } from "@/types/benefits";

export type AgenticEncounterResult = {
  soapAddendum: string;
  paDecisions: PaLineDecision[];
  anyPaRequired: boolean;
  /** Deterministic benefits / formulary output */
  coverage: CoverageEvaluationResult;
  timelineEntries: { title: string; detail: string }[];
  patientNotification?: { title: string; body: string };
};
