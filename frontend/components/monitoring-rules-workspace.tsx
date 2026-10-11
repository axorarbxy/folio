'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Diff,
  ExternalLink,
  Eye,
  FileCheck2,
  Filter,
  Flame,
  HelpCircle,
  History,
  Info,
  Layers,
  Play,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'
import { AppShell, PageHeading, SectionCard } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  MonitoringSubNav,
  SeverityPill,
  SkeletonPanel,
  Sparkline,
  StatusBadge,
  TimeRangeControl,
  TrendDelta,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  getRuleTableFreshness,
  getRuleKPIs,
  getRulePerformanceData,
  getFalsePositiveTrends,
  getRuleVersionHistory,
  getRuleTestSuiteStatus,
  type RulePerformanceItem,
  type RuleVersionChange,
  type Severity,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type KindFilter = 'all' | 'Deterministic' | 'AI-assisted'
type SortField =
  | 'code'
  | 'name'
  | 'kind'
  | 'runsCount'
  | 'failRatePct'
  | 'userConfirmedPct'
  | 'dismissedPct'
  | 'lastChanged'

interface ToastNotice {
  id: string
  message: string
}

function DonutSplitMeter({
  deterministicPct = 82,
  aiPct = 18,
  size = 80,
}: {
  deterministicPct?: number
  aiPct?: number
  size?: number
}) {
  const strokeWidth = 8
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const detOffset = circumference - (deterministicPct / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#8b78ae"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#474c80"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={detOffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-[#393d68]">{deterministicPct}%</span>
        <span className="text-[8px] font-semibold text-[#686b86]">DET</span>
      </div>
    </div>
  )
}

