import type { PriorAuthCase } from "@/types/benefits";
import type { PatientClinicalSummary, PrescriptionLine, UUID } from "@/types/workflow";

/**
 * Read-only snapshot passed into workflow tool dispatch during encounter finalize (demo).
 * Built on the server from the encounter-agent request body.
 */
export type EncounterToolDispatchContext = {
  patientDisplayName: string;
  patientId: string;
  appointmentId: string;
  prescriptionLines: PrescriptionLine[];
  clinical: PatientClinicalSummary | null;
  treatmentPlan: string;
  priorAuthCases: PriorAuthCase[];
  /** Transmit site — required for benefits adjudication tool */
  pharmacyId: UUID | string;
  insurancePlanId?: UUID | string;
  preferredPharmacyId?: UUID | string;
};
