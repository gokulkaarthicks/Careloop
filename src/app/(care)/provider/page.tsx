"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CarePageHeader } from "@/components/care-loop/care-page-header";
import { EncounterWorkspace } from "@/components/care-loop/encounter-workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  buildPreVisitAgentInput,
  runPreVisitAgent,
} from "@/lib/agents/pre-visit-agent";
import { runAgenticEncounterPipeline } from "@/lib/agentic/encounter-pipeline";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { PrescriptionLine } from "@/types/workflow";
import { AlertTriangle, Sparkles } from "lucide-react";

export default function ProviderPage() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const patientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const openAppointment = useCareWorkflowStore((s) => s.openAppointment);
  const lastChartSummaryMeta = useCareWorkflowStore(
    (s) => s.lastChartSummaryMeta,
  );
  const saveProviderVisitDraft = useCareWorkflowStore(
    (s) => s.saveProviderVisitDraft,
  );
  const finalizeEncounter = useCareWorkflowStore((s) => s.finalizeEncounter);
  const setAgentActivity = useCareWorkflowStore((s) => s.setAgentActivity);
  const setWorkflowDockPrimaryAction = useCareWorkflowStore(
    (s) => s.setWorkflowDockPrimaryAction,
  );
  const pushWorkflowTimelineEntry = useCareWorkflowStore(
    (s) => s.pushWorkflowTimelineEntry,
  );
  const pushAgenticPatientNotification = useCareWorkflowStore(
    (s) => s.pushAgenticPatientNotification,
  );
  const ehrVisitBriefingLines = useCareWorkflowStore(
    (s) => s.ehrVisitBriefingLines[patientId],
  );
  const demoEncounterUnlockAt = useCareWorkflowStore(
    (s) => s.demoEncounterUnlockAt,
  );
  const clearDemoEncounterSchedule = useCareWorkflowStore(
    (s) => s.clearDemoEncounterSchedule,
  );

  const patient = snapshot.patients.find((p) => p.id === patientId);
  const clinical = snapshot.clinicalByPatientId[patientId];
  const provider = snapshot.providers[0];
  const pharmacy = snapshot.pharmacies[0];

  const chartSummaryNotice =
    lastChartSummaryMeta?.patientId === patientId
      ? lastChartSummaryMeta
      : null;

  const appointments = useMemo(
    () =>
      snapshot.appointments
        .filter((a) => a.patientId === patientId)
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime(),
        ),
    [snapshot.appointments, patientId],
  );

  const appt = appointments[0];
  const rx = snapshot.prescriptions.find(
    (p) => p.patientId === patientId && p.appointmentId === appt?.id,
  );

  const priorEncounters = useMemo(
    () =>
      snapshot.encounters
        .filter((e) => e.patientId === patientId)
        .sort(
          (a, b) =>
            (b.endedAt ?? b.createdAt).localeCompare(
              a.endedAt ?? a.createdAt,
            ),
        ),
    [snapshot.encounters, patientId],
  );

  const preVisit = useMemo(() => {
    if (!patient) return null;
    const appointmentReason =
      appt?.title ?? "Primary care follow-up (no upcoming slot in cohort)";
    const input = buildPreVisitAgentInput({
      patientId: patient.id,
      displayName: patient.displayName,
      appointmentReason,
      clinical,
      priorEncounters,
    });
    return runPreVisitAgent(input);
  }, [patient, appt?.title, clinical, priorEncounters]);

  const [soapNote, setSoapNote] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [rxLines, setRxLines] = useState<PrescriptionLine[]>([]);
  const [agenticFinalizing, setAgenticFinalizing] = useState(false);

  const draft = appt ? snapshot.providerVisitDrafts[appt.id] : undefined;
  const visitFinalized =
    !!draft?.finalizedAt || (rx != null && rx.status !== "draft");

  const apptId = appt?.id;

  useEffect(() => {
    if (!rx) {
      setRxLines([]);
      return;
    }
    // Chat-first: do not hydrate seed/demo draft lines; copy only after finalize updates rx.
    if (rx.status !== "draft") {
      setRxLines(rx.lines.map((l) => ({ ...l })));
    }
  }, [rx]);

  const loadDraftFromStore = useCallback(() => {
    if (!apptId) return;
    const d =
      useCareWorkflowStore.getState().snapshot.providerVisitDrafts[apptId];
    if (d?.finalizedAt) {
      setSoapNote(d.soapNote);
      setTreatmentPlan(d.treatmentPlan);
      return;
    }
    if (d?.soapNote || d?.treatmentPlan) {
      setSoapNote(d.soapNote ?? "");
      setTreatmentPlan(d.treatmentPlan ?? "");
    } else {
      setSoapNote("");
      setTreatmentPlan("");
    }
  }, [apptId]);

  useEffect(() => {
    loadDraftFromStore();
  }, [apptId, patientId, loadDraftFromStore]);

  useEffect(() => {
    if (useCareWorkflowStore.persist.hasHydrated()) {
      loadDraftFromStore();
    }
    const unsub = useCareWorkflowStore.persist.onFinishHydration(() => {
      loadDraftFromStore();
    });
    return unsub;
  }, [loadDraftFromStore]);

  useEffect(() => {
    if (!appt?.id || visitFinalized) return;
    const t = setTimeout(() => {
      saveProviderVisitDraft(appt.id, { soapNote, treatmentPlan });
    }, 650);
    return () => clearTimeout(t);
  }, [
    soapNote,
    treatmentPlan,
    appt?.id,
    visitFinalized,
    saveProviderVisitDraft,
  ]);

  useEffect(() => {
    if (!demoEncounterUnlockAt || !appt?.id) return;
    const target = new Date(demoEncounterUnlockAt).getTime();
    const tick = () => {
      if (Date.now() >= target) {
        openAppointment(appt.id);
        clearDemoEncounterSchedule();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [
    demoEncounterUnlockAt,
    appt?.id,
    openAppointment,
    clearDemoEncounterSchedule,
  ]);

  const handleFinalize = useCallback(async () => {
    if (!appt || !provider || !pharmacy || !patient || visitFinalized) return;
    if (!soapNote.trim() || !treatmentPlan.trim()) return;
    if (!rxLines.length || rxLines.some((l) => !l.drugName.trim())) return;
    if (agenticFinalizing) return;

    setAgenticFinalizing(true);
    const completed: string[] = [];
    setAgentActivity({
      visible: true,
      status: "running",
      headline: "Orchestrator",
      subline: "Starting multi-agent encounter pipeline…",
      completedStepLabels: [],
    });

    try {
      const result = await runAgenticEncounterPipeline(
        {
          patientDisplayName: patient.displayName,
          patientId,
          appointmentId: appt.id,
          clinical: clinical ?? null,
          prescriptionLines: rxLines,
          treatmentPlan,
          pharmacyId: pharmacy.id,
          insurancePlanId: patient.insurancePlanId,
          preferredPharmacyId: patient.preferredPharmacyId,
          coverageDemoTag: patient.coverageDemoTag,
        },
        (step) => {
          completed.push(`${step.agent}`);
          setAgentActivity({
            visible: true,
            status: "running",
            headline: step.agent,
            subline: step.action,
            completedStepLabels: [...completed],
          });
        },
      );

      const mergedSoap = `${soapNote.trim()}\n${result.soapAddendum}`;

      finalizeEncounter({
        appointmentId: appt.id,
        patientId,
        providerId: provider.id,
        pharmacyId: pharmacy.id,
        soapNote: mergedSoap,
        treatmentPlan,
        prescriptionLines: rxLines,
        coverage: result.coverage,
      });

      for (const e of result.timelineEntries) {
        pushWorkflowTimelineEntry({
          title: e.title,
          detail: e.detail,
          patientId,
          appointmentId: appt.id,
        });
      }

      if (result.patientNotification) {
        pushAgenticPatientNotification(
          patientId,
          result.patientNotification.title,
          result.patientNotification.body,
        );
      }

      setSoapNote(mergedSoap);

      setAgentActivity({
        visible: true,
        status: "success",
        headline: "Encounter agents complete",
        subline: result.coverage.holdForPriorAuth ?
          "PA hold — payer must review before pharmacy release."
        : result.coverage.anyStepTherapyBlock ?
          "Step therapy gate — documentation required before transmit."
        : "Pharmacy path cleared — e-Rx released under demo rules.",
        completedStepLabels: completed,
      });
    } catch (err) {
      setAgentActivity({
        visible: true,
        status: "error",
        headline: "Agentic pipeline failed",
        subline: "Encounter was not finalized.",
        completedStepLabels: [],
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAgenticFinalizing(false);
    }
  }, [
    appt,
    provider,
    pharmacy,
    patient,
    visitFinalized,
    soapNote,
    treatmentPlan,
    rxLines,
    agenticFinalizing,
    patientId,
    setAgentActivity,
    finalizeEncounter,
    pushWorkflowTimelineEntry,
    pushAgenticPatientNotification,
    setSoapNote,
    clinical,
  ]);

  const canFinalize =
    !!appt &&
    appt.status !== "scheduled" &&
    soapNote.trim().length > 20 &&
    treatmentPlan.trim().length > 10 &&
    rxLines.length > 0 &&
    rxLines.every((l) => l.drugName.trim().length > 0) &&
    !visitFinalized &&
    !agenticFinalizing;

  const canEditDocs = !visitFinalized;

  useEffect(() => {
    setWorkflowDockPrimaryAction({
      label: "Finalize encounter",
      disabled: !canFinalize,
      loading: agenticFinalizing,
      onClick: () => void handleFinalize(),
    });
    return () => setWorkflowDockPrimaryAction(null);
  }, [
    canFinalize,
    agenticFinalizing,
    setWorkflowDockPrimaryAction,
    handleFinalize,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-4">
      <CarePageHeader
        eyebrow="Provider"
        title="Ambulatory encounter"
        description="Chart context, chat-driven docs, e-prescribe — Finalize runs a multi-agent pipeline (PA rules, routing, SOAP addendum) with a status overlay."
      >
        {appt && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" className="text-[0.65rem] font-medium capitalize">
              {appt.priority}
            </Badge>
            <Badge variant="outline" className="text-[0.65rem] font-normal">
              {appt.ownerRole}
            </Badge>
          </div>
        )}
      </CarePageHeader>

      {!appt && (
        <Alert>
          <AlertTitle>No upcoming encounter in workflow</AlertTitle>
          <AlertDescription className="text-xs">
            Pick a patient with a future appointment, or use Dashboard
            &quot;Schedule in 30s&quot; to open the visit.
          </AlertDescription>
        </Alert>
      )}

      {demoEncounterUnlockAt && (
        <Alert>
          <AlertTitle>Demo encounter scheduled</AlertTitle>
          <AlertDescription className="text-xs">
            Visit opens at{" "}
            {new Date(demoEncounterUnlockAt).toLocaleTimeString()}.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertTitle>Agentic finalize (demo)</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          When you tap <strong>Finalize encounter</strong>, agents load chart context, apply{" "}
          <strong>mock payer / PA rules</strong> (e.g. specialty meds → PA; standard meds →
          pharmacy), draft a <strong>SOAP addendum</strong>, update the{" "}
          <strong>workflow timeline</strong>, and send a <strong>patient inbox</strong> notice.
          Try <code className="rounded bg-muted px-1">Ozempic</code> or{" "}
          <code className="rounded bg-muted px-1">Humira</code> in a line to see PA routing, or
          add <code className="rounded bg-muted px-1">MRI</code> in the treatment plan.
        </AlertDescription>
      </Alert>

      {chartSummaryNotice?.error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Chart summary request failed</AlertTitle>
          <AlertDescription className="text-xs">
            {chartSummaryNotice.error}
          </AlertDescription>
        </Alert>
      )}

      {chartSummaryNotice &&
        !chartSummaryNotice.error &&
        (chartSummaryNotice.warning || chartSummaryNotice.degraded) && (
          <Alert>
            <Sparkles className="size-4" />
            <AlertTitle>AI summary notice</AlertTitle>
            <AlertDescription className="text-xs">
              {chartSummaryNotice.warning ??
                "Using offline mock data for this step."}
            </AlertDescription>
          </Alert>
        )}

      {patient && (
        <EncounterWorkspace
          patientId={patientId}
          patient={patient}
          clinical={clinical ?? null}
          briefingLines={ehrVisitBriefingLines ?? null}
          appointments={appointments}
          activeAppointment={appt ?? null}
          preVisit={preVisit}
          disabled={!clinical}
          soapNote={soapNote}
          onSoapChange={setSoapNote}
          treatmentPlan={treatmentPlan}
          onPlanChange={setTreatmentPlan}
          rxLines={rxLines}
          onRxLinesChange={setRxLines}
          visitFinalized={visitFinalized}
          canEditDocs={canEditDocs}
          onStartEncounter={
            appt && appt.status === "scheduled"
              ? () => openAppointment(appt.id)
              : undefined
          }
          canStartEncounter={!!appt && appt.status === "scheduled"}
        />
      )}

      {appt && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Next action: </span>
          {appt.nextAction}
        </p>
      )}
    </div>
  );
}
