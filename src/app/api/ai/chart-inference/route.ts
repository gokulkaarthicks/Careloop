import { NextResponse } from "next/server";
import { runChartInferenceAgent } from "@/lib/ai/chart-inference-llm";
import type { PatientClinicalSummary, UUID } from "@/types/workflow";
import {
  agentFailureResponse,
  chartInferenceReviewSchema,
  classifyAgentErrorMessage,
  validateAgentOutput,
} from "@/lib/ai/schemas/agent-api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      appointmentId?: UUID;
      patientId?: UUID;
      clinical?: PatientClinicalSummary;
      soapNote?: string;
      treatmentPlan?: string;
    };
    if (!body.appointmentId || !body.patientId) {
      return NextResponse.json(
        { error: "appointmentId and patientId required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const review = await runChartInferenceAgent({
      appointmentId: body.appointmentId,
      patientId: body.patientId,
      clinical: body.clinical,
      soapNote: body.soapNote ?? "",
      treatmentPlan: body.treatmentPlan ?? "",
    });
    const v = validateAgentOutput(chartInferenceReviewSchema, review);
    if (!v.ok) return v.response;
    return NextResponse.json(v.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chart inference failed";
    return agentFailureResponse(classifyAgentErrorMessage(message), message);
  }
}
