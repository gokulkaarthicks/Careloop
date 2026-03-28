import { CareAppShell } from "@/components/care-loop/care-app-shell";

export default function CareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CareAppShell>{children}</CareAppShell>;
}
