"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  PageHeading,
  SectionCard,
  MetricCard,
} from "./app-shell";
import {
  StatusBadge,
  SeverityPill,
  EmptyPanel,
  SkeletonPanel,
  ErrorPanel,
} from "./monitoring-kit";
import {
  SecuritySubNav,
  SecretField,
  ConfirmDialog,
} from "./security-kit";
import {
  COMPLIANCE_FRAMEWORKS_DATA,
  COMPLIANCE_CONTROLS_DATA,
  SECURITY_POLICIES_DATA,
  COMPLIANCE_EVIDENCE_DATA,
  SECURITY_CONTACTS_DATA,
  INCIDENT_PLAYBOOK_STEPS_DATA,
  PAST_INCIDENTS_DATA,
  WORKSPACE_SECURITY_SETTINGS_DATA,
  ComplianceFramework,
  ComplianceControl,
  ControlStatus,
  SecurityPolicy,
  ComplianceEvidence,
  SecurityContact,
  IncidentPlaybookStep,
  PastIncident,
  WorkspaceSecuritySettings,
} from "@/lib/security-data";
import {
  Scale,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Edit2,
  FileText,
  Upload,
  Download,
  ExternalLink,
  ChevronRight,
  User,
  Users,
  Flame,
  X,
  Plus,
  AlertOctagon,
  Copy,
  Check,
  ShieldAlert,
  Sliders,
  Save,
  Trash2,
  FolderArchive,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}

function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors text-sm px-3.5 py-2 disabled:opacity-50 disabled:cursor-not-allowed";
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

