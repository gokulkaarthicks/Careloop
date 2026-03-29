import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type { AgenticCoverageResponse } from "@/lib/ai/agentic-coverage-llm";
import { resolveAgenticCoverage } from "@/lib/ai/agentic-coverage-llm";
import type { EncounterToolDispatchContext } from "@/lib/ai/tools/workflow-tool-context";
import type { UUID } from "@/types/workflow";

export type WorkflowToolDispatchResult =
  | {
      ok: true;
      tool: string;
      detail: string;
      timelineEntry?: { title: string; detail: string };
      /** Populated by adjudicate_benefits_coverage */
      coverageBundle?: AgenticCoverageResponse;
    }
  | { ok: false; tool: string; error: string };

function requireContext(
  ctx: EncounterToolDispatchContext | null | undefined,
): EncounterToolDispatchContext | null {
  return ctx ?? null;
}

/**
 * Deterministic handling of model tool calls — benefits adjudication runs server-side.
 */
export async function dispatchWorkflowToolCall(
  call: ChatCompletionMessageToolCall,
  context?: EncounterToolDispatchContext | null,
): Promise<WorkflowToolDispatchResult> {
  if (call.type !== "function") {
    return { ok: false, tool: "unknown", error: "Unsupported tool call type" };
  }
  const name = call.function.name;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, tool: name, error: "Invalid JSON arguments" };
  }

  const ctx = requireContext(context);

  switch (name) {
    case "adjudicate_benefits_coverage": {
      if (!ctx) {
        return { ok: false, tool: name, error: "Encounter context required" };
      }
      if (!String(ctx.pharmacyId ?? "").trim()) {
        return {
          ok: false,
          tool: name,
          error: "pharmacyId required for adjudication",
        };
      }
      if (!ctx.prescriptionLines.length) {
        return {
          ok: false,
          tool: name,
          error: "prescriptionLines required",
        };
      }
      try {
        const bundle = await resolveAgenticCoverage({
          patientId: ctx.patientId,
          insurancePlanId: ctx.insurancePlanId as UUID | undefined,
          preferredPharmacyId: ctx.preferredPharmacyId as UUID | undefined,
          pharmacyId: ctx.pharmacyId as UUID,
          prescriptionLines: ctx.prescriptionLines,
          treatmentPlanText: ctx.treatmentPlan,
          clinicalSummary: ctx.clinical,
        });
        return {
          ok: true,
          tool: name,
          detail: JSON.stringify({
            plan: bundle.coverage.plan.name,
            holdForPriorAuth: bundle.coverage.holdForPriorAuth,
            lineRoutes: bundle.coverage.lines.map((l) => ({
              drugName: l.drugName,
              route: l.route,
            })),
          }),
          coverageBundle: bundle,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Adjudication failed";
        return { ok: false, tool: name, error: msg };
      }
    }
    case "get_rx_snapshot": {
      if (!ctx) {
        return { ok: false, tool: name, error: "Encounter context required" };
      }
      const lines = ctx.prescriptionLines.map((l) => ({
        drugName: l.drugName,
        strength: l.strength,
        quantity: l.quantity,
        sig: l.sig,
      }));
      return {
        ok: true,
        tool: name,
        detail: JSON.stringify({ lines, treatmentPlanExcerpt: ctx.treatmentPlan.slice(0, 400) }),
      };
    }
    case "get_pa_case": {
      if (!ctx) {
        return { ok: false, tool: name, error: "Encounter context required" };
      }
      const needle = String(args.drugNameContains ?? "").trim().toLowerCase();
      const cases = ctx.priorAuthCases.filter((c) => c.patientId === ctx.patientId);
      const filtered =
        needle ?
          cases.filter((c) => c.drugName.toLowerCase().includes(needle))
        : cases;
      const slim = filtered.map((c) => ({
        id: c.id,
        drugName: c.drugName,
        status: c.status,
        denialReason: c.denialReason,
        suggestedAlternative: c.suggestedAlternative,
        moreInfoQuestion: c.moreInfoQuestion,
      }));
      return {
        ok: true,
        tool: name,
        detail: JSON.stringify({ cases: slim }),
      };
    }
    case "summarize_encounter_context": {
      if (!ctx) {
        return { ok: false, tool: name, error: "Encounter context required" };
      }
      const clin = ctx.clinical;
      const dx = clin?.diagnoses?.map((d) => d.description).join(", ") ?? "—";
      const allergies =
        clin?.allergies?.length ?
          clin.allergies.map((a) => a.substance).join(", ")
        : "NKDA / none recorded in demo snapshot";
      const meds =
        clin?.medications?.map((m) => `${m.name} ${m.dose ?? ""}`).join("; ") ??
        "—";
      const paragraph = `Diagnoses: ${dx}. Allergies: ${allergies}. Home meds (snapshot): ${meds}.`;
      return { ok: true, tool: name, detail: paragraph };
    }
    case "append_timeline_note": {
      const title = String(args.title ?? "").trim();
      const detail = String(args.detail ?? "").trim();
      if (!title || !detail) {
        return { ok: false, tool: name, error: "title and detail required" };
      }
      return {
        ok: true,
        tool: name,
        detail: `Timeline note: ${title}`,
        timelineEntry: { title, detail },
      };
    }
    case "draft_clarifying_question": {
      const topic = String(args.topic ?? "").trim();
      if (!topic) {
        return { ok: false, tool: name, error: "topic required" };
      }
      return {
        ok: true,
        tool: name,
        detail: `Suggested question (draft): Regarding ${topic} — can you confirm the current insurance pharmacy on file and any recent formulary messages?`,
      };
    }
    case "record_workflow_audit": {
      const phase = String(args.phase ?? "");
      const message = String(args.message ?? "");
      if (!phase || !message) {
        return { ok: false, tool: name, error: "phase and message required" };
      }
      return {
        ok: true,
        tool: name,
        detail: `[${phase}] ${message}`,
      };
    }
    case "request_human_review": {
      const reason = String(args.reason ?? "");
      return {
        ok: true,
        tool: name,
        detail: `Review requested: ${reason}`,
      };
    }
    default:
      return { ok: false, tool: name, error: "Unknown tool" };
  }
}
