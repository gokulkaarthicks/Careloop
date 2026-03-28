"use client";

import type { Patient } from "@/types/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

export function PatientCard({
  patient,
  className,
}: {
  patient: Patient | null | undefined;
  className?: string;
}) {
  if (!patient) {
    return (
      <Card className={cn("border-border/80 shadow-care-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Patient</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">No patient selected</CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/80 shadow-care-card", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <User className="size-4 text-primary" aria-hidden />
          Patient
        </CardTitle>
        <Badge variant="neutral" className="text-[0.65rem]">
          {patient.status}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium text-foreground">{patient.displayName}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">MRN</span>
          <span className="tabular-nums">{patient.mrn}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">DOB</span>
          <span>{patient.dateOfBirth}</span>
        </div>
      </CardContent>
    </Card>
  );
}
