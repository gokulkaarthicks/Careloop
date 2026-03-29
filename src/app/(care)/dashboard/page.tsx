"use client";

import { CareJourneyTimeline } from "@/components/care-loop/care-journey-timeline";
import { CareNotificationBanners } from "@/components/care-loop/care-notification-banners";
import { CarePageHeader } from "@/components/care-loop/care-page-header";
import { DashboardWorkflowTabs } from "@/components/care-loop/dashboard-workflow-tabs";
import { JudgeDemoPanel } from "@/components/care-loop/judge-demo-panel";
import { PanelCard } from "@/components/care-loop/panel-card";
import { WorkflowStateCard } from "@/components/care-loop/workflow-state-card";
import { WorkflowStageTracker } from "@/components/care-loop/workflow-stage-tracker";
import { RecoveryOpsPanel } from "@/components/care-loop/recovery-ops-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildCareNotificationBanners } from "@/lib/care-journey-timeline";
import { SEED_DEMO_ROUTE } from "@/lib/seed-data";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PrescriptionStatus } from "@/types/workflow";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ClipboardList,
  HeartPulse,
  Pill,
  Shield,
  Stethoscope,
} from "lucide-react";
import { useMemo } from "react";

function formatStageLabel(s: string) {
  return s.replaceAll("_", " ");
}

function rxBadgeVariant(
  status: PrescriptionStatus,
): "success" | "warning" | "neutral" | "outline" {
  switch (status) {
    case "picked_up":
      return "success";
    case "ready_for_pickup":
    case "received_by_pharmacy":
      return "warning";
    case "draft":
      return "neutral";
    default:
      return "outline";
  }
}

function rxLabel(status: PrescriptionStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "received_by_pharmacy":
      return "At pharmacy";
    case "ready_for_pickup":
      return "Ready";
    case "picked_up":
      return "Picked up";
    default:
      return formatStageLabel(status);
  }
}

