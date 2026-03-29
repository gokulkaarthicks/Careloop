"use client";

import {
  advanceGuidedStoryStep,
  GUIDED_STORY_STEPS,
  GUIDED_STORY_TOTAL_STEPS,
  restartGuidedStoryWithCohortReset,
} from "@/lib/demo/guided-story";
import { cn } from "@/lib/utils";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2, BookOpen } from "lucide-react";
import { useCallback, useState } from "react";

export function GuidedStoryPanel({ className }: { className?: string }) {
  const guided = useCareWorkflowStore((s) => s.guidedStory);
  const resetGuidedStory = useCareWorkflowStore((s) => s.resetGuidedStory);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const advancing = guided.status === "advancing";
  const complete = guided.nextStepIndex >= GUIDED_STORY_TOTAL_STEPS;
  const failed = guided.status === "error";

  const onNext = useCallback(async () => {
    setLocalErr(null);
    const r = await advanceGuidedStoryStep();
    if (!r.ok) setLocalErr(r.error);
  }, []);

  const nextDef = complete ? null : GUIDED_STORY_STEPS[guided.nextStepIndex];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-care-card",
        className,
      )}
    >
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-[1.1rem]" aria-hidden />
            </span>
            <div>
              <p className="text-label">Guided story</p>
              <h2 className="text-sm font-semibold tracking-tight">Walk the closed loop</h2>
              <p className="text-[0.7rem] text-muted-foreground">
                Jordan Ellis cohort · advance one beat at a time
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={advancing || complete}
              onClick={() => void onNext()}
            >
              {advancing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {complete ? "Story complete" : "Next step"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={advancing}
              onClick={() => {
                setLocalErr(null);
                resetGuidedStory();
              }}
            >
              Reset story
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={advancing}
              onClick={() => {
                setLocalErr(null);
                restartGuidedStoryWithCohortReset();
              }}
            >
              Restart + cohort
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <p className="text-label mb-2">
            Progress · {Math.min(guided.nextStepIndex, GUIDED_STORY_TOTAL_STEPS)}/
            {GUIDED_STORY_TOTAL_STEPS}
          </p>
          <ol className="space-y-1.5">
            {GUIDED_STORY_STEPS.map((step, i) => {
              const done = guided.nextStepIndex > i;
              const active = !complete && guided.nextStepIndex === i;
              const spin = active && advancing;
              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex gap-2 rounded-lg px-2 py-1.5 text-xs",
                    active && "bg-primary/10",
                    done && "text-foreground/90",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  ) : spin ? (
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : (
                    <Circle
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        active ? "text-primary" : "text-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="font-medium">{i + 1}. </span>
                    {step.title}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
          <p className="text-label mb-1">Next beat</p>
          {complete ? (
            <p className="text-sm text-muted-foreground">
              Full loop finished. Open Provider, Patient, Pharmacy, and Payer - state is
              synced. Use <strong className="font-medium text-foreground">Restart + cohort</strong>{" "}
              to run again from a clean slate.
            </p>
          ) : nextDef ? (
            <>
              <p className="text-sm font-medium leading-snug">{nextDef.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {nextDef.description}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {(failed && guided.errorMessage) || localErr ? (
        <div className="border-t px-4 pb-4 pt-2">
          <Alert variant="destructive">
            <AlertTitle>Step did not complete</AlertTitle>
            <AlertDescription className="text-xs">
              {localErr ?? guided.errorMessage}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </section>
  );
}
