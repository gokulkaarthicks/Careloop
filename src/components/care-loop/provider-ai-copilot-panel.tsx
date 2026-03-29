"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AiHistorySummary, ClinicalRisk } from "@/types/workflow";
import {
  AlertTriangle,
  BrainCircuit,
  HelpCircle,
  ListChecks,
  Sparkles,
} from "lucide-react";

function RiskRow({ risk }: { risk: ClinicalRisk }) {
  const tone =
    risk.severity === "high"
      ? "border-destructive/40 bg-destructive/5"
      : risk.severity === "moderate"
        ? "border-amber-500/35 bg-amber-500/5"
        : "border-border bg-muted/30";
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0 opacity-80" />
        <span className="font-medium leading-tight">{risk.label}</span>
        <Badge variant="outline" className="text-[0.65rem] uppercase">
          {risk.severity}
        </Badge>
      </div>
      <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
        {risk.rationale}
      </p>
    </div>
  );
}

export function ProviderAiCopilotPanel({
  ai,
  aiLoading,
  hasOpenedVisit,
}: {
  ai: AiHistorySummary | undefined;
  aiLoading: boolean;
  hasOpenedVisit: boolean;
}) {
  return (
    <aside className="flex w-full flex-col xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)] xl:w-[380px] xl:shrink-0">
      <Card className="border-primary/15 bg-gradient-to-b from-primary/5 via-background to-background shadow-md">
        <CardHeader className="space-y-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BrainCircuit className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Care Orchestrator Copilot
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Pre-visit intelligence · not a chatbot
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[min(70vh,640px)] pr-3 xl:h-[min(75vh,720px)]">
            {!hasOpenedVisit && (
              <p className="text-xs text-muted-foreground">
                Open the encounter from the schedule to load AI context for this
                visit.
              </p>
            )}
            {hasOpenedVisit && aiLoading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 animate-pulse" />
                Synthesizing history…
              </p>
            )}
            {hasOpenedVisit && !aiLoading && !ai && (
              <p className="text-xs text-muted-foreground">
                Run <strong>Load AI summary</strong> in the pre-visit tab to
                populate copilot output.
              </p>
            )}
            {ai && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={ai.mock ? "secondary" : "default"}>
                      {ai.mock ? "Rule-based" : "Model-generated"}
                    </Badge>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {new Date(ai.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {ai.narrative}
                  </p>
                </div>

                <Separator />

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <HelpCircle className="size-3.5" />
                    Suggested questions
                  </div>
                  <ol className="list-decimal space-y-1.5 pl-4 text-[0.7rem] leading-relaxed text-muted-foreground">
                    {(ai.suggestedQuestions?.length
                      ? ai.suggestedQuestions
                      : [
                          "Interval hospitalizations or ED visits?",
                          "Home BP readings and technique?",
                        ]
                    ).map((q, i) => (
                      <li key={i} className="text-foreground/85">
                        {q}
                      </li>
                    ))}
                  </ol>
                </div>

                <Separator />

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ListChecks className="size-3.5" />
                    Red flags & risks
                  </div>
                  <div className="space-y-2">
                    {ai.risks.map((r) => (
                      <RiskRow key={r.id} risk={r} />
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Visit focus
                  </p>
                  <ul className="space-y-1 text-[0.7rem] text-muted-foreground">
                    {ai.suggestedFocus.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">·</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </aside>
  );
}
