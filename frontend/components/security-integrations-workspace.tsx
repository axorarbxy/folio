"use client";

import React, { useState, useMemo } from "react";
import {
  PageHeading,
  SectionCard,
  MetricCard,
} from "./app-shell";
import {
  SecuritySubNav,
} from "./security-kit";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}

function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-colors text-sm px-3.5 py-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#474c80] text-[#f8f7e2] hover:bg-[#393d68] shadow-xs",
    secondary: "bg-[#f8f7e2] border border-[#dedecb] text-[#474c80] hover:bg-[#dedecb]/40",
    danger: "bg-[#a24650] text-[#fffef4] hover:bg-[#a24650]/90",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
import {
  StatusBadge,
  SeverityPill,
  EmptyPanel,
  SkeletonPanel,
  ErrorPanel,
} from "./monitoring-kit";
import {
  SecretField,
  ConfirmDialog,
} from "./security-kit";
import {
  API_KEYS_DATA,
  API_KEY_SCOPES_DATA,
  SECURITY_INTEGRATIONS_DATA,
  INBOUND_CHANNEL_DATA,
  WEBHOOKS_DATA,
  getSecurityIntegrations,
  getInboundChannelConfig,
  getWebhookEndpoints,
  ApiKey,
  SecurityIntegration,
  WebhookEndpoint,
  WebhookDelivery,
  QuarantinedMessage,
} from "@/lib/security-data";
import {
  Key,
  Layers,
  Inbox,
  Webhook,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Send,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Smartphone,
  Mail,
  HardDrive,
  Database,
  Building2,
  X,
  FileCheck,
} from "lucide-react";

