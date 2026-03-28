"use client";

import { useEffect, useRef } from "react";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { initialAgentActivity } from "@/types/agentic";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, Loader2, XCircle } from "lucide-react";

/**
 * Fixed bottom strip — shows which agent is running during agentic finalize.
 */
export function AgentActivityOverlay() {
  const agentActivity = useCareWorkflowStore((s) => s.agentActivity);
  const setAgentActivity = useCareWorkflowStore((s) => s.setAgentActivity);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!agentActivity.visible) return;
    if (agentActivity.status !== "success" && agentActivity.status !== "error") {
      return;
    }
    const delayMs = agentActivity.status === "error" ? 6000 : 2800;
    hideTimer.current = setTimeout(() => {
      setAgentActivity({
        ...initialAgentActivity,
        visible: false,
      });
    }, delayMs);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [agentActivity.status, agentActivity.visible, setAgentActivity]);

  if (!agentActivity.visible && agentActivity.status === "idle") return null;

  const show = agentActivity.visible || agentActivity.status === "error";

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 pb-6 md:p-6 md:pb-8"
      role="status"
      aria-live="polite"
      aria-label="Agent activity"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-lg flex-col gap-1 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md",
          agentActivity.status === "error" ?
            "border-destructive/40 bg-destructive/10 text-destructive-foreground"
          : "border-border/80 bg-background/90 text-foreground",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {agentActivity.status === "running" ?
              <Loader2 className="size-4 animate-spin text-primary" />
            : agentActivity.status === "success" ?
              <CheckCircle2 className="size-4 text-emerald-600" />
            : agentActivity.status === "error" ?
              <XCircle className="size-4" />
            : <Bot className="size-4 text-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Agentic workflow
            </p>
            <p className="text-sm font-semibold leading-snug">{agentActivity.headline}</p>
            <p className="text-xs text-muted-foreground">{agentActivity.subline}</p>
            {agentActivity.completedStepLabels.length > 0 &&
              agentActivity.status === "success" && (
                <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-[0.65rem] text-muted-foreground">
                  {agentActivity.completedStepLabels.slice(-6).map((line) => (
                    <li key={line}>✓ {line}</li>
                  ))}
                </ul>
              )}
            {agentActivity.errorMessage && (
              <p className="mt-1 text-xs text-destructive">{agentActivity.errorMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
