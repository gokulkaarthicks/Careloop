import type { PrescriptionLine } from "@/types/workflow";

/** Deterministic SOAP/plan for one-click demo — matches provider templates. */
export const DEMO_SOAP_NOTE = `S: Jordan returns for chronic disease follow-up; no acute complaints today.
O: Vitals reviewed; home BP log discussed. Exam deferred in demo — align with clinic protocol.
A: Essential hypertension and type 2 diabetes — stable on current regimen; continue surveillance.
P: Continue home BP checks; lifestyle counseling; medications as listed below.`;

export const DEMO_TREATMENT_PLAN = `Problem: Hypertension / Type 2 DM
Medications: Continue lisinopril 10 mg daily; continue metformin 500 mg BID
Lifestyle: Diet, activity, home BP monitoring
Follow-up: Return in 14 days or sooner if symptoms worsen`;

const DEFAULT_FOLLOW_UP = "Return in 14 days or sooner if symptoms worsen";

/**
 * Pulls a concrete follow-up interval from free text, e.g. "follow up in 3 days",
 * "return in 2 weeks", "in 10 days for recheck".
 */
export function extractFollowUpLineFromMessage(message: string): string | null {
  const t = message.trim();
  if (!t) return null;

  const patterns: RegExp[] = [
    /\bfollow[\s-]?up\s+in\s+(\d+)\s*(day|days|week|weeks|month|months)\b/i,
    /\breturn\s+(?:visit\s+)?in\s+(\d+)\s*(day|days|week|weeks|month|months)\b/i,
    /\bsee\s+(?:back|patient)\s+in\s+(\d+)\s*(day|days|week|weeks)\b/i,
    /\bin\s+(\d+)\s*(day|days|week|weeks|month|months)\s+(?:for\s+)?(?:follow|f\/u|recheck|return|visit)\b/i,
    /\b(\d+)\s*(day|days|week|weeks)\s+(?:for\s+)?(?:follow[\s-]?up|f\/u|return|recheck)\b/i,
    /\brecheck\s+in\s+(\d+)\s*(day|days|week|weeks)\b/i,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const n = m[1];
    let unit = (m[2] ?? "days").toLowerCase();
    if (unit.startsWith("day")) unit = n === "1" ? "day" : "days";
    else if (unit.startsWith("week")) unit = n === "1" ? "week" : "weeks";
    else if (unit.startsWith("month")) unit = n === "1" ? "month" : "months";
    return `Return in ${n} ${unit} or sooner if symptoms worsen`;
  }
  return null;
}

export function hasFollowUpTimingHint(message: string): boolean {
  return extractFollowUpLineFromMessage(message) !== null;
}

/** Canned demo lines + follow-up from the provider chat message when present. */
export function buildTreatmentPlanDraft(userMessage: string): string {
  const followLine =
    extractFollowUpLineFromMessage(userMessage) ?? DEFAULT_FOLLOW_UP;
  return `Problem: Hypertension / Type 2 DM
Medications: Continue lisinopril 10 mg daily; continue metformin 500 mg BID
Lifestyle: Diet, activity, home BP monitoring
Follow-up: ${followLine}`;
}

/** Merge follow-up timing into an existing plan, or build from template. */
export function mergeTreatmentPlanFromMessage(
  currentPlan: string,
  userMessage: string,
): string {
  const follow = extractFollowUpLineFromMessage(userMessage);
  if (!follow) {
    return buildTreatmentPlanDraft(userMessage);
  }
  const trimmed = currentPlan.trim();
  if (!trimmed) {
    return buildTreatmentPlanDraft(userMessage);
  }
  if (/^Follow-up:/m.test(trimmed)) {
    return trimmed.replace(/^Follow-up:.*$/m, `Follow-up: ${follow}`);
  }
  return `${trimmed}\nFollow-up: ${follow}`;
}

export const DEMO_RX_LINES: PrescriptionLine[] = [
  {
    id: "rxl_demo_judge",
    drugName: "Lisinopril",
    strength: "10 mg",
    quantity: "90",
    refills: 3,
    sig: "Take 1 tablet by mouth once daily",
  },
];
