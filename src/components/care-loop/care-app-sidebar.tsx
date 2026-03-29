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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
              Care Orchestrator
            </span>
            <span className="truncate text-[0.65rem] text-muted-foreground">
              Care orchestration
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-label">Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        "transition-[opacity,box-shadow,transform] duration-200",
                        active ?
                          "relative z-[1] !bg-background font-semibold !text-foreground shadow-[0_3px_12px_-2px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.1)] ring-1 ring-border/70 dark:!bg-sidebar-accent dark:!text-sidebar-accent-foreground dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.55)] dark:ring-sidebar-border/60"
                        : "opacity-[0.58] hover:opacity-100",
                      )}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
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
