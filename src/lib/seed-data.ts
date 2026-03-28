import type {
  AdherenceCheck,
  AiHistorySummary,
  Allergy,
  Appointment,
  CareLoopSnapshot,
  Encounter,
  FollowUpTask,
  Medication,
  Patient,
  PatientClinicalSummary,
  Pharmacy,
  PharmacyOrder,
  PayerStatus,
  Prescription,
  ProviderProfile,
} from "@/types/workflow";
import { SEED_PAYER_PLANS } from "@/lib/benefits/seed-benefits-data";

const now = new Date().toISOString();

/* ─── Sample patient: Jordan Ellis (full demo cohort) ─── */

const jordanId = "pat_seed_001";
const providerId = "prov_seed_001";
const payerId = "payer_seed_001";
const pharmacyId = "pharm_seed_001";
const upcomingApptId = "appt_seed_001";
const rxId = "rx_seed_001";
const phOrderId = "phord_seed_001";

export const patientJordan: Patient = {
  id: jordanId,
  mrn: "MRN-77821",
  displayName: "Jordan Ellis",
  dateOfBirth: "1988-04-12",
  sexAtBirth: "M",
  phone: "+1 (555) 010-4421",
  email: "jordan.ellis@email.test",
  status: "active",
  notes: "Prefers afternoon visits; Baylight Apothecary preferred.",
  createdAt: "2024-01-08T10:00:00Z",
  updatedAt: now,
  externalEhrPatientId: "EHR-DEMO-001",
  preferredPharmacyId: pharmacyId,
  insurancePlanId: "plan_ppo_summit_001",
  coverageDemoTag: "standard",
};

const allergySulfa: Allergy = {
  id: "all_j_001",
  patientId: jordanId,
  substance: "Sulfonamide antibiotics",
  severity: "moderate",
  type: "allergy",
  status: "active",
  reaction: "Rash, pruritus (documented 2019)",
  notes: "Avoid sulfa-based diuretics; verify new Rx against class.",
  recordedAt: "2019-06-15T14:00:00Z",
  updatedAt: now,
};

const medLisinopril: Medication = {
  id: "med_j_001",
  patientId: jordanId,
  name: "Lisinopril",
  dose: "10 mg",
  route: "oral",
  frequency: "once daily",
  status: "active",
  startDate: "2024-06-01",
  notes: "For hypertension; titrate per BP logs.",
  recordedAt: "2024-06-01T16:00:00Z",
  updatedAt: now,
};

const medMetformin: Medication = {
  id: "med_j_002",
  patientId: jordanId,
  name: "Metformin",
  dose: "500 mg",
  route: "oral",
  frequency: "twice daily with meals",
  status: "active",
  startDate: "2023-01-15",
  notes: "Type 2 DM; counsel on GI side effects.",
  recordedAt: "2023-01-15T11:00:00Z",
  updatedAt: now,
};

/** Prior visits (finished encounters) */
const encounterPriorFeb: Encounter = {
  id: "enc_j_20260210",
  patientId: jordanId,
  providerId,
  encounterType: "office",
  status: "finished",
  chiefComplaint: "Hypertension and diabetes follow-up",
  notes:
    "BP 138/86; discussed home monitoring. Continue lisinopril and metformin. Labs ordered: A1c, BMP.",
  priority: "normal",
  nextAction: "None — await labs",
  ownerRole: "provider",
  startedAt: "2026-02-10T14:00:00Z",
  endedAt: "2026-02-10T14:35:00Z",
  createdAt: "2026-02-10T13:55:00Z",
  updatedAt: "2026-02-10T14:40:00Z",
};

const encounterPriorNov: Encounter = {
  id: "enc_j_20251105",
  patientId: jordanId,
  providerId,
  encounterType: "telehealth",
  status: "finished",
  chiefComplaint: "Medication refill and foot check",
  notes: "Brief video visit; no acute issues. Renewed 90-day supplies.",
  priority: "low",
  nextAction: "Schedule in-person within 90 days",
  ownerRole: "provider",
  startedAt: "2025-11-05T19:00:00Z",
  endedAt: "2025-11-05T19:18:00Z",
  createdAt: "2025-11-05T18:50:00Z",
  updatedAt: "2025-11-05T19:20:00Z",
};

/** Upcoming scheduled appointment */
const appointmentUpcoming: Appointment = {
  id: upcomingApptId,
  patientId: jordanId,
  providerId,
  title: "Chronic disease follow-up",
  scheduledFor: "2026-03-28T15:30:00Z",
  status: "scheduled",
  currentStage: "intake",
  priority: "normal",
  nextAction: "Provider to open visit and run AI history summary",
  ownerRole: "provider",
  notes: "Focus: BP trend, A1c review, medication reconciliation.",
  createdAt: "2026-03-01T09:00:00Z",
  updatedAt: "2026-03-01T09:00:00Z",
};

