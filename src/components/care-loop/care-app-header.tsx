"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";
import type { Patient } from "@/types/workflow";
import { Badge } from "@/components/ui/badge";

export function CareAppHeader() {
  const pathname = usePathname();
  const patients = useCareWorkflowStore((s) => s.snapshot.patients);
  const selectedPatientId = useCareWorkflowStore((s) => s.selectedPatientId);
  const selectPatient = useCareWorkflowStore((s) => s.selectPatient);
  const mergeEhrPatientDirectory = useCareWorkflowStore(
    (s) => s.mergeEhrPatientDirectory,
  );
  const hydrateFromEhrApi = useCareWorkflowStore((s) => s.hydrateFromEhrApi);
  const patient = patients.find((p) => p.id === selectedPatientId);

  useEffect(() => {
    fetch("/api/ehr/patients")
      .then((r) => r.json())
      .then((d: { patients?: { id: string }[] }) => {
        if (d.patients?.length)
          mergeEhrPatientDirectory(d.patients as Patient[]);
      })
      .catch(() => {});
  }, [pathname, mergeEhrPatientDirectory]);

  useEffect(() => {
    void hydrateFromEhrApi(selectedPatientId);
  }, [selectedPatientId, hydrateFromEhrApi]);

  return (
    <header className="sticky top-0 z-20 flex h-[3.25rem] shrink-0 items-center gap-3 border-b border-border/80 bg-card/90 px-4 shadow-care-inset backdrop-blur-md supports-[backdrop-filter]:bg-card/75 md:px-8">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-6" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-label hidden sm:inline">Patient</span>
          <Select
            value={selectedPatientId}
            onValueChange={(v) => v && selectPatient(v)}
          >
            <SelectTrigger className="h-9 w-full min-w-[200px] max-w-[min(100%,320px)] border-border/80 bg-background/80 shadow-sm sm:w-[280px]">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.displayName} · {p.mrn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {patient && (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs font-medium bg-primary/10">
                {patient.displayName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex flex-col">
              <span className="truncate text-sm font-medium leading-none">
                {patient.displayName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                DOB {patient.dateOfBirth} · {patient.mrn}
              </span>
            </div>
            <Badge variant="neutral" className="hidden md:inline-flex shrink-0 text-[0.65rem]">
              Demo
            </Badge>
          </div>
        )}
      </div>
    </header>
  );
}
