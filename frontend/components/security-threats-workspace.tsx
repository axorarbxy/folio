'use client'

import React, { useState, useMemo } from 'react'
import {
  Flame,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Search,
  Filter,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lock,
  UserX,
  FileX,
  Clock,
  Sparkles,
  ArrowRight,
  Sliders,
  Check,
  SlidersHorizontal,
  Ban,
  PauseCircle,
  FileCheck2,
  RefreshCw,
  Globe,
  Radio,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  SkeletonPanel,
  SeverityPill,
  TimeRangeControl,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  SecuritySubNav,
  DemoDataChip,
  ConfirmDialog,
  RiskMeter,
  MaskedValue,
} from '@/components/security-kit'
import {
  getThreatSignals,
  getThreatDetectionRules,
  getThreatKpiSummary,
  type ThreatSignal,
  type ThreatCategory,
  type ThreatDetectionRule,
  type ThreatKpiSummary,
} from '@/lib/security-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function SecurityThreatsWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [threats, setThreats] = useState<ThreatSignal[]>(getThreatSignals())
  const [rules, setRules] = useState<ThreatDetectionRule[]>(getThreatDetectionRules())
  const [kpis] = useState<ThreatKpiSummary>(getThreatKpiSummary())

  // Active Category Tab
  const [selectedCategory, setSelectedCategory] = useState<'All' | ThreatCategory>('All')

  // Selected Threat Signal for Right Panel
  const [selectedThreatId, setSelectedThreatId] = useState<string>('THR-102')

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Collapsible Detection Rules
  const [showRules, setShowRules] = useState<boolean>(false)

  // Dialog States
  const [dismissDialogOpen, setDismissDialogOpen] = useState<boolean>(false)
  const [dismissReason, setDismissReason] = useState<string>('Known employee VPN')
  const [dismissNote, setDismissNote] = useState<string>('')

  const [blockDialogOpen, setBlockDialogOpen] = useState<boolean>(false)
  const [holdInvoiceDialogOpen, setHoldInvoiceDialogOpen] = useState<boolean>(false)

  // Feedback Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Active selected threat
  const activeThreat = useMemo(() => {
    return threats.find((t) => t.id === selectedThreatId) || threats[0] || null
  }, [threats, selectedThreatId])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: threats.length,
      Account: 0,
      Data: 0,
      'Invoice fraud': 0,
      Vendor: 0,
    }
    threats.forEach((t) => {
      if (t.category && counts[t.category] !== undefined) {
        counts[t.category]++
      }
    })
    return counts
  }, [threats])

  // Filtered threat signals
  const filteredThreats = useMemo(() => {
    if (viewMode === 'empty') return []

    return threats.filter((item) => {
      // Category Tab
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }

      // Severity Filter
      if (severityFilter !== 'all' && item.severity !== severityFilter) {
        return false
      }

      // Status Filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          item.id.toLowerCase().includes(q) ||
          item.kind.toLowerCase().includes(q) ||
          item.detail.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q))
        if (!matches) return false
      }

      return true
    })
  }, [threats, selectedCategory, severityFilter, statusFilter, searchQuery, viewMode])

  // Toggle checklist item
  const handleToggleChecklist = (checkId: string) => {
    if (!activeThreat) return
    setThreats((prev) =>
      prev.map((t) => {
        if (t.id === activeThreat.id && t.checklist) {
          const updatedChecklist = t.checklist.map((c) =>
            c.id === checkId ? { ...c, completed: !c.completed } : c
          )
          return { ...t, checklist: updatedChecklist }
        }
        return t
      })
    )
  }

  // Action: Investigate
  const handleInvestigate = () => {
    if (!activeThreat) return
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
    setThreats((prev) =>
      prev.map((t) => {
        if (t.id === activeThreat.id) {
          const newLogs = [
            ...(t.actionLogs || []),
            { timestamp: `Today, ${now}`, action: 'Investigating', actor: 'Current User' },
          ]
          return { ...t, status: 'investigating' as const, actionLogs: newLogs }
        }
        return t
      })
    )
    showToast(`Signal ${activeThreat.id} marked as Investigating.`)
  }

  // Action: Dismiss as False Positive
  const handleConfirmDismiss = () => {
    if (!activeThreat) return
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
    const fullReason = dismissNote.trim() ? `${dismissReason} — ${dismissNote.trim()}` : dismissReason

    setThreats((prev) =>
      prev.map((t) => {
        if (t.id === activeThreat.id) {
          const newLogs = [
            ...(t.actionLogs || []),
            {
              timestamp: `Today, ${now}`,
              action: 'Dismissed as false positive',
              actor: 'Current User',
              note: fullReason,
            },
          ]
          return {
            ...t,
            status: 'dismissed' as const,
            dismissReason: fullReason,
            actionLogs: newLogs,
          }
        }
        return t
      })
    )
    setDismissDialogOpen(false)
    setDismissNote('')
    showToast(`Signal ${activeThreat.id} dismissed as false positive.`)
  }

  // Action: Escalate
  const handleEscalate = () => {
    if (!activeThreat) return
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
    setThreats((prev) =>
      prev.map((t) => {
        if (t.id === activeThreat.id) {
          const newLogs = [
            ...(t.actionLogs || []),
            {
              timestamp: `Today, ${now}`,
              action: 'Escalated to SecOps Lead',
              actor: 'Current User',
              note: 'High-priority alert sent to security channel.',
            },
          ]
          return { ...t, severity: 'critical' as const, actionLogs: newLogs }
        }
        return t
      })
    )
    showToast(`Signal ${activeThreat.id} escalated to SecOps lead!`)
  }

  // Action: Block Member or Session
  const handleConfirmBlock = () => {
    if (!activeThreat) return
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
    setThreats((prev) =>
      prev.map((t) => {
        if (t.id === activeThreat.id) {
          const newLogs = [
            ...(t.actionLogs || []),
            {
              timestamp: `Today, ${now}`,
              action: 'Blocked member / session',
              actor: 'Current User',
              note: 'Token invalidated and IP added to blocklist.',
            },
          ]
          return { ...t, status: 'resolved' as const, actionLogs: newLogs }
        }
        return t
      })
    )
    setBlockDialogOpen(false)
    showToast(`Blocked session & access for ${activeThreat.targetEntity?.label || activeThreat.id}.`)
  }

  // Action: Hold Invoice
  const handleConfirmHoldInvoice = () => {
    if (!activeThreat) return
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
    setThreats((prev) =>
      prev.map((t) => {
        if (t.id === activeThreat.id) {
          const newLogs = [
            ...(t.actionLogs || []),
            {
              timestamp: `Today, ${now}`,
              action: 'Invoice Put On Hold',
              actor: 'Current User',
              note: 'Disbursement lock applied in payment gateway.',
            },
          ]
          return { ...t, onHold: true, actionLogs: newLogs }
        }
        return t
      })
    )
    setHoldInvoiceDialogOpen(false)
    showToast(`Invoice placed on mandatory payment hold.`)
  }

  // Toggle Rule Sensitivity
  const handleRuleSensitivity = (ruleId: string, sens: 'Low' | 'Medium' | 'High') => {
    const volumeMap: Record<'Low' | 'Medium' | 'High', string> = {
      Low: '~1 alert / mo',
      Medium: '~3 alerts / mo',
      High: '~6 alerts / mo',
    }
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, sensitivity: sens, expectedVolume: volumeMap[sens] } : r))
    )
  }

  // Toggle Rule Enabled
  const handleToggleRule = (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)))
  }

  return (
    <AppShell active="Security">
      {/* 1. Header + Sub-Nav + Time Range */}
      <PageHeading
        eyebrow="Security & Governance"
        title="Threat & Anomaly Detection"
        description="Finds suspicious behavior in the workspace and fraud signals in the invoices themselves."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />

            {/* View Mode Simulator */}
            <div className="flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-1 text-xs">
              <span className="px-1 text-[11px] font-semibold text-[#686b86]">State:</span>
              {(['normal', 'skeleton', 'empty', 'error'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-2 py-0.5 capitalize transition ${
                    viewMode === mode
                      ? 'bg-[#474c80] font-bold text-[#f8f7e2]'
                      : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <DemoDataChip />
          </div>
        }
      />

      <SecuritySubNav active="threats" />

      {/* Success Notification Toast */}
      {toastMessage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-[#378875]/30 bg-[#378875]/10 px-4 py-3 text-xs font-semibold text-[#378875] animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-[#378875] hover:opacity-75">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 2. KPI Row with Detection Quality Tile */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Open Signals"
          value={String(kpis.openSignals)}
          note="3 High · 2 Critical"
          icon={Flame}
        />
        <MetricCard
          label="Critical Signals"
          value={String(kpis.criticalSignals)}
          note="Immediate triage needed"
          icon={ShieldAlert}
        />
        <MetricCard
          label="Mean Time to Triage"
          value={`${kpis.meanTimeToTriageMinutes} min`}
          note="-6 min vs previous 7d"
          icon={Clock}
        />
        <MetricCard
          label="Blocked Attempts (24h)"
          value={String(kpis.blockedAttempts24h)}
          note="Adaptive Zero-Trust rate limit"
          icon={Ban}
        />
        {/* Detection Quality / False Positive Tile (from README Notes) */}
        <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#686b86]">
            <span className="font-semibold">Detection Quality</span>
            <span className="flex size-5 items-center justify-center rounded-full bg-[#378875]/15 text-[#378875]">
              <Sparkles className="size-3" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-[#393d68]">
            {kpis.falsePositiveRatePct}%
          </div>
          <p className="mt-1 text-[11px] text-[#686b86]">
            Dismissed as false positive this month (Optimal: &lt;20%)
          </p>
        </div>
      </div>

      {/* 3. Signal Categories Tabs with Counts */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[#dedecb] pb-3">
        {(['All', 'Account', 'Data', 'Invoice fraud', 'Vendor'] as const).map((cat) => {
          const isSelected = selectedCategory === cat
          const count = categoryCounts[cat] || 0

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                isSelected
                  ? 'bg-[#474c80] text-[#f8f7e2]'
                  : 'border border-[#dedecb] bg-[#fffef4] text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  isSelected ? 'bg-[#393d68] text-[#f8f7e2]' : 'bg-[#dedecb]/60 text-[#393d68]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* SKELETON STATE */}
      {viewMode === 'skeleton' && (
        <div className="mb-8">
          <SkeletonPanel message="Running heuristic model across workspace telemetry and invoice hashes..." />
        </div>
      )}

      {/* ERROR STATE */}
      {viewMode === 'error' && (
        <div className="mb-8">
          <ErrorPanel
            title="Threat Sentinel Stream Unavailable"
            message="Could not stream real-time threat signals from the fraud detection daemon. Please verify worker connectivity."
            onRetry={() => setViewMode('normal')}
          />
        </div>
      )}

      {/* EMPTY STATE */}
      {viewMode === 'empty' && (
        <div className="mb-8 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-8">
          <EmptyPanel
            title="No threat signals found"
            message="Zero anomalous events or fraud vectors match your selected criteria."
            actionLabel="Reset to All Categories"
            onAction={() => {
              setSelectedCategory('All')
              setSearchQuery('')
              setSeverityFilter('all')
              setStatusFilter('all')
              setViewMode('normal')
            }}
          />
        </div>
      )}

      {/* NORMAL STATE: 2-COLUMN WORKSPACE (40% List / 60% Detail) */}
      {viewMode === 'normal' && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ======================================================== */}
          {/* LEFT COLUMN: SIGNAL LIST (40% width / 5 cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 space-y-3">
            {/* Filter Bar */}
            <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-3 shadow-xs space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#686b86]" />
                <input
                  type="text"
                  placeholder="Search signals, invoices, users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 py-1.5 pl-8 pr-7 text-xs text-[#393d68] placeholder:text-[#686b86] focus:border-[#474c80] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#686b86] hover:text-[#393d68]"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] px-2 py-1 text-[11px] text-[#393d68] focus:border-[#474c80] focus:outline-none"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] px-2 py-1 text-[11px] text-[#393d68] focus:border-[#474c80] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            </div>

            {/* Threat Signals Cards List */}
            {filteredThreats.length === 0 ? (
              <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 text-center text-xs text-[#686b86]">
                No threat signals match your filter.
              </div>
            ) : (
              <div className="space-y-2 max-h-[780px] overflow-y-auto pr-1">
                {filteredThreats.map((threat) => {
                  const isSelected = activeThreat?.id === threat.id

                  return (
                    <div
                      key={threat.id}
                      onClick={() => setSelectedThreatId(threat.id)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all shadow-xs ${
                        isSelected
                          ? 'border-[#474c80] bg-[#fffef4] ring-2 ring-[#474c80]/20'
                          : 'border-[#dedecb] bg-[#fffef4] hover:bg-[#f8f7e2]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SeverityPill level={threat.severity} />
                          <span className="rounded-md border border-[#dedecb] bg-[#f8f7e2] px-1.5 py-0.5 font-mono text-[10px] text-[#686b86]">
                            {threat.category || 'General'}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            threat.status === 'open'
                              ? 'bg-[#a24650]/15 text-[#a24650]'
                              : threat.status === 'investigating'
                              ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                              : threat.status === 'resolved'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : 'bg-[#dedecb]/70 text-[#686b86]'
                          }`}
                        >
                          <span className="capitalize">{threat.status}</span>
                        </span>
                      </div>

                      <h4 className="mt-2 text-xs font-bold text-[#393d68] line-clamp-1">
                        {threat.kind}
                      </h4>
                      <p className="mt-1 text-[11px] text-[#686b86] line-clamp-2 leading-relaxed">
                        {threat.detail}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between border-t border-[#dedecb]/60 pt-2 text-[10px] text-[#686b86]">
                        <span className="font-mono">{threat.id}</span>
                        <span>{threat.detectedAt}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: SIGNAL DETAIL PANEL (60% width / 7 cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-7">
            {activeThreat ? (
              <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-5 shadow-xs space-y-6">
                {/* Header Section */}
                <div className="border-b border-[#dedecb] pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#474c80]">
                        {activeThreat.id}
                      </span>
                      <SeverityPill level={activeThreat.severity} />
                      <span className="rounded-md border border-[#dedecb] bg-[#f8f7e2] px-2 py-0.5 text-[11px] font-bold text-[#393d68]">
                        {activeThreat.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeThreat.onHold && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#a24650] px-2.5 py-0.5 text-[10px] font-bold text-[#f8f7e2]">
                          <PauseCircle className="size-3" />
                          <span>On Hold</span>
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          activeThreat.status === 'open'
                            ? 'bg-[#a24650]/15 text-[#a24650]'
                            : activeThreat.status === 'investigating'
                            ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                            : activeThreat.status === 'resolved'
                            ? 'bg-[#378875]/15 text-[#378875]'
                            : 'bg-[#dedecb]/70 text-[#686b86]'
                        }`}
                      >
                        <span className="capitalize">{activeThreat.status}</span>
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-[#393d68]">{activeThreat.kind}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[#686b86]">
                    <span>Detected {activeThreat.detectedAt}</span>
                    {activeThreat.targetEntity && (
                      <>
                        <span>•</span>
                        <a
                          href={activeThreat.targetEntity.href}
                          className="font-semibold text-[#474c80] hover:underline inline-flex items-center gap-1"
                        >
                          <span>{activeThreat.targetEntity.label}</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* 1. WHY THIS WAS FLAGGED (Plain Language Explanation) */}
                <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-[#474c80]" />
                    <span>Why This Was Flagged (Plain Language)</span>
                  </h4>
                  <p className="text-xs text-[#393d68] leading-relaxed">
                    {activeThreat.plainLanguageExplanation || activeThreat.detail}
                  </p>
                </div>

                {/* 2. RISK METER */}
                <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-4">
                  <RiskMeter
                    score={activeThreat.riskScore || 75}
                    label="Threat Vector Risk Score"
                  />
                </div>

                {/* 3. EVIDENCE LIST (With MaskedValue) */}
                {activeThreat.evidence && activeThreat.evidence.length > 0 && (
                  <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-3">
                      Forensic Evidence & Indicators of Compromise (IoC)
                    </h4>
                    <div className="divide-y divide-[#dedecb]/60">
                      {activeThreat.evidence.map((ev, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center justify-between py-2 text-xs"
                        >
                          <span className="font-medium text-[#686b86]">{ev.key}</span>
                          <div className="font-mono font-semibold text-[#393d68]">
                            {ev.sensitive ? (
                              <MaskedValue
                                value={ev.value}
                                kind={ev.kind === 'gstin' ? 'gstin' : ev.kind === 'email' ? 'email' : 'amount'}
                              />
                            ) : (
                              <span>{ev.value}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. INVOICE TAMPER CARD (For tampered-document signal) */}
                {activeThreat.tamperDetails && (
                  <div className="rounded-2xl border border-[#a24650]/30 bg-[#a24650]/5 p-4.5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="size-4 text-[#a24650]" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#a24650]">
                          Invoice Forensic Tamper Inspection
                        </h4>
                      </div>
                      <span className="rounded-full bg-[#a24650]/20 px-2 py-0.5 font-mono text-[11px] font-bold text-[#a24650]">
                        {activeThreat.tamperDetails.confidenceScore}% Tamper Confidence
                      </span>
                    </div>

                    <p className="text-xs text-[#686b86]">
                      Suspected modification environment:{' '}
                      <strong className="text-[#393d68]">
                        {activeThreat.tamperDetails.suspectedTool}
                      </strong>
                    </p>

                    {/* Side-by-Side Document Comparison Mockup */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* Document Preview 1: Original NIC QR Record */}
                      <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-xs">
                        <span className="font-bold text-[#378875] block text-[11px] mb-1">
                          1. Authentic NIC Signed QR Payload
                        </span>
                        <div className="rounded-lg border border-[#378875]/30 bg-[#378875]/10 p-2.5 font-mono text-[11px] space-y-1 text-[#393d68]">
                          <div>IRN: 4e89f61b0a2c...</div>
                          <div>Total Amount: ₹ 1,45,000.00</div>
                          <div>IGST 18%: ₹ 26,100.00</div>
                          <div className="text-[10px] text-[#378875] font-sans font-semibold">
                            ✓ Verified by NIC e-Invoice Portal
                          </div>
                        </div>
                      </div>

                      {/* Document Preview 2: Altered Visual Scan */}
                      <div className="rounded-xl border border-[#a24650]/30 bg-[#fffef4] p-3 text-xs">
                        <span className="font-bold text-[#a24650] block text-[11px] mb-1">
                          2. Uploaded Document (Visual Layer)
                        </span>
                        <div className="rounded-lg border border-[#a24650]/40 bg-[#a24650]/10 p-2.5 font-mono text-[11px] space-y-1 text-[#a24650]">
                          <div>Invoice #: INV-2026-0391</div>
                          <div className="font-bold bg-[#a24650]/20 px-1 py-0.5 rounded">
                            Total Amount: ₹ 4,45,000.00 [TAMPERED]
                          </div>
                          <div>IGST 18%: ₹ 80,100.00</div>
                          <div className="text-[10px] text-[#a24650] font-sans font-semibold">
                            ✗ Signature Check Failed
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Highlighted regions details */}
                    <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 space-y-2">
                      <span className="text-[11px] font-bold text-[#393d68] block">
                        Detected Forensic Anomalies:
                      </span>
                      {activeThreat.tamperDetails.highlightedRegions.map((region, idx) => (
                        <div key={idx} className="rounded-lg bg-[#f8f7e2]/50 p-2 text-[11px]">
                          <strong className="text-[#a24650] block">{region.label}</strong>
                          <span className="text-[#686b86]">{region.finding}</span>
                        </div>
                      ))}
                    </div>

                    {/* Field Comparison Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#dedecb] text-[10px] font-bold uppercase text-[#686b86]">
                          <tr>
                            <th className="py-1">Field</th>
                            <th className="py-1">NIC Registered</th>
                            <th className="py-1">Document Extracted</th>
                            <th className="py-1 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dedecb]/40">
                          {activeThreat.tamperDetails.fieldsComparison.map((field, i) => (
                            <tr key={i}>
                              <td className="py-1.5 font-medium text-[#393d68]">{field.fieldName}</td>
                              <td className="py-1.5 font-mono text-[#686b86]">{field.originalValue}</td>
                              <td
                                className={`py-1.5 font-mono ${
                                  field.status === 'tampered'
                                    ? 'font-bold text-[#a24650]'
                                    : 'text-[#393d68]'
                                }`}
                              >
                                {field.extractedValue}
                              </td>
                              <td className="py-1.5 text-right">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    field.status === 'tampered'
                                      ? 'bg-[#a24650]/15 text-[#a24650]'
                                      : 'bg-[#378875]/15 text-[#378875]'
                                  }`}
                                >
                                  {field.status === 'tampered' ? 'Tampered' : 'Match'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. GEO AND DEVICE CARD (Simple map substitute with country flags) */}
                {activeThreat.geoHistory && activeThreat.geoHistory.length > 0 && (
                  <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] flex items-center gap-1.5">
                        <Globe className="size-3.5 text-[#474c80]" />
                        <span>Authentication Geolocation & Velocity Map</span>
                      </h4>
                      <span className="rounded-full bg-[#a24650]/15 px-2 py-0.5 text-[10px] font-bold text-[#a24650]">
                        Impossible Travel Flagged
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activeThreat.geoHistory.map((geo, idx) => (
                        <div
                          key={idx}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-3 text-xs ${
                            geo.impossibleTravel
                              ? 'border-[#a24650] bg-[#a24650]/10'
                              : 'border-[#dedecb] bg-[#f8f7e2]/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{geo.flag}</span>
                            <div>
                              <strong className="text-[#393d68]">
                                {geo.city}, {geo.country}
                              </strong>
                              <span className="text-[11px] text-[#686b86] block font-mono">
                                {geo.ip} · {geo.device}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 sm:mt-0 text-right">
                            <span className="text-[11px] font-medium text-[#686b86] block">
                              {geo.timestamp}
                            </span>
                            {geo.impossibleTravel && (
                              <span className="text-[11px] font-bold text-[#a24650]">
                                {geo.distanceKm} km in {geo.timeDeltaMinutes}m (
                                {geo.speedKmh?.toLocaleString()} km/h)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. TIMELINE OF RELATED EVENTS */}
                {activeThreat.timeline && activeThreat.timeline.length > 0 && (
                  <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-3 flex items-center gap-1.5">
                      <Clock className="size-3.5 text-[#474c80]" />
                      <span>Chronological Incident Timeline</span>
                    </h4>
                    <div className="space-y-3 relative pl-4 before:absolute before:bottom-0 before:left-1.5 before:top-1.5 before:w-0.5 before:bg-[#dedecb]">
                      {activeThreat.timeline.map((evt, idx) => (
                        <div key={idx} className="relative text-xs">
                          <span className="absolute -left-[19px] top-1 size-2 rounded-full bg-[#474c80]" />
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-[#474c80]">
                              {evt.time}
                            </span>
                            <strong className="text-[#393d68]">{evt.title}</strong>
                          </div>
                          <p className="mt-0.5 text-[#686b86] text-[11px]">{evt.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. RECOMMENDED STEPS AS A CHECKLIST */}
                {activeThreat.checklist && activeThreat.checklist.length > 0 && (
                  <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-2.5">
                      Recommended Triage Steps
                    </h4>
                    <div className="space-y-2">
                      {activeThreat.checklist.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-start gap-2.5 text-xs text-[#393d68] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleChecklist(item.id)}
                            className="size-4 mt-0.5 rounded border-[#dedecb] accent-[#474c80]"
                          />
                          <span className={item.completed ? 'line-through text-[#686b86]' : ''}>
                            {item.step}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. INCIDENT ACTION CONTROLS */}
                <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86]">
                    Take Response Action
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Investigate */}
                    <button
                      onClick={handleInvestigate}
                      disabled={activeThreat.status === 'investigating'}
                      className="rounded-xl border border-[#dedecb] bg-[#f8f7e2] px-3 py-2 text-xs font-bold text-[#393d68] hover:bg-[#dedecb]/50 transition disabled:opacity-50"
                    >
                      Investigate
                    </button>

                    {/* Dismiss as false positive */}
                    <button
                      onClick={() => setDismissDialogOpen(true)}
                      className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs font-bold text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68] transition"
                    >
                      Dismiss as False Positive
                    </button>

                    {/* Escalate */}
                    <button
                      onClick={handleEscalate}
                      className="rounded-xl border border-[#cf9c50]/40 bg-[#cf9c50]/15 px-3 py-2 text-xs font-bold text-[#cf9c50] hover:bg-[#cf9c50]/25 transition"
                    >
                      Escalate to SecOps
                    </button>

                    {/* Block Member or Session */}
                    <button
                      onClick={() => setBlockDialogOpen(true)}
                      className="rounded-xl bg-[#a24650] px-3 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#a24650]/90 transition"
                    >
                      Block Member / Session
                    </button>

                    {/* Hold Invoice (if invoice related) */}
                    {(activeThreat.category === 'Invoice fraud' ||
                      activeThreat.targetEntity?.type === 'invoice') && (
                      <button
                        onClick={() => setHoldInvoiceDialogOpen(true)}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          activeThreat.onHold
                            ? 'border-[#a24650] bg-[#a24650] text-[#f8f7e2]'
                            : 'border-[#a24650] bg-[#fffef4] text-[#a24650] hover:bg-[#a24650]/10'
                        }`}
                      >
                        {activeThreat.onHold ? 'Invoice On Hold' : 'Hold Invoice'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 9. ACTIVITY LOG */}
                {activeThreat.actionLogs && activeThreat.actionLogs.length > 0 && (
                  <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-2">
                      Triage Activity Log
                    </h4>
                    <div className="space-y-1.5 text-xs font-mono">
                      {activeThreat.actionLogs.map((log, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-[#393d68]">
                            <strong>{log.action}</strong> by {log.actor}
                            {log.note && <span className="font-sans text-[#686b86]"> — {log.note}</span>}
                          </span>
                          <span className="text-[#686b86]">{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-8 text-center text-xs text-[#686b86]">
                Select a threat signal from the list to view forensic details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. DETECTION RULES TABLE (COLLAPSIBLE) */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] shadow-xs overflow-hidden">
        <button
          onClick={() => setShowRules(!showRules)}
          className="w-full flex items-center justify-between p-4.5 bg-[#f8f7e2]/30 hover:bg-[#f8f7e2]/60 transition text-left"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-4 text-[#474c80]" />
            <div>
              <h3 className="text-sm font-bold text-[#393d68]">
                Detection Rules & Sensitivity Tuning
              </h3>
              <p className="text-xs text-[#686b86]">
                Configure detection thresholds, AI heuristic sensitivity, and view estimated alert
                volume.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#474c80]">
              {rules.filter((r) => r.enabled).length} of {rules.length} active
            </span>
            {showRules ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </button>

        {showRules && (
          <div className="border-t border-[#dedecb] p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#dedecb] text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                  <tr>
                    <th className="py-2.5 px-3">Rule Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Threshold Description</th>
                    <th className="py-2.5 px-3">Sensitivity</th>
                    <th className="py-2.5 px-3">Expected Volume</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/60">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-[#f8f7e2]/40 transition">
                      <td className="py-3 px-3">
                        <strong className="text-[#393d68] block">{rule.name}</strong>
                        <span className="text-[11px] text-[#686b86]">{rule.description}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="rounded-md border border-[#dedecb] bg-[#f8f7e2] px-2 py-0.5 text-[10px] font-bold text-[#393d68]">
                          {rule.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[#686b86] font-mono">
                        {rule.thresholdDetail}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-1 text-[10px]">
                          {(['Low', 'Medium', 'High'] as const).map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => handleRuleSensitivity(rule.id, lvl)}
                              className={`rounded px-1.5 py-0.5 font-bold transition ${
                                rule.sensitivity === lvl
                                  ? 'bg-[#474c80] text-[#f8f7e2]'
                                  : 'text-[#686b86] hover:text-[#393d68]'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-[#686b86]">
                        {rule.expectedVolume}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                            rule.enabled
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : 'bg-[#dedecb] text-[#686b86]'
                          }`}
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end border-t border-[#dedecb] pt-3">
              <button
                onClick={() => showToast('Detection rule configurations saved successfully.')}
                className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition shadow-xs"
              >
                Save Sensitivity Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. DIALOGS */}
      {/* ======================================================== */}

      {/* Dismiss as False Positive Modal */}
      {dismissDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#393d68]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#dedecb] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#393d68]">
                Dismiss Signal as False Positive
              </h3>
              <button
                onClick={() => setDismissDialogOpen(false)}
                className="text-[#686b86] hover:text-[#393d68]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#686b86]">
                Provide a reason for closing this alert. This feedback trains the heuristic detection
                rules to reduce noise.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1">
                  Primary Reason
                </label>
                <select
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
                >
                  <option value="Known employee VPN">Known employee VPN or authorized remote IP</option>
                  <option value="Legitimate vendor amendment">Legitimate vendor tax credit amendment</option>
                  <option value="Authorized large audit export">Authorized compliance or auditor batch export</option>
                  <option value="Cooperative bank change verified">Supplier banking change verified out-of-band</option>
                  <option value="Normal concurrent session">Authorized concurrent mobile and desktop session</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1">
                  Verification Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Verified with Ananya via Slack that she was connecting through personal VPN..."
                  value={dismissNote}
                  onChange={(e) => setDismissNote(e.target.value)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#dedecb] pt-3">
              <button
                onClick={() => setDismissDialogOpen(false)}
                className="rounded-xl border border-[#dedecb] px-3.5 py-1.5 text-xs font-semibold text-[#686b86] hover:bg-[#f8f7e2]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDismiss}
                className="rounded-xl bg-[#474c80] px-4 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68]"
              >
                Confirm Dismissal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Member or Session Confirmation Dialog */}
      <ConfirmDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        onConfirm={handleConfirmBlock}
        title="Block Member & Invalidate Session"
        body={`Are you sure you want to block the session/account associated with signal ${activeThreat?.id}? All active tokens will be revoked immediately and the client IP will be banned for 24 hours.`}
        confirmLabel="Block Immediately"
        danger
      />

      {/* Hold Invoice Confirmation Dialog */}
      <ConfirmDialog
        open={holdInvoiceDialogOpen}
        onClose={() => setHoldInvoiceDialogOpen(false)}
        onConfirm={handleConfirmHoldInvoice}
        title="Place Invoice on Mandatory Payment Hold"
        body={`Placing invoice ${activeThreat?.targetEntity?.label || activeThreat?.id} on hold will prevent accounts payable disbursement and freeze GSTR-2B reconciliation clearance until manual audit sign-off.`}
        confirmLabel="Apply Payment Hold"
        danger
      />
    </AppShell>
  )
}
