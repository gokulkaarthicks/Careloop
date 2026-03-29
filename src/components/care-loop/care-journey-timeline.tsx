"use client";

import type { ComponentType } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildCareJourneySteps,
  type CareJourneyStep,
} from "@/lib/care-journey-timeline";
import { cn } from "@/lib/utils";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import {
  CalendarCheck,
  ClipboardList,
  FileText,
  Landmark,
  PackageCheck,
  PhoneForwarded,
  Pill,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

const STEP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  booked: CalendarCheck,
  chart: Sparkles,
  risks: ShieldCheck,
  soap: FileText,
  rx: Send,
  ready: Store,
  pickup: PackageCheck,
  adherence: Pill,
  followup: PhoneForwarded,
  payer: Landmark,
};

function StepIcon({ step }: { step: CareJourneyStep }) {
  const Icon = STEP_ICONS[step.id] ?? ClipboardList;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold transition-colors",
        step.state === "complete" &&
          "border-primary bg-primary text-primary-foreground shadow-sm",
        step.state === "current" &&
          "border-primary bg-background text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]",
        step.state === "upcoming" &&
          "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
      )}
      title={step.hint}
    >
      {step.state === "complete" ? (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
    </span>
  );
}

export function CareJourneyTimeline({ className }: { className?: string }) {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const patientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const appointmentId = useCareWorkflowStore((s) => s.selectedAppointmentId);

  const steps = buildCareJourneySteps(snapshot, patientId, appointmentId);

  if (steps.length === 0) {
    return (
      <Card className={cn("overflow-hidden border-dashed border-border/70 shadow-care-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Care journey</CardTitle>
          <CardDescription className="text-xs">
            No scheduled visit for this patient. Select a member and open an encounter
            to see the full closed loop.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const doneCount = steps.filter((s) => s.state === "complete").length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/80 bg-card shadow-care-card",
        className,
      )}
    >
      <CardHeader className="space-y-3 border-b border-border/60 bg-muted/10 pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-label mb-1">Continuity</p>
            <CardTitle className="text-base font-semibold tracking-tight">
              Closed-loop journey
            </CardTitle>
            <CardDescription className="mt-1 max-w-xl text-xs leading-relaxed">
              Scheduling through adherence and payer closure - mirrored on clinical
              and ops surfaces.
            </CardDescription>
          </div>
          <div className="flex items-baseline gap-2 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs tabular-nums shadow-sm">
            <span className="font-semibold text-foreground">{pct}%</span>
            <span className="text-muted-foreground">loop progress</span>
          </div>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Journey completion"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ol className="relative px-4 py-5 sm:px-6">
          <div
            className="absolute left-[2.125rem] top-6 bottom-6 w-px bg-gradient-to-b from-border via-primary/25 to-border sm:left-[2.375rem]"
            aria-hidden
          />
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "relative flex gap-4 pb-8 last:pb-0",
                step.state === "current" && "z-[1]",
              )}
            >
              <div className="relative z-[1] flex w-9 shrink-0 justify-center sm:w-10">
                <StepIcon step={step} />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium leading-none",
                      step.state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {step.state === "current" ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                      In progress
                    </span>
                  ) : null}
                  {step.state === "complete" ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                      Done
                    </span>
                  ) : null}
                </div>
                {step.hint ? (
                  <p className="text-xs text-muted-foreground leading-snug">
                    {step.hint}
                  </p>
                ) : null}
              </div>
              <span className="sr-only">
                Step {index + 1} of {steps.length}: {step.label},{" "}
                {step.state === "complete"
                  ? "completed"
                  : step.state === "current"
                    ? "current"
                    : "not started"}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
