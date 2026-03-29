"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Link2,
  Pill,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

const benefits = [
  {
    title: "Prepare visits faster",
    body: "AI turns scattered records into a short brief—so you walk in knowing what to ask and what to watch for.",
    icon: Sparkles,
  },
  {
    title: "Close care gaps after the visit",
    body: "Prescriptions, reminders, and pickup stay on one thread—fewer dropped handoffs between clinic, pharmacy, and patient.",
    icon: Link2,
  },
  {
    title: "Measure completion across stakeholders",
    body: "One view of whether each party did their part—so value-based programs can see the full picture, not just a claim.",
    icon: BarChart3,
  },
] as const;

function WorkflowIllustration({ className }: { className?: string }) {
  const steps = [
    { label: "Chart", sub: "context", Icon: Activity },
    { label: "AI", sub: "summary", Icon: Sparkles },
    { label: "Plan & Rx", sub: "signed", Icon: Stethoscope },
    { label: "Pharmacy", sub: "ready", Icon: Pill },
    { label: "Patient", sub: "informed", Icon: Users },
    { label: "Payer", sub: "closure", Icon: BarChart3 },
  ];

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card px-2 py-3 shadow-care-card sm:px-4 sm:py-4",
        className,
      )}
    >
      <p className="text-label mb-2 text-center text-[0.6rem] sm:mb-3 sm:text-[0.65rem]">
        How it flows — one loop, shared state
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-0 gap-y-3 px-1 sm:flex-nowrap sm:gap-y-0 sm:px-2">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <div className="flex w-[4.25rem] shrink-0 flex-col items-center text-center sm:w-[4.75rem] md:w-auto md:min-w-[4.5rem]">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-card shadow-sm sm:size-10 md:size-11">
                <s.Icon className="size-4 text-primary md:size-[1.15rem]" aria-hidden />
              </span>
              <span className="mt-1.5 text-[0.65rem] font-semibold leading-tight text-foreground sm:text-[0.7rem]">
                {s.label}
              </span>
              <span className="text-[0.55rem] text-muted-foreground sm:text-[0.6rem]">{s.sub}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="hidden h-px w-2 shrink-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent sm:block sm:min-w-[6px] md:min-w-3"
                aria-hidden
              />
            )}
          </Fragment>
        ))}
      </div>
      <p className="mx-auto mt-2 max-w-lg px-1 text-center text-[0.6rem] leading-snug text-muted-foreground sm:mt-3 sm:text-[0.65rem] md:text-xs">
        Not five separate tools — one demo where provider, patient, pharmacy, and payer screens all
        update together.
      </p>
    </div>
  );
}

export function CareLoopLanding() {
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="care-canvas flex h-[100dvh] w-full min-h-0 flex-col overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-5 md:px-8">
        <header className="shrink-0 text-center">
          <p className="text-label mb-1.5 text-[0.6rem] sm:mb-2 sm:text-[0.65rem]">Hackathon prototype</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-tight">
            CareLoop AI
          </h1>
          <p className="mx-auto mt-2 max-w-2xl px-1 text-sm font-medium leading-snug text-foreground sm:mt-3 sm:text-base md:text-lg">
            Connect prep, prescribing, fulfillment, and proof—in one live system instead of four
            disconnected tools.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:mt-5 sm:gap-3">
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-care-card transition-colors sm:h-10 sm:px-8 sm:text-base",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Run Demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/provider"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors sm:h-10 sm:px-5 sm:text-base",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Open provider view
            </Link>
          </div>
        </header>

        <section className="mt-4 min-h-0 shrink-0 sm:mt-5 md:mt-6">
          <WorkflowIllustration />
        </section>

        <section className="mt-3 flex min-h-0 flex-1 flex-col justify-center sm:mt-4">
          <h2 className="text-center text-xs font-semibold text-foreground sm:text-sm md:text-base">
            Why it matters
          </h2>
          <p className="mx-auto mt-0.5 max-w-lg text-center text-[0.65rem] text-muted-foreground sm:text-xs">
            Plain language — no clinical jargon required to get the idea.
          </p>
          <ul className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-3 sm:gap-3 md:gap-4">
            {benefits.map(({ title, body, icon: Icon }) => (
              <li key={title} className="min-h-0">
                <Card className="h-full border-border/80 shadow-care-card">
                  <CardContent className="flex flex-col gap-1.5 p-3 pt-4 sm:gap-2 sm:p-4 sm:pt-5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-9">
                      <Icon className="size-4 sm:size-[1.1rem]" aria-hidden />
                    </span>
                    <h3 className="text-xs font-semibold leading-snug text-foreground sm:text-sm">{title}</h3>
                    <p className="line-clamp-4 text-[0.65rem] leading-relaxed text-muted-foreground sm:line-clamp-none sm:text-xs">
                      {body}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <footer className="shrink-0 pt-2 text-center text-[0.6rem] text-muted-foreground sm:pt-3 sm:text-[0.65rem]">
          CareLoop AI · closed-loop care workflow demo
        </footer>
      </div>
    </div>
  );
}
