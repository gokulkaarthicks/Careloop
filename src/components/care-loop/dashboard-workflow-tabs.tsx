"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkflowStage } from "@/types/workflow";
import {
  Building2,
  ClipboardList,
  HeartPulse,
  Landmark,
  Pill,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STAGES: {
  id: WorkflowStage;
  label: string;
  short: string;
  owner: string;
  href: string;
  icon: typeof Stethoscope;
}[] = [
  {
    id: "intake",
    label: "Intake",
    short: "Open the visit, verify identity, and load chart context.",
    owner: "Provider",
    href: "/provider",
    icon: ClipboardList,
  },
  {
    id: "ai_review",
    label: "AI review",
    short: "Summarize history, surface gaps, and highlight risks before decisions.",
    owner: "Provider",
    href: "/provider",
    icon: Sparkles,
  },
  {
    id: "planning",
    label: "Plan",
    short: "Reconcile problems, allergies, and goals into a documented plan.",
    owner: "Provider",
    href: "/provider",
    icon: Stethoscope,
  },
  {
    id: "prescribing",
    label: "Prescribe",
    short: "Sign SOAP, transmit e-Rx, and hand off to pharmacy systems.",
    owner: "Provider",
    href: "/provider",
    icon: Pill,
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    short: "Fill, stage readiness, and confirm pickup with the patient.",
    owner: "Pharmacy",
    href: "/pharmacy",
    icon: Building2,
  },
  {
    id: "patient_followup",
    label: "Follow-up",
    short: "Tasks, adherence nudges, and symptom check-ins after the visit.",
    owner: "Patient",
    href: "/patient",
    icon: HeartPulse,
  },
  {
    id: "payer_closure",
    label: "Payer",
    short: "Closure score and claim posture for value-based reporting.",
    owner: "Payer",
    href: "/payer",
    icon: Landmark,
  },
];

export function DashboardWorkflowTabs({ stage }: { stage?: WorkflowStage }) {
  const initial = stage ?? "intake";

  return (
    <Card className="overflow-hidden shadow-care-card">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <CardTitle className="text-base font-semibold">Workflow stages</CardTitle>
        <CardDescription className="text-xs">
          Same loop across portals — select a stage to see ownership and the next
          clinical action.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs key={initial} defaultValue={initial} className="gap-0">
          <div className="overflow-x-auto border-b border-border/60 bg-background px-3 pt-3 pb-0 sm:px-4">
            <TabsList
              variant="line"
              className="mb-0 h-auto w-max min-w-full justify-start gap-0 bg-transparent p-0 sm:flex-wrap"
            >
              {STAGES.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="shrink-0 rounded-none border-0 px-3 py-2.5 text-xs data-active:border-b-2 data-active:border-primary data-active:bg-transparent data-active:text-foreground sm:text-[0.8rem]"
                >
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {STAGES.map((s) => {
            const Icon = s.icon;
            return (
              <TabsContent
                key={s.id}
                value={s.id}
                className="m-0 border-0 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {s.label}
                        </span>
                        <Badge variant="neutral" className="text-[0.65rem] font-medium">
                          {s.owner}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {s.short}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={s.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "shrink-0 self-start",
                    )}
                  >
                    Open workspace
                  </Link>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
