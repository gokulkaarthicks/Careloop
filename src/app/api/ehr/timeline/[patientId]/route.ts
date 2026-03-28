import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import { getPatientTimeline } from "@/lib/ehr/repository";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  if (!ehrDatabaseConfigured()) {
    return NextResponse.json({ events: [] });
  }
  const db = getEhrDb();
  return NextResponse.json({ events: getPatientTimeline(db, patientId) });
}
