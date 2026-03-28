export type DemoMetrics = {
  capturedAt: string;
  workflowStage: string;
  appointmentStatus: string;
  rxStatus: string;
  pharmacyOrderStatus: string;
  pickedUp: boolean;
  followUpsDone: number;
  followUpsTotal: number;
  adherenceDone: number;
  adherenceTotal: number;
  payerClosureScore: number | null;
  payerClaimStatus: string;
};

export type JudgeDemoStepStatus =
  | "pending"
  | "active"
  | "done"
  | "error";

export interface JudgeDemoStep {
  id: string;
  label: string;
  status: JudgeDemoStepStatus;
}

export interface JudgeDemoState {
  status: "idle" | "running" | "complete" | "error";
  currentStepIndex: number;
  steps: JudgeDemoStep[];
  beforeMetrics: DemoMetrics | null;
  afterMetrics: DemoMetrics | null;
  errorMessage?: string;
  runGeneration: number;
}
