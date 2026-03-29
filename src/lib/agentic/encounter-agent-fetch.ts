import type { CoverageEvaluationResult } from "@/types/benefits";
import type { RunPipelineInput, ToolTraceEntry } from "@/types/agentic";

export type EncounterAgentApiResponse = {
  coverage: CoverageEvaluationResult;
  documentationAddendum?: string;
  patientNotification?: { title: string; body: string };
  trace: ToolTraceEntry[];
  timelineSuggestions: { title: string; detail: string }[];
  finalAssistantText?: string;
  stoppedReason: string;
};

/**
 * End-to-end encounter agent (multi-turn tools + benefits adjudication). Requires XAI_API_KEY.
 * Throws on HTTP errors — no silent linear fallback.
 */
export async function fetchEncounterAgent(
  input: RunPipelineInput,
): Promise<EncounterAgentApiResponse> {
  const res = await fetch("/api/ai/encounter-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientDisplayName: input.patientDisplayName,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      clinical: input.clinical,
      prescriptionLines: input.prescriptionLines,
      treatmentPlan: input.treatmentPlan,
      pharmacyId: input.pharmacyId,
      insurancePlanId: input.insurancePlanId,
      preferredPharmacyId: input.preferredPharmacyId,
      priorAuthCases: input.priorAuthCases ?? [],
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    coverage?: CoverageEvaluationResult;
    trace?: ToolTraceEntry[];
  };

  if (!res.ok) {
    throw new Error(
      payload.error ?? `Encounter agent HTTP ${res.status}`,
    );
  }

  return payload as EncounterAgentApiResponse;
}
