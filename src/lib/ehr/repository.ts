import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/ehr/schema";
import type {
  PatientClinicalSummary,
  Patient,
  Allergy,
  Medication,
  Diagnosis,
  VitalSnapshot,
} from "@/types/workflow";
import type { AiHistorySummary } from "@/types/workflow";

export type EhrDb = BetterSQLite3Database<typeof schema>;

function mapAllergy(row: typeof schema.allergies.$inferSelect): Allergy {
  return {
    id: row.id,
    patientId: row.patientId,
    substance: row.substance,
    severity: row.severity as Allergy["severity"],
    type: row.type as Allergy["type"],
    status: row.status as Allergy["status"],
    reaction: row.reaction ?? undefined,
    notes: row.notes ?? undefined,
    recordedAt: row.recordedAt,
    updatedAt: row.updatedAt,
  };
}

function mapMed(row: typeof schema.medications.$inferSelect): Medication {
  return {
    id: row.id,
    patientId: row.patientId,
    name: row.name,
    dose: row.dose,
    route: row.route ?? undefined,
    frequency: row.frequency,
    status: row.status as Medication["status"],
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    notes: row.notes ?? undefined,
    recordedAt: row.recordedAt,
    updatedAt: row.updatedAt,
  };
}

function mapDx(row: typeof schema.patientDiagnoses.$inferSelect): Diagnosis {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    codingSystem: row.codingSystem as Diagnosis["codingSystem"],
  };
}

export function mapPatientRow(
  row: typeof schema.patients.$inferSelect,
): Patient {
  return {
    id: row.id,
    mrn: row.mrn,
    displayName: row.displayName,
    dateOfBirth: row.dateOfBirth,
    sexAtBirth: row.sexAtBirth as Patient["sexAtBirth"],
    phone: row.phone,
    email: row.email,
    status: row.status as Patient["status"],
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    externalEhrPatientId: row.externalEhrPatientId ?? undefined,
    preferredPharmacyId: row.preferredPharmacyId ?? undefined,
  };
}

export function getPatientById(db: EhrDb, patientId: string) {
  const rows = db
    .select()
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1)
    .all();
  return rows[0] ? mapPatientRow(rows[0]) : null;
}

export function getPatientByMrn(db: EhrDb, mrn: string) {
  const rows = db
    .select()
    .from(schema.patients)
    .where(eq(schema.patients.mrn, mrn.trim()))
    .limit(1)
    .all();
  return rows[0] ? mapPatientRow(rows[0]) : null;
}

export function findPatientByNameAndDob(
  db: EhrDb,
  familyName: string,
  givenName: string,
  dateOfBirth: string,
) {
  const rows = db
    .select()
    .from(schema.patients)
    .where(
      and(
        sql`lower(${schema.patients.familyName}) = ${familyName.trim().toLowerCase()}`,
        sql`lower(${schema.patients.givenName}) = ${givenName.trim().toLowerCase()}`,
        eq(schema.patients.dateOfBirth, dateOfBirth),
      ),
    )
    .limit(1)
    .all();
  return rows[0] ? mapPatientRow(rows[0]) : null;
}

export function getRecentEncounters(db: EhrDb, patientId: string, limit = 8) {
  return db
    .select()
    .from(schema.encounters)
    .where(eq(schema.encounters.patientId, patientId))
    .orderBy(desc(schema.encounters.startedAt))
    .limit(limit)
    .all();
}

export function getActiveAllergies(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.allergies)
    .where(
      and(
        eq(schema.allergies.patientId, patientId),
        eq(schema.allergies.status, "active"),
      ),
    )
    .all();
}

export function getActiveMedications(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.medications)
    .where(
      and(
        eq(schema.medications.patientId, patientId),
        eq(schema.medications.status, "active"),
      ),
    )
    .all();
}

export function getDiagnoses(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.patientDiagnoses)
    .where(eq(schema.patientDiagnoses.patientId, patientId))
    .all();
}

export function getAbnormalLabs(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.labs)
    .where(
      and(
        eq(schema.labs.patientId, patientId),
        eq(schema.labs.abnormalFlag, true),
      ),
    )
    .orderBy(desc(schema.labs.collectedAt))
    .all();
}

export function getRecentLabs(db: EhrDb, patientId: string, limit = 12) {
  return db
    .select()
    .from(schema.labs)
    .where(eq(schema.labs.patientId, patientId))
    .orderBy(desc(schema.labs.collectedAt))
    .limit(limit)
    .all();
}

