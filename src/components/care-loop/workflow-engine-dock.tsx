"use client";

import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

function kindLabel(kind: string): string {
  return kind.replaceAll("_", " ");
}

/**
 * Persistent glass-style workflow strip — live agentic events + optional primary action (Provider finalize).
 */
export function WorkflowEngineDock() {
  const events = useCareWorkflowStore(
    (s) => s.snapshot.workflowEngineEvents ?? [],
  );
  const primary = useCareWorkflowStore((s) => s.workflowDockPrimaryAction);
  const agentActivity = useCareWorkflowStore((s) => s.agentActivity);
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname() ?? "";
  const onProvider = pathname.includes("/provider");
  const showPrimary = onProvider && primary;

  const running = agentActivity.visible && agentActivity.status === "running";

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-stretch border-t border-border/60 bg-background/75 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/65",
      )}
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-col gap-1 px-3 py-2 md:px-4 md:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <Activity className="size-3.5 text-primary" />
            Workflow engine
            {expanded ?
              <ChevronDown className="size-3.5" />
            : <ChevronUp className="size-3.5" />}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {running ?
              <Badge variant="secondary" className="gap-1 font-normal">
                <Loader2 className="size-3 animate-spin" />
                {agentActivity.headline}
              </Badge>
            : agentActivity.visible && agentActivity.status === "success" ?
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              >
                {agentActivity.headline}
              </Badge>
            : (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Idle — events append on finalize / PA / pharmacy
              </Badge>
            )}
            {showPrimary ?
              <Button
                size="sm"
                disabled={primary.disabled}
                className="h-8 gap-1.5"
                onClick={() => primary.onClick()}
              >
                {primary.loading ?
                  <Loader2 className="size-3.5 animate-spin" />
                : null}
                {primary.label}
              </Button>
            : null}
          </div>
        </div>

        {expanded ?
          <ScrollArea className="h-[min(22vh,200px)] rounded-lg border border-border/50 bg-muted/20 pr-3">
            <ul className="space-y-2 py-1 text-xs">
              {events.length === 0 ?
                <li className="px-2 py-6 text-center text-muted-foreground">
                  <Bot className="mx-auto mb-2 size-6 opacity-40" />
                  No engine events yet — finalize an encounter or resolve a PA on the
                  Payer tab.
                </li>
              : events.slice(0, 24).map((e) => (
                  <li
                    key={e.id}
                    className="rounded-md border border-transparent bg-background/80 px-2 py-1.5 leading-snug"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[0.6rem] uppercase text-muted-foreground">
                        {kindLabel(e.kind)}
                      </span>
                      {e.role ?
                        <Badge variant="outline" className="h-4 px-1 text-[0.55rem] font-normal">
                          {e.role}
                        </Badge>
                      : null}
                      <span className="text-[0.6rem] text-muted-foreground">
                        {new Date(e.occurredAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">{e.title}</p>
                    {e.detail ?
                      <p className="text-[0.7rem] text-muted-foreground">{e.detail}</p>
                    : null}
                  </li>
                ))
              }
            </ul>
          </ScrollArea>
        : null}
      </div>
    </div>
  );
}
