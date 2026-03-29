import { describe, expect, it } from "vitest";
import { exportSoapRunBundle, parseSoapSectionsFromText } from "./soap-note";
import type { EncounterAgentRun } from "@/types/agentic";

describe("parseSoapSectionsFromText", () => {
  it("extracts addendum after delimiter", () => {
    const t = "S: hello\n\n---\nAgentic encounter addendum";
    const p = parseSoapSectionsFromText(t);
    expect(p.addendum).toContain("Agentic encounter addendum");
    expect(p.subjective).toContain("hello");
  });

  it("exports bundle shape", () => {
    const run = {
      runId: "car_test",
      appointmentId: "a1",
      patientId: "p1",
      finishedAt: new Date().toISOString(),
      coveragePlanName: "Demo",
      outcomeLabel: "pharmacy_e_rx" as const,
      tools: [],
      routingSummary: [],
      soapAddendum: "x",
      timelineEntryTitles: [],
    } satisfies EncounterAgentRun;

    const b = exportSoapRunBundle({
      encounterAgentRun: run,
      soapNoteFullText: "S: note\n\n---\nadd",
    });
    expect(b.soapSections.addendum).toContain("add");
    expect(b.encounterAgentRun.runId).toBe("car_test");
  });
});
