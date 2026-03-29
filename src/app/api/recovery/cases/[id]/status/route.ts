import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return NextResponse.json({
    recoveryCaseId: params.id,
    status: "waiting_external",
    connectorStatus: "pending_review",
    checkedAt: new Date().toISOString(),
  });
}
