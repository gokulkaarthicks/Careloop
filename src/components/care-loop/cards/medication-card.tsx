"use client";

import type { Medication } from "@/types/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Pill } from "lucide-react";

export function MedicationCard({
  medication,
  className,
}: {
  medication: Medication | null | undefined;
  className?: string;
}) {
  if (!medication) {
    return (
      <Card className={cn("border-border/80 shadow-care-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Medication</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">—</CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/80 shadow-care-card", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Pill className="size-4 text-primary" aria-hidden />
          {medication.name}
        </CardTitle>
        <Badge variant="outline" className="text-[0.65rem] capitalize">
          {medication.status}
        </Badge>
      </CardHeader>
      <CardContent className="text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{medication.dose}</span>
          {medication.route ? ` · ${medication.route}` : ""} · {medication.frequency}
        </p>
      </CardContent>
    </Card>
  );
}
