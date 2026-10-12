import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SecurityComplianceWorkspace } from "@/components/security-compliance-workspace";

export const metadata: Metadata = {
  title: "Compliance Center & Security Settings — Security | Folio",
  description: "DPDP Act readiness, GST statutory audit preparation, policy vault, and security configuration.",
};

export default function SecurityCompliancePage() {
  return (
    <AppShell active="Security">
      <SecurityComplianceWorkspace />
    </AppShell>
  );
}
