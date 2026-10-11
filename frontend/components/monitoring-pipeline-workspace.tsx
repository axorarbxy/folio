'use client'

import React, { useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  Flame,
  Info,
  RefreshCw,
  Search,
  Sparkles,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
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
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  getStagesHealth,
  getPipelineEdges,
  getStageDetailTelemetry,
  getFailedDocuments,
  getPipelineCapacity,
  type Stage,
  type StageHealth,
  type FailedDocumentItem,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type DetailTab = 'latency' | 'throughput' | 'errors' | 'queue'
type SortField = 'stage' | 'status' | 'p50Ms' | 'p95Ms' | 'p99Ms' | 'errorRatePct' | 'queueDepth'

interface ToastNotice {
  id: string
  message: string
}

export default function MonitoringPipelineWorkspace() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const stageFromUrl = searchParams.get('stage') as Stage | null
  const initialStage: Stage =
    stageFromUrl && ['Ingest', 'Preprocess', 'Read', 'Validate', 'Reconcile', 'Notify'].includes(stageFromUrl)
      ? stageFromUrl
      : 'Read'

  const [selectedStage, setSelectedStage] = useState<Stage>(initialStage)
  const [detailTab, setDetailTab] = useState<DetailTab>('latency')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Sorting for latency table
  const [sortField, setSortField] = useState<SortField>('p95Ms')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Failed documents state
  const [failedDocs, setFailedDocs] = useState<FailedDocumentItem[]>(() => getFailedDocuments())
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState<boolean>(false)
  const [retryingIds, setRetryingIds] = useState<string[]>([])
  const [toasts, setToasts] = useState<ToastNotice[]>([])

  const stages = getStagesHealth()
  const edges = getPipelineEdges()
  const capacity = getPipelineCapacity()
  const stageTelemetry = getStageDetailTelemetry(selectedStage)

  const activeStageInfo = stages.find((s) => s.stage === selectedStage) || stages[2]

  function handleSelectStage(stage: Stage) {
    setSelectedStage(stage)
    router.replace(`/app/monitoring/pipeline?stage=${stage}`, { scroll: false })
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => {
      let valA: string | number = a[sortField]
      let valB: string | number = b[sortField]

      if (sortField === 'stage') {
        return sortAsc ? a.stage.localeCompare(b.stage) : b.stage.localeCompare(a.stage)
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA
      }
      return 0
    })
  }, [stages, sortField, sortAsc])

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

  function handleRetrySingle(docId: string, invoiceNumber: string) {
    setRetryingIds((prev) => [...prev, docId])

    setTimeout(() => {
      setFailedDocs((prev) => prev.filter((doc) => doc.id !== docId))
      setRetryingIds((prev) => prev.filter((id) => id !== docId))
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId))
      showToast(`Document ${invoiceNumber} requeued for ${selectedStage} stage`)
    }, 800)
  }

  function handleBulkRetry() {
    setShowBulkConfirmModal(false)
    const count = selectedDocIds.length > 0 ? selectedDocIds.length : failedDocs.length
    const idsToRetry = selectedDocIds.length > 0 ? selectedDocIds : failedDocs.map((d) => d.id)

    setRetryingIds((prev) => [...prev, ...idsToRetry])

    setTimeout(() => {
      setFailedDocs((prev) => prev.filter((doc) => !idsToRetry.includes(doc.id)))
      setRetryingIds([])
      setSelectedDocIds([])
      showToast(`${count} failed documents successfully requeued`)
    }, 1000)
  }

  function toggleSelectDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function toggleSelectAllDocs() {
    if (selectedDocIds.length === failedDocs.length) {
      setSelectedDocIds([])
    } else {
      setSelectedDocIds(failedDocs.map((d) => d.id))
    }
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

      {/* Bulk Retry Confirmation Modal */}
      {showBulkConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-retry-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#393d68]/45 px-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#cf9c50]/15 text-[#cf9c50]">
                <RefreshCw className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="bulk-retry-title" className="text-base font-bold text-[#393d68]">
                  Retry {selectedDocIds.length > 0 ? selectedDocIds.length : failedDocs.length} failed documents?
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-[#686b86]">
                  These documents will be requeued to their respective failure stages (Read, Validate, Reconcile) and reprocessed through worker queues.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#dedecb]/50 pt-4">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-4 py-2 text-xs font-semibold text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkRetry}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] transition hover:bg-[#393d68]"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                <span>Confirm bulk retry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. PageHeading */}
      <PageHeading
        eyebrow="Monitoring"
        title="Pipeline health & throughput"
        description="Deep telemetry across the 6 invoice processing stages: Ingest, Preprocess, Read, Validate, Reconcile, and Notify."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <MonitoringSubNav active="pipeline" />

      {/* State Switcher */}
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
        <span className="text-xs text-[#686b86]">
          Selected stage: <strong className="text-[#393d68]">{selectedStage}</strong>
        </span>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={6} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No pipeline events recorded"
          description="Pipeline worker queues have processed zero transactions during this interval."
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
          title="Pipeline cluster data unavailable"
          message="Worker telemetry daemon in ap-south-1 failed to return metrics."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 2. Flow diagram (six connected nodes with edge volume) */}
          <SectionCard
            title="Pipeline stage flow"
            description="Interactive stage topology. Click any stage to inspect latency, throughput, and error graphs."
          >
            <div className="overflow-x-auto pb-2 scrollbar-none">
              <div className="flex min-w-[980px] items-center justify-between gap-2 px-1 py-3">
                {stages.map((stage, idx) => {
                  const isSelected = selectedStage === stage.stage
                  const isDegraded = stage.status === 'degraded'
                  const isDown = stage.status === 'down'
                  const edge = edges.find((e) => e.from === stage.stage)

                  return (
                    <React.Fragment key={stage.stage}>
                      {/* Node Card */}
                      <button
                        type="button"
                        onClick={() => handleSelectStage(stage.stage)}
                        className={`group relative flex w-[150px] shrink-0 flex-col rounded-2xl border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-[#474c80] bg-[#fffef4] shadow-[0_8px_24px_rgba(71,76,128,0.16)] ring-3 ring-[#474c80]/20'
                            : isDegraded
                            ? 'border-[#cf9c50] bg-[#fffef4] shadow-xs ring-2 ring-[#cf9c50]/30 hover:border-[#474c80]'
                            : isDown
                            ? 'border-[#a24650] bg-[#fffef4] shadow-xs ring-2 ring-[#a24650]/30 hover:border-[#474c80]'
                            : 'border-[#dedecb] bg-[#fffef4] shadow-2xs hover:border-[#474c80] hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#393d68] group-hover:text-[#474c80]">
                            {stage.stage}
                          </span>
                          <span
                            className={`size-2.5 rounded-full ${
                              stage.status === 'healthy'
                                ? 'bg-[#378875]'
                                : stage.status === 'degraded'
                                ? 'bg-[#cf9c50] animate-pulse'
                                : 'bg-[#a24650] animate-pulse'
                            }`}
                          />
                        </div>

                        <div className="mt-3">
                          <span className="block text-[10px] text-[#686b86]">Throughput</span>
                          <strong className="text-sm font-bold text-[#393d68]">
                            {stage.throughputPerMin} <span className="text-[10px] font-normal text-[#686b86]">/m</span>
                          </strong>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-[#dedecb]/60 pt-2 text-[10px]">
                          <span className="text-[#686b86]">p95</span>
                          <strong
                            className={`font-mono font-semibold ${
                              isDegraded ? 'text-[#cf9c50]' : isDown ? 'text-[#a24650]' : 'text-[#393d68]'
                            }`}
                          >
                            {stage.p95Ms}ms
                          </strong>
                        </div>

                        {isSelected && (
                          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#474c80] px-2 py-0.5 text-[9px] font-bold text-[#f8f7e2]">
                            Active
                          </span>
                        )}
                      </button>

                      {/* Edge Connector */}
                      {idx < stages.length - 1 && edge && (
                        <div className="flex flex-1 flex-col items-center px-1">
                          <div className="flex items-center gap-1 text-[9px] font-bold text-[#686b86]">
                            <span>{edge.volumePerMin}/m</span>
                          </div>
                          {/* Proportional Edge line */}
                          <div className="my-1 flex w-full items-center">
                            <div
                              className="h-[3px] w-full rounded-full transition-all"
                              style={{
                                backgroundColor:
                                  edge.transferPct < 90 ? '#cf9c50' : '#474c80',
                                opacity: 0.85,
                              }}
                            />
                            <ArrowRight
                              className={`size-3.5 shrink-0 -ml-1 ${
                                edge.transferPct < 90 ? 'text-[#cf9c50]' : 'text-[#474c80]'
                              }`}
                              aria-hidden="true"
                            />
                          </div>
                          <span className="text-[8px] font-semibold text-[#686b86]">
                            {edge.transferPct}% flow
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </SectionCard>

          {/* 3. Stage detail panel (Tabs: Latency, Throughput, Errors, Queue) */}
          <SectionCard
            title={`${selectedStage} stage telemetry`}
            description={`Detailed performance metrics, error distributions, and queue depth for ${activeStageInfo.description}`}
          >
            {/* Header info bar */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#474c80] text-sm font-bold text-[#f8f7e2]">
                  {selectedStage.slice(0, 2)}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#393d68]">{selectedStage} Stage</h3>
                    <StatusBadge status={activeStageInfo.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-[#686b86]">{activeStageInfo.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-center">
                  <span className="block text-[10px] text-[#686b86]">p50 Latency</span>
                  <strong className="font-mono text-sm font-bold text-[#393d68]">
                    {activeStageInfo.p50Ms}ms
                  </strong>
                </div>
                <div className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-center">
                  <span className="block text-[10px] text-[#686b86]">p95 Latency</span>
                  <strong
                    className={`font-mono text-sm font-bold ${
                      activeStageInfo.p95Ms > 3500 ? 'text-[#cf9c50]' : 'text-[#393d68]'
                    }`}
                  >
                    {activeStageInfo.p95Ms}ms
                  </strong>
                </div>
                <div className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-center">
                  <span className="block text-[10px] text-[#686b86]">Queue Depth</span>
                  <strong className="text-sm font-bold text-[#393d68]">
                    {activeStageInfo.queueDepth} files
                  </strong>
                </div>
                <div className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-center">
                  <span className="block text-[10px] text-[#686b86]">Workers</span>
                  <strong className="text-sm font-bold text-[#393d68]">
                    {activeStageInfo.activeWorkers} active
                  </strong>
                </div>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="mb-5 flex items-center gap-1.5 border-b border-[#dedecb] pb-3 text-xs">
              {(['latency', 'throughput', 'errors', 'queue'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`rounded-lg px-3.5 py-1.5 font-semibold capitalize transition ${
                    detailTab === tab
                      ? 'bg-[#474c80] text-[#f8f7e2] shadow-2xs'
                      : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
                  }`}
                >
                  {tab === 'latency'
                    ? 'Latency (p50 / p95)'
                    : tab === 'throughput'
                    ? 'Throughput'
                    : tab === 'errors'
                    ? 'Errors breakdown'
                    : 'Queue depth'}
                </button>
              ))}
            </div>

            {/* Tab Content 1: Latency Chart */}
            {detailTab === 'latency' && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-[#686b86]">
                  <span>Past 24 hours · Median vs p95 percentile (ms)</span>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="size-2 rounded-full bg-[#474c80]" /> p50 latency
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="size-2 rounded-full bg-[#cf9c50]" /> p95 latency
                    </span>
                  </div>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stageTelemetry.timeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                      <XAxis dataKey="time" stroke="#686b86" fontSize={10} tickLine={false} />
                      <YAxis stroke="#686b86" fontSize={10} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#fffef4',
                          borderColor: '#dedecb',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#393d68',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="p50"
                        name="p50 (ms)"
                        stroke="#474c80"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="p95"
                        name="p95 (ms)"
                        stroke="#cf9c50"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tab Content 2: Throughput Chart */}
            {detailTab === 'throughput' && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-[#686b86]">
                  <span>Invoices processed per minute across 24h</span>
                  <span className="font-semibold text-[#474c80]">Current: {activeStageInfo.throughputPerMin} docs/min</span>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stageTelemetry.timeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#474c80" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#474c80" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                      <XAxis dataKey="time" stroke="#686b86" fontSize={10} tickLine={false} />
                      <YAxis stroke="#686b86" fontSize={10} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#fffef4',
                          borderColor: '#dedecb',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#393d68',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="throughput"
                        name="Throughput (/min)"
                        stroke="#474c80"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorThroughput)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tab Content 3: Errors Breakdown */}
            {detailTab === 'errors' && (
              <div>
                <div className="mb-3 text-xs text-[#686b86]">
                  Distribution of failure reasons for {selectedStage} stage
                </div>
                <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="h-[230px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stageTelemetry.errorTypes} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                        <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                        <XAxis type="number" stroke="#686b86" fontSize={10} tickLine={false} />
                        <YAxis type="category" dataKey="errorType" stroke="#686b86" fontSize={10} tickLine={false} width={130} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#fffef4',
                            borderColor: '#dedecb',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#393d68',
                          }}
                        />
                        <Bar dataKey="count" name="Errors" fill="#a24650" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {stageTelemetry.errorTypes.map((item) => (
                      <div
                        key={item.errorType}
                        className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#393d68]">{item.errorType}</span>
                          <span className="font-mono font-bold text-[#a24650]">{item.count} ({item.percentage}%)</span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#686b86]">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 4: Queue Depth Chart */}
            {detailTab === 'queue' && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-[#686b86]">
                  <span>Backlog queue depth over past 24 hours</span>
                  <span className="font-semibold text-[#cf9c50]">Peak: 42 files at 11:00 IST</span>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stageTelemetry.timeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#cf9c50" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#cf9c50" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                      <XAxis dataKey="time" stroke="#686b86" fontSize={10} tickLine={false} />
                      <YAxis stroke="#686b86" fontSize={10} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#fffef4',
                          borderColor: '#dedecb',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#393d68',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="queueDepth"
                        name="Queued Files"
                        stroke="#cf9c50"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorQueue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </SectionCard>

          {/* 4. Latency table (sortable, row click selects stage) */}
          <SectionCard
            title="Stage latency comparison table"
            description="Percentiles, error rates, and queue depth. Click any column to sort; click a row to view stage details."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                    <th scope="col" className="pb-3 pr-4">
                      <button
                        type="button"
                        onClick={() => handleSort('stage')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Stage
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Status
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('p50Ms')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        p50 Latency
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('p95Ms')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        p95 Latency
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('p99Ms')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        p99 Latency
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('errorRatePct')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Error %
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('queueDepth')}
                        className="inline-flex items-center gap-1 hover:text-[#393d68]"
                      >
                        Queue
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th scope="col" className="pb-3 pl-4 text-right">Trend (14d)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/50">
                  {sortedStages.map((stage) => {
                    const isSelected = selectedStage === stage.stage

                    return (
                      <tr
                        key={stage.stage}
                        onClick={() => handleSelectStage(stage.stage)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#f8f7e2]/80 font-medium'
                            : 'hover:bg-[#f8f7e2]/50'
                        }`}
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-[#474c80] text-xs font-bold text-[#f8f7e2]">
                              {stage.stage.slice(0, 1)}
                            </span>
                            <span className="font-bold text-[#393d68]">{stage.stage}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={stage.status} />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#393d68]">
                          {stage.p50Ms}ms
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#393d68]">
                          <span className={stage.p95Ms > 3500 ? 'text-[#cf9c50]' : 'text-[#393d68]'}>
                            {stage.p95Ms}ms
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#393d68]">
                          <span className={stage.p99Ms > 5000 ? 'text-[#a24650]' : 'text-[#393d68]'}>
                            {stage.p99Ms}ms
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`font-semibold ${stage.errorRatePct > 1 ? 'text-[#cf9c50]' : 'text-[#378875]'}`}>
                            {stage.errorRatePct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            stage.queueDepth > 20 ? 'bg-[#cf9c50]/20 text-[#cf9c50]' : 'bg-[#dedecb]/40 text-[#686b86]'
                          }`}>
                            {stage.queueDepth} files
                          </span>
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <Sparkline
                            data={[14, 18, 16, 22, 28, 25, 30, stage.queueDepth]}
                            tone={stage.status === 'degraded' ? 'degraded' : 'healthy'}
                            width={64}
                            height={20}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 5. Failed documents list (with Retry, Open trace, Bulk retry) */}
          <SectionCard
            title="Failed documents"
            description="Invoices interrupted by stage timeouts, format corruption, or validation mismatches."
          >
            {failedDocs.length === 0 ? (
              <EmptyPanel
                title="No failures in this period"
                description="All documents have passed through the pipeline cleanly or have been successfully retried."
                action={
                  <button
                    type="button"
                    onClick={() => setFailedDocs(getFailedDocuments())}
                    className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
                  >
                    Reset failed documents mock
                  </button>
                }
              />
            ) : (
              <div>
                {/* Action bar for bulk operations */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#dedecb] pb-3 text-xs">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 font-semibold text-[#686b86] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.length === failedDocs.length && failedDocs.length > 0}
                        onChange={toggleSelectAllDocs}
                        className="rounded border-[#dedecb] text-[#474c80] focus:ring-[#474c80]"
                      />
                      <span>Select all ({failedDocs.length})</span>
                    </label>
                    {selectedDocIds.length > 0 && (
                      <span className="text-[#393d68] font-bold">
                        {selectedDocIds.length} selected
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowBulkConfirmModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-1.5 text-xs font-bold text-[#f8f7e2] transition hover:bg-[#393d68]"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    <span>
                      Bulk retry {selectedDocIds.length > 0 ? `(${selectedDocIds.length})` : `all (${failedDocs.length})`}
                    </span>
                  </button>
                </div>

                {/* Document Items */}
                <div className="space-y-3">
                  {failedDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id)
                    const isRetrying = retryingIds.includes(doc.id)

                    return (
                      <div
                        key={doc.id}
                        className={`flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-start sm:justify-between ${
                          isSelected ? 'border-[#474c80] bg-[#f8f7e2]/60' : 'border-[#dedecb] bg-[#fffef4]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectDoc(doc.id)}
                            className="mt-1 rounded border-[#dedecb] text-[#474c80] focus:ring-[#474c80]"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#393d68]">
                                {doc.invoiceNumber}
                              </span>
                              <span className="rounded-md border border-[#dedecb] bg-[#f8f7e2] px-2 py-0.5 text-[10px] font-semibold text-[#686b86]">
                                Failed at {doc.stage}
                              </span>
                              <span className="text-[10px] text-[#686b86]">
                                Retries: {doc.retries}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-[#a24650]">{doc.error}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#686b86]">
                              <span>Vendor: <strong className="text-[#393d68]">{doc.vendor}</strong></span>
                              <span>·</span>
                              <span>Amount: <strong>{formatRupees(doc.taxableAmountInr)}</strong></span>
                              <span>·</span>
                              <time>{doc.failedAt}</time>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleRetrySingle(doc.id, doc.invoiceNumber)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] transition hover:bg-[#474c80] hover:text-[#f8f7e2] disabled:opacity-50"
                          >
                            <RefreshCw className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
                            <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                          </button>
                          <a
                            href={`/app/monitoring/traces?invoice=${doc.invoiceNumber}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#dedecb] bg-[#f8f7e2] px-3 py-1.5 text-xs font-semibold text-[#474c80] transition hover:bg-[#dedecb]"
                          >
                            <span>Open trace</span>
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          {/* 6. Capacity card (Worker utilization & queue clearance estimate) */}
          <SectionCard
            title="Pipeline capacity & worker utilization"
            description="Active thread pools, GPU container load, and estimated queue drain projection."
          >
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Utilization bars */}
              <div className="space-y-3.5">
                {capacity.pools.map((pool) => (
                  <div key={pool.name} className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#393d68]">{pool.name}</span>
                      <span className="font-mono text-[#686b86]">
                        {pool.activeUnits} / {pool.totalUnits} {pool.unitType} (
                        <strong className={pool.utilizationPct > 85 ? 'text-[#cf9c50]' : 'text-[#393d68]'}>
                          {pool.utilizationPct}%
                        </strong>
                        )
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dedecb]/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pool.utilizationPct > 85 ? 'bg-[#cf9c50]' : 'bg-[#474c80]'
                        }`}
                        style={{ width: `${pool.utilizationPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Backlog drain estimate */}
              <div className="flex flex-col justify-between rounded-xl border border-[#dedecb] bg-[#474c80] p-5 text-[#f8f7e2]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#d7d8ef]">
                    Backlog drain estimate
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="text-3xl font-bold tracking-tight text-[#f8f7e2]">
                      ~{capacity.estimatedClearMinutes} min
                    </strong>
                    <span className="text-xs text-[#d7d8ef]">to clear all queues</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#f8f7e2]/80">
                    At current pipeline drain throughput of <strong>{capacity.drainRatePerMin} docs/min</strong>, the {capacity.queueBacklog}-file queue backlog will clear within approximately 6 minutes.
                  </p>
                </div>

                <div className="mt-6 border-t border-white/15 pt-4">
                  <div className="flex items-center gap-2 text-xs text-[#d7d8ef]">
                    <Zap className="size-4 shrink-0 text-[#f8f7e2]" aria-hidden="true" />
                    <span>{capacity.autoscalingStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </AppShell>
  )
}
