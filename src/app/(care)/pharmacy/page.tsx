"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CarePageHeader } from "@/components/care-loop/care-page-header";
import { PanelCard } from "@/components/care-loop/panel-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkflowRoleFeed } from "@/components/care-loop/workflow-role-feed";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { WorkflowEngineEvent } from "@/types/benefits";
import type { PharmacyOrderStatus, PrescriptionStatus } from "@/types/workflow";

const EMPTY_ENGINE_EVENTS: WorkflowEngineEvent[] = [];
import { cn } from "@/lib/utils";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  PackageCheck,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";

const ORDER_QUEUE_RANK: Record<PharmacyOrderStatus, number> = {
  queued: 0,
  sent_to_pharmacy: 1,
  received: 2,
  filling: 3,
  ready_for_pickup: 4,
  picked_up: 10,
  cancelled: 99,
};

function formatStatus(s: string) {
  return s.replaceAll("_", " ");
}

function rxStatusLabel(status: PrescriptionStatus) {
  switch (status) {
    case "draft":
      return "Draft (not at pharmacy)";
    case "pending_prior_auth":
      return "PA / documentation hold";
    case "pa_denied":
      return "PA denied - prescriber action";
    case "sent":
      return "Transmitting";
    case "received_by_pharmacy":
      return "Received - fill";
    case "ready_for_pickup":
      return "Ready";
    case "picked_up":
      return "Picked up";
    case "cancelled":
      return "Cancelled";
    default:
      return formatStatus(status);
  }
}

