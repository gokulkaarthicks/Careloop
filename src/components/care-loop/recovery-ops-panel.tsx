"use client";

import { useMemo, useState } from "react";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { runRecoveryAutopilot } from "@/lib/recovery/recovery-orchestrator";

function metricClass(status: string) {
  if (status === "completed") return "success";
  if (status === "failed" || status === "escalated") return "destructive";
  return "outline";
}

export function RecoveryOpsPanel() {
  const snapshot = useCareWorkflowStore((s) => s.snapshot);
  const selectedPatientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const [loading, setLoading] = useState(false);

  const queue = useMemo(
    () =>
      snapshot.recoveryCases.filter(
        (c) => !selectedPatientId || c.patientId === selectedPatientId,
      ),
    [snapshot.recoveryCases, selectedPatientId],
  );
  const selected = queue[0];
  const actions = snapshot.recoveryActions.filter((a) => a.recoveryCaseId === selected?.id);
  const appeal = selected ? snapshot.appealBundles[selected.id] : undefined;
  const activeSla = selected
    ? snapshot.slaTimers.find((t) => t.recoveryCaseId === selected.id)
    : undefined;

  const metrics = useMemo(() => {
    const total = queue.length;
    const completed = queue.filter((c) => c.status === "completed").length;
    const waiting = queue.filter((c) => c.status === "waiting_external").length;
    const escalated = queue.filter((c) => c.status === "escalated" || c.status === "failed").length;
    return { total, completed, waiting, escalated };
  }, [queue]);

  return (
    <section className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recovery Inbox</CardTitle>
          <CardDescription>
            Autonomous failure recovery queue by patient and workflow break.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            size="sm"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await runRecoveryAutopilot(selectedPatientId ?? undefined);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Running recovery scan..." : "Run recovery scan"}
          </Button>
          <ScrollArea className="h-56 rounded-md border border-border/60">
            <ul className="space-y-2 p-2">
              {queue.length === 0 ? (
                <li className="text-xs text-muted-foreground">
                  No open recovery cases yet.
                </li>
              ) : (
                queue.map((c) => (
                  <li key={c.id} className="rounded-md border border-border/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{c.title}</p>
                      <Badge variant={metricClass(c.status) as never} className="capitalize">
                        {c.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[0.72rem] text-muted-foreground">{c.summary}</p>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="xl:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recovery Case Drawer</CardTitle>
          <CardDescription>Timeline and action trace for the selected case.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {!selected ? (
            <p className="text-muted-foreground">Select a patient and run recovery scan.</p>
          ) : (
            <>
              <div className="rounded-md border border-border/60 p-2">
                <p className="font-medium">{selected.title}</p>
                <p className="mt-1 text-muted-foreground">{selected.summary}</p>
                <p className="mt-1 text-muted-foreground">
                  Failure kind: {selected.failureKind.replaceAll("_", " ")}
                </p>
              </div>
              <div className="rounded-md border border-border/60 p-2">
                <p className="font-medium">Actions</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {actions.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      {a.kind.replaceAll("_", " ")} - {a.status}
                    </li>
                  ))}
                  {actions.length === 0 ? <li>No actions yet.</li> : null}
                </ul>
              </div>
              <div className="rounded-md border border-border/60 p-2">
                <p className="font-medium">SLA</p>
                <p className="mt-1 text-muted-foreground">
                  {activeSla
                    ? `${activeSla.label}: ${new Date(activeSla.dueAt).toLocaleString()}`
                    : "No active SLA timer"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appeal Composer + Command Center</CardTitle>
          <CardDescription>Generated appeal artifacts and live operational metrics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Appeal Package</p>
            {appeal ? (
              <>
                <p className="mt-1 text-muted-foreground">{appeal.pdfFileName}</p>
                <p className="mt-1 text-muted-foreground line-clamp-4">{appeal.letterMarkdown}</p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">No appeal package generated yet.</p>
            )}
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Command Center metrics</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>Total cases: {metrics.total}</li>
              <li>Completed: {metrics.completed}</li>
              <li>Waiting external: {metrics.waiting}</li>
              <li>Escalated/failed: {metrics.escalated}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
