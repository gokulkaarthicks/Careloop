"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { PatientCareEvent } from "@/types/workflow";

/**
 * Derived “current context” for the active patient + appointment.
 * All four portals read the same Zustand snapshot; this hook picks the slice.
 */
export function useCareLoop() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const selectedPatientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const selectedAppointmentId = useCareWorkflowStore((s) => s.selectedAppointmentId);

  return useMemo(() => {
    const patient =
      snapshot.patients.find((p) => p.id === selectedPatientId) ?? null;

    const appointment =
      snapshot.appointments.find((a) => a.id === selectedAppointmentId) ??
      snapshot.appointments
        .filter((a) => a.patientId === selectedPatientId)
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime(),
        )[0] ??
      null;

    const encounterDraft = appointment
      ? snapshot.providerVisitDrafts[appointment.id] ?? null
      : null;

    const prescription = appointment
      ? snapshot.prescriptions.find((r) => r.appointmentId === appointment.id) ??
        null
      : snapshot.prescriptions.find((r) => r.patientId === selectedPatientId) ?? null;

    const pharmacyOrder = prescription
      ? snapshot.pharmacyOrders.find((o) => o.prescriptionId === prescription.id) ??
        null
      : null;

    const followUpTasks = snapshot.followUpTasks.filter(
      (t) => t.patientId === selectedPatientId,
    );

    const patientResponses: PatientCareEvent[] = (
      snapshot.patientCareEvents ?? []
    ).filter((e) => e.patientId === selectedPatientId);

    const payerStatus =
      snapshot.payerStatuses.find(
        (ps) =>
          ps.patientId === selectedPatientId &&
          (!appointment || ps.appointmentId === appointment.id),
      ) ?? null;

    return {
      patient,
      appointment,
      encounterDraft,
      prescription,
      pharmacyOrder,
      followUpTasks,
      patientResponses,
      payerStatus,
      selectedPatientId,
      selectedAppointmentId: selectedAppointmentId ?? appointment?.id ?? null,
    };
  }, [snapshot, selectedPatientId, selectedAppointmentId]);
}

/** Stable action bundle for CareLoop (same store — all portals stay in sync). */
export function useCareLoopActions() {
  return useCareWorkflowStore(
    useShallow((s) => ({
      selectPatient: s.selectPatient,
      setSelectedPatientId: s.setSelectedPatientId,
      setSelectedAppointmentId: s.setSelectedAppointmentId,
      generateChartSummary: s.generateChartSummary,
      saveEncounter: s.saveEncounter,
      saveProviderVisitDraft: s.saveProviderVisitDraft,
      createPrescription: s.createPrescription,
      finalizeEncounter: s.finalizeEncounter,
      markPharmacyPickup: s.markPharmacyPickup,
      pharmacyMarkReady: s.pharmacyMarkReady,
      pharmacyMarkPickedUp: s.pharmacyMarkPickedUp,
      confirmAdherence: s.confirmAdherence,
      patientCompleteAdherenceCheck: s.patientCompleteAdherenceCheck,
      patientLogMedicationTaken: s.patientLogMedicationTaken,
      updatePayerCompletion: s.updatePayerCompletion,
      payerMarkComplete: s.payerMarkComplete,
      resetDemo: s.resetDemo,
    })),
  );
}
