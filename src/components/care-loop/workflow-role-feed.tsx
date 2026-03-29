"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PanelCard } from "@/components/care-loop/panel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorkflowEngineEvent } from "@/types/benefits";

const PHARMACY_KINDS: WorkflowEngineEvent["kind"][] = [
  "insurance_checked",
  "pharmacy_order_created",
  "pharmacy_order_sent",
  "network_mismatch",
  "formulary_alternative",
  "medication_ready",
  "medication_picked_up",
  "patient_notified",
  "refill_eligibility_evaluated",
  "orchestrator_tick",
  "encounter_agent_trace",
];

const PAYER_KINDS: WorkflowEngineEvent["kind"][] = [
  "insurance_checked",
  "pa_required",
  "pa_submitted",
  "pa_approved",
  "pa_denied",
  "pa_more_info_needed",
  "payer_alerted",
  "background_pa_policy_started",
  "background_pa_policy_completed",
  "refill_eligibility_evaluated",
  "orchestrator_tick",
  "encounter_agent_trace",
];

function filterForPharmacy(events: WorkflowEngineEvent[]) {
  return events.filter(
    (e) =>
      e.role === "pharmacy" ||
      e.role === "patient" ||
      PHARMACY_KINDS.includes(e.kind),
  );
}

function filterForPayer(events: WorkflowEngineEvent[]) {
  return events.filter(
    (e) =>
      e.role === "payer" ||
      PAYER_KINDS.includes(e.kind),
  );
}

type Props = {
  events: WorkflowEngineEvent[];
  variant: "pharmacy" | "payer";
  max?: number;
};

/**
 * Surfaces the same `workflowEngineEvents` stream as the workflow dock, filtered for each persona.
 */
export function WorkflowRoleFeed({ events, variant, max = 10 }: Props) {
  const rows = useMemo(() => {
    const list = variant === "pharmacy" ? filterForPharmacy(events) : filterForPayer(events);
    return list.slice(0, max);
  }, [events, variant, max]);

  if (rows.length === 0) {
    return (
      <PanelCard
        title="Workflow (this role)"
        description="Events from finalize, coverage, and handoffs appear here — same feed as the workflow dock, filtered for this screen."
      >
        <p className="text-sm text-muted-foreground">
          No role-specific events yet. Finalize an encounter on{" "}
          <strong>Provider</strong> (after <strong>Start encounter</strong>), then return here.
        </p>
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Live workflow — your queue"
      description="Recent engine events relevant to this role (mirrors the bottom workflow dock)."
    >
      <ScrollArea className="h-[min(220px,32vh)] pr-3">
        <ul className="space-y-2 text-xs">
          {rows.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[0.6rem] font-normal">
                  {e.kind.replaceAll("_", " ")}
                </Badge>
                {e.role ? (
                  <span className="text-[0.6rem] text-muted-foreground">{e.role}</span>
                ) : null}
                <span className="ml-auto text-[0.6rem] text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-1 font-medium leading-snug text-foreground">{e.title}</p>
              {e.detail ? (
                <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                  {e.detail}
                </p>
              ) : null}
              {e.decision || e.action || e.result ? (
                <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
                  {e.decision ? `Decision: ${e.decision}. ` : ""}
                  {e.action ? `Action: ${e.action}. ` : ""}
                  {e.result ? `Result: ${e.result}.` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </PanelCard>
  );
}
