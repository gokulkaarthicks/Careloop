import type { PreVisitAgentInput, PreVisitAgentOutput } from "@/types/pre-visit-agent";

/**
 * Pre-visit agent — server-side Grok only (no fallback).
 */
export async function fetchPreVisitBriefing(
  input: PreVisitAgentInput,
): Promise<PreVisitAgentOutput> {
  const res = await fetch("/api/ai/pre-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Pre-visit HTTP ${res.status}`);
  }
  return (await res.json()) as PreVisitAgentOutput;
}

/** @deprecated Use fetchPreVisitBriefing — same behavior */
export async function fetchPreVisitOutput(
  input: PreVisitAgentInput,
): Promise<PreVisitAgentOutput> {
  return fetchPreVisitBriefing(input);
}
