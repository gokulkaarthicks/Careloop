import type { PreVisitAgentInput } from "@/types/pre-visit-agent";
import type { Encounter, PatientClinicalSummary } from "@/types/workflow";

/** Map EHR snapshot + encounters into the pre-visit agent payload (LLM API body). */
export function buildPreVisitAgentInput(args: {
  patientId: string;
  displayName: string;
  appointmentReason: string;
  clinical: PatientClinicalSummary | undefined;
  priorEncounters: Encounter[];
}): PreVisitAgentInput {
  const c = args.clinical;
  return {
    patientId: args.patientId,
    displayName: args.displayName,
    appointmentReason: args.appointmentReason,
    clinical: c
      ? {
          diagnoses: c.diagnoses.map((d) => ({
            code: d.code,
            description: d.description,
          })),
          medications: c.medications.map((m) => ({
            name: m.name,
            dose: m.dose,
            frequency: m.frequency,
          })),
          allergies: c.allergies.map((a) => ({
            substance: a.substance,
            severity: a.severity,
          })),
          recentVitals: c.recentVitals.map((v) => ({
            recordedAt: v.recordedAt,
            systolicMmHg: v.systolicMmHg,
            diastolicMmHg: v.diastolicMmHg,
          })),
          lastVisitDate: c.lastVisitDate,
        }
      : undefined,
    priorEncounters: args.priorEncounters.map((e) => ({
      id: e.id,
      endedAt: e.endedAt,
      startedAt: e.startedAt,
      encounterType: e.encounterType,
      chiefComplaint: e.chiefComplaint,
      notes: e.notes,
    })),
  };
}
