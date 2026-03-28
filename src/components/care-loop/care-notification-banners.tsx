"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CareNotificationBanner } from "@/lib/care-journey-timeline";
import { cn } from "@/lib/utils";
import { Bell, PackageX, PhoneMissed, ShieldAlert } from "lucide-react";

const toneClass: Record<CareNotificationBanner["tone"], string> = {
  warning:
    "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.07] to-transparent text-foreground [&_[data-slot=alert-description]]:text-amber-950/80 dark:[&_[data-slot=alert-description]]:text-amber-100/80",
  destructive:
    "border-destructive/40 bg-destructive/[0.06] [&_[data-slot=alert-description]]:text-destructive/90",
  info: "border-sky-500/35 bg-gradient-to-br from-sky-500/[0.06] to-transparent [&_[data-slot=alert-description]]:text-muted-foreground",
};

const kindIcon: Record<CareNotificationBanner["kind"], typeof Bell> = {
  missed_pickup: PackageX,
  missed_followup: PhoneMissed,
  adherence_reminder: Bell,
  risk_escalation: ShieldAlert,
};

export function CareNotificationBanners({
  notifications,
  className,
}: {
  notifications: CareNotificationBanner[];
  className?: string;
}) {
  if (notifications.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {notifications.map((n) => {
        const Icon = kindIcon[n.kind];
        return (
          <Alert
            key={n.id}
            className={cn("py-3 pr-3 shadow-sm", toneClass[n.tone])}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <AlertTitle className="text-sm font-semibold leading-snug">
              {n.title}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {n.description}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
