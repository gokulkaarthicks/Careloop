import type { ClinicalRisk, UUID } from "@/types/workflow";

/**
 * Inputs for the pre-visit agent. Designed to map 1:1 to a future LLM prompt payload
 * (system + user messages, or structured tool schema).
 */
export interface PreVisitAgentInput {
  patientId: UUID;
  /** Patient display name for briefing salutation */
  displayName: string;
  /** Current visit focus — appointment title / chief complaint line */
  appointmentReason: string;
  /** Structured chart snapshot: diagnoses, meds, allergies, vitals, last visit */
  clinical:
    | {
        diagnoses: { code: string; description: string }[];
        medications: { name: string; dose?: string; frequency?: string }[];
        allergies: { substance: string; severity: string }[];
        recentVitals: {
          recordedAt: string;
          systolicMmHg?: number;
          diastolicMmHg?: number;
        }[];
        lastVisitDate?: string;
      }
    | undefined;
  /** Finished encounters prior to today’s appointment, newest first or any order */
  priorEncounters: {
    id: string;
    endedAt?: string;
    startedAt?: string;
    encounterType: string;
    chiefComplaint?: string;
    notes?: string;
  }[];
}

/** Output from the pre-visit agent (Grok via `/api/ai/pre-visit`). */
export interface PreVisitAgentOutput {
  /** Exactly five bullets for sign-out / huddle */
  briefingBullets: [string, string, string, string, string];
  risks: ClinicalRisk[];
  missingQuestions: string[];
  /** Short prose + optional line breaks — not a full chart */
  clinicalTimeline: string;
  /** 0–100 composite; higher = fewer documentation gaps before rooming */
  visitReadinessScore: number;
  /** Agent version for telemetry / swapping implementations */
  agentVersion: "llm-v1";
  /** ISO timestamp when the run was evaluated (caller-supplied for determinism) */
  generatedAt: string;
}
