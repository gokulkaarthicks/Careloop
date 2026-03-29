/**
 * Care Orchestrator — workflow entity types.
 * Structured for provider, patient, pharmacy, and payer surfaces + future integrations.
 */

import type { PreVisitAgentOutput } from "./pre-visit-agent";
import type {
  CoverageDemoTag,
  InsurancePlan,
  PriorAuthCase,
  WorkflowEngineEvent,
} from "./benefits";
import type { EncounterAgentRun } from "./agentic";
import type {
  AppealBundle,
  ConnectorRun,
  ExternalSyncCheckpoint,
  RecoveryAction,
  RecoveryCase,
  SlaTimer,
} from "./recovery";

export type UUID = string;

export type ISODateTime = string;

/** Who owns the next workflow step */
export type OwnerRole =
  | "provider"
  | "patient"
  | "pharmacy"
  | "payer"
  | "care_coordinator"
  | "system";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

/** High-level stages in the closed-loop demo */
export type WorkflowStage =
  | "intake"
  | "ai_review"
  | "planning"
  | "prescribing"
  | "pharmacy"
  | "patient_followup"
  | "payer_closure";

export type AppointmentStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PrescriptionStatus =
  | "draft"
  | "sent"
  | "pending_prior_auth"
  | "pa_denied"
  | "received_by_pharmacy"
  | "ready_for_pickup"
  | "picked_up"
  | "cancelled";

export type EncounterStatus =
  | "planned"
  | "arrived"
  | "in_progress"
  | "finished"
  | "cancelled";

export type EncounterType =
  | "office"
  | "telehealth"
  | "inpatient"
  | "follow_up"
  | "urgent";

export type PharmacyOrderStatus =
  | "queued"
  | "sent_to_pharmacy"
  | "received"
  | "filling"
  | "ready_for_pickup"
  | "picked_up"
  | "cancelled";

export type FollowUpTaskStatus =
  | "open"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "skipped"
  | "cancelled";

export type FollowUpTaskType =
  | "reminder"
  | "callback"
  | "education"
  | "lab"
  | "referral"
  | "pharmacy_pickup";

export type AdherenceCheckType =
  | "self_report"
  | "refill_gap"
  | "pillbox"
  | "survey";

export type AdherenceCheckStatus =
  | "pending"
  | "completed"
  | "overdue"
  | "waived";

export type PayerClaimStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "paid"
  | "denied";

export type MedicationStatus = "active" | "discontinued" | "on_hold";

export type AllergyStatus = "active" | "inactive";

export interface Patient {
  id: UUID;
  mrn: string;
  displayName: string;
  dateOfBirth: string;
  sexAtBirth: "M" | "F" | "U";
  phone: string;
  email: string;
  status: "active" | "inactive" | "deceased";
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Integration hook: external EHR patient id */
  externalEhrPatientId?: string;
  preferredPharmacyId?: UUID;
  /** Synthetic plan id — drives formulary / PA rules in demo */
  insurancePlanId?: UUID;
  /** Demo scenario tag for deterministic PA / network branches */
  coverageDemoTag?: CoverageDemoTag;
}

