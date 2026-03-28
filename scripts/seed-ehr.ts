/**
 * Synthetic EHR seed — 60 patients, relational rows, demo-compatible Jordan cohort.
 * Run: npm run db:push && npm run db:seed
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "path";
import * as schema from "../src/lib/ehr/schema";

const DB = join(process.cwd(), "data", "careloop.sqlite");

const COHORTS = [
  "chronic_care",
  "acute_care",
  "follow_up",
  "refill",
  "missed_adherence",
  "multi_encounter",
] as const;

const GIVEN = [
  "Alex",
  "Riley",
  "Jordan",
  "Casey",
  "Morgan",
  "Taylor",
  "Jamie",
  "Quinn",
  "Avery",
  "Reese",
];
const FAMILY = [
  "Nguyen",
  "Patel",
  "Garcia",
  "Okafor",
  "Silva",
  "Kim",
  "Brown",
  "Davis",
  "Wilson",
  "Martinez",
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n: number, w = 3) {
  return String(n).padStart(w, "0");
}

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
    displayName: "Jordan Ellis",
    familyName: "Ellis",
    givenName: "Jordan",
    dateOfBirth: "1988-04-12",
    sexAtBirth: "M",
    phone: "+1 (555) 010-4421",
    email: "jordan.ellis@email.test",
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
    mrn: "MRN-88902",
    displayName: "Sam Rivera",
    familyName: "Rivera",
    givenName: "Sam",
    dateOfBirth: "1976-11-03",
    sexAtBirth: "F",
    phone: "+1 (555) 010-8891",
    email: "sam.rivera@email.test",
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

  /* ─── Synthetic cohort pat_ehr_003 … pat_ehr_060 ─── */
  const rng = mulberry32(42);
  for (let i = 3; i <= 60; i++) {
    const pid = `pat_ehr_${pad(i)}`;
    const cohort = COHORTS[(i - 3) % COHORTS.length];
    const g = GIVEN[i % GIVEN.length];
    const f = FAMILY[(i * 3) % FAMILY.length];
    const displayName = `${g} ${f}`;
    const yob = 1948 + Math.floor(rng() * 52);
    const mob = 1 + Math.floor(rng() * 12);
    const dob = `${yob}-${pad(mob, 2)}-${pad(1 + Math.floor(rng() * 28), 2)}`;
    const mrn = `MRN-${80000 + i}`;
    const sex = rng() > 0.5 ? "M" : "F";

    await db.insert(schema.patients).values({
      id: pid,
      mrn,
      displayName,
      familyName: f,
      givenName: g,
      dateOfBirth: dob,
      sexAtBirth: sex,
      phone: `+1 (555) ${String(200 + i).padStart(3, "0")}-${String(1000 + i).padStart(4, "0")}`,
      email: `${g.toLowerCase()}.${f.toLowerCase()}@patient.demo`,
      status: "active",
      primaryCareProviderId: provId,
      payerId,
      preferredPharmacyId: pharmId,
      cohortTag: cohort,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.patientDiagnoses).values({
      id: `dx_${pid}_1`,
      patientId: pid,
      code: cohort === "acute_care" ? "J06.9" : "I10",
      description:
        cohort === "acute_care"
          ? "Acute upper respiratory infection, unspecified"
          : "Essential (primary) hypertension",
      codingSystem: "ICD10",
    });

    await db.insert(schema.medications).values({
      id: `med_${pid}_1`,
      patientId: pid,
      name: cohort === "refill" ? "Omeprazole" : "Amlodipine",
      dose: "5 mg",
      route: "oral",
      frequency: "once daily",
      status: "active",
      startDate: "2024-01-01",
      recordedAt: now,
      updatedAt: now,
    });

    if (cohort === "missed_adherence") {
      await db.insert(schema.adherenceChecks).values({
        id: `adh_${pid}_1`,
        patientId: pid,
        medicationId: `med_${pid}_1`,
        checkType: "self_report",
        status: "overdue",
        scheduledFor: new Date(Date.now() - 7 * 86400000).toISOString(),
        priority: "normal",
        ownerRole: "patient",
        nextAction: "Complete medication check-in",
        notes: "Demo: missed window",
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.insert(schema.labs).values({
      id: `lab_${pid}_1`,
      patientId: pid,
      code: "BMP",
      name: "Creatinine",
      value: (0.9 + rng() * 0.4).toFixed(1),
      unit: "mg/dL",
      refRange: "0.7-1.2",
      abnormalFlag: rng() > 0.85,
      collectedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    });

    await db.insert(schema.encounters).values({
      id: `enc_${pid}_last`,
      patientId: pid,
      providerId: provId,
      encounterType: "office",
      status: "finished",
      chiefComplaint: "Routine follow-up",
      notes: "Stable; continue current plan.",
      priority: "normal",
      nextAction: "Schedule next visit",
      ownerRole: "provider",
      startedAt: new Date(Date.now() - 120 * 86400000).toISOString(),
      endedAt: new Date(Date.now() - 120 * 86400000 + 20 * 60000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    if (cohort === "multi_encounter") {
      await db.insert(schema.encounters).values({
        id: `enc_${pid}_2`,
        patientId: pid,
        providerId: provId,
        encounterType: "telehealth",
        status: "finished",
        chiefComplaint: "Medication question",
        notes: "Brief call — no changes.",
        priority: "low",
        nextAction: "None",
        ownerRole: "provider",
        startedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        endedAt: new Date(Date.now() - 30 * 86400000 + 10 * 60000).toISOString(),
        createdAt: now,
        updatedAt: now,
      });
    }

    /* Occasional future appointment */
    if (i % 2 === 0) {
      await db.insert(schema.appointments).values({
        id: `appt_${pid}_1`,
        patientId: pid,
        providerId: provId,
        title: "Follow-up visit",
        scheduledFor: new Date(
          Date.now() + (24 + (i % 72)) * 3600000,
        ).toISOString(),
        status: "scheduled",
        currentStage: "intake",
        priority: "normal",
        nextAction: "Check in",
        ownerRole: "provider",
        createdAt: now,
        updatedAt: now,
      });
    }

    const noteContent =
      "Narrative H&P excerpt: patient reports adherence to medications. Social history reviewed.";
    await db.insert(schema.clinicalNotes).values({
      id: `note_${pid}_1`,
      patientId: pid,
      encounterId: `enc_${pid}_last`,
      noteType: "progress",
      content: noteContent,
      authoredAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    });

    await db.insert(schema.documentChunks).values({
      id: `chunk_${pid}_1`,
      patientId: pid,
      noteId: `note_${pid}_1`,
      chunkIndex: 0,
      content: noteContent.slice(0, 200),
    });
  }

  sqlite.close();
  console.log("EHR seed complete: 60 patients + reference data →", DB);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
