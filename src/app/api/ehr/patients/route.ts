import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import { mapPatientRow } from "@/lib/ehr/repository";
import * as schema from "@/lib/ehr/schema";
import { SEED } from "@/lib/seed-data";

export const runtime = "nodejs";

export async function GET() {
  if (!ehrDatabaseConfigured()) {
    return NextResponse.json({
      source: "seed",
      patients: SEED.patients,
    });
  }
  const db = getEhrDb();
  const rows = db.select().from(schema.patients).orderBy(schema.patients.displayName).all();
  return NextResponse.json({
    source: "ehr_sqlite",
    patients: rows.map(mapPatientRow),
  });
}
