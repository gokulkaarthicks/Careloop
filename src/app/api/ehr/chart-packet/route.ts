import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import {
  buildCompactPatientSummary,
  buildPatientClinicalSummary,
  buildVisitChartBriefing,
  getAbnormalLabs,
  getPendingFollowupTasks,
  getPharmacyOrdersByPatient,
} from "@/lib/ehr/repository";

export const runtime = "nodejs";

/** Workflow-ready chart packet for AI agents — structured, no RAG */
export async function POST(req: Request) {
  let body: { patientId?: string; appointmentId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }
  if (!ehrDatabaseConfigured()) {
    return NextResponse.json(
      { error: "EHR database not available" },
      { status: 503 },
    );
  }
  const db = getEhrDb();
  const pid = body.patientId;
  const aid = body.appointmentId ?? null;
  const packet = {
    patientId: pid,
    appointmentId: aid,
    clinical: buildPatientClinicalSummary(db, pid),
    compact: buildCompactPatientSummary(db, pid),
    briefing: buildVisitChartBriefing(db, pid, aid, "Scheduled visit"),
    abnormalLabs: getAbnormalLabs(db, pid),
    pendingTasks: getPendingFollowupTasks(db, pid),
    pharmacyOrders: getPharmacyOrdersByPatient(db, pid),
  };
  return NextResponse.json(packet);
}
