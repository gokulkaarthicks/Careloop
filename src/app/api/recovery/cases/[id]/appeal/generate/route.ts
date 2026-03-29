import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as {
    denialSummary?: string;
    clinicalJustification?: string;
  };
  const letter = [
    "Prior Authorization Appeal",
    `Case: ${params.id}`,
    "",
    `Denial summary: ${body.denialSummary ?? "Not supplied"}`,
    `Clinical justification: ${body.clinicalJustification ?? "Not supplied"}`,
  ].join("\n");
  const pdfBase64 =
    typeof window === "undefined"
      ? Buffer.from(letter, "utf8").toString("base64")
      : btoa(letter);
  return NextResponse.json({
    recoveryCaseId: params.id,
    letterMarkdown: letter,
    pdfFileName: `appeal_${params.id}.pdf`,
    pdfBase64,
    generatedAt: new Date().toISOString(),
  });
}