export interface Allergy {
  id: UUID;
  patientId: UUID;
  substance: string;
  severity: "mild" | "moderate" | "severe";
  type: "allergy" | "intolerance";
  status: AllergyStatus;
  reaction?: string;
  notes?: string;
  recordedAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Medication {
  id: UUID;
  patientId: UUID;
  name: string;
  dose: string;
  route?: string;
  frequency: string;
  status: MedicationStatus;
  startDate: string;
  endDate?: string;
  notes?: string;
  recordedAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Diagnosis {
  id: UUID;
  code: string;
  description: string;
  codingSystem: "ICD10";
}

export interface VitalSnapshot {
  recordedAt: string;
  systolicMmHg?: number;
  diastolicMmHg?: number;
  heartRateBpm?: number;
  weightKg?: number;
}

/** Aggregate for AI + UI (EHR snapshot) */
export interface PatientClinicalSummary {
  patientId: UUID;
  allergies: Allergy[];
  medications: Medication[];
  diagnoses: Diagnosis[];
  recentVitals: VitalSnapshot[];
  lastVisitDate?: string;
}

export interface ClinicalRisk {
  id: UUID;
  label: string;
  severity: "low" | "moderate" | "high";
  rationale: string;
}

export interface AiHistorySummary {
  patientId: UUID;
  generatedAt: string;
  narrative: string;
  risks: ClinicalRisk[];
  suggestedFocus: string[];
  /** Gaps to close before or during the visit (history, meds, social determinants, etc.) */
  suggestedQuestions: string[];
  mock: boolean;
}

/** Persisted SOAP + plan draft per appointment (local demo state). */
export interface ProviderVisitDraft {
  soapNote: string;
  treatmentPlan: string;
  finalizedAt?: ISODateTime;
}

/** Scheduled visit (upcoming or historical anchor) */
export interface Appointment {
  id: UUID;
  patientId: UUID;
  providerId: UUID;
  title: string;
  scheduledFor: ISODateTime;
  status: AppointmentStatus;
  currentStage: WorkflowStage;
  priority: TaskPriority;
  /** Free-text cue for the owning lane */
  nextAction: string;
  ownerRole: OwnerRole;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A clinical encounter (prior visit or in-flight visit tied to an appointment).
 */
export interface Encounter {
  id: UUID;
  patientId: UUID;
  providerId: UUID;
  /** Set when this encounter fulfills a scheduled appointment */
  appointmentId?: UUID;
  encounterType: EncounterType;
  status: EncounterStatus;
  chiefComplaint?: string;
  notes?: string;
  priority: TaskPriority;
  nextAction: string;
  ownerRole: OwnerRole;
  startedAt?: ISODateTime;
  endedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PrescriptionLine {
  id: UUID;
  drugName: string;
  strength: string;
  quantity: string;
  refills: number;
  sig: string;
}

export interface Prescription {
  id: UUID;
  appointmentId: UUID;
  patientId: UUID;
  prescriberId: UUID;
  status: PrescriptionStatus;
  lines: PrescriptionLine[];
  priority: TaskPriority;
  notes?: string;
  nextAction: string;
  ownerRole: OwnerRole;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  writtenAt?: ISODateTime;
  sentAt?: ISODateTime;
  pharmacyId?: UUID;
  /** Linked pharmacy order id when submitted */
  pharmacyOrderId?: UUID;
  externalPharmacyOrderId?: string;
  /** Coverage / PA hold explanation for UI */
  coverageNotes?: string;
}

/** Fulfillment pipeline at the pharmacy (distinct from prescriber Rx document). */
export interface PharmacyOrder {
  id: UUID;
  patientId: UUID;
  prescriptionId: UUID;
  pharmacyId: UUID;
  status: PharmacyOrderStatus;
  priority: TaskPriority;
  notes?: string;
  nextAction: string;
  ownerRole: OwnerRole;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  sentAt?: ISODateTime;
  receivedAt?: ISODateTime;
  readyAt?: ISODateTime;
  pickedUpAt?: ISODateTime;
  externalFulfillmentId?: string;
}

export interface FollowUpTask {
  id: UUID;
  patientId: UUID;
  encounterId?: UUID;
  appointmentId?: UUID;
  prescriptionId?: UUID;
  pharmacyOrderId?: UUID;
  title: string;
  description?: string;
  taskType: FollowUpTaskType;
  status: FollowUpTaskStatus;
  dueAt: ISODateTime;
  priority: TaskPriority;
  ownerRole: OwnerRole;
  nextAction: string;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AdherenceCheck {
  id: UUID;
  patientId: UUID;
  medicationId?: UUID;
  prescriptionId?: UUID;
  checkType: AdherenceCheckType;
  status: AdherenceCheckStatus;
  scheduledFor: ISODateTime;
  completedAt?: ISODateTime;
  /** e.g. "7/7 days", "missed Sat" */
  responseSummary?: string;
  score?: number;
  priority: TaskPriority;
  ownerRole: OwnerRole;
  nextAction: string;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Payer-facing claim / authorization row */
export interface PayerStatus {
  id: UUID;
  patientId: UUID;
  payerId: UUID;
  encounterId?: UUID;
  appointmentId?: UUID;
  claimStatus: PayerClaimStatus;
  authorizedAmountUsd?: number;
  paidAmountUsd?: number;
  priority: TaskPriority;
  ownerRole: OwnerRole;
  nextAction: string;
  notes?: string;
  externalClaimId?: string;
  submittedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** 0–100 mock score for operational closure (pharmacy → patient → payer) */
  closureCompletionScore?: number;
}

export interface CarePlanDraft {
  appointmentId: UUID;
  goals: string[];
  interventions: string[];
  followUpInDays: number;
  patientEducation: string;
  updatedAt: string;
}

export interface Pharmacy {
  id: UUID;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
}

export interface ProviderProfile {
  id: UUID;
  name: string;
  role: string;
  npi?: string;
}

export interface PayerProfile {
  id: UUID;
  name: string;
  planType: string;
}

/** Post-encounter chart review artifact from the documentation integrity agent. */
export interface ChartInferenceReview {
  appointmentId: UUID;
  patientId: UUID;
  generatedAt: ISODateTime;
  source: "llm-v1";
  allergies: { substance: string; severity: string }[];
  medications: { name: string; dose: string; frequency: string }[];
  problems: string[];
  vitalsNarrative: string | null;
  attentionFlags: { label: string; detail: string }[];
}

/** Plain-language handout for the patient app / SMS. */
export interface PatientFacingVisitSummary {
  appointmentId: UUID;
  patientId: UUID;
  title: string;
  bullets: string[];
  medicationsPlainLanguage: string[];
  nextSteps: string[];
  whenToSeekCare: string;
  pharmacyNote: string;
  createdAt: ISODateTime;
}

/** Structured payload for e-prescribe / pharmacy integration mocks. */
export interface PharmacyHandoffPayload {
  prescriptionId: UUID;
  pharmacyId: UUID;
  patientDisplayName: string;
  patientDob: string;
  summaryLine: string;
  lines: {
    drugName: string;
    strength: string;
    quantity: string;
    sig: string;
  }[];
  routingNote: string;
  createdAt: ISODateTime;
}

/** Cross-role audit trail for provider dashboard (pharmacy milestones, etc.) */
export interface WorkflowTimelineEntry {
  id: UUID;
  occurredAt: ISODateTime;
  title: string;
  detail: string;
  patientId: UUID;
  prescriptionId?: UUID;
  appointmentId?: UUID;
}

/** In-app patient alerts driven by pharmacy / workflow (mock SMS mirror) */
export interface PatientWorkflowNotification {
  id: UUID;
  patientId: UUID;
  createdAt: ISODateTime;
  title: string;
  body: string;
  source: "pharmacy" | "patient" | "care_team";
}

/** Patient-initiated events surfaced on reminder timeline + provider workflow */
export type PatientCareEventKind =
  | "med_picked_up"
  | "med_taken"
  | "symptom_checkin";

export interface PatientCareEvent {
  id: UUID;
  patientId: UUID;
  at: ISODateTime;
  kind: PatientCareEventKind;
  /** Short, friendly line for the patient app */
  summary: string;
  /** Optional JSON or free text (e.g. symptom form) */
  detail?: string;
  prescriptionId?: UUID;
}

/** Single bundle driving the demo UI */
export interface CareLoopSnapshot {
  patients: Patient[];
  providers: ProviderProfile[];
  payers: PayerProfile[];
  pharmacies: Pharmacy[];
  appointments: Appointment[];
  encounters: Encounter[];
  clinicalByPatientId: Record<UUID, PatientClinicalSummary>;
  carePlans: Record<UUID, CarePlanDraft>;
  prescriptions: Prescription[];
  pharmacyOrders: PharmacyOrder[];
  followUpTasks: FollowUpTask[];
  adherenceChecks: AdherenceCheck[];
  payerStatuses: PayerStatus[];
  aiSummaries: Record<UUID, AiHistorySummary>;
  /** Keyed by appointment id */
  providerVisitDrafts: Record<UUID, ProviderVisitDraft>;
  /** Frozen chart inference snapshot after finalize (LLM agent) */
  chartInferenceByAppointment: Record<UUID, ChartInferenceReview>;
  /** After finalize — patient-safe copy */
  patientFacingSummariesByAppointment: Record<UUID, PatientFacingVisitSummary>;
  pharmacyHandoffsByPrescription: Record<UUID, PharmacyHandoffPayload>;
  /** Newest-first; surfaced on provider as operational timeline */
  workflowTimeline: WorkflowTimelineEntry[];
  /** Shown on patient home — pharmacy readiness / pickup (demo) */
  patientWorkflowNotifications: PatientWorkflowNotification[];
  /** Newest-first — pickup, doses, check-ins */
  patientCareEvents: PatientCareEvent[];
  /** Latest pre-visit agent output per visit (orchestration / briefing) */
  preVisitBriefingsByAppointment: Record<UUID, PreVisitAgentOutput>;
  /** Synthetic insurance products (demo) */
  insurancePlans: InsurancePlan[];
  /** Prior authorization cases — payer workflow */
  priorAuthCases: PriorAuthCase[];
  /** Newest-first agentic / workflow engine log for the bottom dock */
  workflowEngineEvents: WorkflowEngineEvent[];
  /** One persisted agentic finalize per appointment (demo proof / run report). */
  encounterAgentRunsByAppointment: Record<UUID, EncounterAgentRun>;
  /** Recovery control-plane entities (autonomous recovery mode). */
  recoveryCases: RecoveryCase[];
  recoveryActions: RecoveryAction[];
  appealBundles: Record<UUID, AppealBundle>;
  connectorRuns: ConnectorRun[];
  externalSyncCheckpoints: ExternalSyncCheckpoint[];
  slaTimers: SlaTimer[];
}
