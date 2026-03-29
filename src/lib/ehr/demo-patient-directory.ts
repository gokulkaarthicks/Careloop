import { SEED } from "@/lib/seed-data";
import type { Patient } from "@/types/workflow";

/**
 * Always exposes exactly the five bundled synthetic demo patients in header order.
 * SQLite may omit demo IDs or use a different cohort — seed rows fill gaps.
 * DB fields merge under seed so `coverageDemoTag` / plan IDs stay demo-stable.
 */
export function buildDemoPatientDirectory(dbPatients: Patient[]): Patient[] {
  const byId = new Map(dbPatients.map((p) => [p.id, p]));
  return SEED.patients.map((seedP) => {
    const row = byId.get(seedP.id);
    if (!row) return seedP;
    return {
      ...seedP,
      ...row,
      displayName: seedP.displayName,
      mrn: seedP.mrn,
      insurancePlanId: seedP.insurancePlanId,
      coverageDemoTag: seedP.coverageDemoTag,
      preferredPharmacyId: seedP.preferredPharmacyId ?? row.preferredPharmacyId,
      externalEhrPatientId: seedP.externalEhrPatientId ?? row.externalEhrPatientId,
      notes: seedP.notes ?? row.notes,
    };
  });
}
