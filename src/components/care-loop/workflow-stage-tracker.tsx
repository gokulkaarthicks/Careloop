"use client";

import { cn } from "@/lib/utils";
import type { WorkflowStage } from "@/types/workflow";
import { Check } from "lucide-react";

const STAGES: { id: WorkflowStage; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "ai_review", label: "AI review" },
  { id: "planning", label: "Plan" },
  { id: "prescribing", label: "Rx" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "patient_followup", label: "Follow-up" },
  { id: "payer_closure", label: "Payer" },
];

function stageIndex(stage: WorkflowStage) {
  return STAGES.findIndex((s) => s.id === stage);
}

export function WorkflowStageTracker({
  current,
  className,
}: {
  current: WorkflowStage;
  className?: string;
}) {
  const idx = stageIndex(current);

  return (
    <div className={cn("w-full", className)}>
      <p className="text-label mb-2.5">Encounter stage</p>
      <ol className="flex flex-wrap gap-2 md:gap-0 md:flex-nowrap md:items-center md:justify-between">
        {STAGES.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li
              key={s.id}
              className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial md:gap-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold tabular-nums transition-colors",
                    done &&
                      "border-primary bg-primary text-primary-foreground shadow-sm",
                    active &&
                      !done &&
                      "border-primary bg-background text-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.18)]",
                    !done && !active && "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-[0.7rem] font-medium md:max-w-[5.5rem]",
                    active && "text-foreground",
                    !active && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "hidden h-px flex-1 bg-border/90 md:mx-2 md:block md:min-w-[12px]",
                    i < idx ? "bg-primary/70" : "",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
