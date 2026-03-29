import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    patientId?: string;
    failureKind?: string;
    title?: string;
    summary?: string;
  };
  if (!body.patientId || !body.failureKind || !body.title) {
    return NextResponse.json(
      { error: "patientId, failureKind, and title are required" },
      { status: 400 },
    );
  }
  const id = `rc_${Date.now()}`;
  return NextResponse.json({
    recoveryCaseId: id,
    status: "detected",
    patientId: body.patientId,
    failureKind: body.failureKind,
    title: body.title,
    summary: body.summary ?? "",
    openedAt: new Date().toISOString(),
  });
}
