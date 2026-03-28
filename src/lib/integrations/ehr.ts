import type { PatientClinicalSummary, UUID } from "@/types/workflow";

/**
 * Future EHR integration: fetch normalized clinical summary by patient id.
 * Replace implementation with FHIR / proprietary API calls; keep return type stable.
 */
export async function fetchClinicalSummaryFromEhr(
  patientExternalId: UUID,
): Promise<PatientClinicalSummary> {
  void patientExternalId;
  throw new Error(
    "EHR integration not configured. Use mock seed data or implement fetchClinicalSummaryFromEhr.",
  );
}
