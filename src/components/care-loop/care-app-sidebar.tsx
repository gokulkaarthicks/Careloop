"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  HeartPulse,
  LayoutDashboard,
  Pill,
  RotateCcw,
  Shield,
  Stethoscope,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useMockAuthStore } from "@/lib/auth/mock-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MockRole } from "@/lib/auth/mock-auth";
import { Button } from "@/components/ui/button";
import { useCareWorkflowStore } from "@/stores/care-workflow-store";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/provider", label: "Provider", icon: Stethoscope },
  { href: "/patient", label: "Patient", icon: HeartPulse },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/payer", label: "Payer", icon: Shield },
];

export function CareAppSidebar() {
  const pathname = usePathname();
  const session = useMockAuthStore((s) => s.session);
  const signInDemo = useMockAuthStore((s) => s.signInDemo);
  const resetDemo = useCareWorkflowStore((s) => s.resetDemo);

  return (
    <Sidebar collapsible="none">
      <SidebarHeader className="border-b border-sidebar-border/70 px-2 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent/80 focus-visible:ring-2"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Activity className="size-[1.05rem]" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
              CareLoop
            </span>
            <span className="truncate text-[0.65rem] text-muted-foreground">
              Ambulatory workflow
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-label">Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-label">Persona</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <Select
              value={session?.role ?? "provider"}
              onValueChange={(v) => v && signInDemo(v as MockRole)}
            >
              <SelectTrigger className="h-9 w-full bg-sidebar-accent/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provider">Provider</SelectItem>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
                <SelectItem value="payer">Payer</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-[0.65rem] leading-snug text-muted-foreground">
              Mock session — replace with Supabase when configured.
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2"
          onClick={() => resetDemo()}
        >
          <RotateCcw className="size-3.5" />
          <span className="group-data-[collapsible=icon]:hidden">Reset demo</span>
        </Button>
        <div className="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Prototype build
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
