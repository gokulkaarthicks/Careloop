import { NextResponse } from "next/server";
import { compileCareLoopDemoGraph } from "@/lib/langgraph/care-loop-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a **LangGraph skeleton** audit trail for the care-loop demo graph only.
 * This is **not** the same as persisted `encounterAgentRunsByAppointment` from Provider
 * finalize — use exported JSON from the Provider run report for real agentic proof.
 */
export async function GET() {
  const graph = compileCareLoopDemoGraph();
  const result = await graph.invoke({
    phase: "idle",
    auditLog: [],
  });

  return NextResponse.json({
    phase: result.phase,
    auditLog: result.auditLog,
  });
}