export function SecurityComplianceWorkspace() {
  const [activeTab, setActiveTab] = useState<"readiness" | "policies" | "incident" | "settings">("readiness");
  const [viewState, setViewState] = useState<"normal" | "skeleton" | "empty" | "error">("normal");

  // --- TAB 1: READINESS STATE ---
  const [selectedFramework, setSelectedFramework] = useState<"dpdp" | "gst" | "basics">("dpdp");
  const [controls, setControls] = useState<ComplianceControl[]>(COMPLIANCE_CONTROLS_DATA);

  // --- TAB 2: POLICIES & EVIDENCE STATE ---
  const [policies, setPolicies] = useState<SecurityPolicy[]>(SECURITY_POLICIES_DATA);
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);
  const [evidenceList, setEvidenceList] = useState<ComplianceEvidence[]>(COMPLIANCE_EVIDENCE_DATA);
  const [isGeneratingAuditPack, setIsGeneratingAuditPack] = useState(false);
  const [auditPackStep, setAuditPackStep] = useState(0);
  const [auditPackReady, setAuditPackReady] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState("all");

  // --- TAB 3: INCIDENT RESPONSE STATE ---
  const [activePlaybookStep, setActivePlaybookStep] = useState<number>(1);
  const [playbookSteps, setPlaybookSteps] = useState<IncidentPlaybookStep[]>(INCIDENT_PLAYBOOK_STEPS_DATA);
  const [isDrillActive, setIsDrillActive] = useState(false);
  const [drillSeconds, setDrillSeconds] = useState(0);
  const [contacts, setContacts] = useState<SecurityContact[]>(SECURITY_CONTACTS_DATA);
  const [editingContact, setEditingContact] = useState<SecurityContact | null>(null);
  const [pastIncidents, setPastIncidents] = useState<PastIncident[]>(PAST_INCIDENTS_DATA);

  // Breach notice helper form state
  const [breachForm, setBreachForm] = useState({
    description: "Anomalous export query executed outside regular business hours on GSTR-2B purchase ledger.",
    dataTypes: ["GSTINs & Vendor Ledgers", "Bank Account Numbers"],
    affectedCount: "142",
    discoveredAt: "12 Oct 2026, 06:30 IST",
  });
  const [hasCopiedNotice, setHasCopiedNotice] = useState(false);

  // --- TAB 4: SECURITY SETTINGS STATE ---
  const [initialSettings, setInitialSettings] = useState<WorkspaceSecuritySettings>(WORKSPACE_SECURITY_SETTINGS_DATA);
  const [settings, setSettings] = useState<WorkspaceSecuritySettings>(WORKSPACE_SECURITY_SETTINGS_DATA);
  const [isChangeSummaryOpen, setIsChangeSummaryOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetEmail, setTransferTargetEmail] = useState("");
  const [isCloseWorkspaceOpen, setIsCloseWorkspaceOpen] = useState(false);

  // Drill timer effect
  useEffect(() => {
    let interval: any;
    if (isDrillActive) {
      interval = setInterval(() => {
        setDrillSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isDrillActive]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Readiness progress calculation
  const frameworkScores = useMemo(() => {
    const calc = (frameworkId: "dpdp" | "gst" | "basics") => {
      const list = controls.filter((c) => c.frameworkId === frameworkId);
      if (!list.length) return 0;
      let score = 0;
      list.forEach((c) => {
        if (c.status === "met") score += 1;
        else if (c.status === "partially_met") score += 0.5;
        else if (c.status === "not_applicable") score += 1;
      });
      return Math.round((score / list.length) * 100);
    };
    return {
      dpdp: calc("dpdp"),
      gst: calc("gst"),
      basics: calc("basics"),
    };
  }, [controls]);

  // Overall workspace compliance score
  const overallComplianceScore = useMemo(() => {
    return Math.round((frameworkScores.dpdp + frameworkScores.gst + frameworkScores.basics) / 3);
  }, [frameworkScores]);

  // Top 5 Gap Summary: unmet controls sorted by risk
  const gapSummary = useMemo(() => {
    const riskRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return controls
      .filter((c) => c.status === "not_met" || c.status === "partially_met")
      .sort((a, b) => riskRank[b.risk] - riskRank[a.risk])
      .slice(0, 5);
  }, [controls]);

  // Handle control status change
  const handleUpdateControlStatus = (controlId: string, newStatus: ControlStatus) => {
    setControls((prev) =>
      prev.map((c) => (c.id === controlId ? { ...c, status: newStatus } : c))
    );
  };

  // Check if settings have changed
  const settingsDiff = useMemo(() => {
    const diffs: { label: string; from: string; to: string }[] = [];
    if (settings.requireMfa !== initialSettings.requireMfa) {
      diffs.push({
        label: "Require MFA for all members",
        from: initialSettings.requireMfa ? "Enabled" : "Disabled",
        to: settings.requireMfa ? "Enabled" : "Disabled",
      });
    }
    if (settings.sessionTimeoutMinutes !== initialSettings.sessionTimeoutMinutes) {
      diffs.push({
        label: "Session Idle Timeout",
        from: `${initialSettings.sessionTimeoutMinutes} minutes`,
        to: `${settings.sessionTimeoutMinutes} minutes`,
      });
    }
    if (settings.blockUnfamiliarCountries !== initialSettings.blockUnfamiliarCountries) {
      diffs.push({
        label: "Block logins from unfamiliar countries",
        from: initialSettings.blockUnfamiliarCountries ? "Enabled" : "Disabled",
        to: settings.blockUnfamiliarCountries ? "Enabled" : "Disabled",
      });
    }
    if (settings.requireExportApproval !== initialSettings.requireExportApproval) {
      diffs.push({
        label: "Require multi-party approval for bulk export",
        from: initialSettings.requireExportApproval ? "Enabled" : "Disabled",
        to: settings.requireExportApproval ? "Enabled" : "Disabled",
      });
    }
    if (settings.maskSensitiveByDefault !== initialSettings.maskSensitiveByDefault) {
      diffs.push({
        label: "Mask PII & PAN values by default",
        from: initialSettings.maskSensitiveByDefault ? "Enabled" : "Disabled",
        to: settings.maskSensitiveByDefault ? "Enabled" : "Disabled",
      });
    }
    if (settings.emailSecurityAlerts !== initialSettings.emailSecurityAlerts) {
      diffs.push({
        label: "Email security alerts to workspace administrators",
        from: initialSettings.emailSecurityAlerts ? "Enabled" : "Disabled",
        to: settings.emailSecurityAlerts ? "Enabled" : "Disabled",
      });
    }
    if (settings.quarantineUnsignedInvoices !== initialSettings.quarantineUnsignedInvoices) {
      diffs.push({
        label: "Auto-quarantine unsigned IRN invoices",
        from: initialSettings.quarantineUnsignedInvoices ? "Enabled" : "Disabled",
        to: settings.quarantineUnsignedInvoices ? "Enabled" : "Disabled",
      });
    }
    return diffs;
  }, [settings, initialSettings]);

  // Audit Pack simulation
  const handleStartAuditPack = () => {
    setIsGeneratingAuditPack(true);
    setAuditPackStep(1);
    setAuditPackReady(false);

    setTimeout(() => setAuditPackStep(2), 600);
    setTimeout(() => setAuditPackStep(3), 1200);
    setTimeout(() => setAuditPackStep(4), 1800);
    setTimeout(() => {
      setAuditPackStep(5);
      setAuditPackReady(true);
    }, 2400);
  };

  // Tabletop Drill actions
  const handleStartDrill = () => {
    setIsDrillActive(true);
    setDrillSeconds(0);
    setActivePlaybookStep(1);
  };

  const handleFinishDrill = () => {
    setIsDrillActive(false);
    const newIncident: PastIncident = {
      id: `inc-${Date.now()}`,
      title: "Live Tabletop Incident Drill",
      severity: "high",
      date: "Today, Just now",
      duration: `${Math.max(1, Math.round(drillSeconds / 60))} mins`,
      type: "Simulation Drill",
      status: "Closed Post-Mortem",
      summary: `Completed all 6 triage phases in ${formatTimer(drillSeconds)}. Response playbook verified for statutory CERT-In timelines.`,
    };
    setPastIncidents([newIncident, ...pastIncidents]);
  };

  // Toggle Playbook Task
  const handleToggleTask = (stepNum: number, taskId: string) => {
    setPlaybookSteps((prev) =>
      prev.map((step) =>
        step.step === stepNum
          ? {
              ...step,
              tasks: step.tasks.map((t) =>
                t.id === taskId ? { ...t, completed: !t.completed } : t
              ),
            }
          : step
      )
    );
  };

  // Copy notice draft
  const handleCopyNotice = () => {
    const draftText = `CERT-IN / DPDP STATUTORY INCIDENT NOTIFICATION DRAFT
======================================================
Report Date & Time: ${new Date().toISOString()}
Reporting Entity: Folio GST Workspace (Statutory Data Fiduciary)
Classification: Potential Data Incident Under Section 70B & DPDP Section 8

1. INCIDENT DESCRIPTION:
${breachForm.description}

2. CATEGORY OF DATA IMPLICATED:
- ${breachForm.dataTypes.join("\n- ")}

3. ESTIMATED SCOPE:
Approx. ${breachForm.affectedCount} individuals / taxpayer entities potentially affected.

4. CONTAINMENT MEASURES EXECUTED:
- Sessions revoked and affected API keys placed into isolation hold.
- Inbound ingestion quarantined pending forensic ledger verification.
- Merkle audit log block anchored for evidence integrity.

NOTE: This communication is a privileged legal draft for internal review.`;

    navigator.clipboard.writeText(draftText);
    setHasCopiedNotice(true);
    setTimeout(() => setHasCopiedNotice(false), 2500);
  };

  return (
    <div className="space-y-6">
      <SecuritySubNav active="compliance" />

      {/* Page Heading */}
      <PageHeading
        title="Compliance Center & Security Settings"
        description="Verify readiness for the DPDP Act 2023 and GST statutory audits, maintain policies, run incident response tabletop drills, and configure workspace controls."
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

            {activeTab === "policies" && (
              <Button onClick={handleStartAuditPack}>
                <FolderArchive className="w-4 h-4 mr-1.5" /> Generate Audit Pack
              </Button>
            )}
            {activeTab === "incident" && (
              <Button
                variant={isDrillActive ? "danger" : "primary"}
                onClick={isDrillActive ? handleFinishDrill : handleStartDrill}
              >
                {isDrillActive ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-1.5" /> End Drill ({formatTimer(drillSeconds)})
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1.5" /> Start Incident Drill
                  </>
                )}
              </Button>
            )}
          </div>
        }
      />

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Overall Compliance"
          value={`${overallComplianceScore}%`}
          note="Across 3 statutory frameworks"
          icon={Scale}
        />
        <MetricCard
          label="DPDP Act Readiness"
          value={`${frameworkScores.dpdp}%`}
          note="Data principal & consent score"
          icon={ShieldCheck}
        />
        <MetricCard
          label="GST Audit Readiness"
          value={`${frameworkScores.gst}%`}
          note="Rule 56 & 72m retention met"
          icon={FileCheck2}
        />
        <MetricCard
          label="Security Baseline"
          value={`${frameworkScores.basics}%`}
          note="1 critical gap: MFA required"
          icon={AlertTriangle}
        />
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex border-b border-[#dedecb] space-x-6">
        <button
          onClick={() => setActiveTab("readiness")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "readiness"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Scale className="w-4 h-4" />
          Readiness Checklists
        </button>
        <button
          onClick={() => setActiveTab("policies")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "policies"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <FileText className="w-4 h-4" />
          Policies & Evidence ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab("incident")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "incident"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Flame className="w-4 h-4" />
          Incident Response
          {isDrillActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#a24650] text-[#fffef4] font-semibold animate-pulse">
              Drill Active
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-[#474c80] text-[#474c80]"
              : "border-transparent text-[#686b86] hover:text-[#474c80]"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Security Settings
          {settingsDiff.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#cf9c50] text-[#fffef4] font-semibold">
              {settingsDiff.length} unsaved
            </span>
          )}
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
          title="Could not load compliance assessments"
          message="Failed to retrieve statutory audit matrices and policy certificates from the regulatory compliance vault."
          onRetry={() => setViewState("normal")}
        />
      )}

      {viewState === "empty" && (
        <EmptyPanel
          title="No compliance frameworks configured"
          message="Your workspace does not have any active statutory audit checklists."
          actionLabel="Load Default Frameworks"
          onAction={() => setControls(COMPLIANCE_CONTROLS_DATA)}
        />
      )}

      {/* NORMAL STATE */}
      {viewState === "normal" && (
        <>
          {/* ========================================================= */}
          {/* TAB 1: READINESS CHECKLISTS                               */}
          {/* ========================================================= */}
          {activeTab === "readiness" && (
            <div className="space-y-6">
              {/* Framework Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {COMPLIANCE_FRAMEWORKS_DATA.map((fw) => {
                  const score = frameworkScores[fw.id];
                  const isSelected = selectedFramework === fw.id;
                  return (
                    <div
                      key={fw.id}
                      onClick={() => setSelectedFramework(fw.id)}
                      className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-[#474c80] bg-[#fffef4] ring-2 ring-[#474c80]/20 shadow-sm"
                          : "border-[#dedecb] bg-[#fffef4]/60 hover:bg-[#fffef4] hover:border-[#474c80]/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#474c80]/10 text-[#474c80]">
                            {fw.badgeText}
                          </span>
                          <span className="text-xs text-[#686b86] italic font-medium">Self-assessment</span>
                        </div>

                        <h3 className="text-base font-semibold text-[#474c80] mt-3">{fw.shortName}</h3>
                        <p className="text-xs text-[#686b86] mt-1">{fw.tagline}</p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#dedecb]/70 flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-[#474c80]">{score}%</div>
                          <span className="text-[11px] text-[#686b86]">
                            {score >= 80 ? "Audit Ready" : "Remediation Needed"}
                          </span>
                        </div>
                        {/* Progress ring indicator */}
                        <div className="relative w-11 h-11 flex items-center justify-center">
                          <svg className="w-11 h-11 -rotate-90">
                            <circle
                              cx="22"
                              cy="22"
                              r="18"
                              stroke="#dedecb"
                              strokeWidth="3.5"
                              fill="none"
                            />
                            <circle
                              cx="22"
                              cy="22"
                              r="18"
                              stroke={score >= 80 ? "#378875" : score >= 50 ? "#cf9c50" : "#a24650"}
                              strokeWidth="3.5"
                              strokeDasharray={113}
                              strokeDashoffset={113 - (113 * score) / 100}
                              strokeLinecap="round"
                              fill="none"
                              className="transition-all duration-500"
                            />
                          </svg>
                          <span className="absolute text-[10px] font-bold text-[#474c80]">{score}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Disclaimer Banner */}
              <div className="p-3 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#686b86] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#cf9c50] shrink-0" />
                <span>
                  <strong>Notice:</strong> This is a readiness checklist self-assessment designed for audit preparedness, not an official statutory certification or legal opinion.
                </span>
              </div>

              {/* Top 5 Gap Summary */}
              {gapSummary.length > 0 && (
                <SectionCard
                  title="Compliance Gap Summary: Top Unmet Controls"
                  description="Prioritized remediation roadmap sorted by risk severity to accelerate statutory audit readiness."
                >
                  <div className="space-y-2">
                    {gapSummary.map((gap) => (
                      <div
                        key={gap.id}
                        className="p-3 border border-[#dedecb] rounded-lg bg-[#fffef4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[10px] ${
                                gap.risk === "critical"
                                  ? "bg-[#a24650]/15 text-[#a24650]"
                                  : "bg-[#cf9c50]/15 text-[#cf9c50]"
                              }`}
                            >
                              {gap.risk} risk
                            </span>
                            <span className="text-[11px] font-medium text-[#686b86]">
                              Effort: {gap.effort}
                            </span>
                            <span className="text-[#686b86]">•</span>
                            <span className="text-[#686b86] font-medium">{gap.area}</span>
                          </div>
                          <div className="font-semibold text-sm text-[#474c80]">{gap.title}</div>
                          <p className="text-[#686b86] text-xs max-w-2xl">{gap.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={gap.linkHref}
                            className="inline-flex items-center text-xs font-semibold text-[#474c80] bg-[#f8f7e2] border border-[#dedecb] hover:bg-[#dedecb]/50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {gap.linkLabel} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Active Framework Detailed Controls List */}
              <SectionCard
                title={`${
                  COMPLIANCE_FRAMEWORKS_DATA.find((f) => f.id === selectedFramework)?.name
                } Controls`}
                description="Update control implementation status inline. Progress scores and gap rankings recalculate in real-time."
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#dedecb] text-[#686b86] text-xs uppercase tracking-wider bg-[#f8f7e2]/50">
                        <th className="py-3 px-4">Control & Objective</th>
                        <th className="py-3 px-4">Area</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Evidence</th>
                        <th className="py-3 px-4">Status & Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedecb]">
                      {controls
                        .filter((c) => c.frameworkId === selectedFramework)
                        .map((ctrl) => (
                          <tr key={ctrl.id} className="hover:bg-[#f8f7e2]/30 transition-colors">
                            <td className="py-3.5 px-4 max-w-md">
                              <div className="font-semibold text-sm text-[#474c80]">{ctrl.title}</div>
                              <p className="text-xs text-[#686b86] mt-1">{ctrl.description}</p>
                              <div className="mt-2 flex items-center gap-2">
                                <a
                                  href={ctrl.linkHref}
                                  className="text-[11px] font-semibold text-[#474c80] hover:underline flex items-center gap-1"
                                >
                                  Configure in Folio ({ctrl.linkLabel}) <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span className="font-medium text-[#474c80] bg-[#474c80]/10 px-2 py-0.5 rounded">
                                {ctrl.area}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#474c80] text-[#f8f7e2] font-semibold text-[10px] flex items-center justify-center">
                                  {ctrl.ownerAvatar}
                                </div>
                                <span className="text-[#474c80] font-medium">{ctrl.ownerName}</span>
                              </div>
                              <div className="text-[11px] text-[#686b86] mt-0.5">{ctrl.dueDate}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span className="inline-flex items-center gap-1 text-xs text-[#686b86] bg-[#f8f7e2] border border-[#dedecb] px-2 py-0.5 rounded">
                                <FileCheck2 className="w-3.5 h-3.5 text-[#378875]" />
                                {ctrl.evidenceCount} {ctrl.evidenceCount === 1 ? "file" : "files"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <select
                                value={ctrl.status}
                                onChange={(e) =>
                                  handleUpdateControlStatus(ctrl.id, e.target.value as ControlStatus)
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer focus:outline-none ${
                                  ctrl.status === "met"
                                    ? "bg-[#378875]/10 text-[#378875] border-[#378875]/30"
                                    : ctrl.status === "partially_met"
                                    ? "bg-[#cf9c50]/15 text-[#cf9c50] border-[#cf9c50]/40"
                                    : ctrl.status === "not_met"
                                    ? "bg-[#a24650]/15 text-[#a24650] border-[#a24650]/40"
                                    : "bg-[#dedecb]/50 text-[#686b86] border-[#dedecb]"
                                }`}
                              >
                                <option value="met">Met</option>
                                <option value="partially_met">Partially met</option>
                                <option value="not_met">Not met</option>
                                <option value="not_applicable">Not applicable</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: POLICIES AND EVIDENCE                              */}
          {/* ========================================================= */}
          {activeTab === "policies" && (
            <div className="space-y-6">
              {/* Policies Library */}
              <SectionCard
                title="Security & Governance Policy Library"
                description="Formally ratified operational security, data retention, and incident response governance documents."
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#dedecb] text-[#686b86] text-xs uppercase tracking-wider bg-[#f8f7e2]/50">
                        <th className="py-3 px-4">Policy Document</th>
                        <th className="py-3 px-4">Version</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Last Reviewed</th>
                        <th className="py-3 px-4">Next Review</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedecb]">
                      {policies.map((pol) => (
                        <tr key={pol.id} className="hover:bg-[#f8f7e2]/30 transition-colors">
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="font-semibold text-sm text-[#474c80]">{pol.title}</div>
                            <div className="text-xs text-[#686b86] mt-0.5 truncate">{pol.summary}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono font-medium text-[#474c80]">
                            {pol.version}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#474c80]">{pol.owner}</td>
                          <td className="py-3.5 px-4 text-xs text-[#686b86]">{pol.lastReviewed}</td>
                          <td className="py-3.5 px-4 text-xs text-[#686b86]">{pol.nextReviewDate}</td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#378875]/10 text-[#378875]">
                              Active
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="secondary"
                              className="text-xs py-1 px-3 h-auto"
                              onClick={() => setSelectedPolicy(pol)}
                            >
                              View Policy
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Evidence Vault */}
              <SectionCard
                title="Statutory Evidence Vault"
                description="Verified audit reports, penetration tests, cryptographic key configurations, and vendor agreements."
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#686b86]">
                      {evidenceList.length} verified artifacts
                    </span>
                  </div>
                }
              >
                <div className="space-y-4">
                  {/* Simulated Upload Dropzone */}
                  <div
                    onClick={() => {
                      const newEv: ComplianceEvidence = {
                        id: `ev-${Date.now()}`,
                        fileName: `Audit_Receipt_${new Date().toISOString().split("T")[0]}.pdf`,
                        fileType: "Verification Export",
                        size: "512 KB",
                        linkedControlId: "ctrl-sec-01",
                        linkedControlTitle: "Enforce multi-factor authentication (MFA)",
                        uploadedAt: "Just now",
                        uploadedBy: "You (Live)",
                      };
                      setEvidenceList([newEv, ...evidenceList]);
                    }}
                    className="border-2 border-dashed border-[#dedecb] rounded-xl p-6 text-center bg-[#f8f7e2]/30 hover:bg-[#f8f7e2] hover:border-[#474c80]/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-6 h-6 mx-auto text-[#474c80] opacity-80 mb-2" />
                    <div className="font-semibold text-xs text-[#474c80]">
                      Click to simulate uploading an evidence document or audit sign-off
                    </div>
                    <p className="text-[11px] text-[#686b86] mt-1">
                      PDF, JSON, CSV formats supported. Files are timestamped and linked to compliance controls.
                    </p>
                  </div>

                  {/* Evidence Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#dedecb] text-[#686b86] text-xs uppercase tracking-wider bg-[#f8f7e2]/50">
                          <th className="py-2.5 px-3">File Name</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Linked Control</th>
                          <th className="py-2.5 px-3">Uploaded Date</th>
                          <th className="py-2.5 px-3">Uploader</th>
                          <th className="py-2.5 px-3 text-right">Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dedecb]">
                        {evidenceList.map((item) => (
                          <tr key={item.id} className="hover:bg-[#f8f7e2]/30 text-xs">
                            <td className="py-2.5 px-3 font-medium text-[#474c80] flex items-center gap-1.5">
                              <FileCheck2 className="w-3.5 h-3.5 text-[#378875] shrink-0" />
                              <span className="font-mono">{item.fileName}</span>
                            </td>
                            <td className="py-2.5 px-3 text-[#686b86]">{item.fileType}</td>
                            <td className="py-2.5 px-3 text-[#474c80] max-w-xs truncate">
                              {item.linkedControlTitle}
                            </td>
                            <td className="py-2.5 px-3 text-[#686b86]">{item.uploadedAt}</td>
                            <td className="py-2.5 px-3 text-[#686b86]">{item.uploadedBy}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#686b86]">
                              {item.size}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: INCIDENT RESPONSE                                  */}
          {/* ========================================================= */}
          {activeTab === "incident" && (
            <div className="space-y-6">
              {/* Active Drill Banner */}
              {isDrillActive && (
                <div className="p-4 bg-[#a24650]/10 border border-[#a24650]/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#a24650] text-[#fffef4] flex items-center justify-center font-bold font-mono">
                      {formatTimer(drillSeconds)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-[#a24650]">
                        Active Incident Tabletop Drill in Progress
                      </div>
                      <p className="text-xs text-[#686b86]">
                        Scenario: Simulated batch export attempt from foreign Sofia IP address. Work through the 6-phase response stepper.
                      </p>
                    </div>
                  </div>
                  <Button variant="danger" className="text-xs" onClick={handleFinishDrill}>
                    Complete Drill & Record Post-Mortem
                  </Button>
                </div>
              )}

              {/* 6-Step Playbook Card */}
              <SectionCard
                title="CERT-In & DPDP Cyber Incident Playbook"
                description="Interactive 6-phase protocol ensuring statutory 6-hour incident containment and notification compliance."
              >
                <div className="space-y-6">
                  {/* Stepper Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {playbookSteps.map((step) => {
                      const isActive = activePlaybookStep === step.step;
                      const allDone = step.tasks.every((t) => t.completed);
                      return (
                        <button
                          key={step.step}
                          onClick={() => setActivePlaybookStep(step.step)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isActive
                              ? "border-[#474c80] bg-[#474c80]/10 ring-2 ring-[#474c80]/20"
                              : "border-[#dedecb] bg-[#fffef4] hover:bg-[#f8f7e2]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#686b86] uppercase">
                              Phase {step.step}
                            </span>
                            {allDone && <Check className="w-3.5 h-3.5 text-[#378875]" />}
                          </div>
                          <div className="font-semibold text-xs text-[#474c80] mt-1">{step.name}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Step Details */}
                  {(() => {
                    const current = playbookSteps.find((s) => s.step === activePlaybookStep);
                    if (!current) return null;
                    return (
                      <div className="p-4 bg-[#f8f7e2]/60 border border-[#dedecb] rounded-xl space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-[#474c80] uppercase tracking-wider">
                              Phase {current.step}: {current.name}
                            </span>
                            <h4 className="text-sm font-semibold text-[#474c80] mt-0.5">
                              Objective: {current.objective}
                            </h4>
                          </div>
                          <span className="text-xs text-[#686b86]">
                            {current.tasks.filter((t) => t.completed).length} of {current.tasks.length} tasks completed
                          </span>
                        </div>

                        <div className="space-y-2">
                          {current.tasks.map((task) => (
                            <label
                              key={task.id}
                              className="flex items-start gap-2.5 p-2 rounded-lg bg-[#fffef4] border border-[#dedecb] cursor-pointer hover:bg-[#fffef4]/80 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => handleToggleTask(current.step, task.id)}
                                className="w-4 h-4 mt-0.5 accent-[#474c80] rounded"
                              />
                              <span
                                className={`text-[#474c80] ${
                                  task.completed ? "line-through text-[#686b86]" : ""
                                }`}
                              >
                                {task.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </SectionCard>

              {/* Contact Tree */}
              <SectionCard
                title="Escalation Contact Tree"
                description="Designated cyber officers and legal counsel for immediate emergency notification."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {contacts.map((cnt) => (
                    <div
                      key={cnt.id}
                      className="border border-[#dedecb] rounded-lg p-4 bg-[#fffef4] space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-[#474c80] uppercase tracking-wider bg-[#474c80]/10 px-2 py-0.5 rounded">
                            Level {cnt.escalationLevel} Escalation
                          </span>
                          <h4 className="font-semibold text-sm text-[#474c80] mt-2">{cnt.role}</h4>
                        </div>
                        <button
                          onClick={() => setEditingContact(cnt)}
                          className="p-1 text-[#686b86] hover:text-[#474c80] rounded"
                          title="Edit contact"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="font-medium text-[#474c80] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#686b86]" />
                          {cnt.name}
                        </div>
                        <div className="text-[#686b86] flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="font-mono">{cnt.email}</span>
                        </div>
                        <div className="text-[#686b86] flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="font-mono">{cnt.phone}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#686b86] pt-2 border-t border-[#dedecb]/70">
                        {cnt.description}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Breach Notification Helper */}
              <SectionCard
                title="Statutory Breach Notification Helper"
                description="Formulate standard plain-language disclosures for CERT-In Directions 70B and DPDP Section 8 requirements."
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#474c80] mb-1">
                        Incident Summary: What Happened?
                      </label>
                      <textarea
                        rows={3}
                        value={breachForm.description}
                        onChange={(e) =>
                          setBreachForm({ ...breachForm, description: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#474c80] focus:outline-none focus:border-[#474c80]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#474c80] mb-1.5">
                        Categories of Data Affected:
                      </label>
                      <div className="space-y-1.5 text-xs text-[#474c80]">
                        {[
                          "GSTINs & Vendor Ledgers",
                          "Bank Account Numbers",
                          "Invoice Totals & Line Items",
                          "Personal Contact Names & Phone Numbers",
                        ].map((cat) => {
                          const isChecked = breachForm.dataTypes.includes(cat);
                          return (
                            <label key={cat} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBreachForm({
                                      ...breachForm,
                                      dataTypes: [...breachForm.dataTypes, cat],
                                    });
                                  } else {
                                    setBreachForm({
                                      ...breachForm,
                                      dataTypes: breachForm.dataTypes.filter((x) => x !== cat),
                                    });
                                  }
                                }}
                                className="accent-[#474c80]"
                              />
                              <span>{cat}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#474c80] mb-1">
                          Est. People / Vendors Affected:
                        </label>
                        <input
                          type="text"
                          value={breachForm.affectedCount}
                          onChange={(e) =>
                            setBreachForm({ ...breachForm, affectedCount: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#474c80]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#474c80] mb-1">
                          Date & Time Discovered:
                        </label>
                        <input
                          type="text"
                          value={breachForm.discoveredAt}
                          onChange={(e) =>
                            setBreachForm({ ...breachForm, discoveredAt: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#474c80]"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-[#a24650]/10 border border-[#a24650]/30 rounded-lg text-xs text-[#a24650] flex items-start gap-2">
                      <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">Legal Review Mandatory:</strong>
                        Under CERT-In directions, reports must be furnished within 6 hours. Have your designated Legal DPO review this text prior to external transmission.
                      </div>
                    </div>
                  </div>

                  {/* Generated Plain-Language Draft Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#474c80]">
                        Generated Statutory Notice Draft
                      </span>
                      <Button
                        variant="secondary"
                        className="text-xs py-1 px-2.5 h-auto"
                        onClick={handleCopyNotice}
                      >
                        {hasCopiedNotice ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-[#378875]" /> Copied Draft
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy Draft Notice
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="p-4 bg-[#f8f7e2] border border-[#dedecb] rounded-xl font-mono text-[11px] text-[#474c80] space-y-2 whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto">
                      {`TO: Indian Computer Emergency Response Team (CERT-In)
CC: Data Protection Board of India / Legal Counsel
SUBJECT: INCIDENT NOTIFICATION [DIRECTIONS 70B] - FOLIO GST WORKSPACE

1. Nature of Incident:
${breachForm.description}

2. Data Implicated:
${breachForm.dataTypes.map((d) => `• ${d}`).join("\n")}

3. Volume & Scope:
Approx. ${breachForm.affectedCount} taxpayer / vendor records affected.
Discovered at: ${breachForm.discoveredAt}

4. Remediation Executed:
Compromised token sessions terminated; Merkle ledger integrity frozen; customer KMS rotation scheduled. Zero evidence of lateral exfiltration detected.`}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Past Incidents Table */}
              <SectionCard
                title="Historical Incident & Tabletop Drill Log"
                description="Chronological log of verified drills and remediation outcomes. Direct telemetry synced with workspace incidents."
                action={
                  <a
                    href="/app/monitoring/incidents"
                    className="text-xs font-semibold text-[#474c80] hover:underline flex items-center gap-1"
                  >
                    Open Live Incidents Monitor <ExternalLink className="w-3 h-3" />
                  </a>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#dedecb] text-[#686b86] text-xs uppercase tracking-wider bg-[#f8f7e2]/50">
                        <th className="py-2.5 px-3">Event Title</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedecb]">
                      {pastIncidents.map((inc) => (
                        <tr key={inc.id} className="hover:bg-[#f8f7e2]/30 text-xs">
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#474c80]">{inc.title}</div>
                            <div className="text-[11px] text-[#686b86]">{inc.summary}</div>
                          </td>
                          <td className="py-3 px-3 text-[#686b86]">{inc.type}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                inc.severity === "high"
                                  ? "bg-[#a24650]/15 text-[#a24650]"
                                  : "bg-[#cf9c50]/15 text-[#cf9c50]"
                              }`}
                            >
                              {inc.severity}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#686b86]">{inc.date}</td>
                          <td className="py-3 px-3 text-[#686b86]">{inc.duration}</td>
                          <td className="py-3 px-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#378875]/10 text-[#378875]">
                              {inc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: SECURITY SETTINGS                                  */}
          {/* ========================================================= */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Grouped Switches Card */}
              <SectionCard
                title="Workspace Security Controls"
                description="Global governance settings enforcing identity requirements, export restrictions, and data protection defaults."
              >
                <div className="space-y-5 divide-y divide-[#dedecb]">
                  {/* 1. MFA Requirement */}
                  <div className="pt-4 first:pt-0 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-[#474c80]">
                        Require Multi-Factor Authentication (MFA)
                      </div>
                      <p className="text-xs text-[#686b86] mt-0.5">
                        Mandatory TOTP authenticator or security key for all team members upon next sign-in.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.requireMfa}
                        onChange={(e) =>
                          setSettings({ ...settings, requireMfa: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#dedecb] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#fffef4] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#fffef4] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#474c80]" />
                    </label>
                  </div>

                  {/* 2. Session Idle Timeout */}
                  <div className="pt-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-[#474c80]">
                        Idle Session Timeout
                      </div>
                      <p className="text-xs text-[#686b86] mt-0.5">
                        Automatically lock browser sessions when inactive to prevent unattended console tampering.
                      </p>
                    </div>
                    <select
                      value={settings.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sessionTimeoutMinutes: Number(e.target.value),
                        })
                      }
                      className="px-3 py-1.5 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs font-semibold text-[#474c80] focus:outline-none"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes (Standard)</option>
                      <option value={60}>1 hour</option>
                      <option value={240}>4 hours</option>
                    </select>
                  </div>

                  {/* 3. Block Foreign Country Logins */}
                  <div className="pt-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-[#474c80]">
                        Block Sign-ins From Unverified Countries
                      </div>
                      <p className="text-xs text-[#686b86] mt-0.5">
                        Restrict authentication solely to India and explicitly allowlisted company VPN endpoints.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.blockUnfamiliarCountries}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            blockUnfamiliarCountries: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#dedecb] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#fffef4] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#fffef4] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#474c80]" />
                    </label>
                  </div>

                  {/* 4. Multi-party export approval */}
                  <div className="pt-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-[#474c80]">
                        Require Dual-Approval for Bulk Exports
                      </div>
                      <p className="text-xs text-[#686b86] mt-0.5">
                        Downloading full GSTR-2B spreadsheets or raw database dumps requires dual approval by Admin.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.requireExportApproval}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            requireExportApproval: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#dedecb] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#fffef4] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#fffef4] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#474c80]" />
                    </label>
                  </div>

                  {/* 5. Mask PII & PAN values by default */}
                  <div className="pt-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-[#474c80]">
                        Mask Sensitive Values by Default
                      </div>
                      <p className="text-xs text-[#686b86] mt-0.5">
                        Hide PAN numbers, taxpayer bank accounts, and personal contact details behind a one-click reveal button.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.maskSensitiveByDefault}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            maskSensitiveByDefault: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#dedecb] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#fffef4] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#fffef4] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#474c80]" />
                    </label>
                  </div>

                  {/* 6. Email Security Alerts */}
                  <div className="pt-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-[#474c80]">
                        Email Real-Time Security Alerts to Administrators
                      </div>
                      <p className="text-xs text-[#686b86] mt-0.5">
                        Immediately notify workspace controllers upon prompt-injection alarms or impossible travel jumps.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.emailSecurityAlerts}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailSecurityAlerts: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#dedecb] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#fffef4] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#fffef4] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#474c80]" />
                    </label>
                  </div>
                </div>
              </SectionCard>

              {/* Danger Zone */}
              <div className="border border-[#a24650]/40 rounded-xl p-5 bg-[#a24650]/5 space-y-4">
                <div>
                  <h3 className="font-semibold text-base text-[#a24650] flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" /> Danger Zone
                  </h3>
                  <p className="text-xs text-[#686b86] mt-0.5">
                    Irreversible actions that transfer control or permanently erase workspace data.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-[#fffef4] border border-[#dedecb] rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-[#474c80]">
                        Transfer Workspace Ownership
                      </h4>
                      <p className="text-xs text-[#686b86] mt-1">
                        Relinquish master owner privileges to another registered administrator in your organization.
                      </p>
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="secondary"
                        className="text-xs w-full"
                        onClick={() => setIsTransferModalOpen(true)}
                      >
                        Transfer Ownership
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-[#fffef4] border border-[#a24650]/30 rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-[#a24650]">
                        Close Workspace & Purge Data
                      </h4>
                      <p className="text-xs text-[#686b86] mt-1">
                        Permanently destroy customer encryption KMS keys and purge all uploaded vouchers in compliance with DPDP.
                      </p>
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="danger"
                        className="text-xs w-full"
                        onClick={() => setIsCloseWorkspaceOpen(true)}
                      >
                        Close Workspace
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Save Bar */}
              {settingsDiff.length > 0 && (
                <div className="sticky bottom-4 z-40 bg-[#393d68] text-[#f8f7e2] p-4 rounded-xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#cf9c50] animate-ping" />
                    <span className="text-xs font-semibold">
                      You have {settingsDiff.length} unsaved security setting {settingsDiff.length === 1 ? "change" : "changes"}.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSettings(initialSettings)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#f8f7e2]/80 hover:text-[#f8f7e2] hover:bg-[#dedecb]/10 transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => setIsChangeSummaryOpen(true)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#f8f7e2] text-[#474c80] hover:bg-[#fffef4] transition-colors shadow-xs"
                    >
                      Review & Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Save Toast */}
              {saveToast && (
                <div className="fixed bottom-6 right-6 z-50 bg-[#378875] text-[#fffef4] px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Workspace security controls updated and signed successfully.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* MODALS & DRAWERS                                          */}
      {/* ========================================================= */}

      {/* 1. POLICY DETAIL DRAWER */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex justify-end">
          <div className="bg-[#fffef4] border-l border-[#dedecb] w-full max-w-xl h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex justify-between items-start border-b border-[#dedecb] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#474c80] bg-[#474c80]/10 px-2 py-0.5 rounded">
                      {selectedPolicy.version}
                    </span>
                    <span className="text-xs text-[#686b86] capitalize">{selectedPolicy.category}</span>
                  </div>
                  <h3 className="font-semibold text-lg text-[#474c80] mt-1">
                    {selectedPolicy.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="text-[#686b86] hover:text-[#474c80] p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-[#686b86] grid grid-cols-2 gap-2 p-3 bg-[#f8f7e2] border border-[#dedecb] rounded-lg">
                <div>
                  <strong>Owner:</strong> {selectedPolicy.owner}
                </div>
                <div>
                  <strong>Status:</strong> Active & Enforced
                </div>
                <div>
                  <strong>Last Reviewed:</strong> {selectedPolicy.lastReviewed}
                </div>
                <div>
                  <strong>Next Review:</strong> {selectedPolicy.nextReviewDate}
                </div>
              </div>

              {/* Policy Body */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#474c80] uppercase tracking-wider">
                  Ratified Policy Content:
                </h4>
                <div className="p-4 bg-[#f8f7e2]/50 border border-[#dedecb] rounded-xl text-xs text-[#474c80] font-sans leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {selectedPolicy.fullContent}
                </div>
              </div>

              {/* Version History List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#474c80] uppercase tracking-wider">
                  Revision & Attestation History:
                </h4>
                <div className="space-y-2">
                  {selectedPolicy.versions.map((ver) => (
                    <div
                      key={ver.version}
                      className="p-2.5 rounded-lg border border-[#dedecb] bg-[#fffef4] text-xs space-y-0.5"
                    >
                      <div className="flex justify-between items-center font-medium text-[#474c80]">
                        <span className="font-mono">{ver.version}</span>
                        <span className="text-[11px] text-[#686b86]">{ver.date} • {ver.author}</span>
                      </div>
                      <p className="text-[#686b86] text-[11px]">{ver.changes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#dedecb] flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedPolicy(null)}>
                Close Policy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. GENERATE AUDIT PACK MODAL */}
      {isGeneratingAuditPack && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#474c80]">
                {auditPackReady ? "Statutory Audit Pack Ready" : "Compiling Statutory Audit Pack..."}
              </h3>
              {auditPackReady && (
                <button
                  onClick={() => setIsGeneratingAuditPack(false)}
                  className="text-[#686b86] hover:text-[#474c80]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Steps Checklist */}
            <div className="space-y-3">
              {[
                { step: 1, label: "Collecting immutable Merkle audit log signatures" },
                { step: 2, label: "Extracting RBAC permissions & session history" },
                { step: 3, label: "Bundling active governance policies (v2.3)" },
                { step: 4, label: "Archiving verified evidence vault attachments" },
              ].map((item) => {
                const isPassed = auditPackStep > item.step;
                const isCurrent = auditPackStep === item.step;
                return (
                  <div key={item.step} className="flex items-center gap-2.5 text-xs text-[#474c80]">
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#378875] shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw className="w-4 h-4 text-[#474c80] animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[#dedecb] shrink-0" />
                    )}
                    <span className={isPassed ? "font-medium" : "text-[#686b86]"}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {auditPackReady && (
              <div className="p-3 bg-[#378875]/10 border border-[#378875]/30 rounded-lg text-xs text-[#378875] flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>
                  Archive sealed: <strong>folio_audit_pack_fy26_q2.zip</strong> (14.8 MB)
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
              {auditPackReady ? (
                <>
                  <Button variant="secondary" onClick={() => setIsGeneratingAuditPack(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      alert("Simulated download: folio_audit_pack_fy26_q2.zip saved to Downloads folder.");
                      setIsGeneratingAuditPack(false);
                    }}
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Download ZIP
                  </Button>
                </>
              ) : (
                <span className="text-xs text-[#686b86] italic py-2">
                  Cryptographically signing ZIP contents...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. EDIT CONTACT DIALOG */}
      {editingContact && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#474c80]">
                Edit Contact: {editingContact.role}
              </h3>
              <button onClick={() => setEditingContact(null)} className="text-[#686b86]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1">
                  Officer Name
                </label>
                <input
                  type="text"
                  value={editingContact.name}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs text-[#474c80]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editingContact.email}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs font-mono text-[#474c80]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#474c80] mb-1">
                  Emergency Phone
                </label>
                <input
                  type="text"
                  value={editingContact.phone}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs font-mono text-[#474c80]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
              <Button variant="secondary" onClick={() => setEditingContact(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setContacts((prev) =>
                    prev.map((c) => (c.id === editingContact.id ? editingContact : c))
                  );
                  setEditingContact(null);
                }}
              >
                Save Contact
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SECURITY SETTING CHANGE SUMMARY DIALOG */}
      {isChangeSummaryOpen && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#474c80]">
                Security Change Summary
              </h3>
              <button onClick={() => setIsChangeSummaryOpen(false)} className="text-[#686b86]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#686b86]">
              Please review the following modifications before applying them to your workspace security baseline:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {settingsDiff.map((d, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-[#dedecb] bg-[#f8f7e2]/50 text-xs space-y-1"
                >
                  <div className="font-semibold text-[#474c80]">{d.label}</div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[#a24650] line-through">{d.from}</span>
                    <span>&rarr;</span>
                    <span className="text-[#378875] font-semibold">{d.to}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
              <Button variant="secondary" onClick={() => setIsChangeSummaryOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setInitialSettings({ ...settings });
                  setIsChangeSummaryOpen(false);
                  setSaveToast(true);
                  setTimeout(() => setSaveToast(false), 3000);
                }}
              >
                Confirm & Apply Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TRANSFER OWNERSHIP MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#393d68]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffef4] border border-[#dedecb] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#dedecb] pb-2">
              <h3 className="font-semibold text-base text-[#a24650]">
                Transfer Workspace Ownership
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-[#686b86]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#686b86]">
              This will grant primary controller ownership of the entire Folio GST workspace to another verified user. You will be downgraded to Administrator.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#474c80] mb-1">
                Recipient Administrator Email:
              </label>
              <input
                type="email"
                placeholder="e.g. aditi.mehta@folio-tax.in"
                value={transferTargetEmail}
                onChange={(e) => setTransferTargetEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[#f8f7e2] border border-[#dedecb] rounded-lg text-xs font-mono text-[#474c80]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#dedecb]">
              <Button variant="secondary" onClick={() => setIsTransferModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!transferTargetEmail.includes("@")}
                onClick={() => {
                  alert(`Ownership transfer initiated to ${transferTargetEmail}. Confirmation email sent.`);
                  setIsTransferModalOpen(false);
                  setTransferTargetEmail("");
                }}
              >
                Transfer Ownership
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CLOSE WORKSPACE CONFIRM DIALOG */}
      {isCloseWorkspaceOpen && (
        <ConfirmDialog
          open={isCloseWorkspaceOpen}
          onClose={() => setIsCloseWorkspaceOpen(false)}
          onConfirm={() => {
            alert("Workspace deletion scheduled in accordance with DPDP Section 12 cryptographic purge standards.");
            setIsCloseWorkspaceOpen(false);
          }}
          title="Close Workspace & Purge All Data"
          body="This action is irreversible. All invoice ledgers, vendor master lists, WORM backup vaults, and cryptographic KMS keys will be destroyed."
          confirmLabel="Purge Workspace"
          danger={true}
          requireTyping="DELETE WORKSPACE"
        />
      )}
    </div>
  );
}
