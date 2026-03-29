/**
 * Synthetic EHR seed — two fully relational demo patients + reference data; the app
 * merges five bundled `SEED` patients in the UI directory. Run: `npm run db:push && npm run db:seed`.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "path";
import * as schema from "../src/lib/ehr/schema";

const DB = join(process.cwd(), "data", "careloop.sqlite");

function clearDb(sqlite: Database.Database) {
  sqlite.exec("PRAGMA foreign_keys = OFF");
  const tables = [
    "chart_summary_cache",
    "document_chunks",
    "adherence_checks",
    "followup_tasks",
    "payer_status",
    "pharmacy_orders",
    "prescription_lines",
    "prescriptions",
    "clinical_notes",
    "appointments",
    "encounters",
    "labs",
    "patient_diagnoses",
    "medications",
    "allergies",
    "patients",
    "pharmacies",
    "providers",
    "payers",
  ];
  for (const t of tables) {
    sqlite.prepare(`DELETE FROM ${t}`).run();
  }
  sqlite.exec("PRAGMA foreign_keys = ON");
}

async function main() {
  const sqlite = new Database(DB);
  clearDb(sqlite);
  const db = drizzle(sqlite, { schema });

  const now = new Date().toISOString();
  const payerId = "payer_seed_001";
  const provId = "prov_seed_001";
  const pharmId = "pharm_seed_001";

  await db.insert(schema.payers).values({
    id: payerId,
    name: "Summit Health Plan",
    planType: "PPO",
  });
  await db.insert(schema.providers).values({
    id: provId,
    name: "Dr. Avery Chen",
    role: "Primary Care",
    npi: "1234567890",
  });
  await db.insert(schema.pharmacies).values({
    id: pharmId,
    name: "Harborview Pharmacy",
    addressLine: "400 Bay St",
    city: "San Francisco",
    state: "CA",
    zip: "94107",
  });

  const jordanId = "pat_seed_001";
  const samId = "pat_seed_002";

  /* ─── Jordan (full demo — matches SEED_DEMO_ROUTE) ─── */
  await db.insert(schema.patients).values({
    id: jordanId,
    mrn: "MRN-77821",
    displayName: "Thaddeus Wainwright",
    familyName: "Wainwright",
    givenName: "Thaddeus",
    dateOfBirth: "1988-04-12",
    sexAtBirth: "M",
    phone: "+1 (555) 010-4421",
    email: "thaddeus.wainwright@email.test",
    status: "active",
    notes: "Prefers afternoon visits; pharmacy Harborview.",
    primaryCareProviderId: provId,
    payerId,
    preferredPharmacyId: pharmId,
    externalEhrPatientId: "EHR-DEMO-001",
    cohortTag: "chronic_care",
    createdAt: "2024-01-08T10:00:00Z",
    updatedAt: now,
  });

  await db.insert(schema.allergies).values({
    id: "all_j_001",
    patientId: jordanId,
    substance: "Sulfonamide antibiotics",
    severity: "moderate",
    type: "allergy",
    status: "active",
    reaction: "Rash, pruritus (documented 2019)",
    notes: "Avoid sulfa-based diuretics",
    recordedAt: "2019-06-15T14:00:00Z",
    updatedAt: now,
  });

  await db.insert(schema.medications).values([
    {
      id: "med_j_001",
      patientId: jordanId,
      name: "Lisinopril",
      dose: "10 mg",
      route: "oral",
      frequency: "once daily",
      status: "active",
      startDate: "2024-06-01",
      notes: "Hypertension",
      recordedAt: "2024-06-01T16:00:00Z",
      updatedAt: now,
    },
    {
      id: "med_j_002",
      patientId: jordanId,
      name: "Metformin",
      dose: "500 mg",
      route: "oral",
      frequency: "twice daily with meals",
      status: "active",
      startDate: "2023-01-15",
      notes: "Type 2 DM",
      recordedAt: "2023-01-15T11:00:00Z",
      updatedAt: now,
    },
  ]);

  await db.insert(schema.patientDiagnoses).values([
    {
      id: "dx_j_1",
      patientId: jordanId,
      code: "I10",
      description: "Essential (primary) hypertension",
      codingSystem: "ICD10",
    },
    {
      id: "dx_j_2",
      patientId: jordanId,
      code: "E11.9",
      description: "Type 2 diabetes mellitus without complications",
      codingSystem: "ICD10",
    },
  ]);

  await db.insert(schema.labs).values([
    {
      id: "lab_j_001",
      patientId: jordanId,
      code: "A1C",
      name: "Hemoglobin A1c",
      value: "7.1",
      unit: "%",
      refRange: "<7.0 goal",
      abnormalFlag: true,
      collectedAt: "2026-02-12T08:00:00Z",
    },
    {
      id: "lab_j_002",
      patientId: jordanId,
      code: "LDL",
      name: "LDL Cholesterol",
      value: "112",
      unit: "mg/dL",
      refRange: "<100",
      abnormalFlag: true,
      collectedAt: "2026-02-12T08:00:00Z",
    },
  ]);

  await db.insert(schema.encounters).values([
    {
      id: "enc_j_20260210",
      patientId: jordanId,
      providerId: provId,
      encounterType: "office",
      status: "finished",
      chiefComplaint: "Hypertension and diabetes follow-up",
      notes:
        "BP 138/86; discussed home monitoring. Continue lisinopril and metformin.",
      priority: "normal",
      nextAction: "None — await labs",
      ownerRole: "provider",
      startedAt: "2026-02-10T14:00:00Z",
      endedAt: "2026-02-10T14:35:00Z",
      createdAt: "2026-02-10T13:55:00Z",
      updatedAt: "2026-02-10T14:40:00Z",
    },
    {
      id: "enc_j_20251105",
      patientId: jordanId,
      providerId: provId,
      encounterType: "telehealth",
      status: "finished",
      chiefComplaint: "Medication refill and foot check",
      notes: "Brief video visit; no acute issues.",
      priority: "low",
      nextAction: "Schedule in-person within 90 days",
      ownerRole: "provider",
      startedAt: "2025-11-05T19:00:00Z",
      endedAt: "2025-11-05T19:18:00Z",
      createdAt: "2025-11-05T18:50:00Z",
      updatedAt: "2025-11-05T19:20:00Z",
    },
  ]);

  const upcomingApptId = "appt_seed_001";
  await db.insert(schema.appointments).values({
    id: upcomingApptId,
    patientId: jordanId,
    providerId: provId,
    title: "Chronic disease follow-up",
    scheduledFor: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
    currentStage: "intake",
    priority: "normal",
    nextAction: "Provider to open visit and run chart briefing",
    ownerRole: "provider",
    notes: "Focus: BP trend, A1c review, medication reconciliation.",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.prescriptions).values({
    id: "rx_seed_001",
    appointmentId: upcomingApptId,
    patientId: jordanId,
    prescriberId: provId,
    status: "draft",
    priority: "normal",
    notes: "Verify sulfa allergy before class change.",
    nextAction: "Provider to sign and transmit to pharmacy",
    ownerRole: "provider",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.prescriptionLines).values({
    id: "rxl_j_001",
    prescriptionId: "rx_seed_001",
    drugName: "Lisinopril",
    strength: "10 mg",
    quantity: "90",
    refills: 3,
    sig: "Take 1 tablet by mouth daily",
  });

  await db.insert(schema.pharmacyOrders).values({
    id: "phord_seed_001",
    patientId: jordanId,
    prescriptionId: "rx_seed_001",
    pharmacyId: pharmId,
    status: "queued",
    priority: "normal",
    notes: "Surescripts stub",
    nextAction: "Await prescriber e-send",
    ownerRole: "pharmacy",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.followupTasks).values({
    id: "fut_j_pickup_001",
    patientId: jordanId,
    appointmentId: upcomingApptId,
    prescriptionId: "rx_seed_001",
    pharmacyOrderId: "phord_seed_001",
    title: "Pick up lisinopril at Harborview Pharmacy",
    description: "SMS when Rx is ready",
    taskType: "pharmacy_pickup",
    status: "scheduled",
    dueAt: new Date(Date.now() + 48 * 3600000).toISOString(),
    priority: "normal",
    ownerRole: "patient",
    nextAction: "Patient to collect when status is Ready",
    notes: "Demo tie-out",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.adherenceChecks).values({
    id: "adh_j_bp_001",
    patientId: jordanId,
    medicationId: "med_j_001",
    prescriptionId: "rx_seed_001",
    checkType: "self_report",
    status: "pending",
    scheduledFor: new Date(Date.now() + 24 * 3600000).toISOString(),
    priority: "normal",
    ownerRole: "patient",
    nextAction: "Log 7-day AM home BP average",
    notes: "Post-visit HTN management",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.payerStatus).values({
    id: "paystat_j_001",
    patientId: jordanId,
    payerId,
    appointmentId: upcomingApptId,
    encounterId: "enc_j_20260210",
    claimStatus: "pending",
    priority: "normal",
    ownerRole: "payer",
    nextAction: "Release payment after encounter closes",
    notes: "Professional + pharmacy stub",
    closureCompletionScore: 22,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.clinicalNotes).values({
    id: "note_j_001",
    patientId: jordanId,
    encounterId: "enc_j_20260210",
    noteType: "discharge_summary",
    content:
      "Patient counseled on low-sodium diet and home BP monitoring. Return PRN for hypoglycemia symptoms.",
    authoredAt: "2026-02-10T14:30:00Z",
  });

  /* ─── Sam — upcoming appointment (fixes empty schedule in UI) ─── */
  await db.insert(schema.patients).values({
    id: samId,
    mrn: "MRN-441902",
    displayName: "Amara Okafor",
    familyName: "Okafor",
    givenName: "Amara",
    dateOfBirth: "1976-11-03",
    sexAtBirth: "F",
    phone: "+1 (555) 010-8891",
    email: "amara.okafor@email.test",
    status: "active",
    primaryCareProviderId: provId,
    payerId,
    preferredPharmacyId: pharmId,
    cohortTag: "follow_up",
    createdAt: "2024-03-12T12:00:00Z",
    updatedAt: now,
  });

  await db.insert(schema.medications).values({
    id: "med_s_001",
    patientId: samId,
    name: "Atorvastatin",
    dose: "20 mg",
    route: "oral",
    frequency: "daily at bedtime",
    status: "active",
    startDate: "2025-08-01",
    recordedAt: "2025-08-01T10:00:00Z",
    updatedAt: now,
  });

  await db.insert(schema.patientDiagnoses).values({
    id: "dx_s_1",
    patientId: samId,
    code: "E78.5",
    description: "Hyperlipidemia, unspecified",
    codingSystem: "ICD10",
  });

  await db.insert(schema.labs).values({
    id: "lab_s_001",
    patientId: samId,
    code: "CMP",
    name: "Basic metabolic panel — Glucose",
    value: "102",
    unit: "mg/dL",
    refRange: "65-99",
    abnormalFlag: true,
    collectedAt: "2026-03-18T09:30:00Z",
  });

  await db.insert(schema.encounters).values({
    id: "enc_s_20251202",
    patientId: samId,
    providerId: provId,
    encounterType: "office",
    status: "finished",
    chiefComplaint: "Lipid panel review",
    notes: "Continue statin; lifestyle counseling.",
    priority: "normal",
    nextAction: "Annual follow-up",
    ownerRole: "provider",
    startedAt: "2025-12-02T10:00:00Z",
    endedAt: "2025-12-02T10:25:00Z",
    createdAt: "2025-12-02T09:50:00Z",
    updatedAt: "2025-12-02T10:30:00Z",
  });

  const samAppt = "appt_sam_001";
  await db.insert(schema.appointments).values({
    id: samAppt,
    patientId: samId,
    providerId: provId,
    title: "Primary care follow-up",
    scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
    currentStage: "intake",
    priority: "normal",
    nextAction: "Open encounter — chart briefing",
    ownerRole: "provider",
    notes: "Hyperlipidemia follow-up; vitals review.",
    createdAt: now,
    updatedAt: now,
  });

  sqlite.close();
  console.log(
    "EHR seed complete: 2 demo patients (pat_seed_001, pat_seed_002) + reference data →",
    DB,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
