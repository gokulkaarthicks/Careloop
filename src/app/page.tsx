import { CareLoopLanding } from "@/components/landing/careloop-landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Care Orchestrator — closed-loop care, one demo",
  description:
    "From visit prep to prescription and proof of completion—AI-assisted workflow across provider, patient, pharmacy, and payer.",
};

export default function Home() {
  return <CareLoopLanding />;
}
