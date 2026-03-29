"use client";

import { JUDGE_DEMO_STEP_DEFS } from "@/lib/demo/step-definitions";
import { cn } from "@/lib/utils";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABEL: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/provider": "Provider",
  "/pharmacy": "Pharmacy",
  "/patient": "Patient",
  "/payer": "Payer",
};

export function JudgeDemoTourBar() {
  const pathname = usePathname() ?? "";
  const judge = useCareWorkflowStore((s) => s.judgeDemo);
  const running = judge.status === "running";
  const active = judge.steps.find((s) => s.status === "active");
  const stepLabel =
    active?.label ??
    JUDGE_DEMO_STEP_DEFS[judge.currentStepIndex]?.label ??
    "";

  if (!running) return null;

  const here =
    ROUTE_LABEL[pathname] ?? (pathname.replace(/^\//, "") || "Home");

  return (
    <div
      className={cn(
        "border-b border-primary/20 bg-gradient-to-r from-primary/12 via-primary/6 to-transparent px-4 py-2.5",
        "text-[0.75rem] leading-snug",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          Demo tour
        </span>
        <span className="text-muted-foreground">
          Step {Math.min(judge.currentStepIndex + 1, JUDGE_DEMO_STEP_DEFS.length)} of{" "}
          {JUDGE_DEMO_STEP_DEFS.length}
          {stepLabel ? (
            <>
              {" "}
              · <span className="text-foreground">{stepLabel}</span>
            </>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3 shrink-0 opacity-70" aria-hidden />
          Viewing: {here}
        </span>
        <Link
          href="/dashboard"
          className="ml-auto font-medium text-primary underline-offset-4 hover:underline"
        >
          Dashboard & metrics
        </Link>
      </div>
    </div>
  );
}