export function getPendingFollowupTasks(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.followupTasks)
    .where(
      and(
        eq(schema.followupTasks.patientId, patientId),
        or(
          eq(schema.followupTasks.status, "open"),
          eq(schema.followupTasks.status, "scheduled"),
          eq(schema.followupTasks.status, "in_progress"),
        ),
      ),
    )
    .orderBy(schema.followupTasks.dueAt)
    .all();
}

export function getPharmacyOrdersByPatient(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.pharmacyOrders)
    .where(eq(schema.pharmacyOrders.patientId, patientId))
    .orderBy(desc(schema.pharmacyOrders.updatedAt))
    .all();
}

export function getAppointmentsForPatient(db: EhrDb, patientId: string) {
  return db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.patientId, patientId))
    .orderBy(schema.appointments.scheduledFor)
    .all();
}

export function getAppointmentById(db: EhrDb, appointmentId: string) {
  const rows = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, appointmentId))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

export function buildPatientClinicalSummary(
  db: EhrDb,
  patientId: string,
): PatientClinicalSummary {
  const allergies = getActiveAllergies(db, patientId).map(mapAllergy);
  const medications = getActiveMedications(db, patientId).map(mapMed);
  const dxRows = getDiagnoses(db, patientId);
  const labs = getRecentLabs(db, patientId, 6);
  const enc = getRecentEncounters(db, patientId, 1);

  const diagnoses: Diagnosis[] = dxRows.map(mapDx);

  const recentVitals: VitalSnapshot[] = [];
  const last = labs[0];
  if (last) {
    recentVitals.push({
      recordedAt: last.collectedAt,
    });
  }

  const lastVisitDate = enc[0]?.endedAt?.slice(0, 10) ?? enc[0]?.startedAt?.slice(0, 10);

  return {
    patientId,
    allergies,
    medications,
    diagnoses,
    recentVitals,
    lastVisitDate,
  };
}

export type CompactPatientSummary = {
  patientId: string;
  mrn: string;
  displayName: string;
  cohortTag: string | null;
  problemSummary: string;
  allergySummary: string;
  medicationSummary: string;
  labSummary: string;
  lastVisitLine: string | null;
};

export function buildCompactPatientSummary(
  db: EhrDb,
  patientId: string,
): CompactPatientSummary {
  const prow = db
    .select()
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1)
    .all()[0];
  if (!prow) {
    throw new Error(`Unknown patient ${patientId}`);
  }
  const dx = getDiagnoses(db, patientId)
    .map((d) => `${d.code} ${d.description}`)
    .join("; ");
  const allergies = getActiveAllergies(db, patientId);
  const meds = getActiveMedications(db, patientId);
  const abnormal = getAbnormalLabs(db, patientId);
  const enc = getRecentEncounters(db, patientId, 1);

  return {
    patientId,
    mrn: prow.mrn,
    displayName: prow.displayName,
    cohortTag: prow.cohortTag ?? null,
    problemSummary: dx || "No coded problems on file",
    allergySummary:
      allergies.length === 0
        ? "NKDA / no active allergies documented"
        : allergies.map((a) => `${a.substance} (${a.severity})`).join("; "),
    medicationSummary:
      meds.length === 0
        ? "No active medications"
        : meds.map((m) => `${m.name} ${m.dose} ${m.frequency}`).join("; "),
    labSummary:
      abnormal.length === 0
        ? "No flagged abnormal labs in recent results"
        : abnormal
            .map((l) => `${l.name}: ${l.value} ${l.unit}`)
            .join("; "),
    lastVisitLine: enc[0]
      ? `${enc[0].encounterType} — ${enc[0].chiefComplaint ?? "Visit"} (${(enc[0].endedAt ?? enc[0].startedAt ?? "").slice(0, 10)})`
      : null,
  };
}

export type VisitChartBriefing = {
  patientId: string;
  appointmentId: string | null;
  appointmentReason: string;
  briefingLines: string[];
  structured: PatientClinicalSummary;
};

export function buildVisitChartBriefing(
  db: EhrDb,
  patientId: string,
  appointmentId: string | null,
  fallbackReason: string,
): VisitChartBriefing {
  const appt = appointmentId
    ? getAppointmentById(db, appointmentId)
    : null;
  const structured = buildPatientClinicalSummary(db, patientId);
  const compact = buildCompactPatientSummary(db, patientId);
  const lines = [
    `Visit focus: ${appt?.title ?? fallbackReason}`,
    `Problems: ${compact.problemSummary}`,
    `Allergies: ${compact.allergySummary}`,
    `Active medications: ${compact.medicationSummary}`,
    `Recent labs (flagged): ${compact.labSummary}`,
  ];
  if (compact.lastVisitLine) lines.push(`Last encounter: ${compact.lastVisitLine}`);

  return {
    patientId,
    appointmentId: appt?.id ?? appointmentId,
    appointmentReason: appt?.title ?? fallbackReason,
    briefingLines: lines,
    structured,
  };
}

