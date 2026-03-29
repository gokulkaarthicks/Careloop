/**
 * Unified Care Orchestrator — agent-driven workflow (Grok via API routes).
 *
 * - Encounter finalize: `runAgenticEncounterPipeline` → `POST /api/ai/encounter-agent` (E2E tool loop + adjudication) + chart inference + `scheduleBackgroundPaPolicyResolution`
 * - Payer PA (background): `POST /api/ai/pa-adjudicate` from `scheduleBackgroundPaPolicyResolution`
 * - Refill: `runRefillEligibilityAgent` → `POST /api/ai/refill-eligibility`
 * - Post-pickup chain: `runPostPickupAgenticChain` in `./post-pickup-agent`
 * - Central orchestration loop: `runCentralOrchestratorAgent` (state-driven agent routing)
 */

export { scheduleBackgroundPaPolicyResolution, runBackgroundPaPolicyResolution } from "./background-pa-policy";
export { runRefillEligibilityAgent, runRefillEligibilityAgentAsync } from "./refill-agent";
export { runPostPickupAgenticChain } from "./post-pickup-agent";
export {
  runCentralOrchestratorAgent,
  runPatientHistoryAgent,
  runPaInsuranceReasoningAgent,
  runProviderFollowUpAgent,
  runAppointmentReschedulingAgent,
  runPharmacyFulfillmentAgent,
  runPatientReminderAdherenceAgent,
  runOrderCancellationEscalationAgent,
  runPayerFollowUpAgent,
} from "./central-orchestrator-agent";
export type { PolicyPaResolution } from "@/types/pa-policy";
