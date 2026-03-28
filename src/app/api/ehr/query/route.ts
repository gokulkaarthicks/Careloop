import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import { searchPatientChartText } from "@/lib/ehr/repository";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { patientId?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.patientId || !body.query?.trim()) {
    return NextResponse.json(
      { error: "patientId and query required" },
      { status: 400 },
    );
  }
  if (!ehrDatabaseConfigured()) {
    return NextResponse.json({
      hits: [],
      note: "EHR database not seeded — run npm run db:push && npm run db:seed",
    });
  }
  const db = getEhrDb();
  const hits = searchPatientChartText(db, body.patientId, body.query);
  return NextResponse.json({ hits });
}