export type TimelineEntry = {
  id: string;
  at: string;
  kind: "encounter" | "lab" | "appointment" | "task" | "note";
  title: string;
  detail: string;
};

export function getPatientTimeline(db: EhrDb, patientId: string): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  for (const e of getRecentEncounters(db, patientId, 20)) {
    out.push({
      id: e.id,
      at: e.endedAt ?? e.startedAt ?? e.createdAt,
      kind: "encounter",
      title: `${e.encounterType} encounter`,
      detail: e.chiefComplaint ?? e.notes ?? "",
    });
  }
  for (const l of getRecentLabs(db, patientId, 15)) {
    out.push({
      id: l.id,
      at: l.collectedAt,
      kind: "lab",
      title: l.name,
      detail: `${l.value} ${l.unit}${l.abnormalFlag ? " (abnormal)" : ""}`,
    });
  }
  for (const a of getAppointmentsForPatient(db, patientId)) {
    out.push({
      id: a.id,
      at: a.scheduledFor,
      kind: "appointment",
      title: a.title,
      detail: `${a.status} · ${a.nextAction}`,
    });
  }

  out.sort((x, y) => y.at.localeCompare(x.at));
  return out.slice(0, 40);
}

export function getChartSummaryCache(
  db: EhrDb,
  patientId: string,
  appointmentId: string | null,
) {
  const rows = db
    .select()
    .from(schema.chartSummaryCache)
    .where(
      and(
        eq(schema.chartSummaryCache.patientId, patientId),
        appointmentId
          ? eq(schema.chartSummaryCache.appointmentId, appointmentId)
          : isNull(schema.chartSummaryCache.appointmentId),
      ),
    )
    .orderBy(desc(schema.chartSummaryCache.updatedAt))
    .limit(1)
    .all();
  const row = rows[0];
  if (!row) return null;
  try {
    return JSON.parse(row.payloadJson) as AiHistorySummary;
  } catch {
    return null;
  }
}

export function saveChartSummaryCache(
  db: EhrDb,
  patientId: string,
  appointmentId: string | null,
  summary: AiHistorySummary,
  source: string,
) {
  const id = `cache_${patientId}_${appointmentId ?? "global"}`;
  const payloadJson = JSON.stringify(summary);
  const updatedAt = new Date().toISOString();
  db.insert(schema.chartSummaryCache)
    .values({
      id,
      patientId,
      appointmentId,
      payloadJson,
      source,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.chartSummaryCache.id,
      set: { payloadJson, source, updatedAt },
    })
    .run();
}

export function searchPatientChartText(
  db: EhrDb,
  patientId: string,
  query: string,
): { source: string; snippet: string }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { source: string; snippet: string }[] = [];
  for (const m of getActiveMedications(db, patientId)) {
    const line = `${m.name} ${m.dose}`.toLowerCase();
    if (line.includes(q) || q.includes(m.name.toLowerCase())) {
      results.push({
        source: "Medication",
        snippet: `${m.name} ${m.dose}, ${m.frequency}`,
      });
    }
  }
  for (const a of getActiveAllergies(db, patientId)) {
    if (a.substance.toLowerCase().includes(q)) {
      results.push({
        source: "Allergy",
        snippet: `${a.substance} — ${a.severity}`,
      });
    }
  }
  for (const d of getDiagnoses(db, patientId)) {
    if (d.description.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)) {
      results.push({
        source: "Problem (ICD-10)",
        snippet: `${d.code} ${d.description}`,
      });
    }
  }
  const chunks = db
    .select()
    .from(schema.documentChunks)
    .where(eq(schema.documentChunks.patientId, patientId))
    .all();
  for (const c of chunks) {
    if (c.content.toLowerCase().includes(q)) {
      results.push({
        source: "Clinical note chunk",
        snippet: c.content.slice(0, 280),
      });
    }
  }
  return results.slice(0, 12);
}

/** Build in-memory indexes for MRN / name+dob / appointment */
export function buildPatientChartIndex(db: EhrDb) {
  const rows = db.select().from(schema.patients).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const byMrn = new Map(rows.map((r) => [r.mrn, r]));
  const byNameDob = new Map(
    rows.map((r) => [
      `${r.familyName.toLowerCase()}|${r.givenName.toLowerCase()}|${r.dateOfBirth}`,
      r,
    ]),
  );
  const appts = db.select().from(schema.appointments).all();
  const byAppointmentId = new Map(appts.map((a) => [a.id, a]));
  return { byId, byMrn, byNameDob, byAppointmentId };
}
