import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** Reference: billing / plan */
export const payers = sqliteTable("payers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  planType: text("plan_type").notNull(),
});

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  npi: text("npi"),
});

export const pharmacies = sqliteTable("pharmacies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  addressLine: text("address_line").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
});

/**
 * Synthetic patient — US-style MRN, PCP, payer, preferred pharmacy.
 * `cohortTag` encodes demo archetype (chronic_care, acute, etc.).
 */
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  mrn: text("mrn").notNull().unique(),
  displayName: text("display_name").notNull(),
  familyName: text("family_name").notNull(),
  givenName: text("given_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  sexAtBirth: text("sex_at_birth").notNull(), // M | F | U
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  primaryCareProviderId: text("pcp_provider_id").references(() => providers.id),
  payerId: text("payer_id").references(() => payers.id),
  preferredPharmacyId: text("preferred_pharmacy_id").references(
    () => pharmacies.id,
  ),
  externalEhrPatientId: text("external_ehr_patient_id"),
  cohortTag: text("cohort_tag"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const allergies = sqliteTable("allergies", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  substance: text("substance").notNull(),
  severity: text("severity").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  reaction: text("reaction"),
  notes: text("notes"),
  recordedAt: text("recorded_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const medications = sqliteTable("medications", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dose: text("dose").notNull(),
  route: text("route"),
  frequency: text("frequency").notNull(),
  status: text("status").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  notes: text("notes"),
  recordedAt: text("recorded_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const patientDiagnoses = sqliteTable("patient_diagnoses", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  description: text("description").notNull(),
  codingSystem: text("coding_system").notNull().default("ICD10"),
});

export const labs = sqliteTable("labs", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  unit: text("unit").notNull(),
  refRange: text("ref_range"),
  abnormalFlag: integer("abnormal_flag", { mode: "boolean" }).notNull().default(false),
  collectedAt: text("collected_at").notNull(),
});

export const encounters = sqliteTable("encounters", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  providerId: text("provider_id").references(() => providers.id),
  appointmentId: text("appointment_id"),
  encounterType: text("encounter_type").notNull(),
  status: text("status").notNull(),
  chiefComplaint: text("chief_complaint"),
  notes: text("notes"),
  priority: text("priority").notNull(),
  nextAction: text("next_action").notNull(),
  ownerRole: text("owner_role").notNull(),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  providerId: text("provider_id").references(() => providers.id),
  title: text("title").notNull(),
  scheduledFor: text("scheduled_for").notNull(),
  status: text("status").notNull(),
  currentStage: text("current_stage").notNull(),
  priority: text("priority").notNull(),
  nextAction: text("next_action").notNull(),
  ownerRole: text("owner_role").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const clinicalNotes = sqliteTable("clinical_notes", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  encounterId: text("encounter_id"),
  noteType: text("note_type").notNull(),
  content: text("content").notNull(),
  authoredAt: text("authored_at").notNull(),
});

/** Optional semantic layer for long text — not used for structured truth */
export const documentChunks = sqliteTable("document_chunks", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  noteId: text("note_id").references(() => clinicalNotes.id, {
    onDelete: "cascade",
  }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
});

export const prescriptions = sqliteTable("prescriptions", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  prescriberId: text("prescriber_id").references(() => providers.id),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  notes: text("notes"),
  nextAction: text("next_action").notNull(),
  ownerRole: text("owner_role").notNull(),
  pharmacyId: text("pharmacy_id"),
  pharmacyOrderId: text("pharmacy_order_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const prescriptionLines = sqliteTable("prescription_lines", {
  id: text("id").primaryKey(),
  prescriptionId: text("prescription_id")
    .notNull()
    .references(() => prescriptions.id, { onDelete: "cascade" }),
  drugName: text("drug_name").notNull(),
  strength: text("strength").notNull(),
  quantity: text("quantity").notNull(),
  refills: integer("refills").notNull(),
  sig: text("sig").notNull(),
});

export const pharmacyOrders = sqliteTable("pharmacy_orders", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  prescriptionId: text("prescription_id").notNull(),
  pharmacyId: text("pharmacy_id").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  notes: text("notes"),
  nextAction: text("next_action").notNull(),
  ownerRole: text("owner_role").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const followupTasks = sqliteTable("followup_tasks", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id"),
  prescriptionId: text("prescription_id"),
  pharmacyOrderId: text("pharmacy_order_id"),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(),
  status: text("status").notNull(),
  dueAt: text("due_at").notNull(),
  priority: text("priority").notNull(),
  ownerRole: text("owner_role").notNull(),
  nextAction: text("next_action").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const adherenceChecks = sqliteTable("adherence_checks", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  medicationId: text("medication_id"),
  prescriptionId: text("prescription_id"),
  checkType: text("check_type").notNull(),
  status: text("status").notNull(),
  scheduledFor: text("scheduled_for").notNull(),
  priority: text("priority").notNull(),
  ownerRole: text("owner_role").notNull(),
  nextAction: text("next_action").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payerStatus = sqliteTable("payer_status", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  payerId: text("payer_id").notNull(),
  appointmentId: text("appointment_id"),
  encounterId: text("encounter_id"),
  claimStatus: text("claim_status").notNull(),
  priority: text("priority").notNull(),
  ownerRole: text("owner_role").notNull(),
  nextAction: text("next_action").notNull(),
  notes: text("notes"),
  closureCompletionScore: integer("closure_completion_score"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chartSummaryCache = sqliteTable("chart_summary_cache", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id"),
  payloadJson: text("payload_json").notNull(),
  source: text("source").notNull(),
  updatedAt: text("updated_at").notNull(),
});
