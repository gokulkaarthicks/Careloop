import type { ToolTraceEntry } from "@/types/agentic";

const STEP_LABELS: Record<string, string> = {
  get_rx_snapshot: "Read prescription lines",
  summarize_encounter_context: "Summarize chart context",
  get_pa_case: "Check prior-auth cases",
  adjudicate_benefits_coverage: "Apply coverage routing",
  append_timeline_note: "Add timeline note",
  draft_clarifying_question: "Draft clarifying question",
  record_workflow_audit: "Record workflow audit",
  request_human_review: "Request human review",
};

export type FormattedToolTraceRow = {
  label: string;
  note: string | null;
  ok: boolean;
  error?: string;
};

/**
 * Turns stored tool-loop rows (often JSON blobs) into short labels for the run-report UI.
 * Full payloads remain in Export JSON.
 */
export function formatToolTraceRow(row: ToolTraceEntry): FormattedToolTraceRow {
  const label = STEP_LABELS[row.tool] ?? row.tool.replaceAll("_", " ");
  if (!row.ok) {
    return { label, note: null, ok: false, error: row.error };
  }

  const d = row.detail?.trim() ?? "";
  if (!d) {
    return { label, note: null, ok: true };
  }

  if (d.startsWith("{") || d.startsWith("[")) {
    try {
      const j = JSON.parse(d) as Record<string, unknown>;
      if (row.tool === "get_rx_snapshot") {
        const lines = j.lines as { drugName?: string }[] | undefined;
        const n = Array.isArray(lines) ? lines.length : 0;
        const names = Array.isArray(lines) ?
          lines
            .map((l) => l.drugName)
            .filter(Boolean)
            .slice(0, 4)
        : [];
        const suffix =
          n > names.length ? ` (+${n - names.length} more)` : "";
        return {
          label,
          note:
            n === 0 ? "No prescription lines on encounter"
            : `${n} line(s): ${names.join(", ")}${suffix}`,
          ok: true,
        };
      }
      if (row.tool === "get_pa_case") {
        const cases = j.cases as unknown[] | undefined;
        const n = Array.isArray(cases) ? cases.length : 0;
        return {
          label,
          note: n === 0 ? "No open PA cases" : `${n} PA case(s) on file`,
          ok: true,
        };
      }
      if (row.tool === "adjudicate_benefits_coverage") {
        const plan = typeof j.plan === "string" ? j.plan : null;
        const lr = j.lineRoutes as unknown[] | undefined;
        const n = Array.isArray(lr) ? lr.length : 0;
        const planBit = plan ? `${plan} · ` : "";
        return {
          label,
          note: `${planBit}${n} medication line(s) routed (details in table below)`,
          ok: true,
        };
      }
      return {
        label,
        note: "Completed — full payload in Export JSON",
        ok: true,
      };
    } catch {
      return {
        label,
        note: "Completed — see Export JSON for raw output",
        ok: true,
      };
    }
  }

  const prose = d.replace(/\s+/g, " ").trim();
  const max = 240;
  const note = prose.length > max ? `${prose.slice(0, max - 1)}…` : prose;
  return { label, note, ok: true };
}
