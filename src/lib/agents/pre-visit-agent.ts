import type {
  PreVisitAgentInput,
  PreVisitAgentOutput,
} from "@/types/pre-visit-agent";
import type { ClinicalRisk, Encounter, PatientClinicalSummary } from "@/types/workflow";

/** Deterministic string hash for stable pseudo-random picks (demo / testing). */
function seedHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(Math.round((b - a) / 86400000));
}

function hasDx(clinical: PreVisitAgentInput["clinical"], needle: RegExp): boolean {
  if (!clinical?.diagnoses?.length) return false;
  return clinical.diagnoses.some((d) => needle.test(d.description) || needle.test(d.code));
}

const QUESTION_BANK: { id: string; predicate: (ctx: Ctx) => boolean; text: string }[] =
  [
    {
      id: "dm_labs",
      predicate: (c) => hasDx(c.clinical, /diabetes|E11|dm\b/i),
      text: "When was the most recent A1c, and was it at goal?",
    },
    {
      id: "htn_home_bp",
      predicate: (c) => hasDx(c.clinical, /hypertension|I10|htn/i),
      text: "What are typical home BP readings and measurement technique?",
    },
    {
      id: "interval_ed",
      predicate: (c) => c.priorEncounters.length > 0,
      text: "Any ED visits or hospitalizations since the last documented encounter?",
    },
    {
      id: "meds_otc",
      predicate: () => true,
      text: "Any new OTC, herbal, or borrowed medications since last visit?",
    },
    {
      id: "allergy_review",
      predicate: (c) => (c.clinical?.allergies?.length ?? 0) > 0,
      text: "Review allergies with patient today — any new reactions since last charted?",
    },
    {
      id: "foot_dm",
      predicate: (c) => hasDx(c.clinical, /diabetes|E11/i),
      text: "Foot inspection: numbness, wounds, or podiatry follow-up needed?",
    },
    {
      id: "lipids",
      predicate: (c) => hasDx(c.clinical, /lipid|hyperlip|E78/i),
      text: "Statin tolerance and most recent lipid panel?",
    },
    {
      id: "sdo_h",
      predicate: () => true,
      text: "Barriers to pharmacy pickup, transportation, or medication cost?",
    },
    {
      id: "sick_day",
      predicate: (c) => hasDx(c.clinical, /diabetes|E11/i),
      text: "Sick-day rules for diabetes medications — patient understanding?",
    },
    {
      id: "exercise",
      predicate: () => true,
      text: "Physical activity minutes per week and fall risk?",
    },
  ];

type Ctx = {
  clinical: PreVisitAgentInput["clinical"];
  priorEncounters: PreVisitAgentInput["priorEncounters"];
  appointmentReason: string;
};

function selectMissingQuestions(input: PreVisitAgentInput): string[] {
  const seed = `${input.patientId}|${input.appointmentReason}`;
  const ctx: Ctx = {
    clinical: input.clinical,
    priorEncounters: input.priorEncounters,
    appointmentReason: input.appointmentReason,
  };
  const eligible = QUESTION_BANK.filter((q) => q.predicate(ctx)).map((q) => q.text);
  const fallback = QUESTION_BANK.map((q) => q.text);
  const merged = [...eligible, ...fallback];
  const pool =
    eligible.length >= 5
      ? eligible
      : Array.from(new Set(merged));
  const h = seedHash(seed);
  const out: string[] = [];
  const n = pool.length;
  for (let i = 0; i < 5; i++) {
    const idx = (h + i * 2654435761) % n;
    const q = pool[idx];
    if (!out.includes(q)) out.push(q);
  }
  let k = 0;
  while (out.length < 5 && k < fallback.length) {
    const q = fallback[k++];
    if (!out.includes(q)) out.push(q);
  }
  return out.slice(0, 5);
}

function buildRisks(input: PreVisitAgentInput): ClinicalRisk[] {
  const risks: ClinicalRisk[] = [];
  const c = input.clinical;
  const last = c?.lastVisitDate;
  const today = new Date().toISOString().slice(0, 10);
  if (last && daysBetween(last, today) > 120) {
    risks.push({
      id: "risk_gap",
      label: "Long interval since last PCP visit",
      severity: "moderate",
      rationale: `Last documented visit ${last}; confirm interval history and medication adherence.`,
    });
  }
  if (c?.allergies?.some((a) => a.severity === "severe")) {
    risks.push({
      id: "risk_severe_allergy",
      label: "Severe allergy on file",
      severity: "high",
      rationale: "Cross-check new prescriptions and therapeutic class alternatives.",
    });
  } else if ((c?.allergies?.length ?? 0) > 0) {
    risks.push({
      id: "risk_allergy",
      label: "Documented drug allergy",
      severity: "low",
      rationale: "Verify allergy list with patient prior to ordering or prescribing.",
    });
  }
  const vit = c?.recentVitals?.[0];
  if (vit?.systolicMmHg != null && vit.systolicMmHg >= 135) {
    risks.push({
      id: "risk_bp",
      label: "Elevated BP in recent vitals",
      severity: "moderate",
      rationale: `Most recent BP ${vit.systolicMmHg}/${vit.diastolicMmHg ?? "—"}; reconcile with home readings.`,
    });
  }
  if (hasDx(c, /diabetes|E11/i) && (c?.medications?.length ?? 0) >= 3) {
    risks.push({
      id: "risk_poly",
      label: "Cardiometabolic polypharmacy",
      severity: "moderate",
      rationale: "Multiple active meds with DM; review adherence, interactions, and renal function.",
    });
  }
  if (risks.length === 0) {
    risks.push({
      id: "risk_default",
      label: "Standard adult chronic-care visit",
      severity: "low",
      rationale: "No automated red flags beyond routine reconciliation and screening gaps.",
    });
  }
  return risks.slice(0, 6);
}

