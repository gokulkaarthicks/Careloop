import type { JudgeDemoStep } from "./types";

export const JUDGE_DEMO_STEP_DEFS = [
  { id: "reset", label: "Reset cohort to a clean baseline" },
  { id: "admission", label: "Provider: admit patient and open encounter workspace" },
  { id: "ai", label: "Provider: load AI chart context and visit briefing" },
  { id: "soap", label: "Provider: type SOAP note (visual input step)" },
  { id: "plan", label: "Provider: type treatment plan (visual input step)" },
  { id: "rx", label: "Provider: add prescription line (visual input step)" },
  { id: "runreport", label: "Provider: open agent run report view cue" },
  { id: "clinical", label: "Provider: finalize encounter (workflow routing starts)" },
  { id: "dash1", label: "Dashboard: show first closed-loop progress checkpoint" },
  { id: "pharmacy_hold", label: "Pharmacy: see medication blocked pending payer PA decision" },
  { id: "payer_approve", label: "Payer: simulate approval action and release medication" },
  { id: "pharmacy_ready", label: "Pharmacy: medication ready + pickup transition" },
  { id: "patient_checkin", label: "Patient: pickup/adherence/check-in actions" },
  { id: "timefast", label: "Time jump: trigger overdue follow-up + auto-reschedule" },
  { id: "paopen", label: "Worst case: force PA denial to trigger recovery workflow" },
  { id: "recovery", label: "Recovery: Autonomous case + PA Auto-Fighter + appeal submit" },
  { id: "dashboard", label: "Dashboard: show end-to-end progress and command center state" },
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
