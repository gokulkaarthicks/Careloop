import type { EncounterIntentResult } from "@/lib/encounter-intent";
import { mapLlmLabelToEncounterIntent } from "@/lib/encounter-intent";

/**
 * Resolve encounter chat routing via the server intent agent (Grok only).
 */
export async function fetchEncounterIntent(
  message: string,
): Promise<EncounterIntentResult> {
  const res = await fetch("/api/ai/encounter-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    intent?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Encounter intent HTTP ${res.status}`);
  }
  const label = data.intent;
  if (!label) {
    throw new Error("Encounter intent: missing intent in response");
  }
  if (label === "search") {
    return { kind: "chart_search", query: message.trim() };
  }
  const mapped = mapLlmLabelToEncounterIntent(label);
  if (!mapped) {
    throw new Error(`Encounter intent: unsupported label ${label}`);
  }
  return mapped;
}
