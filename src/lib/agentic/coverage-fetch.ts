import type { AgenticCoverageRequest, AgenticCoverageResponse } from "@/lib/ai/agentic-coverage-llm";
import type { RunPipelineInput } from "@/types/agentic";

/**
 * Browser entry: coverage runs on the server so `XAI_API_KEY` stays off the client bundle.
 */
export async function fetchAgenticCoverage(
  input: RunPipelineInput,
): Promise<AgenticCoverageResponse> {
  const payload: AgenticCoverageRequest = {
    patientId: input.patientId,
    insurancePlanId: input.insurancePlanId,
    preferredPharmacyId: input.preferredPharmacyId,
    pharmacyId: input.pharmacyId,
    prescriptionLines: input.prescriptionLines,
    treatmentPlanText: input.treatmentPlan,
    clinicalSummary: input.clinical ?? null,
  };
  const res = await fetch("/api/ai/agentic-coverage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Agentic coverage HTTP ${res.status}`);
  }
  return (await res.json()) as AgenticCoverageResponse;
}
