import { NextResponse } from "next/server";
import { generateChartSummaryWithXai } from "@/lib/ai/generate-chart-summary-llm";
import {
  isXaiApiKeyConfigured,
  isXaiApiKeyRequired,
} from "@/lib/ai/config";
import type { AiHistorySummary, PatientClinicalSummary } from "@/types/workflow";

export const runtime = "nodejs";

function buildMockSummary(
  patientId: string,
  clinical: PatientClinicalSummary,
): AiHistorySummary {
  const dx = clinical.diagnoses.map((d) => d.description).join("; ");
  const meds = clinical.medications.map((m) => m.name).join(", ");
  return {
    patientId,
    generatedAt: new Date().toISOString(),
    narrative: `Mock AI summary (set XAI_API_KEY for live Grok): ${dx || "No coded diagnoses"}. Active medications include ${meds || "none listed"}. Review allergies and vitals before changes.`,
    risks: [
      {
        id: "mock_r1",
        label: "Polypharmacy / adherence",
        severity: clinical.medications.length > 4 ? "moderate" : "low",
        rationale: `${clinical.medications.length} active medications in profile.`,
      },
      {
        id: "mock_r2",
        label: "Allergy cross-check",
        severity: clinical.allergies.some((a) => a.severity === "severe")
          ? "high"
          : "low",
        rationale: `${clinical.allergies.length} allergy entries on file.`,
      },
    ],
    suggestedFocus: [
      "Reconcile medications with patient-reported use",
      "Confirm BP / metabolic goals",
      "Document counseling topics",
    ],
    suggestedQuestions: [
      "Interval history: ER visits or hospitalizations since last PCP visit?",
      "Medication adherence — missed doses in the past month?",
      "Social determinants: transportation or cost barriers to pharmacy?",
      "Allergies reviewed with patient today?",
    ],
    mock: true,
  };
}

export async function POST(req: Request) {
  let body: { patientId?: string; clinical?: PatientClinicalSummary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patientId = body.patientId;
  const clinical = body.clinical;
  if (!patientId || !clinical) {
    return NextResponse.json(
      { error: "patientId and clinical required" },
      { status: 400 },
    );
  }

  if (isXaiApiKeyRequired() && !isXaiApiKeyConfigured()) {
    return NextResponse.json(
      {
        error: "XAI_API_KEY is required when REQUIRE_XAI_API_KEY=true",
        code: "MISSING_XAI_API_KEY",
      },
      { status: 503 },
    );
  }

  const result = await generateChartSummaryWithXai(patientId, clinical);
  if (result.ok) {
    return NextResponse.json({
      summary: result.summary,
      meta: { source: "xai" as const },
    });
  }

  if (result.code === "missing_key") {
    return NextResponse.json({
      summary: buildMockSummary(patientId, clinical),
      meta: {
        source: "mock" as const,
        warning: "Live Grok disabled: set XAI_API_KEY in .env.local",
      },
    });
  }

  return NextResponse.json({
    summary: buildMockSummary(patientId, clinical),
    meta: {
      source: "mock" as const,
      degraded: true as const,
      warning: `xAI chart summary failed (${result.code}): ${result.message}`,
    },
  });
}
