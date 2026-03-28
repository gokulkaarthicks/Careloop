export type OrchestrationStepStatus =
  | "pending"
  | "active"
  | "done"
  | "error";

export interface OrchestrationStep {
  id: string;
  label: string;
  status: OrchestrationStepStatus;
}

export interface CareLoopOrchestrationState {
  status: "idle" | "running" | "complete" | "error";
  /** Index of the active step while running; -1 when idle */
  currentStepIndex: number;
  steps: OrchestrationStep[];
  errorMessage?: string;
  /** Incremented each run to ignore stale async work */
  runGeneration: number;
}
