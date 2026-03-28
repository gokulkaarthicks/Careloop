"use client";

import { runJudgeDemo } from "@/lib/demo/run-judge-demo";
import { cn } from "@/lib/utils";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";

function MetricLine({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,88px)_minmax(0,88px)]">
      <span className="text-muted-foreground">{label}</span>
      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-center font-mono text-[0.65rem] tabular-nums">
        {before}
      </span>
      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-center font-mono text-[0.65rem] tabular-nums text-primary">
        {after}
      </span>
    </div>
  );
}

export function JudgeDemoPanel() {
  const judge = useCareWorkflowStore((s) => s.judgeDemo);
  const resetJudgeDemo = useCareWorkflowStore((s) => s.resetJudgeDemo);

  const running = judge.status === "running";
  const done = judge.status === "complete";
  const failed = judge.status === "error";

  const doneCount = judge.steps.filter((s) => s.status === "done").length;
  const pct = (doneCount / Math.max(judge.steps.length, 1)) * 100;

  const b = judge.beforeMetrics;
  const a = judge.afterMetrics;

  return (
    <section className="overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-muted/30 shadow-care-card">
      <div className="border-b border-border/60 bg-muted/25 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="size-[1.1rem]" aria-hidden />
            </span>
            <div>
              <p className="text-label">Pitch demo</p>
              <h2 className="text-sm font-semibold tracking-tight">Full encounter run</h2>
              <p className="text-[0.7rem] text-muted-foreground">
                One click · ~20s · synced across portals
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 shadow-sm"
              disabled={running}
              onClick={() => runJudgeDemo()}
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Run full encounter
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={running}
              onClick={() => resetJudgeDemo()}
            >
              Clear demo UI
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div>
          <p className="text-label mb-2">Live steps</p>
          <Progress value={pct} className="mb-3 h-2" />
          <ol className="space-y-1.5">
            {judge.steps.map((s, i) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                  s.status === "active" && "bg-primary/10",
                  s.status === "done" && "text-foreground/90",
                )}
              >
                {s.status === "done" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                ) : s.status === "active" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
                )}
                <span>
                  <span className="font-medium">{i + 1}.</span> {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-label mb-2">Before → after · Jordan Ellis</p>
          {b && a ? (
            <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
              <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-2 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Metric</span>
                <span className="text-center">Before</span>
                <span className="text-center">After</span>
              </div>
              <MetricLine
                label="Workflow stage"
                before={b.workflowStage.replaceAll("_", " ")}
                after={a.workflowStage.replaceAll("_", " ")}
              />
              <MetricLine
                label="Rx status"
                before={b.rxStatus.replaceAll("_", " ")}
                after={a.rxStatus.replaceAll("_", " ")}
              />
              <MetricLine
                label="Pharmacy order"
                before={b.pharmacyOrderStatus.replaceAll("_", " ")}
                after={a.pharmacyOrderStatus.replaceAll("_", " ")}
              />
              <MetricLine
                label="Picked up"
                before={b.pickedUp ? "yes" : "no"}
                after={a.pickedUp ? "yes" : "no"}
              />
              <MetricLine
                label="Follow-ups done"
                before={`${b.followUpsDone}/${b.followUpsTotal}`}
                after={`${a.followUpsDone}/${a.followUpsTotal}`}
              />
              <MetricLine
                label="Adherence checks"
                before={`${b.adherenceDone}/${b.adherenceTotal}`}
                after={`${a.adherenceDone}/${a.adherenceTotal}`}
              />
              <MetricLine
                label="Payer closure %"
                before={b.payerClosureScore != null ? String(b.payerClosureScore) : "—"}
                after={a.payerClosureScore != null ? String(a.payerClosureScore) : "—"}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              Run the demo to capture a before snapshot (after reset) and an after
              snapshot when the loop finishes.
            </p>
          )}
          {done && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <ArrowRight className="size-3.5" />
              Open Provider, Patient, Pharmacy, and Payer tabs — state is synced.
            </p>
          )}
        </div>
      </div>

      {failed && judge.errorMessage && (
        <div className="border-t px-4 pb-4">
          <Alert variant="destructive">
            <AlertTitle>Demo stopped</AlertTitle>
            <AlertDescription className="text-xs">{judge.errorMessage}</AlertDescription>
          </Alert>
        </div>
      )}
    </section>
  );
}
