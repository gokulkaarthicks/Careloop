import { SEED } from "@/lib/seed-data";

/** JSON body for `/api/ehr/context/[patientId]` when serving bundled synthetic data. */
export function buildSeedContextPayload(patientId: string) {
  const clinical = SEED.clinicalByPatientId[patientId];
  const patient = SEED.patients.find((p) => p.id === patientId);
  if (!clinical || !patient) return null;

  const appts = SEED.appointments.filter((a) => a.patientId === patientId);

  return {
    source: "seed" as const,
    patient,
    clinical,
    appointments: appts,
    compact: {
      patientId,
      mrn: patient.mrn,
      displayName: patient.displayName,
      cohortTag: null,
      problemSummary: clinical.diagnoses.map((d) => d.description).join("; "),
      allergySummary:
        clinical.allergies.length === 0 ?
          "NKDA"
        : clinical.allergies.map((a) => a.substance).join("; "),
      medicationSummary: clinical.medications
        .map((m) => `${m.name} ${m.dose}`)
        .join("; "),
      labSummary: "See chart",
      lastVisitLine: clinical.lastVisitDate ?
        `Last chart activity ${clinical.lastVisitDate}`
      : null,
    },
    timeline: [] as const,
    cachedChartSummary: SEED.aiSummaries[patientId] ?? null,
    visitBriefing: {
      briefingLines: [
        "Visit focus: Primary care follow-up (seed)",
        `Problems: ${clinical.diagnoses.map((d) => `${d.code} ${d.description}`).join("; ")}`,
        `Allergies: ${clinical.allergies.length ? clinical.allergies.map((a) => a.substance).join("; ") : "NKDA"}`,
        `Medications: ${clinical.medications.map((m) => `${m.name} ${m.dose}`).join("; ")}`,
      ],
    },
  };
}