const seedPrescription: Prescription = {
  id: rxId,
  appointmentId: upcomingApptId,
  patientId: jordanId,
  prescriberId: providerId,
  status: "draft",
  priority: "normal",
  notes: "Renewal aligned with visit; verify sulfa allergy before any class change.",
  nextAction: "Provider to sign and transmit to pharmacy",
  ownerRole: "provider",
  createdAt: "2026-03-28T15:00:00Z",
  updatedAt: "2026-03-28T15:00:00Z",
  lines: [
    {
      id: "rxl_j_001",
      drugName: "Lisinopril",
      strength: "10 mg",
      quantity: "90",
      refills: 3,
      sig: "Take 1 tablet by mouth daily",
    },
  ],
};

/** Pharmacy pickup pipeline (starts queued until e-prescribe fires) */
const pharmacyOrderJordan: PharmacyOrder = {
  id: phOrderId,
  patientId: jordanId,
  prescriptionId: rxId,
  pharmacyId,
  status: "queued",
  priority: "normal",
  notes: "Will link to Surescripts message id on transmit (mock).",
  nextAction: "Await prescriber e-send",
  ownerRole: "pharmacy",
  createdAt: "2026-03-28T15:00:00Z",
  updatedAt: "2026-03-28T15:00:00Z",
};

const followUpPickup: FollowUpTask = {
  id: "fut_j_pickup_001",
  patientId: jordanId,
  appointmentId: upcomingApptId,
  prescriptionId: rxId,
  pharmacyOrderId: phOrderId,
  title: "Pick up lisinopril at Baylight Apothecary",
  description:
    "SMS when Rx is ready; patient confirms pickup in app (demo: use Pharmacy tab).",
  taskType: "pharmacy_pickup",
  status: "scheduled",
  dueAt: "2026-03-30T17:00:00Z",
  priority: "normal",
  ownerRole: "patient",
  nextAction: "Patient to collect when status is Ready",
  notes: "Tie-out with pharmacy order phord_seed_001.",
  createdAt: "2026-03-28T15:05:00Z",
  updatedAt: "2026-03-28T15:05:00Z",
};

const adherenceBp: AdherenceCheck = {
  id: "adh_j_bp_001",
  patientId: jordanId,
  medicationId: medLisinopril.id,
  prescriptionId: rxId,
  checkType: "self_report",
  status: "pending",
  scheduledFor: "2026-03-29T08:00:00Z",
  priority: "normal",
  ownerRole: "patient",
  nextAction: "Log 7-day AM home BP average in CareLoop",
  notes: "Reminder aligns with post-visit hypertension management.",
  createdAt: "2026-03-28T15:10:00Z",
  updatedAt: "2026-03-28T15:10:00Z",
};

const payerRowJordan: PayerStatus = {
  id: "paystat_j_001",
  patientId: jordanId,
  payerId,
  appointmentId: upcomingApptId,
  encounterId: encounterPriorFeb.id,
  claimStatus: "pending",
  priority: "normal",
  ownerRole: "payer",
  nextAction: "Release payment after encounter closes and pharmacy claims attach",
  notes: "Professional + pharmacy components stubbed for hackathon.",
  createdAt: "2026-03-28T15:00:00Z",
  updatedAt: "2026-03-28T15:00:00Z",
  closureCompletionScore: 22,
};

const clinicalJordan: PatientClinicalSummary = {
  patientId: jordanId,
  allergies: [allergySulfa],
  medications: [medLisinopril, medMetformin],
  diagnoses: [
    {
      id: "dx_j_1",
      code: "I10",
      description: "Essential (primary) hypertension",
      codingSystem: "ICD10",
    },
    {
      id: "dx_j_2",
      code: "E11.9",
      description: "Type 2 diabetes mellitus without complications",
      codingSystem: "ICD10",
    },
  ],
  recentVitals: [
    {
      recordedAt: "2026-03-20T14:00:00Z",
      systolicMmHg: 138,
      diastolicMmHg: 86,
      heartRateBpm: 78,
      weightKg: 88.4,
    },
  ],
  lastVisitDate: "2026-02-10",
};

/* ─── Second patient: minimal rows (no seeded visit) ─── */

const patientSam: Patient = {
  id: "pat_seed_002",
  mrn: "MRN-441902",
  displayName: "Priya Kulkarni",
  dateOfBirth: "1976-11-03",
  sexAtBirth: "F",
  phone: "+1 (555) 010-8891",
  email: "priya.kulkarni@email.test",
  status: "active",
  createdAt: "2024-03-12T12:00:00Z",
  updatedAt: now,
  insurancePlanId: "plan_ppo_summit_001",
  coverageDemoTag: "pa_auto_deny",
};

