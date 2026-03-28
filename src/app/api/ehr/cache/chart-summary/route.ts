import { NextResponse } from "next/server";
import { getEhrDb, ehrDatabaseConfigured } from "@/lib/ehr/db";
import { saveChartSummaryCache } from "@/lib/ehr/repository";
import type { AiHistorySummary } from "@/types/workflow";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    patientId?: string;
    appointmentId?: string | null;
    summary?: AiHistorySummary;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.patientId || !body.summary) {
    return NextResponse.json(
      { error: "patientId and summary required" },
      { status: 400 },
    );
  }
  if (!ehrDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, note: "No SQLite EHR — cache skipped" },
      { status: 200 },
    );
  }
  const db = getEhrDb();
  saveChartSummaryCache(
    db,
    body.patientId,
    body.appointmentId ?? null,
    body.summary,
    body.source ?? "api",
  );
  return NextResponse.json({ ok: true });
}
