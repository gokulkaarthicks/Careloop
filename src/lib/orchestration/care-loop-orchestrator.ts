/**
 * Unified CareLoop orchestration — agent-driven workflow (Grok via API routes).
 *
 * - Encounter finalize: `runAgenticEncounterPipeline` + chart inference + `scheduleBackgroundPaPolicyResolution`
 * - Payer PA (background): `POST /api/ai/pa-adjudicate` from `scheduleBackgroundPaPolicyResolution`
 * - Refill: `runRefillEligibilityAgent` → `POST /api/ai/refill-eligibility`
 * - Post-pickup chain: `runPostPickupAgenticChain` in `./post-pickup-agent`
 */

export { scheduleBackgroundPaPolicyResolution, runBackgroundPaPolicyResolution } from "./background-pa-policy";
export { runRefillEligibilityAgent, runRefillEligibilityAgentAsync } from "./refill-agent";
export { runPostPickupAgenticChain } from "./post-pickup-agent";
export type { PolicyPaResolution } from "@/types/pa-policy";
