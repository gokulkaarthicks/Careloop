import type { JudgeDemoStep } from "./types";

export const JUDGE_DEMO_STEP_DEFS = [
  { id: "reset", label: "Reset cohort to a clean baseline" },
  { id: "visit", label: "Load chart & start the visit" },
  { id: "ai", label: "AI chart review (summary)" },
  { id: "clinical", label: "Provider plan, Rx, pharmacy & payer routing" },
  { id: "ready", label: "Pharmacy: medication ready" },
  { id: "pickup", label: "Pharmacy: picked up" },
  { id: "adherence", label: "Patient: adherence & dose logging" },
  { id: "complete", label: "Closed loop ready for judges" },
] as const;

export function buildIdleJudgeSteps(): JudgeDemoStep[] {
  return JUDGE_DEMO_STEP_DEFS.map((d) => ({
    id: d.id,
    label: d.label,
    status: "pending" as const,
  }));
}

export function buildJudgeDemoSteps(finishedCount: number): JudgeDemoStep[] {
  const total = JUDGE_DEMO_STEP_DEFS.length;
  return JUDGE_DEMO_STEP_DEFS.map((d, i) => {
    let status: JudgeDemoStep["status"];
    if (finishedCount >= total) status = "done";
    else if (i < finishedCount) status = "done";
    else if (i === finishedCount) status = "active";
    else status = "pending";
    return { id: d.id, label: d.label, status };
  });
}
