/** Payer adjudication outcome from the PA policy agent (LLM-only path). */
export type PolicyPaResolution =
  | "approved"
  | "denied"
  | "more_info"
  | "manual_queue";
