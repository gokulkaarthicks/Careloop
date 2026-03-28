import Link from "next/link";
import { Fragment } from "react";
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
        "relative w-full overflow-x-auto rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card px-3 py-8 shadow-care-card sm:px-6",
        className,
      )}
    >
      <p className="text-label mb-6 text-center">How it flows — one loop, shared state</p>
      <div className="flex min-w-[600px] items-center justify-center gap-0 px-2 sm:min-w-0 sm:px-0">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <div className="flex w-[4.5rem] shrink-0 flex-col items-center text-center sm:w-auto sm:min-w-[5rem]">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border/80 bg-card shadow-sm sm:size-12">
                <s.Icon className="size-5 text-primary sm:size-[1.35rem]" aria-hidden />
              </span>
              <span className="mt-2 text-[0.7rem] font-semibold leading-tight text-foreground sm:text-xs">
                {s.label}
              </span>
              <span className="text-[0.6rem] text-muted-foreground sm:text-[0.65rem]">{s.sub}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px min-w-[8px] flex-1 bg-gradient-to-r from-transparent via-primary/35 to-transparent sm:min-w-[16px]"
                aria-hidden
              />
            )}
          </Fragment>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-lg text-center text-[0.65rem] leading-relaxed text-muted-foreground sm:text-xs">
        Not five separate tools — one demo where provider, patient, pharmacy, and payer screens all
        update together.
      </p>
    </div>
  );
}

export function CareLoopLanding() {
  return (
    <div className="care-canvas">
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-4 pb-16 pt-12 md:px-8 md:pt-16">
        <header className="text-center">
          <p className="text-label mb-3">Hackathon prototype</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            CareLoop AI
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium leading-snug text-foreground md:text-xl">
            Connect prep, prescribing, fulfillment, and proof—in one live system instead of four
            disconnected tools.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground shadow-care-card transition-colors",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Run Demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/provider"
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-5 text-base font-medium transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Open provider view
            </Link>
          </div>
        </header>

        <section className="mt-16 md:mt-20">
          <WorkflowIllustration />
        </section>

        <section className="mt-14 md:mt-16">
          <h2 className="text-center text-sm font-semibold text-foreground md:text-base">
            Why it matters
          </h2>
          <p className="mx-auto mt-1 max-w-lg text-center text-xs text-muted-foreground">
            Plain language — no clinical jargon required to get the idea.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {benefits.map(({ title, body, icon: Icon }) => (
              <li key={title}>
                <Card className="h-full border-border/80 shadow-care-card transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-5 pt-6">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-sm font-semibold leading-snug text-foreground">{title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-auto pt-16 text-center text-[0.65rem] text-muted-foreground">
          CareLoop AI · closed-loop care workflow demo
        </footer>
      </div>
    </div>
  );
}
