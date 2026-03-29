import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import { buildDemoPatientDirectory } from "@/lib/ehr/demo-patient-directory";
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
  try {
    const db = getEhrDb();
    const rows = db.select().from(schema.patients).orderBy(schema.patients.displayName).all();
    const patients = buildDemoPatientDirectory(rows.map(mapPatientRow));
    return NextResponse.json({
      source: "ehr_sqlite",
      patients,
    });
  } catch {
    return NextResponse.json({
      source: "seed_fallback",
      patients: SEED.patients,
    });
  }
}
