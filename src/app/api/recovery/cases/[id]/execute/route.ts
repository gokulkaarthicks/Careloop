import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return NextResponse.json({
    recoveryCaseId: params.id,
    status: "executing",
    startedAt: new Date().toISOString(),
  });
}
