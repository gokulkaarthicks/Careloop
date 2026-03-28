"use client";

import { runCareLoopWorkflow } from "@/lib/orchestration/run-care-loop-workflow";
import { cn } from "@/lib/utils";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { PrescriptionLine } from "@/types/workflow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Loader2,
  PlayCircle,
  RotateCcw,
  Workflow,
} from "lucide-react";

type Props = {
  patientId: string;
  appointmentId: string | undefined;
  providerId: string;
  pharmacyId: string;
  soapNote: string;
  treatmentPlan: string;
  prescriptionLines: PrescriptionLine[];
  visitFinalized: boolean;
};

export function CareLoopOrchestrationPanel({
  patientId,
  appointmentId,
  providerId,
  pharmacyId,
  soapNote,
  treatmentPlan,
  prescriptionLines,
  visitFinalized,
}: Props) {
  const orch = useCareWorkflowStore((s) => s.careLoopOrchestration);
  const resetCareLoopOrchestration = useCareWorkflowStore(
    (s) => s.resetCareLoopOrchestration,
  );

  const running = orch.status === "running";
  const done = orch.status === "complete";
  const failed = orch.status === "error";

  const doneCount = orch.steps.filter((x) => x.status === "done").length;
  const progressPct = (doneCount / Math.max(orch.steps.length, 1)) * 100;

  const canRun =
    !visitFinalized &&
    !!appointmentId &&
    soapNote.trim().length > 20 &&
    treatmentPlan.trim().length > 10 &&
    prescriptionLines.length > 0 &&
    prescriptionLines.every((l) => l.drugName.trim().length > 0) &&
    !running;

  async function handleRun() {
    if (!appointmentId || !canRun) return;
    await runCareLoopWorkflow({
      patientId,
      appointmentId,
      providerId,
      pharmacyId,
      soapNote,
      treatmentPlan,
      prescriptionLines,
      stepDelayMs: 380,
    });
  }

  return (
    <Card className="border border-dashed border-primary/25 bg-primary/[0.02] shadow-care-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-label">Automation</p>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Workflow className="size-4 text-primary" />
              Loop orchestration
            </CardTitle>
            <CardDescription className="max-w-xl text-xs">
              End-to-end pipeline across portals from this draft — same mock store
              everywhere.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!canRun}
              onClick={handleRun}
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              Run full workflow
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={running}
              onClick={() => resetCareLoopOrchestration()}
            >
              <RotateCcw className="size-3.5" />
              Reset progress
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Step progress</span>
            <span>
              {doneCount}/{orch.steps.length} complete
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <ol className="space-y-2">
          {orch.steps.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs",
                s.status === "active" && "border-primary bg-primary/5",
                s.status === "done" && "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20",
                s.status === "error" && "border-destructive/50 bg-destructive/5",
                s.status === "pending" && "border-transparent bg-muted/30",
              )}
            >
              {s.status === "done" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : s.status === "active" ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
              ) : s.status === "error" ? (
                <Circle className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div>
                <span className="font-medium text-foreground">
                  {i + 1}. {s.label}
                </span>
              </div>
            </li>
          ))}
        </ol>

        {failed && orch.errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Workflow stopped</AlertTitle>
            <AlertDescription className="text-xs">{orch.errorMessage}</AlertDescription>
          </Alert>
        )}

        {done && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Full loop finished — check patient, pharmacy, and payer tabs for updated
            state.
          </p>
        )}

        {!canRun && !visitFinalized && !running && (
          <p className="text-[0.7rem] text-muted-foreground">
            Fill SOAP, treatment plan, and at least one medication line, then start the
            visit if it is still scheduled.
          </p>
        )}

        {visitFinalized && (
          <p className="text-[0.7rem] text-muted-foreground">
            This visit is already finalized — reset the demo to run orchestration again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
