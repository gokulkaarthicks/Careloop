/**
 * Lightweight intent routing for the encounter chat (hackathon — replace with LLM later).
 */
export type EncounterIntentResult =
  | { kind: "chart_search"; query: string }
  | { kind: "draft_soap" }
  | { kind: "draft_plan" }
  | { kind: "draft_rx" };

/**
 * Multi-line clinical dictation (Problem / Medications / Lifestyle / Follow-up) is common
 * provider shorthand — route to SOAP generation, not chart search or the canned treatment plan.
 */
/** True when the provider is clearly asking for SOAP, even if the note also contains "Treatment plan:" clinically. */
export function looksLikeExplicitSoapRequest(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (
    /^(draft|generate|write|create)\s+(a\s+)?soap/.test(t) ||
    /\bsoap\s+notes?\s*:?\s*(create|generate|draft|write)\b/.test(t) ||
    // create soap note | create soap notes
    /\b(create|generate|draft|write)\s+(a\s+)?soap\s+notes?\b/.test(t) ||
    /\b(generate|write|create)\s+(a\s+)?soap\s+note\b/.test(t) ||
    /\b(update|rewrite)\s+soap\b/.test(t) ||
    /\bsoap\s+notes?\s*:/.test(t) ||
    /\bthe\s+soap\s+is\b/.test(t) ||
    /\bsoap\s+is\b/.test(t) ||
    /\bsoap\s+(note|draft)\b/.test(t) ||
    /\b(document|dictate|chart)\s+(this\s+)?(as\s+)?(a\s+)?soap\b/.test(t) ||
    t === "soap"
  );
}

export function looksLikeStructuredVisitDictation(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 32) return false;
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim().toLowerCase());
  const hasProblem = lines.some((l) => /^problems?\s*:/.test(l));
  const hasMeds = lines.some((l) => /^medications?\s*:/.test(l));
  const hasLifestyle = lines.some((l) => /^lifestyle\s*:/.test(l));
  const hasFollowUp = lines.some((l) => /^follow-?up\s*:/.test(l));
  return hasProblem && (hasMeds || hasLifestyle || hasFollowUp);
}

export function parseEncounterIntent(raw: string): EncounterIntentResult {
  const t = raw.trim().toLowerCase();
  if (!t) return { kind: "chart_search", query: "" };

  if (looksLikeExplicitSoapRequest(raw)) {
    return { kind: "draft_soap" };
  }
  if (
    /^(draft|update|write)\s+(the\s+)?(treatment\s+)?plan/.test(t) ||
    /\btreatment\s+plan\b/.test(t)
  ) {
    return { kind: "draft_plan" };
  }
  if (looksLikeStructuredVisitDictation(raw)) {
    return { kind: "draft_soap" };
  }
  if (
    /^(add|draft|new)\s+(an?\s+)?(rx|prescription)\b/.test(t) ||
    /\bprescribe\b/.test(t) ||
    /\bnew\s+rx\b/.test(t) ||
    /\bprescription\s+[a-z0-9]/.test(t) ||
    /^\s*rx\s+[a-z0-9]/i.test(raw.trim())
  ) {
    return { kind: "draft_rx" };
  }
  return { kind: "chart_search", query: raw.trim() };
}

/**
 * When regex routes to chart search but the message still looks like SOAP / plan / Rx,
 * call the LLM classifier to avoid misrouting clinical dictation.
 */
export function shouldDisambiguateEncounterIntent(
  raw: string,
  result: EncounterIntentResult,
): boolean {
  if (result.kind !== "chart_search") return false;
  const t = raw.trim();
  if (t.length < 10) return false;
  return /\b(soap|prescri|prescription|(^|[\s,])rx([\s,:]|$)|treatment\s+plan|care\s+plan|patient\s+presents|dictat|document(\s+this)?\s+(as\s+)?(a\s+)?soap)\b/i.test(
    t,
  );
}

/** Map POST /api/ai/encounter-intent response to a concrete intent; `null` means keep regex result. */
export function mapLlmLabelToEncounterIntent(
  label: string,
): Exclude<EncounterIntentResult, { kind: "chart_search" }> | null {
  switch (label.toLowerCase()) {
    case "soap":
      return { kind: "draft_soap" };
    case "plan":
      return { kind: "draft_plan" };
    case "rx":
      return { kind: "draft_rx" };
    default:
      return null;
  }
}
