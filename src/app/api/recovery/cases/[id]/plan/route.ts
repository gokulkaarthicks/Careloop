import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return NextResponse.json({
    recoveryCaseId: params.id,
    status: "planning",
    plan: [
      "Generate appeal package",
      "Submit to connector",
      "Hold follow-up slot",
      "Track status and deadlines",
    ],
    plannedAt: new Date().toISOString(),
  });
}