export default function PharmacyPage() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const pharmacyMarkReady = useCareWorkflowStore((s) => s.pharmacyMarkReady);
  const pharmacyMarkPickedUp = useCareWorkflowStore((s) => s.pharmacyMarkPickedUp);
  const pharmacy = snapshot.pharmacies[0];

  const timeline = snapshot.workflowTimeline ?? [];
  const patientNotifications = snapshot.patientWorkflowNotifications ?? [];
  const engineEvents = snapshot.workflowEngineEvents ?? EMPTY_ENGINE_EVENTS;

  const rows = useMemo(() => {
    const list = snapshot.prescriptions.map((rx) => {
      const patient = snapshot.patients.find((p) => p.id === rx.patientId);
      const order =
        snapshot.pharmacyOrders.find((o) => o.prescriptionId === rx.id) ?? null;
      return { rx, patient, order };
    });

    return list.sort((a, b) => {
      const ra = a.order ? ORDER_QUEUE_RANK[a.order.status] : 50;
      const rb = b.order ? ORDER_QUEUE_RANK[b.order.status] : 50;
      if (ra !== rb) return ra - rb;
      return (b.order?.updatedAt ?? "").localeCompare(a.order?.updatedAt ?? "");
    });
  }, [snapshot.prescriptions, snapshot.patients, snapshot.pharmacyOrders]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (rows.length === 0) return;
    const still = rows.some((r) => r.rx.id === selectedId);
    if (!selectedId || !still) {
      setSelectedId(rows[0].rx.id);
    }
  }, [rows, selectedId]);

  const selected = rows.find((r) => r.rx.id === selectedId) ?? rows[0];
  const rx = selected?.rx;
  const patient = selected?.patient;
  const order = selected?.order;
  const agentRunForRx =
    rx?.appointmentId ?
      snapshot.encounterAgentRunsByAppointment[rx.appointmentId]
    : undefined;
  const canMarkReady =
    rx &&
    (rx.status === "received_by_pharmacy" || rx.status === "sent") &&
    (!order ||
      (order.status !== "picked_up" && order.status !== "cancelled"));

  const canMarkPickedUp =
    rx && rx.status === "ready_for_pickup" && order?.status === "ready_for_pickup";

  const handleReady = useCallback(() => {
    if (!rx) return;
    pharmacyMarkReady(rx.id);
  }, [pharmacyMarkReady, rx]);

  const handlePickedUp = useCallback(() => {
    if (!rx) return;
    pharmacyMarkPickedUp(rx.id);
  }, [pharmacyMarkPickedUp, rx]);

  const queueIncoming = rows.filter((r) => {
    if (r.rx.status === "cancelled" || r.rx.status === "picked_up") return false;
    if (r.order) {
      return (
        r.order.status !== "picked_up" && r.order.status !== "cancelled"
      );
    }
    /** Show e-Rx even if the order stub is missing (persisted / demo edge case). */
    return (
      r.rx.status === "received_by_pharmacy" ||
      r.rx.status === "sent" ||
      r.rx.status === "ready_for_pickup" ||
      r.rx.status === "draft" ||
      r.rx.status === "pending_prior_auth" ||
      r.rx.status === "pa_denied"
    );
  });
  const queueDone = rows.filter((r) => r.order?.status === "picked_up");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <CarePageHeader
        eyebrow="Pharmacy"
        title="Fulfillment queue"
        description="Same prescriptions as Provider. After payer marks a claim paid/approved, any linked order stuck in “queued” moves to received so it stays visible here for fill and pickup."
      >
        <div className="flex max-w-md items-start gap-2 text-xs text-muted-foreground">
          <Building2 className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
          <span className="leading-snug">
            {pharmacy.name} · {pharmacy.addressLine}, {pharmacy.city}, {pharmacy.state}{" "}
            {pharmacy.zip}
          </span>
        </div>
      </CarePageHeader>

      <WorkflowRoleFeed events={engineEvents} variant="pharmacy" />

      {queueIncoming.some((r) => r.rx.status === "pending_prior_auth") && (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-50">
          <strong className="font-semibold">Prior authorization required:</strong> at least one
          prescription is held for payer review. Open the{" "}
          <Link href="/payer" className="font-medium text-primary underline underline-offset-2">
            Payer
          </Link>{" "}
          screen and use <strong>Prior authorization queue</strong> (Approve / Deny / More info).
          When PA clears, the Rx will show as receivable here.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <PanelCard
            title="Incoming queue"
            description="Orders awaiting fill or patient pickup. Select a row to manage."
          >
            <ScrollArea className="h-[min(52vh,420px)] pr-3">
              <div className="space-y-2">
                {queueIncoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active orders. Finalize a visit on the provider side to send an
                    e-Rx, or reset the demo.
                  </p>
                ) : (
                  queueIncoming.map(({ rx: rowRx, patient: p, order: o }) => {
                    const active = rowRx.id === selectedId;
                    return (
                      <button
                        key={rowRx.id}
                        type="button"
                        onClick={() => setSelectedId(rowRx.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {p?.displayName ?? rowRx.patientId}
                          </span>
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground",
                              active && "text-primary",
                            )}
                          />
                        </div>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {rowRx.lines.map((l) => l.drugName).join(", ") || "-"}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <Badge variant="secondary" className="text-[0.65rem] font-normal">
                            Order: {o ? formatStatus(o.status) : "-"}
                          </Badge>
                          <Badge variant="outline" className="text-[0.65rem] font-normal">
                            Rx: {rxStatusLabel(rowRx.status)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </PanelCard>

          {queueDone.length > 0 && (
            <PanelCard
              title="Completed pickups"
              description="Recent fulfillments for this demo cohort."
            >
              <ul className="space-y-2 text-xs">
                {queueDone.map(({ rx: rowRx, patient: p, order: o }) => (
                  <li
                    key={rowRx.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5"
                  >
                    <span className="font-medium">{p?.displayName}</span>
                    <span className="text-muted-foreground">
                      {o?.pickedUpAt
                        ? new Date(o.pickedUpAt).toLocaleString()
                        : "-"}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelCard>
          )}
        </div>

        <div className="space-y-4 lg:col-span-7">
          {!rx || !patient ? (
            <PanelCard title="Detail" description="Select a prescription from the queue.">
              <p className="text-sm text-muted-foreground">Nothing selected.</p>
            </PanelCard>
          ) : (
            <>
              <PanelCard
                title="Patient"
                description="Verify identity at pickup against this profile."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3">
                    <User className="mt-0.5 size-4 text-muted-foreground" />
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold leading-none">{patient.displayName}</p>
                      <p className="text-xs text-muted-foreground">MRN {patient.mrn}</p>
                      <p className="text-xs text-muted-foreground">
                        DOB {patient.dateOfBirth} · {patient.sexAtBirth}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed">
                    <p className="font-medium text-foreground">Contact</p>
                    <p className="text-muted-foreground">{patient.phone}</p>
                    <p className="text-muted-foreground">{patient.email}</p>
                  </div>
                </div>
              </PanelCard>

              <PanelCard
                title="Prescription & order"
                description="Dispensing details and fulfillment identifiers."
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    Rx {formatStatus(rx.status)}
                  </Badge>
                  {order && (
                    <Badge variant="secondary" className="font-normal">
                      Order {formatStatus(order.status)}
                    </Badge>
                  )}
                  {order?.externalFulfillmentId && (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem]">
                      {order.externalFulfillmentId}
                    </code>
                  )}
                  {agentRunForRx ?
                    <Badge variant="outline" className="font-mono text-[0.6rem] font-normal" title={agentRunForRx.runId}>
                      Run …{agentRunForRx.runId.slice(-12)}
                    </Badge>
                  : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Package className="size-3" />
                      Pickup status
                    </p>
                    <ul className="space-y-2 text-xs">
                      <li className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Will-call</span>
                        <span className="font-medium">
                          {order?.readyAt
                            ? `Ready ${new Date(order.readyAt).toLocaleString()}`
                            : rx.status === "ready_for_pickup" || rx.status === "picked_up"
                              ? "Released"
                              : "Not ready"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Picked up</span>
                        <span className="font-medium">
                          {order?.pickedUpAt
                            ? new Date(order.pickedUpAt).toLocaleString()
                            : "-"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2 border-t pt-2">
                        <span className="text-muted-foreground">Next action</span>
                        <span className="max-w-[60%] text-right text-[0.7rem]">
                          {order?.nextAction ?? rx.nextAction}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      <RefreshCw className="size-3" />
                      Refill status (per line)
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Refills remaining after this fill. Patient must request renewals
                      before zero.
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {rx.lines.map((line) => (
                        <li
                          key={line.id}
                          className="flex justify-between gap-2 rounded bg-muted/30 px-2 py-1"
                        >
                          <span className="font-medium">{line.drugName}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {line.refills} refill{line.refills === 1 ? "" : "s"} left
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Separator className="my-4" />

                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Medication lines
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug</TableHead>
                        <TableHead>Strength</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Refills</TableHead>
                        <TableHead className="min-w-[140px]">Sig</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rx.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">{line.drugName}</TableCell>
                          <TableCell className="text-xs">{line.strength}</TableCell>
                          <TableCell className="text-xs">{line.quantity}</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {line.refills}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {line.sig}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canMarkReady}
                    onClick={handleReady}
                  >
                    <Truck className="size-4" />
                    Mark medication ready
                  </Button>
                  <Button
                    type="button"
                    disabled={!canMarkPickedUp}
                    onClick={handlePickedUp}
                  >
                    <PackageCheck className="size-4" />
                    Mark picked up
                  </Button>
                </div>
                {!canMarkReady && rx.status !== "picked_up" && (
                  <p className="mt-3 text-[0.7rem] text-muted-foreground">
                    <Clock className="mr-1 inline size-3" />
                    Ready is available after the prescriber transmits and the order is
                    in receiving status.
                  </p>
                )}
              </PanelCard>

              <PanelCard
                title="Workflow & payer sync"
                description="Care Orchestrator updates the patient app, payer closure score, and provider timeline when you confirm pickup."
              >
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    <span>
                      Pickup updates the pharmacy order to complete and advances the
                      care loop toward payer closure.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    <span>
                      The patient workflow receives in-app notifications (mirrors SMS
                      in production).
                    </span>
                  </li>
                </ul>
                {patient && (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Latest patient notifications ({patient.displayName.split(" ")[0]})
                    </p>
                    <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto text-[0.7rem]">
                      {patientNotifications
                        .filter((n) => n.patientId === patient.id)
                        .slice(0, 4)
                        .map((n) => (
                          <li key={n.id} className="border-l-2 border-primary/40 pl-2">
                            <span className="font-medium text-foreground">{n.title}</span>
                            <span className="block text-muted-foreground">{n.body}</span>
                          </li>
                        ))}
                      {patientNotifications.filter((n) => n.patientId === patient.id)
                        .length === 0 && (
                        <li className="text-muted-foreground">No alerts yet for this patient.</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Provider timeline (recent)
                  </p>
                  <ul className="mt-2 max-h-32 space-y-2 overflow-y-auto text-[0.7rem]">
                    {timeline
                      .filter((e) => e.patientId === patient.id)
                      .slice(0, 5)
                      .map((e) => (
                        <li key={e.id}>
                          <span className="font-medium text-foreground">{e.title}</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            {e.detail}
                          </span>
                          <span className="text-[0.6rem] text-muted-foreground/80">
                            {new Date(e.occurredAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    {timeline.filter((e) => e.patientId === patient.id).length ===
                      0 && (
                      <li className="text-muted-foreground">
                        Pharmacy events appear here after Ready / Picked up.
                      </li>
                    )}
                  </ul>
                </div>
              </PanelCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
