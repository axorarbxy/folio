'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  SearchCode,
  Activity,
  Clock,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Filter,
  ExternalLink,
  Layers,
  Terminal,
  Pause,
  Play,
  Download,
  Calendar,
  Sparkles,
  UserCheck,
  RotateCcw,
  Sliders,
  X,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  MonitoringSubNav,
  SeverityPill,
  SkeletonPanel,
  TimeRangeControl,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  getInvoiceTracesList,
  getInitialLiveLogs,
  type InvoiceTraceItem,
  type TraceWaterfallStage,
  type LiveLogLine,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function MonitoringTracesWorkspace() {
  const searchParams = useSearchParams()
  const initialInvoiceParam = searchParams.get('invoice')

  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [traces, setTraces] = useState<InvoiceTraceItem[]>(getInvoiceTracesList())
  const [liveLogs, setLiveLogs] = useState<LiveLogLine[]>(getInitialLiveLogs())
  const [logsPaused, setLogsPaused] = useState(false)
  const [logsSearch, setLogsSearch] = useState('')
  const [logsLevelFilter, setLogsLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL')
  const [logsOpen, setLogsOpen] = useState(true)

  // Filters & selection
  const [searchQuery, setSearchQuery] = useState(initialInvoiceParam || '')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Succeeded' | 'Needs review' | 'Failed'>('All')
  const [stageFilter, setStageFilter] = useState<string>('All')
  const [selectedTraceId, setSelectedTraceId] = useState<string>(
    initialInvoiceParam || 'INV-2026-0422'
  )

  // Accordion state for stages
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    read: true,
    validate: true,
    reconcile: false,
    ingest: false,
    preprocess: false,
    notify: false,
  })

  // Raw JSON viewer state
  const [rawJsonOpen, setRawJsonOpen] = useState(false)
  const [copiedRawJson, setCopiedRawJson] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Keyboard navigation & search shortcuts ref
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filtered traces
  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      if (statusFilter !== 'All' && t.verdict !== statusFilter) return false
      if (stageFilter !== 'All' && t.currentStage !== stageFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchId = t.id.toLowerCase().includes(q)
        const matchNum = t.invoiceNumber.toLowerCase().includes(q)
        const matchVendor = t.vendor.toLowerCase().includes(q)
        const matchGstin = t.vendorGstin.toLowerCase().includes(q)
        if (!matchId && !matchNum && !matchVendor && !matchGstin) return false
      }
      return true
    })
  }, [traces, statusFilter, stageFilter, searchQuery])

  // Active selected trace
  const activeTrace = useMemo(() => {
    return traces.find((t) => t.id === selectedTraceId) || filteredTraces[0] || traces[0]
  }, [traces, selectedTraceId, filteredTraces])

  // Simulate live log tail ticking every 2 seconds
  useEffect(() => {
    if (logsPaused) return
    const timer = setInterval(() => {
      const stages = ['Ingest', 'Preprocess', 'Read', 'Validate', 'Reconcile', 'Notify']
      const levels: ('INFO' | 'WARN' | 'ERROR')[] = ['INFO', 'INFO', 'WARN', 'INFO']
      const stage = stages[Math.floor(Math.random() * stages.length)]
      const level = levels[Math.floor(Math.random() * levels.length)]
      const now = new Date()
      const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0')

      const sampleMessages = [
        `Span executed: ${stage} completed with latency ${Math.floor(Math.random() * 200 + 40)}ms`,
        `Checked telemetry span on worker ip-10-0-4-192`,
        `Flushed memory buffer for document stream correlation`,
        `GSP gateway keep-alive heartbeat acknowledged`,
      ]

      const newLog: LiveLogLine = {
        id: `log-${Date.now()}`,
        timestamp,
        level,
        stage,
        traceId: activeTrace?.rawJson?.traceId?.slice(0, 7) || 'tr-auto',
        message: sampleMessages[Math.floor(Math.random() * sampleMessages.length)],
      }

      setLiveLogs((prev) => [newLog, ...prev.slice(0, 24)])
    }, 2000)

    return () => clearInterval(timer)
  }, [logsPaused, activeTrace])

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'ArrowDown' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        const currentIndex = filteredTraces.findIndex((t) => t.id === selectedTraceId)
        if (currentIndex < filteredTraces.length - 1) {
          setSelectedTraceId(filteredTraces[currentIndex + 1].id)
        }
      } else if (e.key === 'ArrowUp' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        const currentIndex = filteredTraces.findIndex((t) => t.id === selectedTraceId)
        if (currentIndex > 0) {
          setSelectedTraceId(filteredTraces[currentIndex - 1].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredTraces, selectedTraceId])

  // Filtered live logs
  const filteredLiveLogs = useMemo(() => {
    return liveLogs.filter((l) => {
      if (logsLevelFilter !== 'ALL' && l.level !== logsLevelFilter) return false
      if (logsSearch) {
        const q = logsSearch.toLowerCase()
        if (!l.message.toLowerCase().includes(q) && !l.stage.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [liveLogs, logsLevelFilter, logsSearch])

  // Helpers
  const toggleStageAccordion = (key: string) => {
    setExpandedStages((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopyRawJson = () => {
    if (!activeTrace) return
    navigator.clipboard.writeText(JSON.stringify(activeTrace.rawJson, null, 2))
    setCopiedRawJson(true)
    setTimeout(() => setCopiedRawJson(false), 2000)
    setToastMessage('Raw trace JSON copied to clipboard')
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleExportJson = () => {
    setToastMessage(`Exported trace ${activeTrace.id} as JSON bundle`)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Waterfall scale calculation
  const totalWaterfallMs = activeTrace?.totalDurationMs || 5000

  return (
    <AppShell active="Monitoring">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#378875]/40 bg-[#378875] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeading
        eyebrow="Monitoring"
        title="Invoice Trace & Log Explorer"
        description="Full-fidelity auditability and explainability: inspect end-to-end spans, model versions, deterministic rule checks, and human overrides."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#393d68] shadow-2xs hover:bg-[#f8f7e2] transition"
            >
              <Download className="size-3.5 text-[#474c80]" />
              <span>Export Trace</span>
            </button>
          </div>
        }
      />

      <MonitoringSubNav active="traces" />

      {/* Top Search & Filter Bar with Keyboard Shortcuts */}
      <div className="mb-6 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main search box */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#686b86]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice ID, number, vendor, or GSTIN (Press '/' to focus)..."
              className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 py-2 pl-10 pr-14 text-xs font-medium text-[#393d68] placeholder:text-[#686b86] focus:border-[#474c80] focus:outline-hidden"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[#dedecb] bg-[#fffef4] px-1.5 py-0.5 text-[10px] font-mono text-[#686b86]">
              /
            </kbd>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
            >
              <option value="All">All verdicts</option>
              <option value="Succeeded">Succeeded</option>
              <option value="Needs review">Needs review</option>
              <option value="Failed">Failed</option>
            </select>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
            >
              <option value="All">All stages</option>
              <option value="Ingest">Ingest</option>
              <option value="Preprocess">Preprocess</option>
              <option value="Read">Read</option>
              <option value="Validate">Validate</option>
              <option value="Reconcile">Reconcile</option>
              <option value="Notify">Notify</option>
            </select>
          </div>
        </div>

        {/* State Simulator & Keyboard Help */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dedecb]/60 pt-2.5 text-xs text-[#686b86]">
          <div className="flex items-center gap-2 font-semibold">
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

          <div className="flex items-center gap-3 text-[11px]">
            <span>Navigate: <kbd className="rounded border px-1 bg-[#fffef4]">↑</kbd> <kbd className="rounded border px-1 bg-[#fffef4]">↓</kbd></span>
            <span className="text-[#dedecb]">|</span>
            <span>2,410 traces captured in buffer</span>
          </div>
        </div>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No matching traces found"
          description="Zero invoice traces match the selected filters or search query."
          action={
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('All')
                setStageFilter('All')
                setViewMode('normal')
              }}
              className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
            >
              Clear filters
            </button>
          }
        />
      )}

      {viewMode === 'error' && (
        <ErrorPanel
          title="Trace store unavailable"
          message="Could not stream execution spans from Jaeger / OpenTelemetry collector buffer."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* Main 1/3 and 2/3 Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 1/3: Results list */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-[#686b86]">
                <span>Matching Traces ({filteredTraces.length})</span>
                <span>Latency</span>
              </div>

              <div className="space-y-2.5">
                {filteredTraces.map((trace) => {
                  const isSelected = activeTrace?.id === trace.id

                  return (
                    <div
                      key={trace.id}
                      onClick={() => setSelectedTraceId(trace.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        isSelected
                          ? 'border-[#474c80] bg-[#fffef4] shadow-sm ring-1 ring-[#474c80]'
                          : 'border-[#dedecb] bg-[#fffef4] hover:bg-[#f8f7e2]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-[#393d68]">
                            {trace.invoiceNumber}
                          </div>
                          <div className="text-[11px] font-semibold text-[#686b86]">
                            {trace.vendor}
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            trace.verdict === 'Succeeded'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : trace.verdict === 'Needs review'
                              ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                              : 'bg-[#a24650]/15 text-[#a24650]'
                          }`}
                        >
                          {trace.verdict}
                        </span>
                      </div>

                      {/* Mini Stage-Dots Strip */}
                      <div className="mt-3 flex items-center justify-between border-t border-[#dedecb]/60 pt-2.5 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {(['ingest', 'preprocess', 'read', 'validate', 'reconcile', 'notify'] as const).map(
                            (stg) => {
                              const s = trace.stageStatus[stg]
                              const color =
                                s === 'succeeded'
                                  ? 'bg-[#378875]'
                                  : s === 'needs_review'
                                  ? 'bg-[#cf9c50]'
                                  : 'bg-[#a24650]'
                              return (
                                <span
                                  key={stg}
                                  className={`size-2 rounded-full ${color}`}
                                  title={`${stg}: ${s}`}
                                />
                              )
                            }
                          )}
                        </div>

                        <span className="font-mono text-xs font-bold text-[#393d68]">
                          {(trace.totalDurationMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right 2/3: Trace View for Selected Invoice */}
            <div className="lg:col-span-8 space-y-6">
              {activeTrace && (
                <div className="space-y-6">
                  {/* Trace Header */}
                  <div className="rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#474c80]">
                            {activeTrace.id}
                          </span>
                          <span className="text-[#dedecb]">·</span>
                          <span className="font-mono text-sm font-bold text-[#393d68]">
                            {activeTrace.invoiceNumber}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              activeTrace.verdict === 'Succeeded'
                                ? 'bg-[#378875]/15 text-[#378875]'
                                : activeTrace.verdict === 'Needs review'
                                ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                                : 'bg-[#a24650]/15 text-[#a24650]'
                            }`}
                          >
                            {activeTrace.verdict}
                          </span>
                        </div>

                        <h3 className="mt-1 text-base font-black text-[#393d68]">
                          {activeTrace.vendor}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#686b86]">
                          <span className="font-mono">{activeTrace.vendorGstin}</span>
                          <span>·</span>
                          <span>{activeTrace.timestamp}</span>
                        </div>
                      </div>

                      {/* Header Actions & Duration */}
                      <div className="flex flex-col sm:items-end gap-2">
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#686b86]">
                            Total Execution
                          </span>
                          <div className="font-mono text-xl font-black text-[#393d68]">
                            {(activeTrace.totalDurationMs / 1000).toFixed(2)}s
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`/app/invoices/${activeTrace.id}/review`}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#474c80] px-3 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                          >
                            <span>Review</span>
                            <ExternalLink className="size-3" />
                          </a>
                          <a
                            href={`/app/invoices/${activeTrace.id}/validation`}
                            className="inline-flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#393d68] hover:bg-[#f8f7e2] transition"
                          >
                            <span>Rules</span>
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Waterfall Chart */}
                  <SectionCard
                    title="Span execution waterfall"
                    description="Relative offset and duration breakdown across micro-service execution stages."
                  >
                    <div className="space-y-3 pt-2">
                      {activeTrace.waterfall.map((span) => {
                        const leftPercent = (span.startMs / totalWaterfallMs) * 100
                        const widthPercent = Math.max(2, (span.durationMs / totalWaterfallMs) * 100)
                        const barColor =
                          span.status === 'succeeded'
                            ? 'bg-[#378875]'
                            : span.status === 'needs_review'
                            ? 'bg-[#cf9c50]'
                            : 'bg-[#a24650]'

                        return (
                          <div key={span.stage} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-[#393d68] flex items-center gap-1.5">
                                <span>{span.stage}</span>
                                <span className="font-mono text-[10px] font-normal text-[#686b86]">
                                  ({span.service})
                                </span>
                              </span>
                              <span className="font-mono text-xs font-bold text-[#686b86]">
                                {span.durationMs}ms
                              </span>
                            </div>

                            {/* Waterfall Bar Track */}
                            <div className="relative h-6 w-full rounded-lg bg-[#f8f7e2] border border-[#dedecb]/60 overflow-hidden">
                              <div
                                className={`absolute h-full rounded-md ${barColor} transition-all duration-500 flex items-center px-2 text-[10px] font-bold text-[#f8f7e2] shadow-xs`}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                title={`${span.stage}: ${span.durationMs}ms (Starts at +${span.startMs}ms)`}
                              >
                                {span.durationMs > 300 && <span>{span.durationMs}ms</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </SectionCard>

                  {/* Stage Details Accordion */}
                  <SectionCard
                    title="Stage diagnostic inputs & outputs"
                    description="Deep inspection into extracted tensors, model prompts, deterministic formulas, and statutory 2B matching."
                  >
                    <div className="space-y-3">
                      {/* Read Stage Accordion */}
                      <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleStageAccordion('read')}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f8f7e2]/40 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="size-2 rounded-full bg-[#cf9c50]" />
                            <h4 className="text-xs font-bold text-[#393d68]">
                              Stage 3: Read (Multimodal Extraction)
                            </h4>
                          </div>
                          {expandedStages.read ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>

                        {expandedStages.read && (
                          <div className="border-t border-[#dedecb] p-4 bg-[#f8f7e2]/20 space-y-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#686b86] pb-2 border-b border-[#dedecb]/60">
                              <span>Model: <strong className="text-[#393d68] font-mono">{activeTrace.stages.read.modelVersion}</strong></span>
                              <span>Extracted: {activeTrace.stages.read.outputs.fieldCount} fields</span>
                            </div>
                            <p className="text-xs text-[#686b86]">{activeTrace.stages.read.detailsText}</p>

                            {/* Extracted Fields Table with Confidence Pills */}
                            {activeTrace.stages.read.extractedFields && (
                              <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-[#dedecb] bg-[#fffef4] text-[10px] font-bold text-[#686b86]">
                                      <th className="py-2 px-3">Field Name</th>
                                      <th className="py-2 px-3">Extracted Value</th>
                                      <th className="py-2 px-3 text-right">Confidence</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#dedecb]/60 bg-[#fffef4]">
                                    {activeTrace.stages.read.extractedFields.map((f, i) => (
                                      <tr key={i}>
                                        <td className="py-1.5 px-3 font-semibold text-[#393d68]">{f.name}</td>
                                        <td className="py-1.5 px-3 font-mono text-[#474c80]">{f.value}</td>
                                        <td className="py-1.5 px-3 text-right">
                                          <span
                                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                                              f.confidence >= 0.9
                                                ? 'bg-[#378875]/15 text-[#378875]'
                                                : f.confidence >= 0.8
                                                ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                                                : 'bg-[#a24650]/15 text-[#a24650]'
                                            }`}
                                          >
                                            {(f.confidence * 100).toFixed(0)}%
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Validate Stage Accordion */}
                      <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleStageAccordion('validate')}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f8f7e2]/40 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="size-2 rounded-full bg-[#cf9c50]" />
                            <h4 className="text-xs font-bold text-[#393d68]">
                              Stage 4: Validate (Deterministic Rule Checks)
                            </h4>
                          </div>
                          {expandedStages.validate ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>

                        {expandedStages.validate && (
                          <div className="border-t border-[#dedecb] p-4 bg-[#f8f7e2]/20 space-y-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#686b86] pb-2 border-b border-[#dedecb]/60">
                              <span>Engine: <strong className="text-[#393d68]">{activeTrace.stages.validate.modelVersion}</strong></span>
                              <span>Rule table: <strong className="text-[#393d68] font-mono">{activeTrace.stages.validate.ruleTableVersion}</strong></span>
                            </div>
                            <p className="text-xs text-[#686b86]">{activeTrace.stages.validate.detailsText}</p>

                            {/* Rule Evaluations List */}
                            {activeTrace.stages.validate.ruleEvaluations && (
                              <div className="space-y-2">
                                {activeTrace.stages.validate.ruleEvaluations.map((r) => (
                                  <div
                                    key={r.code}
                                    className={`rounded-xl border p-2.5 ${
                                      r.passed ? 'border-[#dedecb] bg-[#fffef4]' : 'border-[#cf9c50] bg-[#cf9c50]/10'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-[#393d68]">{r.code}</span>
                                        <span className="font-semibold text-[#393d68]">{r.name}</span>
                                        <span className="rounded-md bg-[#dedecb]/50 px-1.5 py-0.5 text-[9px] font-bold text-[#686b86]">
                                          {r.kind}
                                        </span>
                                      </div>
                                      <span
                                        className={`font-bold text-[10px] ${
                                          r.passed ? 'text-[#378875]' : 'text-[#a24650]'
                                        }`}
                                      >
                                        {r.passed ? 'PASSED' : 'FLAGGED'}
                                      </span>
                                    </div>
                                    <div className="mt-1 font-mono text-[10px] text-[#686b86]">{r.formula}</div>
                                    <div className="mt-1 text-[11px] text-[#686b86]">{r.message}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reconcile Stage Accordion */}
                      <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleStageAccordion('reconcile')}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f8f7e2]/40 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="size-2 rounded-full bg-[#378875]" />
                            <h4 className="text-xs font-bold text-[#393d68]">
                              Stage 5: Reconcile (GSTR-2B Statement Cross-Match)
                            </h4>
                          </div>
                          {expandedStages.reconcile ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>

                        {expandedStages.reconcile && (
                          <div className="border-t border-[#dedecb] p-4 bg-[#f8f7e2]/20 space-y-2 text-xs">
                            <p className="text-xs text-[#686b86]">{activeTrace.stages.reconcile.detailsText}</p>
                            {activeTrace.stages.reconcile.reconcileMatches?.map((m, idx) => (
                              <div key={idx} className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5 flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-[#393d68] block">{m.source}</span>
                                  <span className="text-[11px] text-[#686b86]">{m.notes}</span>
                                </div>
                                <span className="font-bold text-xs text-[#378875]">MATCHED</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </SectionCard>

                  {/* Edits Timeline */}
                  {activeTrace.editsTimeline.length > 0 && (
                    <SectionCard
                      title="Human corrections timeline"
                      description="Audit trail of field alterations performed by reviewers in the review queue."
                    >
                      <div className="space-y-3 pt-1">
                        {activeTrace.editsTimeline.map((edit) => (
                          <div
                            key={edit.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="flex size-5 items-center justify-center rounded-md bg-[#474c80] text-[9px] font-bold text-[#f8f7e2]">
                                  {edit.userAvatar}
                                </span>
                                <span className="text-xs font-bold text-[#393d68]">{edit.user}</span>
                                <span className="text-[10px] text-[#686b86]">· {edit.timestamp}</span>
                              </div>

                              <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className="font-bold text-[#686b86]">{edit.fieldName}:</span>
                                <span className="font-mono text-[#a24650] line-through">{edit.oldValue}</span>
                                <ArrowRight className="size-3 text-[#686b86]" />
                                <span className="font-mono font-bold text-[#378875]">{edit.newValue}</span>
                              </div>

                              <p className="text-[11px] text-[#686b86] italic">
                                Reason: {edit.reason}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Raw JSON Viewer */}
                  <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setRawJsonOpen(!rawJsonOpen)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f8f7e2]/40 transition text-xs font-bold text-[#393d68]"
                    >
                      <span>Raw OpenTelemetry Trace JSON Payload</span>
                      {rawJsonOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>

                    {rawJsonOpen && (
                      <div className="border-t border-[#dedecb] p-4 bg-[#393d68] text-[#f8f7e2] space-y-2">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleCopyRawJson}
                            className="inline-flex items-center gap-1 rounded-md bg-[#474c80] px-2.5 py-1 text-xs font-bold hover:bg-[#dedecb] hover:text-[#393d68] transition"
                          >
                            {copiedRawJson ? <Check className="size-3" /> : <Copy className="size-3" />}
                            <span>{copiedRawJson ? 'Copied' : 'Copy JSON'}</span>
                          </button>
                        </div>
                        <pre className="overflow-x-auto text-[11px] font-mono leading-relaxed p-2">
                          {JSON.stringify(activeTrace.rawJson, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Live Log Tail Panel (Collapsible bottom console) */}
          <div className="rounded-3xl border border-[#dedecb] bg-[#fffef4] shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[#dedecb] bg-[#f8f7e2]/50">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#393d68]">
                <Terminal className="size-4 text-[#474c80]" />
                <span>Live Ingestion Log Stream (Simulated 2s Heartbeat)</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Search in logs */}
                <input
                  type="text"
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  placeholder="Filter log messages..."
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs text-[#393d68] focus:outline-hidden"
                />

                {/* Level Filter */}
                <select
                  value={logsLevelFilter}
                  onChange={(e) => setLogsLevelFilter(e.target.value as any)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2 py-1 text-xs font-semibold text-[#393d68]"
                >
                  <option value="ALL">ALL LEVELS</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>

                {/* Pause/Resume */}
                <button
                  type="button"
                  onClick={() => setLogsPaused(!logsPaused)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                    logsPaused
                      ? 'bg-[#378875] text-[#f8f7e2]'
                      : 'border border-[#dedecb] bg-[#fffef4] text-[#393d68]'
                  }`}
                >
                  {logsPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                  <span>{logsPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLogsOpen(!logsOpen)}
                  className="rounded-xl p-1 text-[#686b86] hover:bg-[#dedecb]/40"
                >
                  {logsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
              </div>
            </div>

            {logsOpen && (
              <div className="max-h-60 overflow-y-auto bg-[#393d68] p-4 text-[#f8f7e2] font-mono text-[11px] space-y-1.5 scrollbar-thin">
                {filteredLiveLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-[#dedecb]/60 shrink-0">{log.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                        log.level === 'INFO'
                          ? 'bg-[#378875]/30 text-[#378875]'
                          : log.level === 'WARN'
                          ? 'bg-[#cf9c50]/30 text-[#cf9c50]'
                          : 'bg-[#a24650]/40 text-[#a24650]'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[#8b78ae] shrink-0">[{log.stage}]</span>
                    <span className="text-[#f8f7e2]/90 flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}
