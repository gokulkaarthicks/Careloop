import { z } from "zod";

/** Structured SOAP for validation and export (demo — not a full CDA). */
export const soapSectionsSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  /** Agentic block merged at finalize */
  addendum: z.string().optional(),
});

export type SoapSections = z.infer<typeof soapSectionsSchema>;

const HEADER = /^(S|O|A|P)\s*:\s*/im;

/**
 * Best-effort parse when the note uses S:/O:/A:/P: headings (common in demos).
 * Falls back to a single `subjective` field with full text when headers are missing.
 */
export function parseSoapSectionsFromText(text: string): SoapSections {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const parts: Record<string, string> = {};
  const map = { S: "subjective", O: "objective", A: "assessment", P: "plan" } as const;

  const addendumSplit = trimmed.split(/\n---\n/);
  const main = addendumSplit[0]?.trim() ?? "";
  const addendum =
    addendumSplit.length > 1 ? addendumSplit.slice(1).join("\n---\n").trim() : undefined;

  if (!HEADER.test(main)) {
    const out: SoapSections = { subjective: main };
    if (addendum) out.addendum = addendum;
    return soapSectionsSchema.parse(out);
  }

  const lines = main.split("\n");
  let current: keyof typeof map | null = null;
  const buf: string[] = [];

  function flush() {
    if (!current || buf.length === 0) return;
    const key = map[current];
    parts[key] = buf.join("\n").trim();
    buf.length = 0;
  }

  for (const line of lines) {
    const m = line.match(/^(S|O|A|P)\s*:\s*(.*)$/i);
    if (m) {
      flush();
      current = m[1].toUpperCase() as keyof typeof map;
      buf.push(m[2] ?? "");
    } else if (current) {
      buf.push(line);
    }
  }
  flush();

  const out: SoapSections = {
    subjective: parts.subjective,
    objective: parts.objective,
    assessment: parts.assessment,
    plan: parts.plan,
  };
  if (addendum) out.addendum = addendum;
  return soapSectionsSchema.parse(out);
}

export function exportSoapRunBundle(args: {
  encounterAgentRun: import("@/types/agentic").EncounterAgentRun;
  soapNoteFullText: string;
}) {
  const sections = parseSoapSectionsFromText(args.soapNoteFullText);
  return {
    exportedAt: new Date().toISOString(),
    encounterAgentRun: args.encounterAgentRun,
    soapSections: sections,
  };
}
