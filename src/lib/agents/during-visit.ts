import type {
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