function buildTimeline(input: PreVisitAgentInput): string {
  const rows = [...input.priorEncounters]
    .sort((a, b) => {
      const da = a.endedAt ?? a.startedAt ?? "";
      const db = b.endedAt ?? b.startedAt ?? "";
      return da.localeCompare(db);
    })
    .slice(-5);

  if (rows.length === 0) {
    return "No prior encounters in mock cohort — timeline will populate as history accrues.";
  }

  return rows
    .map((e) => {
      const d = (e.endedAt ?? e.startedAt ?? "").slice(0, 10) || "—";
      const cc = e.chiefComplaint ?? e.notes?.slice(0, 80) ?? "Visit";
      return `${d} · ${e.encounterType}: ${cc}`;
    })
    .join("\n");
}

function readinessScore(input: PreVisitAgentInput): number {
  let s = 58;
  const c = input.clinical;
  if (c?.allergies && c.allergies.length > 0) s += 8;
  if (c?.medications && c.medications.length > 0) s += 10;
  if (c?.diagnoses && c.diagnoses.length > 0) s += 8;
  if (input.priorEncounters.length > 0) s += 9;
  if (c?.recentVitals && c.recentVitals.length > 0) s += 7;

  const last = c?.lastVisitDate;
  const today = new Date().toISOString().slice(0, 10);
  if (last) {
    const gap = daysBetween(last, today);
    if (gap <= 90) s += 8;
    else if (gap > 200) s -= 14;
    else if (gap > 150) s -= 8;
  } else {
    s -= 6;
  }

  if (!c?.recentVitals?.length) s -= 10;

  return clamp(Math.round(s), 0, 100);
}

function briefingBullets(input: PreVisitAgentInput): PreVisitAgentOutput["briefingBullets"] {
  const c = input.clinical;
  const name = input.displayName.split(" ")[0] || "Patient";
  const dx = c?.diagnoses?.length
    ? c.diagnoses.map((d) => d.description).slice(0, 3).join("; ")
    : "No coded problems in mock summary";
  const medN = c?.medications?.length ?? 0;
  const medLine =
    medN > 0
      ? `${medN} active medication(s) on file — reconcile in room.`
      : "No home medications listed — obtain reconciliation.";
  const allergyLine =
    (c?.allergies?.length ?? 0) > 0
      ? `${c!.allergies!.length} allergy/intolerance entr${c!.allergies!.length === 1 ? "y" : "ies"} — confirm with patient.`
      : "No allergies on file — verify NKDA vs. undocumented.";
  const last = c?.lastVisitDate
    ? `Last charted visit: ${c.lastVisitDate}.`
    : "No last-visit date — capture interval history.";
  const vit = c?.recentVitals?.[0];
  const vitLine = vit
    ? `Recent vitals (${vit.recordedAt.slice(0, 10)}): BP ${vit.systolicMmHg ?? "—"}/${vit.diastolicMmHg ?? "—"}.`
    : "No recent vitals — plan BP/weight as indicated.";

  return [
    `${name} — today’s focus: ${input.appointmentReason}.`,
    `Problem list (excerpt): ${dx}.`,
    medLine,
    allergyLine,
    `${last} ${vitLine}`,
  ] as PreVisitAgentOutput["briefingBullets"];
}

/** Map EHR snapshot + encounters into the agent input contract (same payload you’d send to an LLM). */
export function buildPreVisitAgentInput(args: {
  patientId: string;
  displayName: string;
  appointmentReason: string;
  clinical: PatientClinicalSummary | undefined;
  priorEncounters: Encounter[];
}): PreVisitAgentInput {
  const c = args.clinical;
  return {
    patientId: args.patientId,
    displayName: args.displayName,
    appointmentReason: args.appointmentReason,
    clinical: c
      ? {
          diagnoses: c.diagnoses.map((d) => ({
            code: d.code,
            description: d.description,
          })),
          medications: c.medications.map((m) => ({
            name: m.name,
            dose: m.dose,
            frequency: m.frequency,
          })),
          allergies: c.allergies.map((a) => ({
            substance: a.substance,
            severity: a.severity,
          })),
          recentVitals: c.recentVitals.map((v) => ({
            recordedAt: v.recordedAt,
            systolicMmHg: v.systolicMmHg,
            diastolicMmHg: v.diastolicMmHg,
          })),
          lastVisitDate: c.lastVisitDate,
        }
      : undefined,
    priorEncounters: args.priorEncounters.map((e) => ({
      id: e.id,
      endedAt: e.endedAt,
      startedAt: e.startedAt,
      encounterType: e.encounterType,
      chiefComplaint: e.chiefComplaint,
      notes: e.notes,
    })),
  };
}

/**
 * Rule-based pre-visit agent. Swap implementation body for an LLM call using the same
 * {@link PreVisitAgentInput} / {@link PreVisitAgentOutput} contract.
 */
export function runPreVisitAgent(
  input: PreVisitAgentInput,
  options?: { generatedAt?: string },
): PreVisitAgentOutput {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();

  return {
    briefingBullets: briefingBullets(input),
    risks: buildRisks(input),
    missingQuestions: selectMissingQuestions(input),
    clinicalTimeline: buildTimeline(input),
    visitReadinessScore: readinessScore(input),
    agentVersion: "rules-v1",
    generatedAt,
  };
}