function DemoEncounterScheduleCard() {
  const router = useRouter();
  const scheduleDemoEncounter = useCareWorkflowStore(
    (s) => s.scheduleDemoEncounter,
  );
  const selectPatient = useCareWorkflowStore((s) => s.selectPatient);

  return (
    <Card className="border-primary/25 shadow-care-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Manual walk-through primer</CardTitle>
        <CardDescription className="text-xs">
          Selects the scripted demo cohort member, then schedules an{" "}
          <strong>arrival</strong> in 30 seconds. Provider opens the encounter — then
          use Pharmacy → Patient → Payer in order.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            selectPatient(SEED_DEMO_ROUTE.patientId);
            scheduleDemoEncounter(30);
            router.push("/provider");
          }}
        >
          Schedule in 30s and open Provider
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const patientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const appointmentId = useCareWorkflowStore((s) => s.selectedAppointmentId);
  const patient = snapshot.patients.find((p) => p.id === patientId);
  const appt = snapshot.appointments.find((a) => a.patientId === patientId);

  const workflowNotifications = useMemo(
    () => buildCareNotificationBanners(snapshot, patientId, appointmentId),
    [snapshot, patientId, appointmentId],
  );

  const rx = snapshot.prescriptions.filter((p) => p.patientId === patientId);
  const followUps = snapshot.followUpTasks.filter((t) => t.patientId === patientId);
  const payer = snapshot.payerStatuses.find((e) => e.patientId === patientId);
  const latestEvent = snapshot.workflowEngineEvents.find((e) => e.patientId === patientId);

  const cohortRows = useMemo(() => {
    return snapshot.patients.map((p) => {
      const rowAppt = snapshot.appointments.find((a) => a.patientId === p.id);
      const rowRx = snapshot.prescriptions.find((r) => r.patientId === p.id);
      const rowPayer = snapshot.payerStatuses.find((x) => x.patientId === p.id);
      return { patient: p, appt: rowAppt, rx: rowRx, payer: rowPayer };
    });
  }, [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <CarePageHeader
        eyebrow="Operations"
        title="Practice overview"
        description="Closed-loop status across encounters, prescriptions, and payer milestones. Local mock state - structured like production EHR and claims feeds."
      />

      <JudgeDemoPanel />

      {appt ?
        <WorkflowStateCard
          title="Current demo state"
          currentState={`Stage: ${formatStageLabel(appt.currentStage)}`}
          nextAction={appt.nextAction}
          reason={
            latestEvent?.reason ??
            latestEvent?.detail ??
            "State moves automatically when the workflow engine chooses each next step."
          }
        />
      : null}

      <DemoEncounterScheduleCard />

      <CareNotificationBanners notifications={workflowNotifications} />

      <DashboardWorkflowTabs
        key={`${appt?.id ?? "none"}-${appt?.currentStage ?? ""}`}
        stage={appt?.currentStage}
      />

      <RecoveryOpsPanel />

      <section className="flex flex-col gap-4">
        {appt && (
          <Card className="shadow-care-card">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-label">Encounter</p>
                <CardTitle className="text-base font-semibold">{appt.title}</CardTitle>
                <CardDescription>
                  {new Date(appt.scheduledFor).toLocaleString()}
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit shrink-0 capitalize">
                {formatStageLabel(appt.status)}
              </Badge>
            </CardHeader>
            <CardContent className="pt-5">
              <WorkflowStageTracker current={appt.currentStage} />
            </CardContent>
          </Card>
        )}
        <CareJourneyTimeline />
      </section>

      <Card className="overflow-hidden shadow-care-card">
        <CardHeader className="border-b border-border/60 bg-muted/15 py-4">
          <CardTitle className="text-base font-semibold">Cohort operations</CardTitle>
          <CardDescription className="text-xs">
            Encounters and fulfillment by member - read-only operational view.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="text-label h-11 pl-4 font-semibold">
                  Patient
                </TableHead>
                <TableHead className="text-label h-11 font-semibold">Stage</TableHead>
                <TableHead className="text-label h-11 font-semibold">Rx</TableHead>
                <TableHead className="text-label h-11 font-semibold">Claim</TableHead>
                <TableHead className="text-label h-11 pr-4 text-right font-semibold">
                  Next action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohortRows.map(({ patient: p, appt: rowAppt, rx: rowRx, payer: rowPayer }) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    "border-border/50",
                    p.id === patientId && "bg-primary/[0.04]",
                  )}
                >
                  <TableCell className="pl-4 font-medium">
                    {p.displayName}
                    <span className="ml-1.5 text-muted-foreground">{p.mrn}</span>
                  </TableCell>
                  <TableCell>
                    {rowAppt ? (
                      <Badge variant="neutral" className="font-normal capitalize">
                        {formatStageLabel(rowAppt.currentStage)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {rowRx ? (
                      <Badge variant={rxBadgeVariant(rowRx.status)}>
                        {rxLabel(rowRx.status)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {rowPayer ? (
                      <Badge variant="outline" className="font-normal capitalize">
                        {rowPayer.claimStatus}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate pr-4 text-right text-xs text-muted-foreground">
                    {rowAppt?.nextAction ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <p className="text-label mb-3">Portals</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PanelCard
            title="Provider"
            description="Documentation, AI summary, e-prescribe."
            action={
              <Link
                href="/provider"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1",
                )}
              >
                Open <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <div className="flex items-start gap-3 text-muted-foreground">
              <Stethoscope className="size-5 shrink-0 text-primary/80" />
              <p className="text-xs leading-relaxed">
                CDS and SOAP; optional{" "}
                <code className="rounded border border-border/80 bg-muted/50 px-1 py-px text-[0.65rem]">
                  AI summary via /api/ai/summary
                </code>
              </p>
            </div>
          </PanelCard>

          <PanelCard
            title="Patient"
            description="Reminders, pickup, adherence."
            action={
              <Link href="/patient" className={buttonVariants({ variant: "outline", size: "sm" })}>
                View
              </Link>
            }
          >
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <HeartPulse className="size-4 text-primary/70" />
                Tasks {followUps.filter((t) => t.status === "completed").length}/
                {followUps.length}
              </span>
            </div>
          </PanelCard>

          <PanelCard
            title="Pharmacy"
            description="Queue, fill, release."
            action={
              <Link href="/pharmacy" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Queue
              </Link>
            }
          >
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Pill className="size-4 text-primary/70" />
                Rx {rx.filter((r) => r.status === "picked_up").length}/{rx.length} picked up
              </span>
            </div>
          </PanelCard>

          <PanelCard
            title="Payer"
            description="Closure and engagement rollups."
            action={
              <Link href="/payer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Reports
              </Link>
            }
          >
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Shield className="size-4 text-primary/70" />
                {payer?.claimStatus ?? "-"}
              </span>
              {payer?.authorizedAmountUsd != null && (
                <span className="tabular-nums text-foreground">${payer.authorizedAmountUsd}</span>
              )}
            </div>
          </PanelCard>

          <PanelCard title="Record" description="Header selector context.">
            <div className="flex items-center gap-2 text-xs">
              <ClipboardList className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{patient?.displayName ?? "-"}</span>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
