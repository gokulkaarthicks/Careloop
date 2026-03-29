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
import { buildSeedContextPayload } from "@/lib/ehr/seed-context-payload";
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
    const payload = buildSeedContextPayload(patientId);
    if (!payload) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  }

  const db = getEhrDb();
  const patient = getPatientById(db, patientId);
  if (!patient) {
    const payload = buildSeedContextPayload(patientId);
    if (!payload) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
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

  const seedP = SEED.patients.find((p) => p.id === patientId);
  const patientOut =
    seedP ?
      {
        ...seedP,
        ...patient,
        displayName: seedP.displayName,
        mrn: seedP.mrn,
        insurancePlanId: seedP.insurancePlanId,
        coverageDemoTag: seedP.coverageDemoTag,
        preferredPharmacyId: seedP.preferredPharmacyId ?? patient.preferredPharmacyId,
        externalEhrPatientId: seedP.externalEhrPatientId ?? patient.externalEhrPatientId,
        notes: seedP.notes ?? patient.notes,
      }
    : patient;

  return NextResponse.json({
    source: "ehr_sqlite",
    patient: patientOut,
    clinical,
    appointments: apptRows.map(mapDbAppointmentToWorkflow),
    compact,
    timeline: getPatientTimeline(db, patientId),
    cachedChartSummary: cached,
    visitBriefing,
  });
}
