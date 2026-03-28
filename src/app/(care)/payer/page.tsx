"use client";

import { useMemo } from "react";
import { CarePageHeader } from "@/components/care-loop/care-page-header";
import { PanelCard } from "@/components/care-loop/panel-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cohortAverageVbc,
  collectMissedCareAlerts,
  buildPayerCompletedTimeline,
  computeMemberLoopMetrics,
  type MemberLoopMetrics,
} from "@/lib/payer-analytics";
import { cn } from "@/lib/utils";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  LineChart,
  Pill,
  Shield,
  Timer,
  Users,
} from "lucide-react";

function MiniBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={value} className={cn("h-2 max-w-[120px]", className)} />
      <span className="tabular-nums text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}

function toneRing(tone: MemberLoopMetrics["careTone"]) {
  switch (tone) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

export default function PayerPage() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const payerMarkComplete = useCareWorkflowStore((s) => s.payerMarkComplete);
  const resolvePriorAuthCase = useCareWorkflowStore((s) => s.resolvePriorAuthCase);
  const payerProfile = snapshot.payers[0];

  const pendingPa = useMemo(
    () =>
      (snapshot.priorAuthCases ?? []).filter((c) => c.status === "pending_review"),
    [snapshot.priorAuthCases],
  );

  const members = useMemo(() => {
    return snapshot.patients.map((p) => computeMemberLoopMetrics(snapshot, p));
  }, [snapshot]);

  const avgVbc = useMemo(() => cohortAverageVbc(members), [members]);

  const alerts = useMemo(() => collectMissedCareAlerts(snapshot), [snapshot]);

  const timeline = useMemo(
    () => buildPayerCompletedTimeline(snapshot, 35),
    [snapshot],
  );

  const followUpAggregate = useMemo(() => {
    const tasks = snapshot.followUpTasks;
    const done = tasks.filter((t) => t.status === "completed").length;
    return { done, total: tasks.length };
  }, [snapshot.followUpTasks]);

  const adherenceAggregate = useMemo(() => {
    const c = snapshot.adherenceChecks;
    const done = c.filter((x) => x.status === "completed").length;
    return { done, total: c.length };
  }, [snapshot.adherenceChecks]);

  const pickupAggregate = useMemo(() => {
    const rx = snapshot.prescriptions;
    const picked = rx.filter((r) => r.status === "picked_up").length;
    return { picked, total: rx.length };
  }, [snapshot.prescriptions]);

  const highAlerts = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      <CarePageHeader
        eyebrow="Payer · mock analytics"
        title="Outcomes & engagement"
        description={`${payerProfile.name} · ${payerProfile.planType}. Visit, pharmacy, and follow-up signals roll up for care management — not adjudicated claims.`}
      >
        <Badge variant="neutral" className="shrink-0 text-[0.65rem] font-medium">
          Demo data
        </Badge>
      </CarePageHeader>

      <PanelCard
        title="Prior authorization queue (demo)"
        description="Resolve PA cases to simulate payer approval, denial, or more-info requests — downstream pharmacy + notifications update automatically."
      >
        {pendingPa.length === 0 ?
          <p className="text-sm text-muted-foreground">
            No pending PA cases. Finalize a visit with a specialty drug (e.g. Ozempic, Humira) or
            step-therapy-blocked line to create one.
          </p>
        : (
          <ul className="space-y-3">
            {pendingPa.map((c) => {
              const name =
                snapshot.patients.find((p) => p.id === c.patientId)?.displayName ??
                c.patientId;
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{c.drugName}</p>
                    <p className="text-[0.65rem] text-muted-foreground">Case {c.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => resolvePriorAuthCase(c.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => resolvePriorAuthCase(c.id, "more_info")}
                    >
                      More info
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolvePriorAuthCase(c.id, "denied")}
                    >
                      Deny
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.07] to-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
              <LineChart className="size-3.5" />
              Value-based style score
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{avgVbc}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Cohort average — blends closure, visit stage, Rx pickup, tasks, and
              adherence.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
              <Pill className="size-3.5" />
              Prescription pickup
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {pickupAggregate.total === 0
                ? "—"
                : `${pickupAggregate.picked}/${pickupAggregate.total}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Rx marked picked up in the closed loop (demo pharmacy + patient).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
              <ClipboardCheck className="size-3.5" />
              Follow-up completion
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {followUpAggregate.total === 0
                ? "—"
                : `${followUpAggregate.done}/${followUpAggregate.total}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tasks marked complete across all members in the snapshot.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
              <HeartPulse className="size-3.5" />
              Adherence checks
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {adherenceAggregate.total === 0
                ? "—"
                : `${adherenceAggregate.done}/${adherenceAggregate.total}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Self-report style check-ins completed vs scheduled.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <PanelCard
          className="lg:col-span-3"
          title="Member-level loop status"
          description="Patient care completion, fulfillment, and engagement — normalized for reporting conversations."
        >
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="min-w-[130px]">Care path</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Follow-ups</TableHead>
                  <TableHead>Adherence</TableHead>
                  <TableHead className="text-right">VBC score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.patient.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{m.patient.displayName}</span>
                        {m.closureScore != null && (
                          <span className="text-[0.65rem] text-muted-foreground">
                            Loop closure {m.closureScore}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <MiniBar value={m.careCompletionPct} />
                        <p
                          className={cn(
                            "text-[0.65rem] leading-tight",
                            toneRing(m.careTone),
                          )}
                        >
                          {m.careStatusLabel}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MiniBar value={m.pickupPct} />
                      <p className="mt-1 text-[0.65rem] text-muted-foreground capitalize">
                        {m.pickupStatusLabel}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-sm">
                        {m.followUpCompleted}/{m.followUpTotal || "0"}
                      </span>
                      <MiniBar value={m.followUpPct} className="mt-1" />
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-sm">
                        {m.adherenceCompleted}/{m.adherenceTotal || "0"}
                      </span>
                      <MiniBar value={m.adherencePct} className="mt-1" />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-lg font-semibold tabular-nums">
                        {m.valueBasedCareScore}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PanelCard>

        <PanelCard
          className="lg:col-span-2"
          title="Missed-care alerts"
          description="Rule-based flags from overdue tasks, adherence windows, and open pickups — not clinical decision support."
        >
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <Shield className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No open gaps in this snapshot</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                As the demo progresses (visits, pharmacy, patient app), alerts appear
                here for care managers.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[min(340px,50vh)] pr-3">
              <ul className="space-y-3">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm",
                      a.severity === "high" && "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30",
                      a.severity === "medium" &&
                        "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/25",
                      a.severity === "low" &&
                        "border-sky-200 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          a.severity === "high" && "text-red-600",
                          a.severity === "medium" && "text-amber-600",
                          a.severity === "low" && "text-sky-600",
                        )}
                      />
                      <div>
                        <p className="font-medium leading-tight">{a.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.patientName} · {a.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
          {highAlerts > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {highAlerts} high-priority item{highAlerts === 1 ? "" : "s"} in this list.
            </p>
          )}
        </PanelCard>
      </div>

      <PanelCard
        title="Timeline of completed actions"
        description="Workflow + patient events newest first — what already happened in the closed loop."
      >
        {timeline.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
            <Timer className="size-5 shrink-0" />
            <span>
              No completed events yet. Finalize a visit, move the prescription, or use
              the patient app to populate this feed.
            </span>
          </div>
        ) : (
          <ScrollArea className="h-[min(380px,45vh)]">
            <ul className="space-y-0 pr-3">
              {timeline.map((item) => (
                <li
                  key={item.id}
                  className="relative flex gap-4 border-l border-border pb-6 pl-6 last:pb-0"
                >
                  <span
                    className={cn(
                      "absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-background",
                      item.category === "Patient" && "bg-violet-500",
                      item.category === "Pharmacy" && "bg-teal-500",
                      item.category === "Clinical" && "bg-rose-500",
                      item.category === "Care loop" && "bg-slate-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[0.65rem] font-normal">
                        {item.category}
                      </Badge>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {item.patientName}
                      </span>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {new Date(item.occurredAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 font-medium leading-snug">{item.title}</p>
                    {item.detail ? (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PanelCard>

      <PanelCard
        title="Administrative touchpoint (demo)"
        description="Mark paid / approved closes the claim stub and syncs the linked e-Rx to the Pharmacy incoming queue when the order was still queued. Open Pharmacy to fill — or finalize on Provider first if the Rx is still draft."
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.payerStatuses.map((row) => {
                const patient = snapshot.patients.find((p) => p.id === row.patientId);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {patient?.displayName ?? row.patientId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.claimStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.paidAmountUsd != null ? (
                        <span>${row.paidAmountUsd} paid</span>
                      ) : row.authorizedAmountUsd != null ? (
                        <span>${row.authorizedAmountUsd} auth</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          row.claimStatus === "paid" || row.claimStatus === "approved"
                        }
                        onClick={() => payerMarkComplete(row.id, "paid")}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark paid
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </PanelCard>

      <footer className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Users className="size-4 shrink-0" />
        <span>
          Cohort: {snapshot.patients.length} members · Avg VBC {avgVbc} · Alerts{" "}
          {alerts.length}
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="flex items-center gap-1">
          <Activity className="size-3.5" />
          Events in timeline: {timeline.length}
        </span>
      </footer>
    </div>
  );
}
