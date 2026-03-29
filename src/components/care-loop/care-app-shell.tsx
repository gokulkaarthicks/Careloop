"use client";

import { AgentActivityOverlay } from "@/components/care-loop/agent-activity-overlay";
import { CareAppHeader } from "@/components/care-loop/care-app-header";
import { CareAppSidebar } from "@/components/care-loop/care-app-sidebar";
import { WorkflowEngineDock } from "@/components/care-loop/workflow-engine-dock";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function CareAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const providerLockedLayout = pathname.includes("/provider");

  return (
    <>
      <CareAppSidebar />
      <SidebarInset
        className={cn(
          "care-canvas overflow-x-hidden",
          providerLockedLayout
            ? "h-svh min-h-0 max-h-svh flex-1 overflow-hidden"
            : "overflow-y-auto",
        )}
      >
        <div className="shrink-0">
          <CareAppHeader />
        </div>
        <div
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6 p-4 pb-40 md:p-6 md:pb-40 lg:px-8 lg:pb-40 lg:pt-6",
            providerLockedLayout && "gap-2 overflow-hidden pt-2 md:pt-3",
          )}
        >
          {children}
        </div>
      </SidebarInset>
      <WorkflowEngineDock />
      <AgentActivityOverlay />
    </>
  );
}
