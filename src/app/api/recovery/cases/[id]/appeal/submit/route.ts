import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as {
    connectorKey?: string;
  };
  return NextResponse.json({
    recoveryCaseId: params.id,
    connectorKey: body.connectorKey ?? "mock_default",
    status: "submitted",
    externalReference: `APL-${Date.now()}`,
    submittedAt: new Date().toISOString(),
  });
}
