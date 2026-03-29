"use client";

import { PanelCard } from "@/components/care-loop/panel-card";

type Props = {
  title?: string;
  currentState: string;
  nextAction: string;
  reason: string;
};

export function WorkflowStateCard({
  title = "Current workflow state",
  currentState,
  nextAction,
  reason,
}: Props) {
  return (
    <PanelCard
      title={title}
      description="What is happening now, what happens next, and why."
    >
      <div className="grid gap-2 text-sm">
        <p>
          <span className="font-medium text-foreground">Current:</span> {currentState}
        </p>
        <p>
          <span className="font-medium text-foreground">Next action:</span> {nextAction}
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Why:</span> {reason}
        </p>
      </div>
    </PanelCard>
  );
}

