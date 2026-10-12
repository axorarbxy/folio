import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SecurityIntegrationsWorkspace } from "@/components/security-integrations-workspace";

export const metadata: Metadata = {
  title: "API Keys & Integrations — Security | Folio",
  description: "Manage API keys, connected ERP/GSP integrations, inbound ingestion channels, and webhooks.",
};

export default function SecurityIntegrationsPage() {
  return (
    <AppShell active="Security">
      <SecurityIntegrationsWorkspace />
    </AppShell>
  );
}
