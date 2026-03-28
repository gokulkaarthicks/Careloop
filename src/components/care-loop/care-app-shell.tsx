"use client";

import { AgentActivityOverlay } from "@/components/care-loop/agent-activity-overlay";
import { CareAppHeader } from "@/components/care-loop/care-app-header";
import { CareAppSidebar } from "@/components/care-loop/care-app-sidebar";
import { WorkflowEngineDock } from "@/components/care-loop/workflow-engine-dock";
import { SidebarInset } from "@/components/ui/sidebar";

export function CareAppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CareAppSidebar />
      <SidebarInset className="care-canvas overflow-x-hidden">
        <CareAppHeader />
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 pb-40 md:p-6 md:pb-40 lg:px-8 lg:pb-40 lg:pt-6">
          {children}
        </div>
      </SidebarInset>
      <WorkflowEngineDock />
      <AgentActivityOverlay />
    </>
  );
}