const medSam: Medication = {
  id: "med_s_001",
  patientId: patientSam.id,
  name: "Atorvastatin",
  dose: "20 mg",
  frequency: "daily at bedtime",
  status: "active",
  startDate: "2025-08-01",
  recordedAt: "2025-08-01T10:00:00Z",
  updatedAt: now,
};

const clinicalSam: PatientClinicalSummary = {
  patientId: patientSam.id,
  allergies: [],
  medications: [medSam],
  diagnoses: [
    {
      id: "dx_s_1",
      code: "E78.5",
      description: "Hyperlipidemia, unspecified",
      codingSystem: "ICD10",
    },
  ],
  recentVitals: [
    {
      recordedAt: "2026-03-18T09:30:00Z",
      systolicMmHg: 122,
      diastolicMmHg: 74,
      heartRateBpm: 68,
    },
  ],
  lastVisitDate: "2025-12-02",
};

/** Sam — upcoming visit so Provider schedule is not empty without SQLite */
const appointmentSam: Appointment = {
  id: "appt_sam_001",
  patientId: patientSam.id,
  providerId,
  title: "Primary care follow-up",
  scheduledFor: "2026-03-28T18:00:00Z",
  status: "scheduled",
  currentStage: "intake",
  priority: "normal",
  nextAction: "Open encounter — chart briefing",
  ownerRole: "provider",
  notes: "Lipids and cardiovascular risk review.",
  createdAt: "2026-03-01T09:00:00Z",
  updatedAt: now,
};

const provider: ProviderProfile = {
  id: providerId,
  name: "Dr. Morgan Okonkwo",
  role: "Primary Care",
  npi: "1982765432",
};

const pharmacy: Pharmacy = {
  id: pharmacyId,
  name: "Baylight Apothecary",
  addressLine: "400 Bay St",
  city: "San Francisco",
  state: "CA",
  zip: "94107",
};

const seedAiSummary: AiHistorySummary = {
  patientId: jordanId,
  generatedAt: now,
  narrative:
    "Jordan is a 37-year-old with hypertension and type 2 diabetes, reasonably controlled on lisinopril and metformin. Recent BP is borderline elevated. No documented sulfa exposure since documented allergy.",
  risks: [
    {
      id: "risk_1",
      label: "Cardiovascular risk",
      severity: "moderate",
      rationale: "Hypertension + diabetes; BP 138/86 on last reading.",
    },
    {
      id: "risk_2",
      label: "Hypoglycemia counseling",
      severity: "low",
      rationale: "On metformin; reinforce sick-day rules and monitoring.",
    },
    {
      id: "risk_3",
      label: "Uncontrolled BP trajectory",
      severity: "high",
      rationale:
        "Upward BP trend vs goal; intensify monitoring and consider therapy adjustment at visit.",
    },
  ],
  suggestedFocus: [
    "BP goal and home monitoring",
    "Diabetes self-management and A1c timing",
    "Medication adherence",
  ],
  suggestedQuestions: [
    "When was your last dilated eye exam?",
    "Are you checking home BP at least twice weekly, and what are typical readings?",
    "Any new OTC or herbal products since last visit?",
    "Foot inspection frequency — any numbness or wounds?",
    "Sick-day rules for metformin — can you describe your plan?",
  ],
  mock: true,
};

export const SEED: CareLoopSnapshot = {
  patients: [patientJordan, patientSam],
  providers: [provider],
  payers: [
    {
      id: payerId,
      name: "Cascadia Mutual Health",
      planType: "PPO",
    },
  ],
  pharmacies: [pharmacy],
  appointments: [appointmentUpcoming, appointmentSam],
  encounters: [encounterPriorFeb, encounterPriorNov],
  clinicalByPatientId: {
    [jordanId]: clinicalJordan,
    [patientSam.id]: clinicalSam,
  },
  carePlans: {},
  prescriptions: [seedPrescription],
  pharmacyOrders: [pharmacyOrderJordan],
  followUpTasks: [followUpPickup],
  adherenceChecks: [adherenceBp],
  payerStatuses: [payerRowJordan],
  aiSummaries: {
    [jordanId]: seedAiSummary,
  },
  providerVisitDrafts: {},
  chartInferenceByAppointment: {},
  patientFacingSummariesByAppointment: {},
  pharmacyHandoffsByPrescription: {},
  workflowTimeline: [],
  patientWorkflowNotifications: [],
  patientCareEvents: [],
  preVisitBriefingsByAppointment: {},
  insurancePlans: SEED_PAYER_PLANS,
  priorAuthCases: [],
  workflowEngineEvents: [],
};

export const DEFAULT_SELECTED_PATIENT_ID = jordanId;

/** Stable ids for one-click judge demo (Jordan cohort). */
export const SEED_DEMO_ROUTE = {
  patientId: jordanId,
  appointmentId: upcomingApptId,
  rxId,
  providerId,
  pharmacyId,
  payerStatusId: "paystat_j_001",
} as const;
