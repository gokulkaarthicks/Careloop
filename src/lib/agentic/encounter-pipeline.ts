import type {
  AgenticEncounterResult,
  AgentPipelineStep,
  PaLineDecision,
  RunPipelineInput,
} from "@/types/agentic";
import { fetchAgenticCoverage } from "@/lib/agentic/coverage-fetch";

export type { RunPipelineInput } from "@/types/agentic";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildSoapAddendum(
  patientName: string,
  decisions: PaLineDecision[],
  coverage: AgenticEncounterResult["coverage"],
  opts: {
    documentationAddendum?: string;
  },
): string {
  const lines = [
    "",
    "---",
    `Agentic encounter addendum (${new Date().toLocaleString()})`,
    "Coverage adjudication: Grok benefits agent (structured JSON).",
    `Benefits context: ${coverage.plan.name} (${coverage.plan.planCode})`,
  ];

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

/**
 * Full agentic sequence for finalize: sense → decide → document → route (mock delays + server-side Grok coverage).
 */
export async function runAgenticEncounterPipeline(
  input: RunPipelineInput,
  onStep: (step: AgentPipelineStep) => void,
): Promise<AgenticEncounterResult> {
  onStep({
    agent: "Chart & history agent",
    action: "Loading allergies, diagnoses, meds, and visit context…",
  });
  await delay(420);
  const allergyHint =
    input.clinical?.allergies?.length ?
      input.clinical.allergies.map((a) => a.substance).join(", ")
    : "NKDA";

  onStep({
    agent: "Eligibility & coverage agent",
    action: "Calling agentic benefits adjudication (server)…",
  });
  await delay(200);

  onStep({
    agent: "Formulary check agent",
    action: "Synthesizing per-line routing with coverage model…",
  });

  const agentic = await fetchAgenticCoverage(input);
  const coverage = agentic.coverage;

  await delay(220);

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

  onStep({
    agent: "PA decision agent",
    action: coverage.holdForPriorAuth ?
      "Prior auth required — staging payer packet…"
    : coverage.anyStepTherapyBlock ?
      "Step therapy gate — hold transmit pending documentation…"
    : "No PA barrier — routing to pharmacy routing agent…",
  });
  await delay(360);

  onStep({
    agent: "Documentation agent",
    action: "Composing SOAP addendum with coverage rationale…",
  });
  await delay(400);

  const soapAddendum = buildSoapAddendum(
    input.patientDisplayName,
    paDecisions,
    coverage,
    {
      documentationAddendum: agentic.documentationAddendum,
    },
  );

  onStep({
    agent: "Pharmacy routing agent",
    action: coverage.anyNetworkMismatch ?
      "Flagging out-of-network / preferred pharmacy mismatch…"
    : "Aligning e-Rx to selected pharmacy…",
  });
  await delay(320);

  onStep({
    agent: "Patient instruction agent",
    action: "Drafting patient-facing status copy…",
  });
  await delay(280);

  const timelineEntries: AgenticEncounterResult["timelineEntries"] = [
    {
      title: "Agentic review complete",
      detail: `Chart context loaded; allergies noted (${allergyHint.slice(0, 80)}). Benefits adjudication: Grok.`,
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
    agentic.patientNotification ??
    (coverage.holdForPriorAuth ?
      {
        title: "Prior authorization in progress",
        body: `Your plan (${coverage.plan.name}) is reviewing one or more medications. We'll notify you when you can pick up or if we need more information.`,
      }
    : coverage.anyStepTherapyBlock ?
      {
        title: "More documentation may be needed",
        body: "Your care team may need to confirm step therapy before sending certain medications. Watch for a message in CareLoop.",
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
  };
}
