import type { AgenticCoverageResponse } from "@/lib/ai/agentic-coverage-llm";
import { resolveAgenticCoverage } from "@/lib/ai/agentic-coverage-llm";
import { runWorkflowToolLoop } from "@/lib/ai/run-workflow-tool-loop";
import { agenticCoverageResponseSchema } from "@/lib/ai/schemas/agent-api-responses";
import type { EncounterToolDispatchContext } from "@/lib/ai/tools/workflow-tool-context";
import { WORKFLOW_TOOL_DEFINITIONS } from "@/lib/ai/tools/workflow-tools";
import type { RunPipelineInput, ToolTraceEntry } from "@/types/agentic";

const ENCOUNTER_AGENT_SYSTEM = `You are Care Orchestrator's end-to-end encounter workflow agent (demo).
Use tools as needed: read prescription lines and PA cases, summarize chart context, then call adjudicate_benefits_coverage to produce structured per-line routing (required to complete finalize). You may append timeline notes, audit lines, or draft clarifying questions. When finished with tools, reply with a short clinician-facing summary. Do not invent clinical facts beyond tool outputs.`;

function buildContext(input: RunPipelineInput): EncounterToolDispatchContext {
  return {
    patientDisplayName: input.patientDisplayName,
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    prescriptionLines: input.prescriptionLines,
    clinical: input.clinical,
    treatmentPlan: input.treatmentPlan,
    priorAuthCases: input.priorAuthCases ?? [],
    pharmacyId: input.pharmacyId,
    insurancePlanId: input.insurancePlanId,
    preferredPharmacyId: input.preferredPharmacyId,
  };
}

const backoff = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type EncounterAgentResult = {
  coverage: AgenticCoverageResponse["coverage"];
  documentationAddendum?: string;
  patientNotification?: { title: string; body: string };
  trace: ToolTraceEntry[];
  timelineSuggestions: { title: string; detail: string }[];
  finalAssistantText?: string;
  stoppedReason: string;
};

/**
 * Single orchestration: multi-turn tool loop with benefits adjudication as a tool,
 * plus resilient recovery if the model stops before adjudication succeeds.
 */
export async function runEncounterAgentOrchestration(
  input: RunPipelineInput,
): Promise<EncounterAgentResult> {
  const context = buildContext(input);
  const userMessage = `Finalize encounter for ${context.patientDisplayName} (appointment ${context.appointmentId}). Treatment plan:\n${context.treatmentPlan.slice(0, 8000)}`;

  const loop = await runWorkflowToolLoop({
    context,
    systemPrompt: ENCOUNTER_AGENT_SYSTEM,
    userMessage,
    tools: WORKFLOW_TOOL_DEFINITIONS,
    maxTurns: 10,
  });

  if (loop.stoppedReason === "no_api_key") {
    throw new Error("XAI_API_KEY is not configured");
  }

  const trace = [...loop.trace];
  let bundle: AgenticCoverageResponse | undefined = loop.coverageBundle;

  if (!bundle) {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        bundle = await resolveAgenticCoverage({
          patientId: input.patientId,
          insurancePlanId: input.insurancePlanId,
          preferredPharmacyId: input.preferredPharmacyId,
          pharmacyId: input.pharmacyId,
          prescriptionLines: input.prescriptionLines,
          treatmentPlanText: input.treatmentPlan,
          clinicalSummary: input.clinical ?? undefined,
        });
        trace.push({
          tool: "adjudicate_benefits_coverage",
          args: { recovery: true, attempt: attempt + 1 },
          ok: true,
          detail:
            "Recovery: mandatory benefits adjudication (loop ended without coverage bundle).",
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        await backoff(200 * (attempt + 1));
      }
    }
    if (!bundle && lastErr) throw lastErr;
  }

  if (!bundle) {
    throw new Error("Encounter agent: benefits adjudication unavailable");
  }

  const parsed = agenticCoverageResponseSchema.safeParse({
    coverage: bundle.coverage,
    documentationAddendum: bundle.documentationAddendum,
    patientNotification: bundle.patientNotification,
  });
  if (!parsed.success) {
    throw new Error("Encounter agent: coverage output failed validation");
  }

  return {
    coverage: parsed.data.coverage,
    documentationAddendum: parsed.data.documentationAddendum,
    patientNotification: parsed.data.patientNotification,
    trace,
    timelineSuggestions: loop.timelineSuggestions,
    finalAssistantText: loop.finalAssistantText,
    stoppedReason: loop.stoppedReason,
  };
}
