import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { connectorKey: string } },
) {
  return NextResponse.json({
    connectorKey: params.connectorKey,
    syncStatus: "ok",
    syncedAt: new Date().toISOString(),
    operations: ["check_status", "submit_appeal", "upload_attachment"],
  });
}
