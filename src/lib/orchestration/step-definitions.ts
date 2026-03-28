import type { OrchestrationStep } from "./types";

export const CARE_LOOP_WORKFLOW_STEPS = [
  { id: "chart", label: "Load patient chart data" },
  { id: "pre_visit", label: "Run pre-visit agent" },
  { id: "briefing", label: "Generate provider briefing" },
  { id: "plan", label: "Apply provider plan (SOAP & treatment)" },
  { id: "rx_tasks", label: "Create prescription & follow-up tasks" },
  { id: "pharmacy", label: "Route pharmacy order" },
  { id: "reminders", label: "Initialize patient reminders" },
  { id: "payer", label: "Update payer completion metrics" },
] as const;

export function buildIdleOrchestrationSteps(): OrchestrationStep[] {
  return CARE_LOOP_WORKFLOW_STEPS.map((d) => ({
    id: d.id,
    label: d.label,
    status: "pending" as const,
  }));
}

export function buildOrchestrationSteps(
  finishedCount: number,
  total: number = CARE_LOOP_WORKFLOW_STEPS.length,
): OrchestrationStep[] {
  return CARE_LOOP_WORKFLOW_STEPS.slice(0, total).map((d, i) => {
    let status: OrchestrationStep["status"];
    if (finishedCount >= total) status = "done";
    else if (i < finishedCount) status = "done";
    else if (i === finishedCount) status = "active";
    else status = "pending";
    return { id: d.id, label: d.label, status };
  });
}
