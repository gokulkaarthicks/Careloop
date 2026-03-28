"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type MockRole = "provider" | "patient" | "pharmacy" | "payer" | "admin";

export type MockSession = {
  userId: string;
  email: string;
  role: MockRole;
  displayName: string;
};

type MockAuthState = {
  session: MockSession | null;
  signInDemo: (role: MockRole) => void;
  signOut: () => void;
};

const roleLabels: Record<MockRole, { email: string; name: string }> = {
  provider: { email: "provider@careloop.demo", name: "Dr. Avery Chen" },
  patient: { email: "patient@careloop.demo", name: "Jordan Ellis" },
  pharmacy: { email: "rx@harborview.demo", name: "Harborview Pharmacy" },
  payer: { email: "payer@summit.demo", name: "Summit Health Plan" },
  admin: { email: "admin@careloop.demo", name: "CareLoop Admin" },
};

/**
 * Local mock auth when Supabase env is not configured.
 * Swap for `supabase.auth.getSession()` when connecting a real project.
 */
export const useMockAuthStore = create<MockAuthState>()(
  persist(
    (set) => ({
      session: {
        userId: "mock_user_provider",
        email: roleLabels.provider.email,
        displayName: roleLabels.provider.name,
        role: "provider",
      },
      signInDemo: (role) =>
        set({
          session: {
            userId: `mock_user_${role}`,
            email: roleLabels[role].email,
            displayName: roleLabels[role].name,
            role,
          },
        }),
      signOut: () => set({ session: null }),
    }),
    {
      name: "careloop-mock-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ session: s.session }),
      skipHydration: true,
    },
  ),
);

export function rehydrateMockAuthStore() {
  useMockAuthStore.persist.rehydrate();
}
