'use client'

import React, { useState, useMemo } from 'react'
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  FileSearch,
  Eye,
  EyeOff,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Trash2,
  Plus,
  X,
  FileCheck2,
  ExternalLink,
  ChevronRight,
  Bot,
  Scale,
  Clock,
  ArrowRight,
  UserCheck,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  SkeletonPanel,
  TimeRangeControl,
  StatusBadge,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  SecuritySubNav,
  DemoDataChip,
  MaskedValue,
  ConfirmDialog,
} from '@/components/security-kit'
import {
  getRetentionPolicies,
  getSubProcessors,
  getPrivacyRequests,
  getConsentLogs,
  type RetentionPolicyItem,
  type SubProcessorItem,
  type PrivacyRequestItem,
  type ConsentLogItem,
} from '@/lib/security-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function SecurityDataWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicyItem[]>(getRetentionPolicies())
  const [subProcessors] = useState<SubProcessorItem[]>(getSubProcessors())
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequestItem[]>(getPrivacyRequests())
  const [consentLogs, setConsentLogs] = useState<ConsentLogItem[]>(getConsentLogs())

  // PII Masking Toggles
  const [maskGstin, setMaskGstin] = useState(true)
  const [maskPhone, setMaskPhone] = useState(true)
  const [maskEmail, setMaskEmail] = useState(true)
  const [maskBank, setMaskBank] = useState(true)
  const [maskAmounts, setMaskAmounts] = useState(false)

  // AI Privacy Toggle
  const [blockAiImages, setBlockAiImages] = useState(false)

  // Consent Filter Search
  const [consentSearch, setConsentSearch] = useState('')

  // New Privacy Request Modal
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [reqName, setReqName] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqType, setReqType] = useState<PrivacyRequestItem['type']>('Data Access (Export)')
  const [reqNotes, setReqNotes] = useState('')

  // Export Data Simulation
  const [exportingData, setExportingData] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  // Generic Confirm Dialog State
  const [confirmDialogData, setConfirmDialogData] = useState<{
    isOpen: boolean
    title: string
    body: string
    confirmLabel: string
    danger: boolean
    requireTyping?: string
    action: () => void
  } | null>(null)

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Retention adjustment calculation
  const totalStorageGb = useMemo(() => {
    return retentionPolicies.reduce((acc, p) => acc + p.estimatedStorageGb, 0).toFixed(1)
  }, [retentionPolicies])

  const handleRetentionChange = (id: string, newDays: number) => {
    setRetentionPolicies((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const ratio = newDays / p.retentionDays
          return {
            ...p,
            retentionDays: newDays,
            estimatedStorageGb: Math.max(1.2, +(p.estimatedStorageGb * ratio).toFixed(1)),
          }
        }
        return p
      })
    )
    showToast(`Updated retention policy. ~2.4 GB will be scheduled for pruning upon the next automated cycle.`)
  }

  // Privacy Request Actions
  const handleApproveRequest = (req: PrivacyRequestItem) => {
    setPrivacyRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'Approved' } : r))
    )
    showToast(`Request ${req.id} approved. Dispatching encrypted verification token to ${req.requesterEmail}.`)
  }

  const handleCompleteRequest = (req: PrivacyRequestItem) => {
    setPrivacyRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'Completed' } : r))
    )
    showToast(`Request ${req.id} marked as completed and logged in DPDP fulfillment audit trail.`)
  }

  const handleRejectRequest = (req: PrivacyRequestItem) => {
    setConfirmDialogData({
      isOpen: true,
      title: `Reject Request ${req.id}?`,
      body: `You must specify a statutory ground for rejection under the DPDP Act (e.g. conflicting tax retention under Section 36 of CGST Act).`,
      confirmLabel: 'Reject Request',
      danger: true,
      action: () => {
        setPrivacyRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, status: 'Rejected' } : r))
        )
        showToast(`Request ${req.id} rejected citing Section 36 CGST statutory retention precedence.`)
      },
    })
  }

  const handleCreateNewRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqEmail || !reqName) return

    const newReq: PrivacyRequestItem = {
      id: `REQ-2026-00${privacyRequests.length + 1}`,
      requesterName: reqName,
      requesterEmail: reqEmail,
      type: reqType,
      receivedDate: 'Today',
      dueDate: '25 Oct 2026',
      daysUntilDue: 14,
      status: 'Pending Review',
      notes: reqNotes || 'Standard statutory request logged by compliance team.',
    }

    setPrivacyRequests([newReq, ...privacyRequests])
    setNewRequestOpen(false)
    setReqName('')
    setReqEmail('')
    setReqNotes('')
    showToast(`Privacy request ${newReq.id} registered with 14-day statutory SLA clock`)
  }

  // Export Workspace Simulation
  const handleStartExport = () => {
    setExportingData(true)
    setExportProgress(10)
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setExportingData(false)
          showToast('Workspace export complete. 1.84 GB encrypted archive downloaded.')
          return 100
        }
        return prev + 25
      })
    }, 600)
  }

  // Delete Workspace Data
  const handleDeleteWorkspaceData = () => {
    setConfirmDialogData({
      isOpen: true,
      title: 'Permanently Erase All Workspace Data?',
      body: 'This action is irreversibly destructive. All purchase vouchers, extracted GSTIN tables, and audit logs will be cryptographically shredded. Please type "FOLIO-WORKSPACE-PURGE" to authorize this destruction.',
      confirmLabel: 'Erase All Workspace Data',
      danger: true,
      requireTyping: 'FOLIO-WORKSPACE-PURGE',
      action: () => {
        showToast('Cryptographic erasure request initiated. Workspace scheduled for immediate deprovisioning.')
      },
    })
  }

  // Filtered consent logs
  const filteredConsentLogs = useMemo(() => {
    return consentLogs.filter((c) => {
      if (consentSearch) {
        const q = consentSearch.toLowerCase()
        return (
          c.subject.toLowerCase().includes(q) ||
          c.subjectEmail.toLowerCase().includes(q) ||
          c.purpose.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [consentLogs, consentSearch])

  return (
    <AppShell active="Security">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#378875]/40 bg-[#378875] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialogData && (
        <ConfirmDialog
          isOpen={confirmDialogData.isOpen}
          onClose={() => setConfirmDialogData(null)}
          onConfirm={confirmDialogData.action}
          title={confirmDialogData.title}
          body={confirmDialogData.body}
          confirmLabel={confirmDialogData.confirmLabel}
          danger={confirmDialogData.danger}
          requireTyping={confirmDialogData.requireTyping}
        />
      )}

      <PageHeading
        eyebrow="Security"
        title="Data Protection & Privacy Governance"
        description="Transparent encryption architectures, PII masking rules, DPDP data principal requests, and statutory retention controls."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <DemoDataChip />
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <SecuritySubNav active="data" />

      {/* State Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#686b86]">
          <span>State simulator:</span>
          {(['normal', 'skeleton', 'empty', 'error'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                viewMode === mode
                  ? 'bg-[#474c80] text-[#f8f7e2]'
                  : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-[#686b86]">
          <span>Regulatory Framework: <strong className="text-[#378875]">DPDP Act 2023 & Section 36 CGST</strong></span>
          <span className="text-[#dedecb]">·</span>
          <span>Storage: {totalStorageGb} GB Encrypted</span>
        </div>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No data privacy policies found"
          description="Workspace privacy configuration has not been initialized."
          action={
            <button
              type="button"
              onClick={() => setViewMode('normal')}
              className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
            >
              Reset view
            </button>
          }
        />
      )}

      {viewMode === 'error' && (
        <ErrorPanel
          title="Privacy Engine Telemetry Unreachable"
          message="Could not stream encryption tier states and DPDP fulfillment queues."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-8 pb-16">
          {/* 1. PROTECTION SUMMARY ROW (4 METRIC CARDS) */}
          <div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Encrypted in transit"
                value="TLS 1.3 Strict"
                note="HSTS & PFS enforced on all hops"
                icon={Lock}
              />
              <MetricCard
                label="Encrypted at rest"
                value="AES-256 KMS"
                note="FIPS 140-2 Level 3 HSM keys"
                icon={HardDrive}
              />
              <MetricCard
                label="Files scanned for malware"
                value="3,842 files"
                note="Zero malicious payloads detected"
                icon={FileSearch}
              />
              <MetricCard
                label="Last cross-region backup"
                value="22 min ago"
                note="RPO: 15 min · WORM Object Lock"
                icon={Server}
              />
            </div>
            <p className="mt-2 text-[10px] text-right text-[#686b86]">
              * Demo values reflecting production architecture telemetry
            </p>
          </div>

          {/* 2. DATA MAP CARD */}
          <SectionCard
            title="End-to-end invoice data journey"
            description="Trace how business and tax records travel through Folio with cryptographic locks applied at every transit step."
          >
            <div className="pt-2 overflow-x-auto">
              <div className="min-w-[700px] flex items-center justify-between gap-2 p-4 rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/30 text-xs">
                {/* Node 1: Upload */}
                <div className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-center space-y-1">
                  <span className="font-bold text-[#393d68] block">1. Upload</span>
                  <span className="text-[10px] text-[#686b86]">Browser / SFTP / Webhook</span>
                  <div className="pt-1 text-[10px] font-mono text-[#378875] flex items-center justify-center gap-1">
                    <Lock className="size-3" /> TLS 1.3 / HSTS
                  </div>
                </div>

                <div className="text-[#686b86] flex flex-col items-center">
                  <ArrowRight className="size-4" />
                </div>

                {/* Node 2: Storage */}
                <div className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-center space-y-1">
                  <span className="font-bold text-[#393d68] block">2. Raw Vault</span>
                  <span className="text-[10px] text-[#686b86]">AWS S3 ap-south-1</span>
                  <div className="pt-1 text-[10px] font-mono text-[#378875] flex items-center justify-center gap-1">
                    <Lock className="size-3" /> AES-256 KMS
                  </div>
                </div>

                <div className="text-[#686b86] flex flex-col items-center">
                  <ArrowRight className="size-4" />
                </div>

                {/* Node 3: AI Reading (Highlight) */}
                <div className="flex-1 rounded-xl border-2 border-[#474c80] bg-[#474c80]/5 p-3 text-center space-y-1 relative shadow-xs">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#474c80] px-2 py-0.2 text-[9px] font-bold text-[#f8f7e2]">
                    AI Hop
                  </span>
                  <span className="font-bold text-[#474c80] block">3. Vision OCR</span>
                  <span className="text-[10px] text-[#686b86]">Gemini 2.5 in Mumbai</span>
                  <div className="pt-1 text-[10px] font-mono text-[#378875] flex items-center justify-center gap-1">
                    <Lock className="size-3" /> Zero Retention DPA
                  </div>
                </div>

                <div className="text-[#686b86] flex flex-col items-center">
                  <ArrowRight className="size-4" />
                </div>

                {/* Node 4: Rule Engine */}
                <div className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-center space-y-1">
                  <span className="font-bold text-[#393d68] block">4. Rule Engine</span>
                  <span className="text-[10px] text-[#686b86]">Local Python Sandbox</span>
                  <div className="pt-1 text-[10px] font-mono text-[#378875] flex items-center justify-center gap-1">
                    <Lock className="size-3" /> Air-gapped logic
                  </div>
                </div>

                <div className="text-[#686b86] flex flex-col items-center">
                  <ArrowRight className="size-4" />
                </div>

                {/* Node 5: Reports */}
                <div className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-center space-y-1">
                  <span className="font-bold text-[#393d68] block">5. Ledger</span>
                  <span className="text-[10px] text-[#686b86]">PostgreSQL + GSP</span>
                  <div className="pt-1 text-[10px] font-mono text-[#378875] flex items-center justify-center gap-1">
                    <Lock className="size-3" /> TDE Encrypted
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-xs text-[#686b86] leading-relaxed">
              <strong className="text-[#393d68]">AI Provider Transparency:</strong> Gemini Vision API processes document image pixels strictly within Google Cloud's Mumbai region. Under our enterprise BAA & DPA agreement, customer invoice data is never cached, stored, or utilized for foundation model training.
            </div>
          </SectionCard>

          {/* 3. PII MASKING CONTROLS & LIVE PREVIEW PANEL */}
          <SectionCard
            title="PII & sensitive entity masking controls"
            description="Control how confidential tax identification numbers, bank IFSCs, and contact details appear across developer logs, audit traces, and customer support sessions."
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
              {/* Controls Column (7 cols) */}
              <div className="lg:col-span-7 space-y-3.5 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                  <div>
                    <span className="font-bold text-[#393d68] block">Mask Supplier GSTINs</span>
                    <span className="text-[11px] text-[#686b86]">Replaces characters 5–12 with asterisks (e.g., 27AA••••••1ZM).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaskGstin(!maskGstin)
                      showToast(`Supplier GSTIN masking ${!maskGstin ? 'enabled' : 'disabled'}`)
                    }}
                    className={`rounded-full px-3 py-1 font-bold text-xs transition ${
                      maskGstin ? 'bg-[#378875] text-[#f8f7e2]' : 'bg-[#dedecb] text-[#686b86]'
                    }`}
                  >
                    {maskGstin ? 'Active' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                  <div>
                    <span className="font-bold text-[#393d68] block">Mask Contact Phone Numbers</span>
                    <span className="text-[11px] text-[#686b86]">Obfuscates registered +91 vendor contact numbers.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaskPhone(!maskPhone)
                      showToast(`Phone number masking ${!maskPhone ? 'enabled' : 'disabled'}`)
                    }}
                    className={`rounded-full px-3 py-1 font-bold text-xs transition ${
                      maskPhone ? 'bg-[#378875] text-[#f8f7e2]' : 'bg-[#dedecb] text-[#686b86]'
                    }`}
                  >
                    {maskPhone ? 'Active' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                  <div>
                    <span className="font-bold text-[#393d68] block">Mask Contact Emails</span>
                    <span className="text-[11px] text-[#686b86]">Partially shields usernames in notifications and audit export dumps.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaskEmail(!maskEmail)
                      showToast(`Email masking ${!maskEmail ? 'enabled' : 'disabled'}`)
                    }}
                    className={`rounded-full px-3 py-1 font-bold text-xs transition ${
                      maskEmail ? 'bg-[#378875] text-[#f8f7e2]' : 'bg-[#dedecb] text-[#686b86]'
                    }`}
                  >
                    {maskEmail ? 'Active' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                  <div>
                    <span className="font-bold text-[#393d68] block">Mask Vendor Bank Details & IFSC</span>
                    <span className="text-[11px] text-[#686b86]">Protects disbursement account numbers in view-only roles.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaskBank(!maskBank)
                      showToast(`Bank account masking ${!maskBank ? 'enabled' : 'disabled'}`)
                    }}
                    className={`rounded-full px-3 py-1 font-bold text-xs transition ${
                      maskBank ? 'bg-[#378875] text-[#f8f7e2]' : 'bg-[#dedecb] text-[#686b86]'
                    }`}
                  >
                    {maskBank ? 'Active' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                  <div>
                    <span className="font-bold text-[#393d68] block">Mask Invoice Monetary Amounts</span>
                    <span className="text-[11px] text-[#686b86]">Hides gross totals in developer logs and non-finance telemetry.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaskAmounts(!maskAmounts)
                      showToast(`Monetary amount masking ${!maskAmounts ? 'enabled' : 'disabled'}`)
                    }}
                    className={`rounded-full px-3 py-1 font-bold text-xs transition ${
                      maskAmounts ? 'bg-[#378875] text-[#f8f7e2]' : 'bg-[#dedecb] text-[#686b86]'
                    }`}
                  >
                    {maskAmounts ? 'Active' : 'Off'}
                  </button>
                </div>
              </div>

              {/* Live Preview Panel (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/30 p-5 space-y-3 text-xs">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                  Live Masking Demonstration
                </span>
                <p className="text-[11px] text-[#686b86]">
                  How sample invoice <strong className="text-[#393d68] font-mono">INV-2026-0422</strong> renders under current rules:
                </p>

                <div className="space-y-2 rounded-xl border border-[#dedecb] bg-[#fffef4] p-3.5 font-mono text-xs">
                  <div className="flex justify-between items-center pb-1 border-b border-[#dedecb]/60">
                    <span className="text-[#686b86]">Supplier GSTIN:</span>
                    {maskGstin ? (
                      <MaskedValue value="27AABCU9603R1ZM" kind="gstin" />
                    ) : (
                      <span className="text-[#393d68] font-bold">27AABCU9603R1ZM</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pb-1 border-b border-[#dedecb]/60">
                    <span className="text-[#686b86]">Phone Contact:</span>
                    {maskPhone ? (
                      <MaskedValue value="+91 98201 44820" kind="phone" />
                    ) : (
                      <span className="text-[#393d68] font-bold">+91 98201 44820</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pb-1 border-b border-[#dedecb]/60">
                    <span className="text-[#686b86]">Billing Email:</span>
                    {maskEmail ? (
                      <MaskedValue value="billing@deccanprecision.com" kind="email" />
                    ) : (
                      <span className="text-[#393d68] font-bold">billing@deccanprecision.com</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pb-1 border-b border-[#dedecb]/60">
                    <span className="text-[#686b86]">Bank Account:</span>
                    {maskBank ? (
                      <span className="text-[#474c80] font-bold">HDFC •••• 9102 (IFSC: HDFC0000240)</span>
                    ) : (
                      <span className="text-[#393d68] font-bold">50200049219102 (HDFC0000240)</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#686b86]">Gross Total:</span>
                    {maskAmounts ? (
                      <MaskedValue value="₹1,42,500.00" kind="amount" />
                    ) : (
                      <span className="text-[#393d68] font-bold">₹1,42,500.00</span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-[#686b86]">
                  Click the eye icon next to masked fields to temporarily reveal with audit logging.
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 4. RETENTION POLICY TABLE */}
          <SectionCard
            title="Data retention & statutory purge schedules"
            description="Manage retention horizons by data type. Section 36 of CGST Act requires keeping tax records for 72 months."
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Data Classification</th>
                    <th className="py-3 px-3">Statutory & Legal Benchmark</th>
                    <th className="py-3 px-3">Current Retention</th>
                    <th className="py-3 px-3 text-right pr-4">Storage Footprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {retentionPolicies.map((pol) => (
                    <tr key={pol.id} className="hover:bg-[#f8f7e2]/30 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#393d68]">{pol.dataType}</div>
                        <p className="text-[11px] text-[#686b86]">{pol.description}</p>
                      </td>
                      <td className="py-3 px-3 text-[#686b86] max-w-xs">{pol.statutoryRequirement}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={pol.retentionDays}
                          onChange={(e) => handleRetentionChange(pol.id, parseInt(e.target.value))}
                          className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs font-semibold text-[#393d68]"
                        >
                          <option value={30}>30 Days</option>
                          <option value={90}>90 Days</option>
                          <option value={365}>1 Year (365 Days)</option>
                          <option value={2555}>7 Years (Statutory 72m)</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right pr-4 font-mono font-bold text-[#474c80]">
                        {pol.estimatedStorageGb} GB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-[#686b86] border-t border-[#dedecb]/60 pt-3">
              <span>Total workspace active archive: <strong className="text-[#393d68] font-mono">{totalStorageGb} GB</strong></span>
              <span className="italic">Note: Changing policies schedules background pruning on the next 00:00 UTC cycle.</span>
            </div>
          </SectionCard>

          {/* 5. DATA RESIDENCY & SUB-PROCESSORS */}
          <SectionCard
            title="Data residency & authorized sub-processors"
            description="All financial records and tax tokens are stored exclusively within the Republic of India."
            action={
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#378875]" />
                <span className="text-xs font-bold text-[#378875]">India Data Sovereignty Active</span>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {subProcessors.map((sp) => (
                <div
                  key={sp.id}
                  className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#393d68]">{sp.name}</h4>
                      <span className="text-[10px] text-[#686b86] font-mono">{sp.region}</span>
                    </div>
                    <span className="rounded-md bg-[#378875]/15 px-2 py-0.5 text-[9px] font-bold text-[#378875]">
                      DPA Signed
                    </span>
                  </div>

                  <p className="text-[11px] text-[#686b86] leading-relaxed">{sp.purpose}</p>

                  <div className="border-t border-[#dedecb]/60 pt-2 text-[10px] text-[#686b86]">
                    <strong>Data shared:</strong> {sp.dataShared}
                  </div>

                  <div className="pt-1 text-right">
                    <span className="text-[10px] font-bold text-[#474c80] hover:underline cursor-pointer">
                      View terms & DPA →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Toggle: Exclude invoice images from external AI */}
            <div className="mt-5 rounded-2xl border border-[#cf9c50]/50 bg-[#fffef4] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-[#474c80]" />
                  <h4 className="text-xs font-bold text-[#393d68]">
                    Strict Air-Gap: Do not send invoice images to external AI providers
                  </h4>
                </div>
                <p className="text-[11px] text-[#686b86]">
                  Routes all document reading through a local offline Tesseract OCR model. <strong>Accuracy trade-off:</strong> extraction confidence may drop by ~15% on non-standard receipt layouts.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBlockAiImages(!blockAiImages)
                  showToast(`Air-gap mode ${!blockAiImages ? 'enabled' : 'disabled'}`)
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold shrink-0 transition ${
                  blockAiImages ? 'bg-[#a24650] text-[#f8f7e2]' : 'border border-[#dedecb] bg-[#fffef4] text-[#686b86]'
                }`}
              >
                {blockAiImages ? 'Air-Gap Enforced' : 'Allow Cloud Vision'}
              </button>
            </div>
          </SectionCard>

          {/* 6. PRIVACY REQUESTS (DPDP-STYLE WORKFLOW) */}
          <SectionCard
            title="Privacy requests & data principal obligations"
            description="Supports your DPDP Act 2023 obligations: handle data principal access, correction, and erasure inquiries."
            action={
              <button
                type="button"
                onClick={() => setNewRequestOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
              >
                <Plus className="size-3.5" />
                <span>New privacy request</span>
              </button>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Requester & Type</th>
                    <th className="py-3 px-3">Received Date</th>
                    <th className="py-3 px-3">SLA Due Countdown</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {privacyRequests.map((req) => {
                    const isDueSoon = req.daysUntilDue <= 3 && req.status === 'Pending Review'

                    return (
                      <tr key={req.id} className="hover:bg-[#f8f7e2]/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#393d68]">{req.requesterName}</div>
                          <div className="text-[11px] text-[#686b86]">{req.requesterEmail}</div>
                          <span className="inline-block mt-0.5 rounded-md bg-[#dedecb]/50 px-1.5 py-0.2 text-[9px] font-bold text-[#474c80]">
                            {req.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#686b86] whitespace-nowrap">{req.receivedDate}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isDueSoon && <AlertTriangle className="size-3.5 text-[#a24650] animate-pulse" />}
                            <span
                              className={`font-mono text-xs font-bold ${
                                isDueSoon ? 'text-[#a24650]' : 'text-[#393d68]'
                              }`}
                            >
                              {req.daysUntilDue > 0 ? `${req.daysUntilDue} days left` : 'Completed'}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#686b86]">Due: {req.dueDate}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              req.status === 'Completed'
                                ? 'bg-[#378875]/15 text-[#378875]'
                                : req.status === 'Approved'
                                ? 'bg-[#474c80]/15 text-[#474c80]'
                                : req.status === 'Rejected'
                                ? 'bg-[#a24650]/15 text-[#a24650]'
                                : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right pr-4 whitespace-nowrap">
                          {req.status === 'Pending Review' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveRequest(req)}
                                className="rounded-lg bg-[#474c80] px-2 py-1 text-[11px] font-bold text-[#f8f7e2] hover:bg-[#393d68]"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectRequest(req)}
                                className="rounded-lg border border-[#a24650]/40 px-2 py-1 text-[11px] font-bold text-[#a24650] hover:bg-[#a24650]/10"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {req.status === 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleCompleteRequest(req)}
                              className="rounded-lg bg-[#378875] px-2.5 py-1 text-[11px] font-bold text-[#f8f7e2] hover:bg-[#378875]/90"
                            >
                              Mark Complete
                            </button>
                          )}
                          {(req.status === 'Completed' || req.status === 'Rejected') && (
                            <span className="text-[11px] text-[#686b86] italic">Fulfilled</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 7. CONSENT LOG */}
          <SectionCard
            title="DPDP consent registry"
            description="Audit trail of affirmative consents granted by vendors, finance controllers, and contractors."
            action={
              <div className="relative min-w-[200px]">
                <input
                  type="text"
                  value={consentSearch}
                  onChange={(e) => setConsentSearch(e.target.value)}
                  placeholder="Filter consent records..."
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs text-[#393d68] focus:outline-hidden"
                />
              </div>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Subject & Identifier</th>
                    <th className="py-3 px-3">Consent Purpose</th>
                    <th className="py-3 px-3">Notice Version</th>
                    <th className="py-3 px-3">Granted Date</th>
                    <th className="py-3 px-3 text-right pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {filteredConsentLogs.map((con) => (
                    <tr key={con.id} className="hover:bg-[#f8f7e2]/30 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#393d68]">{con.subject}</div>
                        <div className="text-[10px] text-[#686b86]">{con.subjectEmail}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[#686b86] max-w-sm">{con.purpose}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#474c80]">{con.noticeVersion}</td>
                      <td className="py-2.5 px-3 text-[#686b86] whitespace-nowrap">{con.grantedAt}</td>
                      <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            con.status === 'Active'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : 'bg-[#a24650]/15 text-[#a24650]'
                          }`}
                        >
                          {con.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 8. DANGER ZONE */}
          <div className="rounded-3xl border border-[#a24650]/40 bg-[#a24650]/5 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-[#a24650] flex items-center gap-2">
                <AlertTriangle className="size-5" />
                <span>Danger Zone: Complete Workspace Data Portability & Erasure</span>
              </h3>
              <p className="mt-1 text-xs text-[#686b86]">
                Execute full tenant data dumps or permanently purge company tax data.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[#dedecb]/60 pt-4">
              <div>
                <strong className="text-xs font-bold text-[#393d68] block">Export All Workspace Records</strong>
                <span className="text-[11px] text-[#686b86]">Download encrypted zip bundle containing statutory PDFs, ledgers, and audit logs.</span>
                {exportingData && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[#dedecb]">
                      <div className="h-full bg-[#474c80] transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                    </div>
                    <span className="text-[10px] text-[#474c80] font-bold">Bundling archive: {exportProgress}%</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={exportingData}
                onClick={handleStartExport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-4 py-2 text-xs font-bold text-[#393d68] hover:bg-[#f8f7e2] transition shrink-0"
              >
                <Download className="size-3.5" />
                <span>Export archive (.zip)</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[#dedecb]/60 pt-4">
              <div>
                <strong className="text-xs font-bold text-[#a24650] block">Cryptographic Purge of All Data</strong>
                <span className="text-[11px] text-[#686b86]">Permanently delete all business data, vendor files, and cryptographic keys.</span>
              </div>
              <button
                type="button"
                onClick={handleDeleteWorkspaceData}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#a24650] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#a24650]/90 transition shrink-0"
              >
                <Trash2 className="size-3.5" />
                <span>Delete workspace data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PRIVACY REQUEST MODAL */}
      {newRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Log Data Principal Request</h3>
                <p className="text-xs text-[#686b86]">Initiates statutory 14-day tracking clock under DPDP guidelines.</p>
              </div>
              <button
                type="button"
                onClick={() => setNewRequestOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRequest} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Requester Name</label>
                <input
                  type="text"
                  required
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  placeholder="e.g., Rajesh Sharma"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Requester Email</label>
                <input
                  type="email"
                  required
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  placeholder="requester@domain.in"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Request Type</label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as any)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5 text-xs font-semibold text-[#393d68]"
                >
                  <option value="Data Access (Export)">Data Access (Export personal data dump)</option>
                  <option value="Data Correction">Data Correction (Rectify registered name/details)</option>
                  <option value="Data Deletion (Purge)">Data Deletion (Right to be forgotten)</option>
                  <option value="Consent Revocation">Consent Revocation (Withdraw promotional/API consent)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Request Context / Notes</label>
                <textarea
                  rows={3}
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Describe specific records or legal representation..."
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#dedecb]">
                <button
                  type="button"
                  onClick={() => setNewRequestOpen(false)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                >
                  Register Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
