"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Heart,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

const personas = [
  {
    role: "Provider",
    icon: Stethoscope,
    headline: "Walk in prepared. Leave with the loop closed.",
    body: "AI-generated chart summaries surface risks before the visit. Draft SOAP notes and sign prescriptions in one step - no tab switching.",
    accent: "text-blue-600 bg-blue-500/10",
  },
  {
    role: "Patient",
    icon: Heart,
    headline: "Know what happened. Stay on track.",
    body: "Plain-language visit recaps, medication reminders, and one-tap check-ins keep you connected to your care team between visits.",
    accent: "text-rose-600 bg-rose-500/10",
  },
  {
    role: "Pharmacy",
    icon: Pill,
    headline: "Orders arrive the moment they're signed.",
    body: "No fax, no phone tag. Real-time Rx handoff with full patient context - mark orders ready and the patient's loop updates instantly.",
    accent: "text-teal-600 bg-teal-500/10",
  },
  {
    role: "Payer",
    icon: ShieldCheck,
    headline: "Closure metrics before the claim lands.",
    body: "VBC programs pay for outcomes, not volume. Track fill rates, adherence, and visit completion scores in real time - proof of care delivery that value-based contracts actually reward.",
    accent: "text-violet-600 bg-violet-500/10",
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

  const flowPeriodSec = 3.9;
  const n = steps.length;

  return (
    <div
      className={cn(
        "mx-auto w-fit max-w-full rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card px-3 py-2 shadow-care-card motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0 sm:px-4 sm:py-2.5",
        "animate-landing-fade-up opacity-0",
        className,
      )}
    >
      <p className="text-label mb-1.5 text-center text-[0.6rem] sm:mb-2 sm:text-[0.65rem]">
        How it flows - one loop, shared state
      </p>
      <div className="flex flex-nowrap items-center justify-center gap-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-0.5 [&::-webkit-scrollbar]:hidden">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <div
              className={cn(
                "flex w-[4.25rem] shrink-0 flex-col items-center text-center motion-reduce:animate-none sm:w-[4.5rem] md:min-w-[4.25rem]",
                "animate-landing-flow-node",
              )}
              style={{
                animationDelay: `${(i * flowPeriodSec) / n}s`,
              }}
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-card shadow-sm sm:size-10">
                <s.Icon className="size-4 text-primary sm:size-[1.05rem]" aria-hidden />
              </span>
              <span className="mt-1 text-[0.65rem] font-semibold leading-tight text-foreground sm:text-[0.7rem]">
                {s.label}
              </span>
              <span className="text-[0.55rem] text-muted-foreground sm:text-[0.6rem]">{s.sub}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight
                className="mx-0.5 size-4 shrink-0 self-center animate-landing-flow-arrow text-primary motion-reduce:animate-none sm:mx-1 sm:size-[1.125rem]"
                strokeWidth={2.25}
                aria-hidden
                style={{
                  animationDelay: `${((i + 0.5) * flowPeriodSec) / n}s`,
                }}
              />
            )}
          </Fragment>
        ))}
      </div>
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
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 py-3 sm:px-6 sm:py-4 md:px-8">
        {/* Single vertically centered column: no flex-1 dead zone below the cards */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:gap-4 md:gap-5">
          <header className="w-full shrink-0 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.65rem] font-medium text-primary sm:text-xs">
              Built for Value-Based Care (VBC)
            </span>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-tight">
              Care Orchestrator
            </h1>
            <p className="mx-auto mt-2 max-w-2xl px-1 text-sm font-medium leading-snug text-foreground sm:mt-3 sm:text-base md:text-lg">
              Connect prep, prescribing, fulfillment, and proof-in one live system instead of four
              disconnected tools.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:mt-4 sm:gap-3">
              <Link
                href="/dashboard"
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-care-card transition-colors sm:h-10 sm:px-8 sm:text-base",
                  "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Check flow
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </header>

          <section className="flex w-full shrink-0 justify-center">
            <WorkflowIllustration />
          </section>

          <section className="w-full max-w-4xl shrink-0">
            <h2 className="text-center text-xs font-semibold text-foreground sm:text-sm md:text-base">
              Why it matters
            </h2>
            <p className="mx-auto mt-0.5 max-w-lg text-center text-xs text-muted-foreground sm:text-sm">
              One platform. Every stakeholder gets exactly what they need.
            </p>
            {/* items-start + content-start keeps each cell exactly aspect-square (no stretched rows) */}
            <ul className="mt-2 grid w-full grid-cols-2 content-start items-start justify-items-stretch gap-2 sm:mt-3 sm:grid-cols-4 sm:gap-3">
              {personas.map(({ role, icon: Icon, headline, body, accent }, idx) => (
                <li
                  key={role}
                  className={cn(
                    "aspect-square min-h-0 min-w-0 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
                    "animate-landing-fade-up opacity-0",
                  )}
                  style={{ animationDelay: `${380 + idx * 75}ms` }}
                >
                  <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 shadow-care-card">
                    <CardContent className="flex h-full min-h-0 flex-col gap-1 p-2 pt-2.5 sm:gap-1.5 sm:p-2.5 sm:pt-3">
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-md sm:size-7 ${accent}`}
                        >
                          <Icon className="size-3 sm:size-3.5" aria-hidden />
                        </span>
                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground sm:text-xs">
                          {role}
                        </p>
                      </div>
                      <h3 className="shrink-0 text-xs font-semibold leading-snug text-foreground sm:text-[0.8125rem]">
                        {headline}
                      </h3>
                      <p className="min-h-0 flex-1 overflow-y-auto text-[0.7rem] leading-snug text-muted-foreground sm:text-xs">
                        {body}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="shrink-0 pb-1 pt-1 text-center text-[0.6rem] text-muted-foreground sm:text-[0.65rem]">
          Care Orchestrator · closed-loop care workflow demo
        </footer>
      </div>
    </div>
  );
}
