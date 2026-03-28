import type { PrescriptionLine } from "@/types/workflow";

/** Deterministic SOAP/plan for one-click demo — matches provider templates. */
export const DEMO_SOAP_NOTE = `S: Jordan returns for chronic disease follow-up; no acute complaints today.
O: Vitals reviewed; home BP log discussed. Exam deferred in demo — align with clinic protocol.
A: Essential hypertension and type 2 diabetes — stable on current regimen; continue surveillance.
P: Continue home BP checks; lifestyle counseling; medications as listed below.`;

export const DEMO_TREATMENT_PLAN = `Problem: Hypertension / Type 2 DM
Medications: Continue lisinopril 10 mg daily; continue metformin 500 mg BID
Lifestyle: Diet, activity, home BP monitoring
Follow-up: Return in 14 days or sooner if symptoms worsen`;

export const DEMO_RX_LINES: PrescriptionLine[] = [
  {
    id: "rxl_demo_judge",
    drugName: "Lisinopril",
    strength: "10 mg",
    quantity: "90",
    refills: 3,
    sig: "Take 1 tablet by mouth once daily",
  },
];
