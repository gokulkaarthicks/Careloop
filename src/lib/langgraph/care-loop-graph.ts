/**
 * LangGraph definition for the canonical CareLoop demo path.
 * Nodes append to `auditLog` for an audit trail; wiring to Zustand/DB is done via injected runners (client demo / future API).
 */
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export type CareLoopGraphPhase =
  | "open_visit"
  | "chart_summary"
  | "surface_gaps"
  | "finalize_plan"
  | "route_prescription"
  | "patient_instructions"
  | "pharmacy_fulfillment"
  | "payer_closure";

const CareLoopState = Annotation.Root({
  /** Latest phase identifier */
  phase: Annotation<CareLoopGraphPhase | "idle">(),
  /** Ordered human-readable audit lines */
  auditLog: Annotation<string[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
});

type State = typeof CareLoopState.State;

function push(state: State, line: string): Partial<State> {
  return { auditLog: [line] };
}

async function nodeOpenVisit(state: State): Promise<Partial<State>> {
  return {
    phase: "open_visit",
    ...push(state, "Visit opened — chart context loaded for encounter."),
  };
}

async function nodeChartSummary(state: State): Promise<Partial<State>> {
  return {
    phase: "chart_summary",
    ...push(state, "AI chart summary generated (xAI Grok structured JSON)."),
  };
}

async function nodeSurfaceGaps(state: State): Promise<Partial<State>> {
  return {
    phase: "surface_gaps",
    ...push(state, "Risk flags and suggested questions surfaced to provider."),
  };
}

async function nodeFinalizePlan(state: State): Promise<Partial<State>> {
  return {
    phase: "finalize_plan",
    ...push(state, "Plan + Rx committed (encounter finalized)."),
  };
}

async function nodeRoutePrescription(state: State): Promise<Partial<State>> {
  return {
    phase: "route_prescription",
    ...push(state, "Prescription routed to pharmacy queue."),
  };
}

async function nodePatientInstructions(state: State): Promise<Partial<State>> {
  return {
    phase: "patient_instructions",
    ...push(state, "Patient-facing instructions and inbox notifications."),
  };
}

async function nodePharmacyFulfillment(state: State): Promise<Partial<State>> {
  return {
    phase: "pharmacy_fulfillment",
    ...push(state, "Pharmacy ready / pickup confirmed."),
  };
}

async function nodePayerClosure(state: State): Promise<Partial<State>> {
  return {
    phase: "payer_closure",
    ...push(state, "Payer completion / closure metrics updated."),
  };
}

/** Compiled graph — invoke with `.invoke({ phase: 'idle', auditLog: [] })` */
export function compileCareLoopDemoGraph() {
  const g = new StateGraph(CareLoopState)
    .addNode("open_visit", nodeOpenVisit)
    .addNode("chart_summary", nodeChartSummary)
    .addNode("surface_gaps", nodeSurfaceGaps)
    .addNode("finalize_plan", nodeFinalizePlan)
    .addNode("route_prescription", nodeRoutePrescription)
    .addNode("patient_instructions", nodePatientInstructions)
    .addNode("pharmacy_fulfillment", nodePharmacyFulfillment)
    .addNode("payer_closure", nodePayerClosure)
    .addEdge(START, "open_visit")
    .addEdge("open_visit", "chart_summary")
    .addEdge("chart_summary", "surface_gaps")
    .addEdge("surface_gaps", "finalize_plan")
    .addEdge("finalize_plan", "route_prescription")
    .addEdge("route_prescription", "patient_instructions")
    .addEdge("patient_instructions", "pharmacy_fulfillment")
    .addEdge("pharmacy_fulfillment", "payer_closure")
    .addEdge("payer_closure", END);

  return g.compile();
}
