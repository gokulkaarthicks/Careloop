"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { rehydrateCareWorkflowStore } from "@/stores/care-workflow-store";
import { rehydrateMockAuthStore } from "@/lib/auth/mock-auth";

function StoreHydration() {
  useEffect(() => {
    rehydrateCareWorkflowStore();
    rehydrateMockAuthStore();
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <StoreHydration />
        {children}
      </SidebarProvider>
    </TooltipProvider>
  );
}
