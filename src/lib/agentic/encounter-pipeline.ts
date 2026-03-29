import type {
  AgenticEncounterResult,
  AgentPipelineStep,
  PaLineDecision,
  RunPipelineInput,
} from "@/types/agentic";
import { fetchEncounterAgent } from "@/lib/agentic/encounter-agent-fetch";

export type { RunPipelineInput } from "@/types/agentic";

function buildSoapAddendum(
  patientName: string,
  decisions: PaLineDecision[],
  coverage: AgenticEncounterResult["coverage"],
  opts: {
    documentationAddendum?: string;
    toolLoopNarrative?: string;
  },
): string {
  const lines = [
    "",
    "---",
    `Encounter workflow addendum (${new Date().toLocaleString()})`,
    "Coverage: end-to-end encounter agent (tools + adjudication).",
    `Benefits context: ${coverage.plan.name} (${coverage.plan.planCode})`,
  ];

  if (opts.toolLoopNarrative?.trim()) {
    lines.push(
      `Encounter agent summary: ${opts.toolLoopNarrative.trim().slice(0, 600)}`,
    );
  }

  if (opts.documentationAddendum?.trim()) {
    lines.push(opts.documentationAddendum.trim());
  }

  for (const d of decisions) {
    const dest =
      d.route === "payer_prior_auth" ? "payer prior-auth queue"
      : d.route === "blocked_step_therapy" ? "step therapy / documentation gate"
      : "pharmacy e-prescribe";
    lines.push(
      `• ${d.drugName}: ${d.paRequired ? "Action required" : "Cleared"} — ${d.reason} → ${dest}`,
    );
  }
  if (coverage.anyNetworkMismatch) {
    lines.push(
      "Pharmacy routing: preferred vs selected pharmacy mismatch — steer patient or update preferred pharmacy (demo).",
    );
  }
  if (coverage.holdForPriorAuth) {
    lines.push(
      "Routing: one or more lines require payer review before pharmacy release (demo).",
    );
  } else if (coverage.anyStepTherapyBlock) {
    lines.push(
      "Routing: step therapy / documentation must be satisfied before transmit (demo).",
    );
  } else {
    lines.push(
      "Routing: standard e-prescribe path — no payer PA hold for these lines under agent output.",
    );
  }
  lines.push(`Patient: ${patientName}`);
  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

/**
 * End-to-end agentic finalize: single server orchestration (multi-turn tools + adjudication).
 * Requires `XAI_API_KEY`. No separate linear coverage round-trip.
 */
export async function runAgenticEncounterPipeline(
  input: RunPipelineInput,
  onStep: (step: AgentPipelineStep) => void,
): Promise<AgenticEncounterResult> {
  onStep({
    agent: "Care Orchestrator encounter agent",
    action: "Running end-to-end tool loop (bounded tools + benefits adjudication)…",
  });

  const agent = await fetchEncounterAgent(input);

  for (const row of agent.trace) {
    onStep({
      agent: `Tool · ${row.tool}`,
      action:
        row.ok ? truncate(row.detail ?? "", 160) : (row.error ?? "Tool failed"),
    });
  }

  onStep({
    agent: "Care Orchestrator encounter agent",
    action: "Composing SOAP addendum, timeline, and patient notification…",
  });

  const coverage = agent.coverage;
  const toolLoopTrace = agent.trace;
  const toolLoopNarrative = agent.finalAssistantText;
  const toolTimeline =
    agent.timelineSuggestions?.map((t) => ({
      title: t.title,
      detail: t.detail,
    })) ?? [];

  const paDecisions: PaLineDecision[] = coverage.lines.map((l) => ({
    drugName: l.drugName,
    paRequired:
      l.route === "payer_prior_auth" || l.route === "blocked_step_therapy",
    reason: l.reason,
    route: l.route,
    formularyAlternative: l.coveredAlternativeToken,
    networkIssue: !l.preferredPharmacyInNetwork,
    copayHigh: l.copayHigh,
  }));

  const anyPaRequired =
    coverage.holdForPriorAuth || coverage.anyStepTherapyBlock;

  const allergyHint =
    input.clinical?.allergies?.length ?
      input.clinical.allergies.map((a) => a.substance).join(", ")
    : "NKDA";

  const soapAddendum = buildSoapAddendum(
    input.patientDisplayName,
    paDecisions,
    coverage,
    {
      documentationAddendum: agent.documentationAddendum,
      toolLoopNarrative,
    },
  );

  const timelineEntries: AgenticEncounterResult["timelineEntries"] = [
    ...toolTimeline,
    ...(toolLoopTrace.length > 0 ?
      [
        {
          title: "Encounter agent — tool trace",
          detail: `${toolLoopTrace.length} call(s): ${toolLoopTrace.map((t) => t.tool).join(", ")}`,
        },
      ]
    : []),
    {
      title: "Workflow review complete",
      detail: `Chart context (${truncate(allergyHint, 80)}). Routing via end-to-end encounter agent.`,
    },
    {
      title: `Insurance checked — ${coverage.plan.name}`,
      detail: `${coverage.plan.documentationNotes.slice(0, 140)}…`,
    },
    ...paDecisions.map((d) => ({
      title:
        d.route === "blocked_step_therapy" ? `Step therapy: ${d.drugName}`
        : d.paRequired ? `PA flagged: ${d.drugName}`
        : `Cleared: ${d.drugName}`,
      detail: d.reason,
    })),
    ...(coverage.anyNetworkMismatch ?
      [
        {
          title: "Pharmacy network",
          detail:
            "Preferred pharmacy differs from selected transmit site — review routing (demo).",
        },
      ]
    : []),
    {
      title:
        coverage.holdForPriorAuth ? "Payer queue"
        : coverage.anyStepTherapyBlock ? "Documentation gate"
        : "Pharmacy path",
      detail:
        coverage.holdForPriorAuth ?
          "PA case submitted — payer must approve before pharmacy release."
        : coverage.anyStepTherapyBlock ?
          "Complete step therapy documentation, then resubmit (demo)."
        : "Demo: Rx proceeds to pharmacy without PA hold.",
    },
  ];

  const patientNotification =
    agent.patientNotification ??
    (coverage.holdForPriorAuth ?
      {
        title: "Prior authorization in progress",
        body: `Your plan (${coverage.plan.name}) is reviewing one or more medications. We'll notify you when you can pick up or if we need more information.`,
      }
    : coverage.anyStepTherapyBlock ?
      {
        title: "More documentation may be needed",
        body: "Your care team may need to confirm step therapy before sending certain medications. Watch for a message in Care Orchestrator.",
      }
    : {
        title: "Prescription on the way",
        body: "Medications are being routed per your coverage and pharmacy selection unless your clinician noted otherwise.",
      });

  return {
    soapAddendum,
    paDecisions,
    anyPaRequired,
    coverage,
    timelineEntries,
    patientNotification,
    toolLoopTrace,
    toolLoopNarrative,
  };
}