export function SecurityIntegrationsWorkspace() {
  const [activeTab, setActiveTab] = useState<"keys" | "integrations" | "inbound" | "webhooks">("keys");
  const [viewState, setViewState] = useState<"normal" | "skeleton" | "empty" | "error">("normal");

  // --- API KEYS STATE ---
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => API_KEYS_DATA || []);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [createKeyStep, setCreateKeyStep] = useState<1 | 2 | 3 | 4>(1);
  const [newKeyForm, setNewKeyForm] = useState({
    name: "",
    description: "",
    scopes: ["invoices:read", "itc:read"] as string[],
    expiry: "90" as "30" | "90" | "365" | "never",
  });
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [hasCopiedNewKey, setHasCopiedNewKey] = useState(false);
  const [confirmedStored, setConfirmedStored] = useState(false);

  // Rotation modal state
  const [rotatingKey, setRotatingKey] = useState<ApiKey | null>(null);
  const [rotationOverlap, setRotationOverlap] = useState<"24h" | "7d">("24h");
  const [rotationNewSecret, setRotationNewSecret] = useState<string | null>(null);

  // Revocation modal state
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);

  // Edit scopes state
  const [editingScopesKey, setEditingScopesKey] = useState<ApiKey | null>(null);
  const [editScopesList, setEditScopesList] = useState<string[]>([]);

  // --- INTEGRATIONS STATE ---
  const [integrations, setIntegrations] = useState<SecurityIntegration[]>(() => (typeof getSecurityIntegrations === 'function' ? getSecurityIntegrations() : SECURITY_INTEGRATIONS_DATA) || []);
  const [oauthDialogIntegration, setOauthDialogIntegration] = useState<SecurityIntegration | null>(null);
  const [disconnectingIntegration, setDisconnectingIntegration] = useState<SecurityIntegration | null>(null);

  // --- INBOUND CHANNELS STATE ---
  const [inboundConfig, setInboundConfig] = useState<typeof INBOUND_CHANNEL_DATA>(() => (typeof getInboundChannelConfig === 'function' ? getInboundChannelConfig() : INBOUND_CHANNEL_DATA) || {
    emailAddress: 'invoices-auto@folio-tax.in',
    whatsappNumber: '+91 98200 44921',
    allowlistOnly: true,
    allowlistedSenders: [],
    quarantinedMessages: [],
  });
  const [newSenderInput, setNewSenderInput] = useState("");
  const [newSenderType, setNewSenderType] = useState<"email" | "whatsapp">("email");
  const [senderInputError, setSenderInputError] = useState<string | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  // --- WEBHOOKS STATE ---
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(() => (typeof getWebhookEndpoints === 'function' ? getWebhookEndpoints() : WEBHOOKS_DATA) || []);
  const [isCreateWebhookOpen, setIsCreateWebhookOpen] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookDescInput, setWebhookDescInput] = useState("");
  const [webhookEventsInput, setWebhookEventsInput] = useState<string[]>([
    "invoice.processed",
    "anomaly.detected",
  ]);
  const [webhookUrlError, setWebhookUrlError] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [testEventStatus, setTestEventStatus] = useState<"idle" | "sending" | "success">("idle");
  const [testEventResult, setTestEventResult] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(id);
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  // ----------------------------------------------------
  // API Keys Actions
  // ----------------------------------------------------
  const handleOpenCreateKey = () => {
    setNewKeyForm({
      name: "",
      description: "",
      scopes: ["invoices:read", "itc:read"],
      expiry: "90",
    });
    setCreateKeyStep(1);
    setNewlyCreatedSecret(null);
    setConfirmedStored(false);
    setHasCopiedNewKey(false);
    setIsCreateKeyOpen(true);
  };

  const handleFinishCreateKey = () => {
    const fakeRand = Math.random().toString(36).substring(2, 10).toUpperCase();
    const fakeFullSecret = `fk_live_${fakeRand}_${Math.random().toString(36).substring(2, 12)}4B89`;
    const newEntry: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyForm.name || "Custom Integration Key",
      prefix: `fk_live_••••${fakeRand.slice(-4)}`,
      scopes: newKeyForm.scopes,
      createdAt: new Date().toISOString().split("T")[0],
      lastUsed: "Just now",
      lastUsedDaysAgo: 0,
      status: "active",
      description: newKeyForm.description,
      expiresAt: newKeyForm.expiry === "never" ? "Never" : `In ${newKeyForm.expiry} days`,
    };
    setApiKeys([newEntry, ...apiKeys]);
    setNewlyCreatedSecret(fakeFullSecret);
    setCreateKeyStep(4); // Reveal Screen
  };

  const handleConfirmRotate = () => {
    if (!rotatingKey) return;
    const fakeRand = Math.random().toString(36).substring(2, 10).toUpperCase();
    const fakeSecret = `fk_live_${fakeRand}_${Math.random().toString(36).substring(2, 12)}9F2A`;
    const overlapHours = rotationOverlap === "24h" ? "24 hours" : "7 days";

    setApiKeys((prev) =>
      prev.map((k) =>
        k.id === rotatingKey.id
          ? {
              ...k,
              status: "rotating",
              overlapUntil: `Active for next ${overlapHours}`,
              prefix: `fk_live_••••${fakeRand.slice(-4)}`,
            }
          : k
      )
    );
    setRotationNewSecret(fakeSecret);
  };

  const handleConfirmRevoke = () => {
    if (!revokingKey) return;
    setApiKeys((prev) =>
      prev.map((k) => (k.id === revokingKey.id ? { ...k, status: "revoked" } : k))
    );
    setRevokingKey(null);
  };

  const handleSaveEditedScopes = () => {
    if (!editingScopesKey) return;
    setApiKeys((prev) =>
      prev.map((k) =>
        k.id === editingScopesKey.id ? { ...k, scopes: editScopesList } : k
      )
    );
    setEditingScopesKey(null);
  };

  // ----------------------------------------------------
  // Integration Actions
  // ----------------------------------------------------
  const handleConfirmOAuth = () => {
    if (!oauthDialogIntegration) return;
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === oauthDialogIntegration.id
          ? {
              ...item,
              status: "connected",
              connectedAccount: item.connectedAccount || "Authorized User (Live)",
              lastSync: "Just now",
            }
          : item
      )
    );
    setOauthDialogIntegration(null);
  };

  const handleConfirmDisconnect = () => {
    if (!disconnectingIntegration) return;
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === disconnectingIntegration.id
          ? {
              ...item,
              status: "disconnected",
              connectedAccount: null,
            }
          : item
      )
    );
    setDisconnectingIntegration(null);
  };

  // ----------------------------------------------------
  // Inbound Allowlist & Quarantine
  // ----------------------------------------------------
  const handleAddSender = (e: React.FormEvent) => {
    e.preventDefault();
    setSenderInputError(null);
    const trimmed = newSenderInput.trim();
    if (!trimmed) return;

    if (newSenderType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        setSenderInputError("Please enter a valid email address (e.g., invoices@vendor.com)");
        return;
      }
    } else {
      const phoneRegex = /^\+?[1-9]\d{7,14}$/;
      if (!phoneRegex.test(trimmed.replace(/[\s-]/g, ""))) {
        setSenderInputError("Please enter a valid international phone number (e.g., +919876543210)");
        return;
      }
    }

    setInboundConfig((prev) => ({
      ...prev,
      allowlistedSenders: [
        {
          id: `sender-${Date.now()}`,
          value: trimmed,
          label: trimmed,
          type: newSenderType === "whatsapp" ? "phone" : "email",
          addedAt: new Date().toISOString().split("T")[0],
          addedBy: "You",
        },
        ...(prev.allowlistedSenders || []),
      ],
    }));
    setNewSenderInput("");
  };

  const handleRemoveSender = (id: string) => {
    setInboundConfig((prev) => ({
      ...prev,
      allowlistedSenders: (prev.allowlistedSenders || []).filter((s) => s.id !== id),
    }));
  };

  const handleReleaseQuarantine = (id: string) => {
    setInboundConfig((prev) => ({
      ...prev,
      quarantinedMessages: prev.quarantinedMessages.filter((m) => m.id !== id),
    }));
  };

  const handleDeleteQuarantine = (id: string) => {
    setInboundConfig((prev) => ({
      ...prev,
      quarantinedMessages: prev.quarantinedMessages.filter((m) => m.id !== id),
    }));
  };

  // ----------------------------------------------------
  // Webhooks Actions
  // ----------------------------------------------------
  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookUrlError(null);
    if (!webhookUrlInput.startsWith("https://")) {
      setWebhookUrlError("Endpoint URL must strictly use HTTPS protocol (https://...)");
      return;
    }

    const newEndpoint: WebhookEndpoint = {
      id: `wh-${Date.now()}`,
      url: webhookUrlInput,
      description: webhookDescInput || "Custom notification endpoint",
      events: webhookEventsInput,
      status: "active",
      signingSecret: `whsec_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 12)}`,
      createdAt: new Date().toISOString().split("T")[0],
      lastDeliveryResult: {
        timestamp: "Just now",
        status: "success",
        statusCode: 200,
        latencyMs: 120,
      },
      deliveries: [
        {
          id: `del-${Date.now()}`,
          time: "Just now",
          event: "endpoint.verified",
          status: "success",
          statusCode: 200,
          latencyMs: 145,
          payloadSummary: '{"event": "endpoint.verified", "test": true}',
        },
      ],
    };

    setWebhooks([newEndpoint, ...webhooks]);
    setIsCreateWebhookOpen(false);
    setWebhookUrlInput("");
    setWebhookDescInput("");
  };

  const handleSendTestWebhook = () => {
    setTestEventStatus("sending");
    setTestEventResult(null);
    setTimeout(() => {
      setTestEventStatus("success");
      setTestEventResult(
        JSON.stringify(
          {
            delivered_at: new Date().toISOString(),
            status: 200,
            remote_ip: "104.21.34.120",
            response: '{"received": true, "acknowledged": "ok"}',
            latency: "142ms",
          },
          null,
          2
        )
      );
      if (selectedWebhook) {
        const testDelivery: WebhookDelivery = {
          id: `del-${Date.now()}`,
          time: "Just now",
          event: "invoice.processed (test)",
          status: "success",
          statusCode: 200,
          latencyMs: 142,
          payloadSummary: '{"event":"invoice.processed","test":true,"id":"inv_test_901"}',
        };
        setSelectedWebhook((prev) =>
          prev
            ? {
                ...prev,
                lastDeliveryResult: {
                  timestamp: "Just now",
                  status: "success",
                  statusCode: 200,
                  latencyMs: 142,
                },
                deliveries: [testDelivery, ...prev.deliveries],
              }
            : null
        );
      }
    }, 800);
  };

  // Helper icons for integrations
  const getIntegrationIcon = (id: string) => {
    switch (id) {
      case "int-zoho":
        return <Building2 className="w-5 h-5 text-[#474c80]" />;
      case "int-tally":
        return <Database className="w-5 h-5 text-[#474c80]" />;
      case "int-gsp":
        return <FileCheck className="w-5 h-5 text-[#474c80]" />;
      case "int-whatsapp":
        return <Smartphone className="w-5 h-5 text-[#378875]" />;
      case "int-email":
        return <Mail className="w-5 h-5 text-[#474c80]" />;
      case "int-gdrive":
        return <HardDrive className="w-5 h-5 text-[#cf9c50]" />;
      default:
        return <Layers className="w-5 h-5 text-[#474c80]" />;
    }
  };

  // Render main content
  return (
    <div className="space-y-6">
      <SecuritySubNav active="integrations" />
      {/* Top Header */}
      <PageHeading
        title="API Keys & Integrations"
        description="Safely govern machine access, inbound ingestion pipelines, external ERP syncs, and real-time event webhooks."
        actions={
          <div className="flex items-center gap-2">
            {/* View State Toggle for QA testing */}
            <div className="flex items-center bg-[#f8f7e2] border border-[#dedecb] rounded-lg p-0.5 text-xs text-[#686b86]">
              <button
                onClick={() => setViewState("normal")}
                className={`px-2 py-1 rounded ${viewState === "normal" ? "bg-[#474c80] text-[#f8f7e2] font-medium" : "hover:text-[#474c80]"}`}
              >
                Normal
              </button>
              <button
                onClick={() => setViewState("skeleton")}
                className={`px-2 py-1 rounded ${viewState === "skeleton" ? "bg-[#474c80] text-[#f8f7e2] font-medium" : "hover:text-[#474c80]"}`}
              >
                Skeleton
              </button>
              <button
                onClick={() => setViewState("empty")}
                className={`px-2 py-1 rounded ${viewState === "empty" ? "bg-[#474c80] text-[#f8f7e2] font-medium" : "hover:text-[#474c80]"}`}
              >
                Empty
              </button>
              <button
                onClick={() => setViewState("error")}
                className={`px-2 py-1 rounded ${viewState === "error" ? "bg-[#474c80] text-[#f8f7e2] font-medium" : "hover:text-[#474c80]"}`}
              >
                Error
              </button>
            </div>

            {activeTab === "keys" && (
              <Button onClick={handleOpenCreateKey}>
                <Plus className="w-4 h-4 mr-1.5" /> Generate API Key
              </Button>
            )}
            {activeTab === "webhooks" && (
              <Button onClick={() => setIsCreateWebhookOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Webhook Endpoint
              </Button>
            )}
          </div>
        }
      />

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Active API Keys"
          value={(apiKeys || []).filter((k) => k.status === "active").length}
          note="1 rotating, 1 unused >90d"
          icon={Key}
        />
        <MetricCard
          label="Connected Integrations"
          value={(integrations || []).filter((i) => i.status === "connected").length}
          note="ERP, GSP & Drive connectors"
          icon={Layers}
        />
        <MetricCard
          label="Inbound Ingestion"
          value="Healthy"
          note="Email & WhatsApp listener active"
          icon={Inbox}
        />
        <MetricCard
          label="Webhook Endpoints"
          value={(webhooks || []).length}
          note="99.9% 24h delivery rate"
          icon={Webhook}
        />
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-[#dedecb] space-x-6">
        <button
          onClick={() => setActiveTab("keys")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "keys"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Key className="w-4 h-4" />
          API Keys ({apiKeys.length})
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "integrations"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Layers className="w-4 h-4" />
          Integrations ({integrations.length})
        </button>
        <button
          onClick={() => setActiveTab("inbound")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "inbound"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Inbox className="w-4 h-4" />
          Inbound Channels
          {((inboundConfig?.quarantinedMessages) || []).length > 0 && (
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-[#a24650]/15 text-[#a24650] font-semibold">
              {(inboundConfig?.quarantinedMessages || []).length} quarantined
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("webhooks")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "webhooks"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Webhook className="w-4 h-4" />
          Webhooks ({(webhooks || []).length})
        </button>
      </div>

      {/* Simulated error / skeleton / empty screens */}
      {viewState === "skeleton" && (
        <div className="space-y-4">
          <SkeletonPanel height="h-28" />
          <SkeletonPanel height="h-64" />
        </div>
      )}

      {viewState === "error" && (
        <ErrorPanel
          title="Could not load integration settings"
          message="Failed to retrieve API credentials and channel listeners. The encrypted key store did not respond within 3000ms."
          onRetry={() => setViewState("normal")}
        />
      )}

      {viewState === "empty" && (
        <EmptyPanel
          title="No integrations configured"
          message="You have not created any external API tokens or connected inbound channels yet."
          actionLabel="Create First API Key"
          onAction={handleOpenCreateKey}
        />
      )}

      {/* NORMAL STATE */}
      {viewState === "normal" && (
        <>
          {/* ========================================================= */}
          {/* TAB 1: API KEYS                                           */}
          {/* ========================================================= */}
          {activeTab === "keys" && (
            <div className="space-y-6">
              <SectionCard
                title="Workspace API Keys"
                description="Secrets used by external tools, CI/CD scripts, or billing software to automate invoice ingestion and audit compliance."
                action={
                  <div className="text-xs text-[#686b86] flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#cf9c50]" />
                    Keys unused for &gt;90 days are flagged for revocation
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#dedecb] text-[#686b86] text-xs uppercase tracking-wider bg-[#f8f7e2]/50">
                        <th className="py-3 px-4">Key Name & Token Prefix</th>
                        <th className="py-3 px-4">Scopes</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4">Last Used</th>
                        <th className="py-3 px-4">Expires</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedecb]">
                      {apiKeys.map((key) => {
                        const isStale = (key.lastUsedDaysAgo ?? 0) >= 90 && key.status === "active";
                        return (
                          <tr key={key.id} className="hover:bg-[#f8f7e2]/30 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-[#474c80]">{key.name}</div>
                              <div className="font-mono text-xs text-[#686b86] flex items-center gap-1 mt-0.5">
                                <span>{key.prefix}</span>
                                {key.overlapUntil && (
                                  <span className="text-[10px] text-[#cf9c50] bg-[#cf9c50]/10 px-1 py-0.2 rounded font-sans">
                                    Overlap active
                                  </span>
                                )}
                              </div>
                              {key.description && (
                                <p className="text-xs text-[#686b86] mt-0.5 max-w-xs truncate">{key.description}</p>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {key.scopes.slice(0, 3).map((sc) => (
                                  <span
                                    key={sc}
                                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#474c80]/10 text-[#474c80]"
                                  >
                                    {sc}
                                  </span>
                                ))}
                                {key.scopes.length > 3 && (
                                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#f8f7e2] text-[#686b86] border border-[#dedecb]">
                                    +{key.scopes.length - 3} more
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#686b86]">{key.createdAt}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                {isStale && <AlertTriangle className="w-3.5 h-3.5 text-[#a24650] shrink-0" />}
                                <span
                                  className={`text-xs ${
                                    isStale
                                      ? "text-[#a24650] font-semibold bg-[#a24650]/10 px-1.5 py-0.5 rounded"
                                      : "text-[#686b86]"
                                  }`}
                                >
                                  {key.lastUsed}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#686b86]">{key.expiresAt || "Never"}</td>
                            <td className="py-3.5 px-4">
                              {key.status === "active" && (
                                <span className="inline-flex items-center gap-1 text-xs text-[#378875] bg-[#378875]/10 px-2 py-0.5 rounded-full font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#378875]" />
                                  Active
                                </span>
                              )}
                              {key.status === "rotating" && (
                                <span className="inline-flex items-center gap-1 text-xs text-[#cf9c50] bg-[#cf9c50]/10 px-2 py-0.5 rounded-full font-medium">
                                  <RefreshCw className="w-3 h-3 animate-spin text-[#cf9c50]" />
                                  Rotating
                                </span>
                              )}
                              {key.status === "revoked" && (
                                <span className="inline-flex items-center gap-1 text-xs text-[#a24650] bg-[#a24650]/10 px-2 py-0.5 rounded-full font-medium">
                                  Revoked
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {key.status !== "revoked" ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingScopesKey(key);
                                      setEditScopesList([...key.scopes]);
                                    }}
                                    className="p-1.5 text-[#686b86] hover:text-[#474c80] hover:bg-[#dedecb]/40 rounded transition-colors"
                                    title="Edit scopes"
                                  >
                                    <SlidersHorizontal className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRotatingKey(key);
                                      setRotationNewSecret(null);
                                    }}
                                    className="p-1.5 text-[#686b86] hover:text-[#cf9c50] hover:bg-[#dedecb]/40 rounded transition-colors"
                                    title="Rotate Key"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setRevokingKey(key)}
                                    className="p-1.5 text-[#686b86] hover:text-[#a24650] hover:bg-[#dedecb]/40 rounded transition-colors"
                                    title="Revoke Key"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-[#686b86] italic">Revoked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: INTEGRATIONS                                       */}
          {/* ========================================================= */}
          {activeTab === "integrations" && (
            <div className="space-y-6">
              <SectionCard
                title="Connected Business Applications"
                description="Manage authorization grants and credentials for your accounting ERP, GST Suvidha Provider, and cloud document repositories."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integrations.map((item) => (
                    <div
                      key={item.id}
                      className="border border-[#dedecb] rounded-lg p-4 bg-[#fffef4] flex flex-col justify-between hover:border-[#474c80]/40 transition-colors shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-[#f8f7e2] border border-[#dedecb] flex items-center justify-center shrink-0">
                              {getIntegrationIcon(item.id)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-[#474c80]">{item.name}</h4>
                              <span className="text-xs text-[#686b86] capitalize">{item.category}</span>
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              item.status === "connected"
                                ? "bg-[#378875]/10 text-[#378875]"
                                : item.status === "error"
                                ? "bg-[#a24650]/10 text-[#a24650]"
                                : "bg-[#dedecb] text-[#686b86]"
                            }`}
                          >
                            {item.status === "connected" ? "Connected" : item.status === "error" ? "Needs Attention" : "Not Connected"}
                          </span>
                        </div>

                        <p className="text-xs text-[#686b86] mt-3">{item.description}</p>

                        {/* Account & sync details */}
                        <div className="mt-4 pt-3 border-t border-[#dedecb]/70 space-y-1.5 text-xs text-[#686b86]">
                          <div className="flex justify-between">
                            <span>Account:</span>
                            <span className="font-medium text-[#474c80] truncate max-w-[160px]">
                              {item.connectedAccount || "None"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last sync:</span>
                            <span>{item.lastSync || "Never"}</span>
                          </div>
                        </div>

                        {/* Permissions list */}
                        <div className="mt-3">
                          <span className="text-[11px] font-semibold text-[#474c80] uppercase tracking-wider block mb-1">
                            Permissions Requested:
                          </span>
                          <ul className="text-xs space-y-1 text-[#686b86]">
                            {item.permissions.map((perm, idx) => (
                              <li key={idx} className="flex items-center gap-1.5">
                                <Check className="w-3 h-3 text-[#378875] shrink-0" />
                                <span>{perm}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#dedecb] flex gap-2">
                        {item.status === "connected" ? (
                          <>
                            <Button
                              variant="secondary"
                              className="text-xs flex-1"
                              onClick={() => setOauthDialogIntegration(item)}
                            >
                              Reauthorize
                            </Button>
                            <Button
                              variant="danger"
                              className="text-xs"
                              onClick={() => setDisconnectingIntegration(item)}
                            >
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            className="text-xs w-full"
                            onClick={() => setOauthDialogIntegration(item)}
                          >
                            Connect Integration
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: INBOUND CHANNELS                                   */}
          {/* ========================================================= */}
          {activeTab === "inbound" && (
            <div className="space-y-6">
              {/* Channel Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard
                  title="Forwarding Email Ingestion"
                  description="Forward electronic supplier invoices, bills, and purchase receipts to this dedicated intake mailbox."
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-[#f8f7e2] rounded-lg border border-[#dedecb] flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Mail className="w-4 h-4 text-[#474c80] shrink-0" />
                        <span className="font-mono text-xs font-semibold text-[#474c80] truncate">
                          {inboundConfig.emailAddress}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        className="text-xs py-1 px-2.5 h-auto shrink-0"
                        onClick={() => handleCopy(inboundConfig.emailAddress, "email")}
                      >
                        {copiedChannel === "email" ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-[#378875]" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-[#686b86]">
                      PDF, JPG, PNG attachments are automatically scanned for malware, stripped of metadata, and fed into the invoice pipeline.
                    </p>
                  </div>
                </SectionCard>

                <SectionCard
                  title="WhatsApp Business Number"
                  description="Receive invoices directly from suppliers or branch managers via official verified WhatsApp channel."
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-[#f8f7e2] rounded-lg border border-[#dedecb] flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Smartphone className="w-4 h-4 text-[#378875] shrink-0" />
                        <span className="font-mono text-xs font-semibold text-[#474c80] truncate">
                          {inboundConfig.whatsappNumber}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        className="text-xs py-1 px-2.5 h-auto shrink-0"
                        onClick={() => handleCopy(inboundConfig.whatsappNumber, "whatsapp")}
                      >
                        {copiedChannel === "whatsapp" ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-[#378875]" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-[#686b86]">
                      Meta Cloud API end-to-end encrypted messaging with zero message retention outside India data boundaries.
                    </p>
                  </div>
                </SectionCard>
              </div>

              {/* Sender Allowlist Editor */}
              <SectionCard
                title="Inbound Sender Allowlist"
                description="Restrict who can send invoices into your Folio workspace. Unknown senders are quarantined until approved."
                action={
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-[#474c80] flex items-center gap-2 cursor-pointer">
                      <span>Accept only from allowlisted senders:</span>
                      <input
                        type="checkbox"
                        checked={inboundConfig.allowlistOnly}
                        onChange={(e) =>
                          setInboundConfig({ ...inboundConfig, allowlistOnly: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#474c80] rounded"
                      />
                    </label>
                  </div>
                }
              >
                <div className="space-y-4">
                  {/* Add Sender Form */}
                  <form onSubmit={handleAddSender} className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={newSenderType}
                      onChange={(e) => setNewSenderType(e.target.value as "email" | "whatsapp")}
                      className="px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#474c80] font-medium focus:outline-none focus:border-[#474c80]"
                    >
                      <option value="email">Email Address / Domain</option>
                      <option value="whatsapp">WhatsApp Phone Number</option>
                    </select>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder={
                          newSenderType === "email"
                            ? "e.g., billing@reliable-vendors.in or *@tatasteel.com"
                            : "e.g., +919876543210"
                        }
                        value={newSenderInput}
                        onChange={(e) => setNewSenderInput(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fffef4] border border-[#dedecb] rounded-lg text-xs text-[#474c80] placeholder-[#686b86]/60 focus:outline-none focus:border-[#474c80]"
                      />
                      {senderInputError && (
                        <p className="text-xs text-[#a24650] mt-1">{senderInputError}</p>
                      )}
                    </div>
                    <Button type="submit" className="text-xs whitespace-nowrap">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Allowlisted Sender
                    </Button>
                  </form>

                  {/* Senders List */}
                  <div className="border border-[#dedecb] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#f8f7e2]/50 text-xs text-[#686b86] uppercase border-b border-[#dedecb]">
                        <tr>
                          <th className="py-2.5 px-3">Sender Identifier</th>
                          <th className="py-2.5 px-3">Channel</th>
                          <th className="py-2.5 px-3">Added Date</th>
                          <th className="py-2.5 px-3">Added By</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dedecb]">
                        {(inboundConfig.allowlistedSenders || []).map((sender) => (
                          <tr key={sender.id} className="hover:bg-[#f8f7e2]/30 text-xs">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-medium text-[#474c80] block">{sender.value}</span>
                              {sender.label && sender.label !== sender.value && (
                                <span className="text-[11px] text-[#686b86]">{sender.label}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 capitalize text-[#686b86]">
                              {sender.type}
                            </td>
                            <td className="py-2.5 px-3 text-[#686b86]">{sender.addedAt}</td>
                            <td className="py-2.5 px-3 text-[#686b86]">{sender.addedBy}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleRemoveSender(sender.id)}
                                className="text-[#a24650] hover:text-[#a24650]/80 p-1 rounded"
                                title="Remove sender"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>

              {/* Quarantined Messages Table */}
              <SectionCard
                title="Quarantined Messages & Files"
                description="Inbound invoices received from unknown senders or flagged by initial malware/format verification."
              >
                {inboundConfig.quarantinedMessages.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#686b86]">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-[#378875] mb-2 opacity-80" />
                    No messages in quarantine. All inbound channels are clean.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#f8f7e2]/50 text-xs text-[#686b86] uppercase border-b border-[#dedecb]">
                        <tr>
                          <th className="py-2.5 px-3">Sender</th>
                          <th className="py-2.5 px-3">Attachment File</th>
                          <th className="py-2.5 px-3">Received At</th>
                          <th className="py-2.5 px-3">Quarantine Reason</th>
                          <th className="py-2.5 px-3 text-right">Review Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dedecb]">
                        {inboundConfig.quarantinedMessages.map((msg) => (
                          <tr key={msg.id} className="hover:bg-[#f8f7e2]/30 text-xs">
                            <td className="py-3 px-3">
                              <div className="font-mono font-medium text-[#474c80]">{msg.sender}</div>
                              <span className="text-[10px] text-[#686b86] capitalize">{msg.channel}</span>
                            </td>
                            <td className="py-3 px-3 text-[#474c80] font-medium">{msg.subjectOrFile}</td>
                            <td className="py-3 px-3 text-[#686b86]">{msg.timestamp}</td>
                            <td className="py-3 px-3">
                              <span className="text-xs px-2 py-0.5 rounded bg-[#a24650]/10 text-[#a24650] font-medium">
                                {msg.reason}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  className="text-xs py-1 px-2.5 h-auto text-[#378875] border-[#378875]/30 hover:bg-[#378875]/10"
                                  onClick={() => handleReleaseQuarantine(msg.id)}
                                >
                                  Release to Ingestion
                                </Button>
                                <Button
                                  variant="danger"
                                  className="text-xs py-1 px-2.5 h-auto"
                                  onClick={() => handleDeleteQuarantine(msg.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: WEBHOOKS                                           */}
          {/* ========================================================= */}
          {activeTab === "webhooks" && (
            <div className="space-y-6">
              <SectionCard
                title="Outgoing Event Webhooks"
                description="Stream real-time security anomalies, reconciliation completion events, and approval requests to your servers."
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#dedecb] text-[#686b86] text-xs uppercase tracking-wider bg-[#f8f7e2]/50">
                        <th className="py-3 px-4">Endpoint Destination</th>
                        <th className="py-3 px-4">Subscribed Events</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Last Delivery</th>
                        <th className="py-3 px-4 text-right">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedecb]">
                      {webhooks.map((wh) => (
                        <tr
                          key={wh.id}
                          className="hover:bg-[#f8f7e2]/30 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedWebhook(wh);
                            setTestEventResult(null);
                            setTestEventStatus("idle");
                          }}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs font-semibold text-[#474c80] flex items-center gap-1.5">
                              {wh.url}
                            </div>
                            <div className="text-xs text-[#686b86] mt-0.5">{wh.description}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {wh.events.map((ev) => (
                                <span
                                  key={ev}
                                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#474c80]/10 text-[#474c80]"
                                >
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                wh.status === "active"
                                  ? "bg-[#378875]/10 text-[#378875]"
                                  : "bg-[#a24650]/10 text-[#a24650]"
                              }`}
                            >
                              {wh.status === "active" ? "Active" : "Failing"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {wh.lastDeliveryResult ? (
                              <div className="text-xs">
                                <div className="flex items-center gap-1.5 font-medium text-[#474c80]">
                                  {wh.lastDeliveryResult.status === "success" ? (
                                    <span className="w-2 h-2 rounded-full bg-[#378875]" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-[#a24650]" />
                                  )}
                                  HTTP {wh.lastDeliveryResult.statusCode} ({wh.lastDeliveryResult.latencyMs}ms)
                                </div>
                                <div className="text-[#686b86] text-[11px] mt-0.5">
                                  {wh.lastDeliveryResult.timestamp}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-[#686b86]">No deliveries yet</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="secondary"
                              className="text-xs py-1 px-2.5 h-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWebhook(wh);
                                setTestEventResult(null);
                                setTestEventStatus("idle");
                              }}
                            >
                              Details & Test
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* MODALS & DRAWERS                                          */}
      {/* ========================================================= */}

      {/* 1. CREATE API KEY 3-STEP DIALOG + REVEAL SCREEN */}
      {isCreateKeyOpen && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-3">
              <div>
                <h3 className="font-semibold text-base text-[#474c80]">
                  {createKeyStep === 4 ? "API Key Generated" : `Create API Key (Step ${createKeyStep} of 3)`}
                </h3>
                <p className="text-xs text-[#686b86]">
                  {createKeyStep === 1 && "Define the key name and workload description"}
                  {createKeyStep === 2 && "Apply granular permission scopes (least privilege)"}
                  {createKeyStep === 3 && "Set an expiration schedule to enforce credential rotation"}
                  {createKeyStep === 4 && "Save this key now. It will never be shown again in full."}
                </p>
              </div>
              <button
                onClick={() => setIsCreateKeyOpen(false)}
                className="text-[#686b86] hover:text-[#474c80] p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: Name & Description */}
            {createKeyStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#474c80] mb-1">
                    Key Name <span className="text-[#a24650]">*</span>
                  </label>
                  <input
                    type="text"
                    value={newKeyForm.name}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                    placeholder="e.g. ERP Reconciliation Bot"
                    className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-sm text-[#474c80] focus:outline-none focus:border-[#474c80]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#474c80] mb-1">
                    Workload Description
                  </label>
                  <textarea
                    rows={2}
                    value={newKeyForm.description}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, description: e.target.value })}
                    placeholder="Describe what system will use this key and who owns it..."
                    className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-sm text-[#474c80] focus:outline-none focus:border-[#474c80]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
                  <Button variant="secondary" onClick={() => setIsCreateKeyOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!newKeyForm.name.trim()}
                    onClick={() => setCreateKeyStep(2)}
                  >
                    Next: Scopes &rarr;
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Grouped Scopes with Least Privilege Hint */}
            {createKeyStep === 2 && (
              <div className="space-y-4">
                <div className="p-3 bg-[#f8f7e2] border border-[#dedecb] rounded-lg flex items-start gap-2 text-xs text-[#686b86]">
                  <Info className="w-4 h-4 text-[#474c80] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#474c80]">Principle of Least Privilege:</span> Only grant permissions strictly needed by this service. Avoid write or admin scopes for reporting workloads.
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  {API_KEY_SCOPES_DATA.map((group) => (
                    <div key={group.category} className="border border-[#dedecb] rounded-lg p-2.5 bg-[#f8f7e2]/40">
                      <div className="text-xs font-semibold text-[#474c80] mb-1.5">{group.category}</div>
                      <div className="space-y-1.5">
                        {group.scopes.map((s) => {
                          const isChecked = newKeyForm.scopes.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-start gap-2 text-xs text-[#474c80] hover:bg-[#fffef4] p-1 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewKeyForm({
                                      ...newKeyForm,
                                      scopes: [...newKeyForm.scopes, s.id],
                                    });
                                  } else {
                                    setNewKeyForm({
                                      ...newKeyForm,
                                      scopes: newKeyForm.scopes.filter((sc) => sc !== s.id),
                                    });
                                  }
                                }}
                                className="w-3.5 h-3.5 mt-0.5 accent-[#474c80]"
                              />
                              <div>
                                <span className="font-mono font-medium text-[11px] block">{s.id}</span>
                                <span className="text-[11px] text-[#686b86]">{s.description}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-[#dedecb]">
                  <span className="text-xs text-[#686b86]">
                    {newKeyForm.scopes.length} scopes selected
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setCreateKeyStep(1)}>
                      Back
                    </Button>
                    <Button
                      disabled={newKeyForm.scopes.length === 0}
                      onClick={() => setCreateKeyStep(3)}
                    >
                      Next: Expiry &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Expiry Schedule */}
            {createKeyStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#474c80] mb-2">
                    Key Lifespan / Expiration
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: "30", label: "30 days (Recommended for testing)" },
                      { id: "90", label: "90 days (Quarterly rotation standard)" },
                      { id: "365", label: "365 days (1 year)" },
                      { id: "never", label: "Never expire (Not recommended for production)" },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          newKeyForm.expiry === opt.id
                            ? "border-[#474c80] bg-[#474c80]/5 text-[#474c80]"
                            : "border-[#dedecb] bg-[#f8f7e2]/50 text-[#686b86]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="expiry"
                          value={opt.id}
                          checked={newKeyForm.expiry === opt.id}
                          onChange={(e) =>
                            setNewKeyForm({
                              ...newKeyForm,
                              expiry: e.target.value as "30" | "90" | "365" | "never",
                            })
                          }
                          className="accent-[#474c80]"
                        />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {newKeyForm.expiry === "never" && (
                  <div className="p-2.5 bg-[#a24650]/10 border border-[#a24650]/30 rounded-lg flex items-center gap-2 text-xs text-[#a24650]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Non-expiring keys increase security risk if compromised. Rotate regularly.</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
                  <Button variant="secondary" onClick={() => setCreateKeyStep(2)}>
                    Back
                  </Button>
                  <Button onClick={handleFinishCreateKey}>Generate Key</Button>
                </div>
              </div>
            )}

            {/* STEP 4: REVEAL SCREEN */}
            {createKeyStep === 4 && (
              <div className="space-y-4">
                <div className="p-3 bg-[#cf9c50]/15 border border-[#cf9c50]/40 rounded-lg flex items-start gap-2.5 text-xs text-[#cf9c50]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Copy your API key now:</span>
                    For security reasons, this token will never be displayed again. If you lose it, you will need to rotate or generate a new key.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#474c80] mb-1">
                    Your Full Secret Token:
                  </label>
                  {newlyCreatedSecret && (
                    <SecretField
                      value={newlyCreatedSecret}
                      maskedPlaceholder="fk_live_••••••••••••••••••••••••••••••••"
                    />
                  )}
                </div>

                <label className="flex items-start gap-2 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedStored}
                    onChange={(e) => setConfirmedStored(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#474c80] rounded"
                  />
                  <span className="text-xs text-[#474c80]">
                    I have saved this key in a secure credential manager or vault.
                  </span>
                </label>

                <div className="flex justify-end pt-3 border-t border-[#dedecb]">
                  <Button
                    disabled={!confirmedStored}
                    onClick={() => setIsCreateKeyOpen(false)}
                  >
                    Done & Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. KEY ROTATION MODAL */}
      {rotatingKey && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#474c80]">Rotate API Key</h3>
              <button onClick={() => setRotatingKey(null)} className="text-[#686b86]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!rotationNewSecret ? (
              <>
                <p className="text-xs text-[#686b86]">
                  Rotating <strong className="text-[#474c80]">{rotatingKey.name}</strong> generates a new token while optionally leaving the old token active during an overlap period to prevent service disruptions.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#474c80] mb-1.5">
                    Grace Overlap Period:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRotationOverlap("24h")}
                      className={`p-2.5 rounded-lg border text-xs text-center font-medium transition-colors ${
                        rotationOverlap === "24h"
                          ? "border-[#474c80] bg-[#474c80]/10 text-[#474c80]"
                          : "border-[#dedecb] bg-[#f8f7e2] text-[#686b86]"
                      }`}
                    >
                      24 Hours Overlap
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationOverlap("7d")}
                      className={`p-2.5 rounded-lg border text-xs text-center font-medium transition-colors ${
                        rotationOverlap === "7d"
                          ? "border-[#474c80] bg-[#474c80]/10 text-[#474c80]"
                          : "border-[#dedecb] bg-[#f8f7e2] text-[#686b86]"
                      }`}
                    >
                      7 Days Overlap
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
                  <Button variant="secondary" onClick={() => setRotatingKey(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmRotate}>Generate New Token</Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-[#378875]/10 border border-[#378875]/30 rounded-lg text-xs text-[#378875]">
                  Rotation scheduled. Both old and new credentials are active for the overlap window.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#474c80] mb-1">
                    New Generated Secret:
                  </label>
                  <SecretField
                    value={rotationNewSecret}
                    maskedPlaceholder="fk_live_••••••••••••••••••••••••••••••••"
                  />
                </div>
                <div className="flex justify-end pt-3 border-t border-[#dedecb]">
                  <Button onClick={() => setRotatingKey(null)}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. KEY REVOCATION CONFIRM DIALOG */}
      {revokingKey && (
        <ConfirmDialog
          open={!!revokingKey}
          onClose={() => setRevokingKey(null)}
          onConfirm={handleConfirmRevoke}
          title="Revoke API Key"
          body={`Are you sure you want to revoke "${revokingKey.name}"? Any applications or automated scripts using this key will immediately fail with HTTP 401 Unauthorized.`}
          confirmLabel="Revoke Key"
          danger={true}
          requireTyping={revokingKey.name}
        />
      )}

      {/* 4. EDIT SCOPES MODAL */}
      {editingScopesKey && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#474c80]">
                Edit Scopes: {editingScopesKey.name}
              </h3>
              <button onClick={() => setEditingScopesKey(null)} className="text-[#686b86]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {API_KEY_SCOPES_DATA.map((group) => (
                <div key={group.category} className="border border-[#dedecb] rounded-lg p-2.5 bg-[#f8f7e2]/40">
                  <div className="text-xs font-semibold text-[#474c80] mb-1.5">{group.category}</div>
                  <div className="space-y-1.5">
                    {group.scopes.map((s) => {
                      const isChecked = editScopesList.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-start gap-2 text-xs text-[#474c80] hover:bg-[#fffef4] p-1 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditScopesList([...editScopesList, s.id]);
                              } else {
                                setEditScopesList(editScopesList.filter((sc) => sc !== s.id));
                              }
                            }}
                            className="w-3.5 h-3.5 mt-0.5 accent-[#474c80]"
                          />
                          <div>
                            <span className="font-mono font-medium text-[11px] block">{s.id}</span>
                            <span className="text-[11px] text-[#686b86]">{s.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#dedecb]">
              <span className="text-xs text-[#686b86]">{editScopesList.length} scopes enabled</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditingScopesKey(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEditedScopes}>Save Scopes</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SIMULATED OAUTH CONSENT DIALOG */}
      {oauthDialogIntegration && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-[#dedecb] pb-3">
              <div className="w-10 h-10 rounded-lg bg-[#f8f7e2] border border-[#dedecb] flex items-center justify-center shrink-0">
                {getIntegrationIcon(oauthDialogIntegration.id)}
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#474c80]">
                  Authorize {oauthDialogIntegration.name}
                </h3>
                <p className="text-xs text-[#686b86]">External OAuth 2.0 Authorization Grant</p>
              </div>
            </div>

            <p className="text-xs text-[#686b86]">
              <strong className="text-[#474c80]">{oauthDialogIntegration.name}</strong> is requesting permission to access your Folio workspace with the following scopes:
            </p>

            <div className="bg-[#f8f7e2] border border-[#dedecb] rounded-lg p-3 space-y-2">
              {oauthDialogIntegration.permissions.map((perm, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-[#474c80]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#378875] shrink-0 mt-0.5" />
                  <span>{perm}</span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-[#686b86]">
              Folio will never see your master account password. Access tokens are encrypted at rest with AES-256-GCM.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
              <Button variant="secondary" onClick={() => setOauthDialogIntegration(null)}>
                Deny
              </Button>
              <Button onClick={handleConfirmOAuth}>
                Allow & Connect
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DISCONNECT INTEGRATION DIALOG */}
      {disconnectingIntegration && (
        <ConfirmDialog
          open={!!disconnectingIntegration}
          onClose={() => setDisconnectingIntegration(null)}
          onConfirm={handleConfirmDisconnect}
          title={`Disconnect ${disconnectingIntegration.name}`}
          body={`Disconnecting this integration will immediately revoke sync credentials. Automated invoice imports or journal postings will halt.`}
          confirmLabel="Disconnect Integration"
          danger={true}
        />
      )}

      {/* 7. CREATE WEBHOOK DIALOG */}
      {isCreateWebhookOpen && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#474c80]">Add Webhook Endpoint</h3>
              <button onClick={() => setIsCreateWebhookOpen(false)} className="text-[#686b86]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1">
                  Destination URL <span className="text-[#a24650]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="https://api.yourcompany.com/webhooks/folio"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs font-mono text-[#474c80] focus:outline-none focus:border-[#474c80]"
                />
                {webhookUrlError && (
                  <p className="text-xs text-[#a24650] mt-1">{webhookUrlError}</p>
                )}
                <span className="text-[11px] text-[#686b86] mt-0.5 block">
                  Must be a secure HTTPS endpoint. Plain HTTP is rejected.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g., Slack Alert Bot, SAP Inward Pipeline"
                  value={webhookDescInput}
                  onChange={(e) => setWebhookDescInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#474c80] focus:outline-none focus:border-[#474c80]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1.5">
                  Events to Send:
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-[#dedecb] p-2 rounded-lg bg-[#f8f7e2]/50 text-xs">
                  {[
                    "invoice.processed",
                    "invoice.rejected",
                    "reconciliation.completed",
                    "anomaly.detected",
                    "compliance.alert",
                  ].map((evt) => (
                    <label key={evt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhookEventsInput.includes(evt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookEventsInput([...webhookEventsInput, evt]);
                          } else {
                            setWebhookEventsInput(webhookEventsInput.filter((x) => x !== evt));
                          }
                        }}
                        className="accent-[#474c80]"
                      />
                      <span className="font-mono text-[11px] text-[#474c80]">{evt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
                <Button variant="secondary" type="button" onClick={() => setIsCreateWebhookOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!webhookUrlInput.trim()}>
                  Register Endpoint
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. WEBHOOK DETAIL SLIDE-OUT DRAWER */}
      {selectedWebhook && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex justify-end">
          <div className="bg-[#fffef4] border-l border-[#dedecb] w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-[#dedecb] pb-3">
                <div>
                  <h3 className="font-semibold text-base text-[#474c80]">Webhook Details</h3>
                  <p className="text-xs text-[#686b86] font-mono truncate max-w-sm">
                    {selectedWebhook.url}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWebhook(null)}
                  className="text-[#686b86] hover:text-[#474c80] p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Signing Secret */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#474c80]">
                    Endpoint Signing Secret:
                  </label>
                  <Button
                    variant="secondary"
                    className="text-[11px] py-0.5 px-2 h-auto"
                    onClick={() => {
                      const newSec = `whsec_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 12)}`;
                      setSelectedWebhook({ ...selectedWebhook, signingSecret: newSec });
                      setWebhooks((prev) =>
                        prev.map((w) =>
                          w.id === selectedWebhook.id ? { ...w, signingSecret: newSec } : w
                        )
                      );
                    }}
                  >
                    Regenerate
                  </Button>
                </div>
                <SecretField
                  value={selectedWebhook.signingSecret}
                  maskedPlaceholder="whsec_••••••••••••••••••••••••••••"
                />
                <p className="text-[11px] text-[#686b86]">
                  Verify HMAC SHA256 signatures in the <code>X-Folio-Signature</code> HTTP header.
                </p>
              </div>

              {/* Subscribed Events */}
              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1.5">
                  Subscribed Event Topics:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedWebhook.events.map((ev) => (
                    <span
                      key={ev}
                      className="text-xs font-mono px-2 py-0.5 rounded bg-[#474c80]/10 text-[#474c80] border border-[#474c80]/20"
                    >
                      {ev}
                    </span>
                  ))}
                </div>
              </div>

              {/* Send Test Event */}
              <div className="p-3 bg-[#f8f7e2] border border-[#dedecb] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#474c80]">
                    Live Connection Test
                  </span>
                  <Button
                    variant="secondary"
                    className="text-xs py-1 px-3 h-auto"
                    onClick={handleSendTestWebhook}
                    disabled={testEventStatus === "sending"}
                  >
                    {testEventStatus === "sending" ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 mr-1" /> Send Test Ping
                      </>
                    )}
                  </Button>
                </div>
                {testEventResult && (
                  <pre className="text-[11px] font-mono bg-[#fffef4] border border-[#dedecb] p-2.5 rounded text-[#474c80] overflow-x-auto">
                    {testEventResult}
                  </pre>
                )}
              </div>

              {/* Recent Deliveries */}
              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-2">
                  Delivery History & Response Log:
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {selectedWebhook.deliveries.map((del) => (
                    <div
                      key={del.id}
                      className="p-2.5 rounded border border-[#dedecb] bg-[#f8f7e2]/50 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono text-[#474c80] font-medium">{del.event}</div>
                        <div className="text-[11px] text-[#686b86]">
                          {del.time || (del as any).timestamp} • {del.latencyMs || (del as any).responseMs}ms
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            del.status === "success"
                              ? "bg-[#378875]/10 text-[#378875]"
                              : "bg-[#a24650]/10 text-[#a24650]"
                          }`}
                        >
                          HTTP {del.statusCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#dedecb] flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedWebhook(null)}>
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
