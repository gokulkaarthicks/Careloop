import type {
  ChartInferenceReview,
  PatientClinicalSummary,
  PatientFacingVisitSummary,
  PharmacyHandoffPayload,
  Pharmacy,
  Prescription,
  PrescriptionLine,
  UUID,
} from "@/types/workflow";

const ts = () => new Date().toISOString();

/** Template SOAP — provider stays in control; this is a starting point only. */
export function buildSoapAiDraft(args: {
  patientDisplayName: string;
  appointmentTitle: string;
  clinical: PatientClinicalSummary | undefined;
}): string {
  const first = args.patientDisplayName.split(" ")[0] ?? "Patient";
  const dx =
    args.clinical?.diagnoses?.map((d) => `${d.code} ${d.description}`).join("; ") ??
    "Problems pending reconciliation";
  const vit = args.clinical?.recentVitals?.[0];
  const vitStr = vit
    ? `BP ${vit.systolicMmHg ?? "—"}/${vit.diastolicMmHg ?? "—"} (prior reading ${vit.recordedAt?.slice(0, 10) ?? ""})`
    : "Vitals to be obtained in clinic";
  return `S: ${first} presents for ${args.appointmentTitle}. Interval history reviewed; patient questions addressed.
O: ${vitStr}. Physical exam — document pertinent positives/negatives per protocol.
A: ${dx}. [Provider to refine differential and link to today’s data.]
P: Align meds and education with shared decision-making; document orders below.`;
}

export function buildChartInferenceReview(args: {
  appointmentId: UUID;
  patientId: UUID;
  clinical: PatientClinicalSummary | undefined;
}): ChartInferenceReview {
  const c = args.clinical;
  const allergies =
    c?.allergies?.map((a) => ({ substance: a.substance, severity: a.severity })) ??
    [];
  const medications =
    c?.medications?.map((m) => ({
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
    })) ?? [];
  const problems = c?.diagnoses?.map((d) => `${d.code}: ${d.description}`) ?? [];
  const vit = c?.recentVitals?.[0];
  const vitalsNarrative = vit
    ? `Last stored: ${vit.recordedAt?.slice(0, 10)} — BP ${vit.systolicMmHg ?? "—"}/${vit.diastolicMmHg ?? "—"} mmHg`
    : null;

  const attentionFlags: { label: string; detail: string }[] = [];
  if (allergies.length > 0) {
    attentionFlags.push({
      label: "Allergy list non-empty",
      detail: "Cross-check any new therapy against documented reactions.",
    });
  }
  if (vit?.systolicMmHg != null && vit.systolicMmHg >= 130) {
    attentionFlags.push({
      label: "Elevated BP in last vitals",
      detail: "Correlate with home readings and symptoms today.",
    });
  }

  return {
    appointmentId: args.appointmentId,
    patientId: args.patientId,
    generatedAt: ts(),
    source: "rules-v1",
    allergies,
    medications,
    problems,
    vitalsNarrative,
    attentionFlags,
  };
}

export function buildSuggestedNextSteps(args: {
  clinical: PatientClinicalSummary | undefined;
  treatmentPlan: string;
  soapNote: string;
}): string[] {
  const steps: string[] = [
    "Confirm medication list with patient (pill bottles or pharmacy history).",
    "Reconcile AI draft SOAP with your exam findings before signing.",
  ];
  const plan = args.treatmentPlan.toLowerCase();
  if (plan.includes("lab") || plan.includes("a1c") || plan.includes("bmp")) {
    steps.push("Place orders for labs discussed in plan; schedule result review.");
  }
  if (plan.includes("follow") || plan.includes("return")) {
    steps.push("Set follow-up interval in scheduling per plan.");
  }
  if ((args.clinical?.allergies?.length ?? 0) > 0) {
    steps.push("Document allergy counseling if new drug class prescribed.");
  }
  steps.push("When ready, finalize to transmit Rx and patient instructions.");
  return steps.slice(0, 6);
}

export function buildPatientFacingVisitSummary(args: {
  appointmentId: UUID;
  patientId: UUID;
  patientDisplayName: string;
  treatmentPlan: string;
  pharmacy: Pharmacy;
  prescriptionLines: PrescriptionLine[];
}): PatientFacingVisitSummary {
  const lines = args.prescriptionLines.map(
    (l) =>
      `${l.drugName} ${l.strength}: ${l.sig} (qty ${l.quantity})`,
  );
  return {
    appointmentId: args.appointmentId,
    patientId: args.patientId,
    title: `After your visit — ${args.patientDisplayName.split(" ")[0] ?? "Patient"}`,
    bullets: [
      "Thank you for today’s visit. Below is a simple recap — your clinician’s signed note is the legal record.",
      "Take medications exactly as prescribed. If something is unclear, message us or ask your pharmacist.",
    ],
    medicationsPlainLanguage: lines.length > 0 ? lines : ["No new prescriptions from this finalize — per your plan."],
    nextSteps: args.treatmentPlan
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5),
    whenToSeekCare:
      "Call the clinic or seek urgent care for chest pain, severe shortness of breath, sudden weakness, or other alarming symptoms.",
    pharmacyNote: `If you use ${args.pharmacy.name}, your care team will route prescriptions there when applicable.`,
    createdAt: ts(),
  };
}

export function buildPharmacyHandoffPayload(args: {
  prescription: Prescription;
  patientDisplayName: string;
  patientDob: string;
  pharmacy: Pharmacy;
}): PharmacyHandoffPayload {
  return {
    prescriptionId: args.prescription.id,
    pharmacyId: args.pharmacy.id,
    patientDisplayName: args.patientDisplayName,
    patientDob: args.patientDob,
    summaryLine: `NewRx handoff · ${args.prescription.lines.map((l) => l.drugName).join(", ")}`,
    lines: args.prescription.lines.map((l) => ({
      drugName: l.drugName,
      strength: l.strength,
      quantity: l.quantity,
      sig: l.sig,
    })),
    routingNote: `Deliver to ${args.pharmacy.name} · ${args.pharmacy.addressLine}, ${args.pharmacy.city} ${args.pharmacy.state} ${args.pharmacy.zip}. Demo payload only.`,
    createdAt: ts(),
  };
}
