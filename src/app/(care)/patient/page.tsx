"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runRefillEligibilityAgent } from "@/lib/orchestration/refill-agent";
import { CarePageHeader } from "@/components/care-loop/care-page-header";
import { PanelCard } from "@/components/care-loop/panel-card";
import { WorkflowStateCard } from "@/components/care-loop/workflow-state-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import {
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  Loader2,
  MessageCircle,
  Pill,
  Sparkles,
} from "lucide-react";

export default function PatientPage() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const patientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const markFollowUpTaskComplete = useCareWorkflowStore(
    (s) => s.markFollowUpTaskComplete,
  );
  const patientCompleteAdherenceCheck = useCareWorkflowStore(
    (s) => s.patientCompleteAdherenceCheck,
  );

  const patient = snapshot.patients.find((p) => p.id === patientId);
  const tasks = snapshot.followUpTasks.filter((t) => t.patientId === patientId);
  const rxList = snapshot.prescriptions.filter((p) => p.patientId === patientId);
  const checks = snapshot.adherenceChecks.filter((c) => c.patientId === patientId);
  const careEvents = (snapshot.patientCareEvents ?? []).filter(
    (e) => e.patientId === patientId,
  );
  const inbox = (snapshot.patientWorkflowNotifications ?? []).filter(
    (n) => n.patientId === patientId,
  );
  const latestEvent = (snapshot.workflowEngineEvents ?? []).find(
    (e) => e.patientId === patientId,
  );

  const refillAgentForPatient = useRef<string | null>(null);
  useEffect(() => {
    if (!patientId) return;
    if (refillAgentForPatient.current === patientId) return;
    refillAgentForPatient.current = patientId;
    runRefillEligibilityAgent(patientId);
  }, [patientId]);

  const visitSummary = useMemo(() => {
    const ap = snapshot.appointments.find((a) => a.patientId === patientId);
    if (!ap) return undefined;
    return snapshot.patientFacingSummariesByAppointment[ap.id];
  }, [snapshot.appointments, snapshot.patientFacingSummariesByAppointment, patientId]);

  const primaryRx = rxList[0];

  const [assistQ, setAssistQ] = useState("");
  const [assistReply, setAssistReply] = useState<string | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistErr, setAssistErr] = useState<string | null>(null);

  const clinicalForPatient =
    patientId ? (snapshot.clinicalByPatientId[patientId] ?? null) : null;
  const apptForPatient = snapshot.appointments.find(
    (a) => a.patientId === patientId,
  );
  const prescriptionLinesFlat = rxList.flatMap((p) => p.lines);
  const carePlan = patientId ? snapshot.carePlans[patientId] : undefined;
  const treatmentPlanText = useMemo(() => {
    if (carePlan) {
      return `Goals: ${carePlan.goals.join("; ")}\nInterventions: ${carePlan.interventions.join("; ")}`;
    }
    if (visitSummary) {
      return `${visitSummary.title}\n${visitSummary.bullets.join("\n")}`;
    }
    return "";
  }, [carePlan, visitSummary]);

  const upcomingReminders = useMemo(() => {
    const rows: { id: string; when: string; label: string; kind: string }[] =
      [];
    for (const t of tasks) {
      if (t.status === "completed") continue;
      rows.push({
        id: `task-${t.id}`,
        when: t.dueAt,
        label: t.title,
        kind: "To-do",
      });
    }
    for (const c of checks) {
      if (c.status !== "pending") continue;
      rows.push({
        id: `adh-${c.id}`,
        when: c.scheduledFor,
        label: "Quick check-in about your medications",
        kind: "Reminder",
      });
    }
    return rows.sort(
      (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime(),
    );
  }, [tasks, checks]);

  const recentActivity = useMemo(() => {
    return [...careEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  }, [careEvents]);

  const firstName = patient?.displayName?.split(" ")[0] ?? "there";

  async function submitPatientAssist() {
    if (!assistQ.trim() || !patient || !patientId) return;
    setAssistLoading(true);
    setAssistErr(null);
    try {
      const res = await fetch("/api/ai/patient-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          patientDisplayName: patient.displayName,
          appointmentId: apptForPatient?.id ?? "patient-chat",
          message: assistQ.trim(),
          prescriptionLines: prescriptionLinesFlat,
          clinical: clinicalForPatient,
          treatmentPlan: treatmentPlanText,
          priorAuthCases: snapshot.priorAuthCases.filter(
            (c) => c.patientId === patientId,
          ),
          pharmacyId: patient.preferredPharmacyId ?? "",
          insurancePlanId: patient.insurancePlanId,
          preferredPharmacyId: patient.preferredPharmacyId,
        }),
      });
      if (res.status === 503) {
        setAssistErr(
          "Assistant is unavailable in this demo (configure XAI_API_KEY on the server).",
        );
        return;
      }
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setAssistReply(data.reply ?? "");
      setAssistQ("");
    } catch (e) {
      setAssistErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAssistLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16 pt-1">
      <CarePageHeader
        eyebrow="Patient"
        title={`Hi, ${firstName}`}
        description="Short nudges tied to your visit - actions here sync with your care team in this demo."
        className="border-b-0 pb-2"
      />

      {patient ?
        <WorkflowStateCard
          title="Your care loop status"
          currentState={primaryRx ? `Medication: ${primaryRx.status.replaceAll("_", " ")}` : "No active prescription yet"}
          nextAction={primaryRx?.nextAction ?? "Wait for provider/pharmacy updates"}
          reason={
            latestEvent?.reason ??
            latestEvent?.detail ??
            "Care Orchestrator follows medication, reminders, and check-ins until treatment is complete."
          }
        />
      : null}

      {!patientId && (
        <PanelCard
          title="Choose a member"
          description="The shared demo store does not assume a default patient. Pick someone in the header to load medications and notifications for that person."
        >
          <p className="text-sm text-muted-foreground">
            Provider / pharmacy / payer views use the same selection so you can follow
            one cohort member end to end.
          </p>
        </PanelCard>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch [&>*]:min-w-0">
      {inbox.length > 0 && (
        <section
          className="space-y-2 md:col-span-2"
          aria-label="Updates"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Updates for you
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {inbox.slice(0, 4).map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm"
              >
                <p className="font-medium leading-snug">{n.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-2 text-[0.65rem] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PanelCard
        fillHeight
        title="Ask Care Orchestrator (demo)"
        description="Plain-language help from your demo chart and meds — not a substitute for your clinician."
      >
        <div className="space-y-3">
          <Textarea
            value={assistQ}
            onChange={(e) => setAssistQ(e.target.value)}
            placeholder="e.g. Why might my pharmacy be waiting on my insurance?"
            className="min-h-[88px] resize-none text-sm"
            disabled={assistLoading || !patient}
          />
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={
              assistLoading || !patient || !assistQ.trim() || assistQ.length > 4000
            }
            onClick={() => void submitPatientAssist()}
          >
            {assistLoading ?
              <Loader2 className="size-4 animate-spin" />
            : <MessageCircle className="size-4" />}
            Get an answer
          </Button>
          {assistErr && (
            <p className="text-xs text-destructive">{assistErr}</p>
          )}
          {assistReply && (
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3 text-sm leading-relaxed text-foreground">
              {assistReply}
            </div>
          )}
          <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
            Emergency? Call your local emergency number. This demo uses the same
            bounded tool loop as the provider app with stricter safety prompts.
          </p>
        </div>
      </PanelCard>

      {visitSummary && (
        <PanelCard
          fillHeight
          title="Your visit, in plain words"
          description="A simple recap - your clinician’s note in the chart is the official record."
        >
          <p className="text-base font-medium leading-snug">{visitSummary.title}</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {visitSummary.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-teal-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {visitSummary.nextSteps.length > 0 && (
            <div className="mt-5 rounded-xl border border-dashed bg-muted/30 px-3 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                What we agreed you’d do next
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
                {visitSummary.nextSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground border-t pt-3">
            {visitSummary.whenToSeekCare}
          </p>
        </PanelCard>
      )}

      {!visitSummary && (
        <PanelCard
          fillHeight
          title="Your visit, in plain words"
          description="After your clinician finishes your visit in Care Orchestrator, a simple summary will show up here."
        >
          <p className="text-sm text-muted-foreground">
            Nothing yet - when your care team finalizes the visit, you’ll see the
            highlights here.
          </p>
        </PanelCard>
      )}

      <PanelCard
        fillHeight
        title="Your medications"
        description="How to take what was prescribed - ask your pharmacist if you have questions."
      >
        {rxList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active prescriptions in this demo yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {rxList.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border bg-card/80 px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill className="size-4 text-teal-600" />
                  <span className="text-sm font-medium">
                    {p.lines.map((l) => l.drugName).join(", ")}
                  </span>
                  <Badge variant="secondary" className="text-[0.65rem] font-normal">
                    {p.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                {p.lines.map((line) => (
                  <div key={line.id} className="mt-3 text-sm leading-relaxed">
                    <p className="text-foreground/90">
                      <span className="font-medium">{line.drugName}</span>{" "}
                      {line.strength} · {line.quantity} supply · refill{" "}
                      {line.refills}x
                    </p>
                    <p className="mt-1 text-muted-foreground">{line.sig}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        fillHeight
        title="Reminder timeline"
        description="What’s coming up and what you’ve already done in Care Orchestrator."
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Up next
            </p>
            {upcomingReminders.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing scheduled - enjoy the quiet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {upcomingReminders.map((row) => (
                  <li
                    key={row.id}
                    className="flex gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium leading-tight">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.kind} · {new Date(row.when).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent activity
            </p>
            {recentActivity.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                When you pick up meds, log doses, or send a check-in, it will
                list here.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {recentActivity.map((e) => (
                  <li
                    key={e.id}
                    className="flex gap-2 rounded-lg border border-transparent px-1 py-1 text-sm"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-teal-600" />
                    <div>
                      <p>{e.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PanelCard>

      <PanelCard
        fillHeight
        title="Follow-up from your care team"
        description="Small steps that keep everyone aligned."
      >
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open tasks - check back after your next visit.
          </p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border bg-muted/15 px-3 py-3 text-sm"
              >
                <div className="flex gap-2">
                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{t.title}</p>
                    {t.description ? (
                      <p className="mt-1 text-muted-foreground">{t.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(t.dueAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {t.status.replaceAll("_", " ")}
                  </Badge>
                  {(t.status === "scheduled" || t.status === "open") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => markFollowUpTaskComplete(t.id)}
                    >
                      Mark done
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        fillHeight
        title="Adherence check-ins"
        description="Quick nudges - not a grade. Tap when you’ve done the step."
      >
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No check-ins right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {checks.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex gap-2">
                  <Bell className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium leading-snug">
                      {c.notes ?? "Stay on track with your plan"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {new Date(c.scheduledFor).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {c.status}
                  </Badge>
                  {c.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => patientCompleteAdherenceCheck(c.id)}
                    >
                      I did this
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
      </div>
    </div>
  );
}