export default function MonitoringRulesWorkspace() {
  const [mounted, setMounted] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [demoStale, setDemoStale] = useState<boolean>(false)

  // Filters & Sorting for performance table
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('failRatePct')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>('R-106')

  // Version Diff Modal
  const [selectedDiffVersion, setSelectedDiffVersion] = useState<RuleVersionChange | null>(null)

  // Test suite runner state
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState(() => getRuleTestSuiteStatus())

  // Toasts
  const [toasts, setToasts] = useState<ToastNotice[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const freshness = useMemo(() => getRuleTableFreshness(demoStale), [demoStale])
  const kpis = useMemo(() => getRuleKPIs(), [])
  const rules = useMemo(() => getRulePerformanceData(), [])
  const falsePositiveTrends = useMemo(() => getFalsePositiveTrends(), [])
  const versionHistory = useMemo(() => getRuleVersionHistory(), [])

  // Filtered and sorted rules
  const filteredAndSortedRules = useMemo(() => {
    return rules
      .filter((rule) => {
        if (kindFilter !== 'all' && rule.kind !== kindFilter) return false
        if (severityFilter !== 'all' && rule.severity !== severityFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          return (
            rule.name.toLowerCase().includes(q) ||
            rule.code.toLowerCase().includes(q) ||
            rule.formula.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        const valA = a[sortField]
        const valB = b[sortField]

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA
        }
        return 0
      })
  }, [rules, kindFilter, severityFilter, searchQuery, sortField, sortAsc])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  function toggleExpandRule(id: string) {
    setExpandedRuleId((prev) => (prev === id ? null : id))
  }

  function showToast(message: string) {
    const notice: ToastNotice = {
      id: `${Date.now()}-${Math.random()}`,
      message,
    }
    setToasts((prev) => [...prev, notice])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== notice.id))
    }, 3500)
  }

  function handleRunTests() {
    setIsRunningTests(true)
    setTimeout(() => {
      setIsRunningTests(false)
      setTestStatus({
        totalTests: 148,
        passingTests: 148,
        failingTests: 0,
        lastRunTime: 'Just now (11 Oct 2026, 12:08 IST)',
        durationMs: 44,
      })
      showToast('148 rule validation test cases passed (44ms execution time)')
    }, 1200)
  }

  return (
    <AppShell active="Monitoring">
      {/* Toast notifications */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#dedecb] bg-[#393d68] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-[0_12px_28px_rgba(57,61,104,0.28)] transition-all"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-[#378875] text-[#f8f7e2]">
              <Check className="size-3" aria-hidden="true" />
            </span>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Dismiss notification"
              className="ml-2 rounded p-1 text-[#f8f7e2]/70 hover:text-white"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {/* Version Diff Modal Dialog */}
      {selectedDiffVersion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diff-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#393d68]/45 px-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#dedecb] pb-4">
              <div>
                <span className="rounded-md bg-[#474c80] px-2 py-0.5 text-[10px] font-bold text-[#f8f7e2]">
                  {selectedDiffVersion.version}
                </span>
                <h3 id="diff-dialog-title" className="mt-1 text-base font-bold text-[#393d68]">
                  {selectedDiffVersion.title}
                </h3>
                <p className="mt-0.5 text-xs text-[#686b86]">
                  Effective: {selectedDiffVersion.effectiveDate} · Author: {selectedDiffVersion.changedBy}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDiffVersion(null)}
                className="rounded-lg p-1.5 text-[#686b86] hover:bg-[#dedecb]/40 hover:text-[#393d68]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 max-h-[380px] space-y-3 overflow-y-auto pr-1">
              {selectedDiffVersion.diff.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-3.5 text-xs"
                >
                  <strong className="block text-xs font-bold text-[#393d68]">{item.field}</strong>
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-[#dedecb]/60 bg-[#fffef4] p-2 text-[11px]">
                    <div>
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-[#a24650]">
                        Before
                      </span>
                      <span className="font-mono text-[#a24650] line-through">{item.before}</span>
                    </div>
                    <div className="border-l border-[#dedecb] pl-2">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-[#378875]">
                        After (Current)
                      </span>
                      <span className="font-mono font-bold text-[#378875]">{item.after}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[#686b86]">
                    <strong className="text-[#393d68]">Tax Rationale:</strong> {item.rationale}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end border-t border-[#dedecb] pt-4">
              <button
                type="button"
                onClick={() => setSelectedDiffVersion(null)}
                className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] transition hover:bg-[#393d68]"
              >
                Close diff inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. PageHeading */}
      <PageHeading
        eyebrow="Monitoring"
        title="Validation engine & rule monitoring"
        description="Deterministic tax rules, CBIC master tables, and false-positive tracking. The AI reads, deterministic rules decide."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <MonitoringSubNav active="rules" />

      {/* State Simulator */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-4 py-2.5 shadow-xs">
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
        <span className="text-xs text-[#686b86]">Rule Engine v2.4 · 9 active rules</span>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={6} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No validation rule telemetry recorded"
          description="The rule engine has not recorded verification events in this period."
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
          title="Rule engine metrics offline"
          message="Could not connect to rule evaluator daemon in ap-south-1 zone."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 2. Freshness Banner (turns amber if older than 30 days) */}
          <div
            className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-xs transition sm:flex-row sm:items-center sm:justify-between ${
              freshness.isStale
                ? 'border-[#cf9c50]/40 bg-[#cf9c50]/15'
                : 'border-[#378875]/30 bg-[#378875]/10'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  freshness.isStale
                    ? 'bg-[#cf9c50] text-[#fffef4]'
                    : 'bg-[#378875] text-[#f8f7e2]'
                }`}
              >
                {freshness.isStale ? (
                  <AlertTriangle className="size-5" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className={`text-base font-bold ${
                      freshness.isStale ? 'text-[#cf9c50]' : 'text-[#378875]'
                    }`}
                  >
                    {freshness.isStale
                      ? `Attention: ${freshness.staleTableName} is ${freshness.daysSinceUpdate} days old`
                      : 'Rule tables current & verified'}
                  </h2>
                  <span className="rounded-full border border-black/10 bg-white/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#393d68]">
                    Rate table {freshness.version}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#393d68]">
                  Rule tables last updated {freshness.lastUpdated} · Next scheduled review {freshness.nextReview}.
                  {freshness.isStale && (
                    <span className="ml-1 font-bold text-[#a24650]">
                      Tables older than 30 days require statutory re-verification against CBIC Gazette.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Interactive demo toggle for stale state */}
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setDemoStale(!demoStale)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] shadow-2xs transition hover:bg-[#f8f7e2]"
              >
                <Sliders className="size-3 text-[#474c80]" />
                <span>{demoStale ? 'Revert to current (9d)' : 'Simulate stale table (62d)'}</span>
              </button>
            </div>
          </div>

          {/* 3. KPI row (Checks run today, Invoices flagged %, Donut check split, Override rate) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: Checks run today */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Checks run today</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <Workflow aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.checksRunToday.toLocaleString()}
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <TrendDelta value={12.4} goodWhen="up" />
                <span className="text-xs font-medium text-[#686b86]">Across 2,480 invoices</span>
              </div>
            </div>

            {/* KPI 2: Invoices flagged % */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Invoices flagged</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <AlertTriangle aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.invoicesFlaggedPct}%
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#cf9c50]">
                  {kpis.invoicesFlaggedCount} invoices held
                </span>
                <Sparkline data={[4.5, 4.2, 4.0, 3.9, 3.8]} tone="healthy" width={64} height={20} />
              </div>
            </div>

            {/* KPI 3: Deterministic vs AI-assisted check split (Donut) */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Check split</p>
                <span className="text-xs font-bold text-[#474c80]">Deterministic First</span>
              </div>
              <div className="relative mt-2 flex items-center gap-4">
                <DonutSplitMeter
                  deterministicPct={kpis.deterministicSplitPct}
                  aiPct={kpis.aiAssistedSplitPct}
                  size={64}
                />
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#474c80]" />
                    <span className="font-semibold text-[#393d68]">82% Deterministic</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#8b78ae]" />
                    <span className="text-[#686b86]">18% AI-assisted</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 4: Override rate */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Reviewer override rate</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <Scale aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.overrideRatePct}%
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <TrendDelta value={-0.6} goodWhen="down" />
                <span className="text-xs text-[#686b86]">User accepted flagged item</span>
              </div>
            </div>
          </div>

          {/* 4. Rule performance table with expanded formula & failure examples */}
          <SectionCard
            title="Validation rules performance"
            description="All 9 active GST validation rules. Click column headers to sort; click any row to inspect rule formula and failure examples."
          >
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#dedecb] pb-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Kind Filter */}
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-[#686b86]">Kind:</span>
                  {(['all', 'Deterministic', 'AI-assisted'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKindFilter(k)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                        kindFilter === k
                          ? 'bg-[#474c80] text-[#f8f7e2]'
                          : 'border border-[#dedecb] bg-[#fffef4] text-[#686b86] hover:bg-[#f8f7e2]'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Severity Filter */}
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-[#686b86]">Severity:</span>
                  {(['all', 'critical', 'high', 'medium'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverityFilter(s)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                        severityFilter === s
                          ? 'bg-[#474c80] text-[#f8f7e2]'
                          : 'border border-[#dedecb] bg-[#fffef4] text-[#686b86] hover:bg-[#f8f7e2]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 size-3.5 text-[#686b86]" />
                <input
                  type="text"
                  placeholder="Filter rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 rounded-xl border border-[#dedecb] bg-[#fffef4] pl-8 pr-3 text-xs text-[#393d68] placeholder-[#686b86] focus:border-[#474c80] focus:outline-none"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                    <th scope="col" className="pb-3 pr-4">
                      <button
                        type="button"
                        onClick={() => handleSort('code')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Rule
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('kind')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Kind
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('runsCount')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Runs
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('failRatePct')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Fail Rate
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('userConfirmedPct')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Confirmed %
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('dismissedPct')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Dismissed %
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">Trend</th>
                    <th scope="col" className="pb-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('lastChanged')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Last Changed
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/50">
                  {filteredAndSortedRules.map((rule) => {
                    const isExpanded = expandedRuleId === rule.id
                    const isHighDismissal = rule.dismissedPct > 15

                    return (
                      <React.Fragment key={rule.id}>
                        <tr
                          onClick={() => toggleExpandRule(rule.id)}
                          className={`cursor-pointer transition ${
                            isExpanded ? 'bg-[#f8f7e2]/70' : 'hover:bg-[#f8f7e2]/40'
                          }`}
                        >
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="size-3.5 shrink-0 text-[#474c80]" />
                              ) : (
                                <ChevronRight className="size-3.5 shrink-0 text-[#686b86]" />
                              )}
                              <span className="font-mono text-xs font-bold text-[#474c80]">{rule.code}</span>
                              <span className="font-bold text-[#393d68]">{rule.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                rule.kind === 'Deterministic'
                                  ? 'bg-[#474c80]/10 text-[#474c80]'
                                  : 'bg-[#8b78ae]/20 text-[#8b78ae]'
                              }`}
                            >
                              {rule.kind}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#393d68]">
                            {rule.runsCount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#393d68]">
                            {rule.failRatePct}%
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#378875]">
                            {rule.userConfirmedPct}%
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-semibold ${
                                isHighDismissal ? 'font-bold text-[#cf9c50]' : 'text-[#393d68]'
                              }`}
                            >
                              {rule.dismissedPct}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Sparkline
                              data={rule.sparkline}
                              tone={isHighDismissal ? 'degraded' : 'healthy'}
                              width={60}
                              height={18}
                            />
                          </td>
                          <td className="py-3.5 pl-4 text-right text-[#686b86]">
                            {rule.lastChanged}
                          </td>
                        </tr>

                        {/* Expanded details */}
                        {isExpanded && (
                          <tr className="bg-[#f8f7e2]/50">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="space-y-3 rounded-xl border border-[#dedecb] bg-[#fffef4] p-4 text-xs">
                                {/* Monospace Formula */}
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#686b86]">
                                    Deterministic Evaluation Formula
                                  </span>
                                  <div className="mt-1 rounded-lg border border-[#dedecb] bg-[#f8f7e2]/60 p-2.5 font-mono text-xs text-[#393d68]">
                                    <code>{rule.formula}</code>
                                  </div>
                                </div>

                                {/* Top 3 Failure Examples */}
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#686b86]">
                                    Top 3 Recent Trigger Examples
                                  </span>
                                  <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                                    {rule.failureExamples.map((ex, idx) => (
                                      <div
                                        key={idx}
                                        className="rounded-lg border border-[#dedecb] bg-[#fffef4] p-2.5 text-[11px]"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono font-bold text-[#474c80]">
                                            {ex.invoiceId}
                                          </span>
                                          <span className="text-[10px] text-[#686b86]">
                                            {ex.vendor}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[11px] leading-4 text-[#a24650]">
                                          {ex.reason}
                                        </p>
                                        <time className="mt-1 block text-[9px] text-[#686b86]">
                                          {ex.timestamp}
                                        </time>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 5. False-positive monitor (Dismissal rate chart & alert threshold) */}
          <SectionCard
            title="False-positive monitor & rule dismissal rate"
            description="Tracking user dismissal rates over time. Rules with dismissal rates exceeding 15% are flagged for sensitivity tuning."
          >
            {/* Warning banner for rules above 15% */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cf9c50]/35 bg-[#cf9c50]/15 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#cf9c50] text-[#fffef4]">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-[#cf9c50]">
                    Review this rule: R-106 (Duplicate invoice collision) dismissal rate is at 18.4%
                  </h3>
                  <p className="mt-0.5 text-xs text-[#393d68]">
                    18.4% of flagged invoices were marked as valid by reviewers (threshold: 15%). Fuzzy sensitivity on monthly retainers is over-triggering.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => showToast('Tuning suggestion submitted: Fuzzy match distance threshold increased to 0.92')}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-1.5 text-xs font-bold text-[#f8f7e2] transition hover:bg-[#393d68]"
              >
                <Sliders className="size-3.5" aria-hidden="true" />
                <span>Tune rule sensitivity</span>
              </button>
            </div>

            {/* Line chart of dismissal rates */}
            <div
              className="h-[250px] w-full"
              role="region"
              aria-label="Chart of rule dismissal rates over time"
              tabIndex={0}
            >
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 250 }}>
                  <LineChart data={falsePositiveTrends} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis dataKey="date" stroke="#686b86" fontSize={11} tickLine={false} />
                    <YAxis
                      domain={[0, 25]}
                      stroke="#686b86"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#fffef4',
                        borderColor: '#dedecb',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#393d68',
                      }}
                      formatter={(val, name) => [`${val}%`, name]}
                    />
                    <ReferenceLine
                      y={15}
                      stroke="#a24650"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: '15% Review Threshold',
                        fill: '#a24650',
                        fontSize: 10,
                        position: 'right',
                        fontWeight: 600,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="R-106"
                      name="R-106 (Duplicate)"
                      stroke="#cf9c50"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#cf9c50' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="R-103"
                      name="R-103 (HSN lookup)"
                      stroke="#474c80"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="R-109"
                      name="R-109 (2B match)"
                      stroke="#8b78ae"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="R-102"
                      name="R-102 (Place of supply)"
                      stroke="#378875"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>
          </SectionCard>

          {/* 6 & 7: Rule data versions & Test suite status */}
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            {/* 6. Rule data versions */}
            <SectionCard
              title="Rule table version history"
              description="Audit trail of rate tables, threshold adjustments, and statutory updates with before/after diffs."
            >
              <div className="space-y-3.5">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex flex-col gap-2 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4 transition hover:bg-[#f8f7e2] sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[#474c80] px-2 py-0.5 text-[10px] font-bold text-[#f8f7e2]">
                          {ver.version}
                        </span>
                        <span className="rounded-md border border-[#dedecb] bg-[#fffef4] px-2 py-0.5 text-[10px] font-semibold text-[#686b86]">
                          {ver.category}
                        </span>
                        <time className="text-[10px] text-[#686b86]">Effective: {ver.effectiveDate}</time>
                      </div>
                      <h3 className="mt-1.5 text-xs font-bold text-[#393d68]">{ver.title}</h3>
                      <p className="mt-0.5 text-[11px] text-[#686b86]">By {ver.changedBy}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedDiffVersion(ver)}
                      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#474c80] shadow-2xs transition hover:bg-[#474c80] hover:text-[#f8f7e2]"
                    >
                      <Diff className="size-3.5" aria-hidden="true" />
                      <span>Inspect diff ({ver.diff.length})</span>
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* 7. Test suite status card */}
            <SectionCard
              title="Continuous rule test suite"
              description="Automated regression tests run against historical ground-truth invoices."
            >
              <div className="flex flex-col justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-5 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#378875]/30 bg-[#378875]/10 px-2.5 py-1 text-xs font-bold text-[#378875]">
                      <CheckCircle2 className="size-3.5" />
                      <span>Suite healthy</span>
                    </span>
                    <span className="text-xs text-[#686b86]">{testStatus.durationMs}ms run time</span>
                  </div>

                  <strong className="mt-4 block text-3xl font-bold tracking-tight text-[#393d68]">
                    {testStatus.passingTests} of {testStatus.totalTests} tests passing
                  </strong>
                  <p className="mt-1 text-xs text-[#686b86]">
                    Zero regressions detected. All edge-case GSTINs, roundoff tolerances, and HSN tariff schedules verified.
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-[#686b86]">
                    Last executed: {testStatus.lastRunTime}
                  </p>
                </div>

                <div className="mt-6 border-t border-[#dedecb]/60 pt-4">
                  <button
                    type="button"
                    onClick={handleRunTests}
                    disabled={isRunningTests}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#474c80] px-4 py-2.5 text-xs font-bold text-[#f8f7e2] transition hover:bg-[#393d68] disabled:opacity-50"
                  >
                    <Play className={`size-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                    <span>{isRunningTests ? 'Running test suite...' : 'Run test suite now'}</span>
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </AppShell>
  )
}
