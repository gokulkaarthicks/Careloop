"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runRefillEligibilityAgent } from "@/lib/orchestration/refill-agent";
import { CarePageHeader } from "@/components/care-loop/care-page-header";
import { PanelCard } from "@/components/care-loop/panel-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCareWorkflowStore,
  type PatientSymptomCheckInPayload,
} from "@/stores/care-workflow-store";
import { cn } from "@/lib/utils";
import {
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  Heart,
  PackageCheck,
  Pill,
  Sparkles,
  Sunrise,
} from "lucide-react";

const SYMPTOM_TAGS = [
  "Headache",
  "Dizziness",
  "Nausea",
  "Short of breath",
  "Feeling worried",
  "Sleep changes",
] as const;

export default function PatientPage() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const patientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const markFollowUpTaskComplete = useCareWorkflowStore(
    (s) => s.markFollowUpTaskComplete,
  );
  const patientConfirmMedicationPickedUp = useCareWorkflowStore(
    (s) => s.patientConfirmMedicationPickedUp,
  );
  const patientLogMedicationTaken = useCareWorkflowStore(
    (s) => s.patientLogMedicationTaken,
  );
  const patientCompleteAdherenceCheck = useCareWorkflowStore(
    (s) => s.patientCompleteAdherenceCheck,
  );
  const patientSubmitSymptomCheckIn = useCareWorkflowStore(
    (s) => s.patientSubmitSymptomCheckIn,
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
  const canConfirmPickup =
    primaryRx?.status === "ready_for_pickup";
  const pickupDone = primaryRx?.status === "picked_up";

  const [overall, setOverall] =
    useState<PatientSymptomCheckInPayload["overall"]>("same");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [symptomNote, setSymptomNote] = useState("");
  const [symptomSent, setSymptomSent] = useState(false);

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

  function toggleConcern(tag: string) {
    setConcerns((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  }

  function submitSymptoms() {
    patientSubmitSymptomCheckIn(patientId, {
      overall,
      concerns,
      note: symptomNote.trim(),
    });
    setSymptomSent(true);
    setSymptomNote("");
    setConcerns([]);
  }

  const firstName = patient?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 pb-16 pt-1">
      <CarePageHeader
        eyebrow="Patient"
        title={`Hi, ${firstName}`}
        description="Short nudges tied to your visit — actions here sync with your care team in this demo."
        className="border-b-0 pb-2"
      />

      <section className="rounded-xl border border-border/70 bg-card px-5 py-5 shadow-care-card">
        <p className="text-label">This week</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pick up meds, log how you feel, and complete quick check-ins — same loop
          your provider and pharmacy see.
        </p>
      </section>

      {inbox.length > 0 && (
        <section className="space-y-2" aria-label="Updates">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Updates for you
          </p>
          <ul className="space-y-2">
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

      {visitSummary && (
        <PanelCard
          title="Your visit, in plain words"
          description="A simple recap — your clinician’s note in the chart is the official record."
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
          title="Your visit, in plain words"
          description="After your clinician finishes your visit in CareLoop, a simple summary will show up here."
        >
          <p className="text-sm text-muted-foreground">
            Nothing yet — when your care team finalizes the visit, you’ll see the
            highlights here.
          </p>
        </PanelCard>
      )}

      <PanelCard
        title="Your medications"
        description="How to take what was prescribed — ask your pharmacist if you have questions."
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
        title="Quick actions"
        description="Two taps your care team can see right away."
      >
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="h-auto justify-start gap-3 py-4 text-left font-normal"
            disabled={!primaryRx || !canConfirmPickup}
            onClick={() => primaryRx && patientConfirmMedicationPickedUp(primaryRx.id)}
          >
            <PackageCheck className="size-6 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold">I picked up my medication</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {pickupDone
                  ? "We already have pickup on file — you’re good."
                  : canConfirmPickup
                    ? "Tap when you have the bag from the pharmacy."
                    : "We’ll turn this on when the pharmacy says your order is ready."}
              </span>
            </span>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-auto justify-start gap-3 py-4 text-left font-normal"
            disabled={!patient}
            onClick={() => patientLogMedicationTaken(patientId)}
          >
            <Sunrise className="size-6 shrink-0 text-amber-600" />
            <span>
              <span className="block font-semibold">I took my medication today</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Helps your care team know you’re on track. Safe to tap once a day
                in this demo.
              </span>
            </span>
          </Button>
        </div>
      </PanelCard>

      <PanelCard
        title="How are you feeling?"
        description="Optional — not a diagnosis. We’ll share this with your care team."
      >
        {symptomSent && (
          <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:bg-teal-950/50 dark:text-teal-100">
            Thanks — we sent that. You can send another update anytime.
          </p>
        )}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Compared to your last few days
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["better", "A bit better"],
                  ["same", "About the same"],
                  ["worse", "A bit worse"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={overall === value ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => {
                    setOverall(value);
                    setSymptomSent(false);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Anything on your mind? (pick any)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SYMPTOM_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    toggleConcern(tag);
                    setSymptomSent(false);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    concerns.includes(tag)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background hover:bg-muted/60",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="symptom-note" className="text-xs text-muted-foreground">
              Anything else you want us to know?
            </Label>
            <Textarea
              id="symptom-note"
              className="mt-1.5 min-h-[88px] resize-none text-sm"
              placeholder="Optional — a sentence or two is plenty."
              value={symptomNote}
              onChange={(e) => {
                setSymptomNote(e.target.value);
                setSymptomSent(false);
              }}
            />
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={submitSymptoms}
            disabled={!patient}
          >
            <Heart className="size-4" />
            Send check-in
          </Button>
        </div>
      </PanelCard>

      <PanelCard
        title="Reminder timeline"
        description="What’s coming up and what you’ve already done in CareLoop."
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Up next
            </p>
            {upcomingReminders.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing scheduled — enjoy the quiet.
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
        title="Follow-up from your care team"
        description="Small steps that keep everyone aligned."
      >
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open tasks — check back after your next visit.
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
        title="Adherence check-ins"
        description="Quick nudges — not a grade. Tap when you’ve done the step."
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
  );
}
