"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  BarChart3,
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

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card px-2 py-3 shadow-care-card sm:px-4 sm:py-4",
        className,
      )}
    >
      <p className="text-label mb-2 text-center text-[0.6rem] sm:mb-3 sm:text-[0.65rem]">
        How it flows - one loop, shared state
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
        Not five separate tools - one demo where provider, patient, pharmacy, and payer screens all
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.65rem] font-medium text-primary sm:text-xs">
            Built for Value-Based Care (VBC)
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-tight">
            CareLoop AI
          </h1>
          <p className="mx-auto mt-2 max-w-2xl px-1 text-sm font-medium leading-snug text-foreground sm:mt-3 sm:text-base md:text-lg">
            Connect prep, prescribing, fulfillment, and proof-in one live system instead of four
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
            One platform. Every stakeholder gets exactly what they need.
          </p>
          <ul className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2 sm:mt-3 sm:grid-cols-4 sm:gap-3 md:gap-4">
            {personas.map(({ role, icon: Icon, headline, body, accent }) => (
              <li key={role} className="min-h-0">
                <Card className="h-full border-border/80 shadow-care-card">
                  <CardContent className="flex h-full flex-col gap-2 p-3 pt-4 sm:p-4 sm:pt-5">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 ${accent}`}>
                        <Icon className="size-4 sm:size-[1.1rem]" aria-hidden />
                      </span>
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground sm:text-[0.7rem]">
                        {role}
                      </p>
                    </div>
                    <h3 className="text-xs font-semibold leading-snug text-foreground sm:text-sm">
                      {headline}
                    </h3>
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
