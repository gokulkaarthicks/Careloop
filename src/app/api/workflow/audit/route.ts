import { NextResponse } from "next/server";
import { compileCareLoopDemoGraph } from "@/lib/langgraph/care-loop-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the canonical LangGraph audit trail for the care loop (no PHI — demo only).
 * Useful for judges / debugging ordering vs the Zustand demo runner.
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
