"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatToolTraceRow } from "@/lib/agentic/format-tool-trace-for-ui";
import type { EncounterAgentRun } from "@/types/agentic";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, FileText, ListOrdered, Route } from "lucide-react";

function outcomeBadge(outcome: EncounterAgentRun["outcomeLabel"]) {
  switch (outcome) {
    case "pharmacy_e_rx":
      return (
        <Badge className="bg-emerald-600/90 text-white hover:bg-emerald-600">
          Pharmacy e-prescribe
        </Badge>
      );
    case "prior_auth_hold":
      return <Badge variant="secondary">Prior authorization hold</Badge>;
    case "step_therapy_hold":
      return <Badge variant="outline">Step therapy / documentation</Badge>;
    default:
      return null;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: EncounterAgentRun | null;
  patientDisplayName?: string;
  onOpenSoap: () => void;
  onExportJson?: () => void;
};

export function EncounterRunReportDialog({
  open,
  onOpenChange,
  run,
  patientDisplayName,
  onOpenSoap,
  onExportJson,
}: Props) {
  return (
    <Dialog open={open && !!run} onOpenChange={onOpenChange}>
      {run ?
      <DialogContent className="flex min-h-0 max-h-[min(92vh,760px)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            Encounter workflow — run report
            {outcomeBadge(run.outcomeLabel)}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Proof bundle for this finalize. Run ID{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
              {run.runId}
            </code>
            {patientDisplayName ? (
              <>
                {" "}
                · {patientDisplayName} · {run.coveragePlanName}
              </>
            ) : (
              <> · {run.coveragePlanName}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 [scrollbar-gutter:stable]">
          <div className="space-y-5 pb-1 text-sm">
            <section>
              <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ListOrdered className="size-3.5" />
                Agent steps
              </h4>
              <p className="mb-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                What ran during finalize. Per-medication routing is in the table below; full raw trace
                is in{" "}
                <span className="font-medium text-foreground">Export JSON</span> if you need it.
              </p>
              {run.tools.length === 0 ?
                <p className="text-xs text-muted-foreground">No steps recorded.</p>
              : (
                <ol className="list-none space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  {run.tools.map((row, i) => {
                    const f = formatToolTraceRow(row);
                    return (
                      <li
                        key={`${row.tool}-${i}`}
                        className="flex gap-2.5 leading-snug"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[0.65rem] font-semibold text-muted-foreground ring-1 ring-border">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">{f.label}</span>
                            {f.ok ?
                              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                            : (
                              <AlertCircle
                                className="size-3.5 shrink-0 text-destructive"
                                aria-hidden
                              />
                            )}
                          </div>
                          {f.ok && f.note ?
                            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{f.note}</p>
                          : null}
                          {!f.ok && f.error ?
                            <p className="mt-0.5 text-[0.7rem] text-destructive">{f.error}</p>
                          : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="min-w-0">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Route className="size-3.5" />
                Per-line routing
              </h4>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <Table className="table-fixed min-w-[520px] text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%] text-xs">Medication</TableHead>
                      <TableHead className="w-[24%] text-xs">Route</TableHead>
                      <TableHead className="w-[54%] text-xs">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.routingSummary.map((d) => (
                      <TableRow key={d.drugName + d.reason}>
                        <TableCell className="align-top font-medium break-words whitespace-normal">
                          {d.drugName}
                        </TableCell>
                        <TableCell className="align-top capitalize break-words whitespace-normal">
                          {d.route.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="align-top break-words text-muted-foreground whitespace-normal">
                          {d.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Timeline titles (operational)
              </h4>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {run.timelineEntryTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                SOAP addendum (excerpt)
              </h4>
              <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[0.65rem] leading-relaxed text-foreground">
                {run.soapAddendum.slice(0, 1200)}
                {run.soapAddendum.length > 1200 ? "…" : ""}
              </pre>
            </section>
          </div>
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-col gap-3 border-t border-border/60 bg-card px-6 py-4",
            "sm:flex-row sm:items-center sm:justify-between sm:gap-4",
          )}
        >
          <div className="flex min-w-0 w-full flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="inline-flex h-auto min-h-9 w-full items-center justify-start gap-0 whitespace-normal px-3 py-2 text-left sm:w-auto"
              onClick={onOpenSoap}
            >
              <FileText className="mr-1.5 size-4 shrink-0" />
              <span className="text-left leading-snug">Open full SOAP (read-only)</span>
            </Button>
            {onExportJson ?
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 w-full shrink-0 sm:w-auto"
                onClick={onExportJson}
              >
                Export JSON
              </Button>
            : null}
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
      : null}
    </Dialog>
  );
}
