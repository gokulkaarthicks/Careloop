import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import {
  buildCompactPatientSummary,
  buildPatientClinicalSummary,
  buildVisitChartBriefing,
  getPatientTimeline,
  getChartSummaryCache,
  getPatientById,
} from "@/lib/ehr/repository";
import * as schema from "@/lib/ehr/schema";
import { eq } from "drizzle-orm";
import { mapDbAppointmentToWorkflow } from "@/lib/ehr/map-to-workflow";
import { SEED } from "@/lib/seed-data";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const url = new URL(_req.url);
  const appointmentId = url.searchParams.get("appointmentId");

  if (!ehrDatabaseConfigured()) {
    const clinical = SEED.clinicalByPatientId[patientId];
    const appts = SEED.appointments.filter((a) => a.patientId === patientId);
    return NextResponse.json({
      source: "seed",
      patient: SEED.patients.find((p) => p.id === patientId) ?? null,
      clinical: clinical ?? null,
      appointments: appts,
      compact: clinical
        ? {
            patientId,
            mrn: SEED.patients.find((p) => p.id === patientId)?.mrn ?? "",
            displayName:
              SEED.patients.find((p) => p.id === patientId)?.displayName ?? "",
            cohortTag: null,
            problemSummary: clinical.diagnoses.map((d) => d.description).join("; "),
            allergySummary:
              clinical.allergies.length === 0
                ? "NKDA"
                : clinical.allergies.map((a) => a.substance).join("; "),
            medicationSummary: clinical.medications
              .map((m) => `${m.name} ${m.dose}`)
              .join("; "),
            labSummary: "See chart",
            lastVisitLine: clinical.lastVisitDate
              ? `Last chart activity ${clinical.lastVisitDate}`
              : null,
          }
        : null,
      timeline: [],
      cachedChartSummary: SEED.aiSummaries[patientId] ?? null,
      visitBriefing: clinical
        ? {
            briefingLines: [
              "Visit focus: Primary care follow-up (seed)",
              `Problems: ${clinical.diagnoses.map((d) => `${d.code} ${d.description}`).join("; ")}`,
              `Allergies: ${clinical.allergies.length ? clinical.allergies.map((a) => a.substance).join("; ") : "NKDA"}`,
              `Medications: ${clinical.medications.map((m) => `${m.name} ${m.dose}`).join("; ")}`,
            ],
          }
        : null,
    });
  }

  const db = getEhrDb();
  const patient = getPatientById(db, patientId);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const clinical = buildPatientClinicalSummary(db, patientId);
  const compact = buildCompactPatientSummary(db, patientId);
  const apptRows = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.patientId, patientId))
    .orderBy(schema.appointments.scheduledFor)
    .all();

  const visitBriefing = buildVisitChartBriefing(
    db,
    patientId,
    appointmentId,
    "Primary care follow-up",
  );

  const cached = getChartSummaryCache(
    db,
    patientId,
    appointmentId ?? null,
  );

  return NextResponse.json({
    source: "ehr_sqlite",
    patient,
    clinical,
    appointments: apptRows.map(mapDbAppointmentToWorkflow),
    compact,
    timeline: getPatientTimeline(db, patientId),
    cachedChartSummary: cached,
    visitBriefing,
  });
}
