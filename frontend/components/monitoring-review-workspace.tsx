'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Inbox,
  Clock,
  Timer,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Users,
  Sliders,
  ChevronDown,
  ArrowUpDown,
  Search,
  Filter,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Sparkles,
  RefreshCw,
  X,
  UserPlus,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  MonitoringSubNav,
  SkeletonPanel,
  TimeRangeControl,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  getReviewKPISummary,
  getReviewAgingData,
  getReviewQueueItems,
  getReviewerWorkload,
  getReviewReasonsData,
  getDefaultSlaSettings,
  type ReviewKPISummary,
  type ReviewAgingBucket,
  type ReviewQueueItem,
  type ReviewerWorkloadItem,
  type ReviewReasonItem,
  type SlaSettingsConfig,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function MonitoringReviewWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Data states
  const [kpis, setKpis] = useState<ReviewKPISummary>(getReviewKPISummary())
  const [agingData, setAgingData] = useState<ReviewAgingBucket[]>(getReviewAgingData())
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>(getReviewQueueItems())
  const [reviewers, setReviewers] = useState<ReviewerWorkloadItem[]>(getReviewerWorkload())
  const [reasons, setReasons] = useState<ReviewReasonItem[]>(getReviewReasonsData())
  const [slaSettings, setSlaSettings] = useState<SlaSettingsConfig>(getDefaultSlaSettings())

  // Filters & selection
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'Urgent' | 'High' | 'Medium' | 'Low'>('All')
  const [reasonFilter, setReasonFilter] = useState<string>('All')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All')
  const [breachingSoonOnly, setBreachingSoonOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Drawer / modal states
  const [slaDrawerOpen, setSlaDrawerOpen] = useState(false)
  const [bulkAssignTarget, setBulkAssignTarget] = useState<string>('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Live countdown timer ticker (ticks every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setQueueItems((prev) =>
        prev.map((item) => ({
          ...item,
          secondsLeft: Math.max(0, item.secondsLeft - 1),
        }))
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto clear toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  // Filtered queue items
  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchInvoice = item.invoiceNumber.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
        const matchVendor = item.vendor.toLowerCase().includes(q) || item.vendorGstin.toLowerCase().includes(q)
        const matchReason = item.reason.toLowerCase().includes(q)
        if (!matchInvoice && !matchVendor && !matchReason) return false
      }
      if (priorityFilter !== 'All' && item.priority !== priorityFilter) return false
      if (reasonFilter !== 'All' && item.reasonCategory !== reasonFilter) return false
      if (assigneeFilter !== 'All' && item.assignedTo !== assigneeFilter) return false
      if (breachingSoonOnly && item.secondsLeft > 15 * 60) return false // under 15 min
      return true
    })
  }, [queueItems, searchQuery, priorityFilter, reasonFilter, assigneeFilter, breachingSoonOnly])

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map((item) => item.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Bulk actions
  const handleBulkAssign = (newAssignee: string) => {
    if (!newAssignee || selectedIds.length === 0) return
    const avatar =
      reviewers.find((r) => r.name === newAssignee)?.avatar || '??'

    setQueueItems((prev) =>
      prev.map((item) =>
        selectedIds.includes(item.id)
          ? { ...item, assignedTo: newAssignee, assignedAvatar: avatar }
          : item
      )
    )

    // Update workload open items counts
    setReviewers((prev) =>
      prev.map((r) => {
        if (r.name === newAssignee) {
          return { ...r, openItems: r.openItems + selectedIds.length }
        }
        return r
      })
    )

    setToastMessage(`Assigned ${selectedIds.length} item(s) to ${newAssignee}`)
    setSelectedIds([])
    setBulkAssignTarget('')
  }

  const handleRaisePriority = () => {
    if (selectedIds.length === 0) return
    setQueueItems((prev) =>
      prev.map((item) => {
        if (selectedIds.includes(item.id)) {
          return { ...item, priority: 'Urgent', secondsLeft: Math.min(item.secondsLeft, 12 * 60) }
        }
        return item
      })
    )
    setToastMessage(`Raised priority to Urgent for ${selectedIds.length} item(s)`)
    setSelectedIds([])
  }

  const handleSingleAssign = (itemId: string, newAssignee: string) => {
    const avatar = reviewers.find((r) => r.name === newAssignee)?.avatar || '??'
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, assignedTo: newAssignee, assignedAvatar: avatar }
          : item
      )
    )
    setToastMessage(`Item reassigned to ${newAssignee}`)
  }

  // Helpers for timer display
  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return 'Breached'
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    return `${m}m ${s < 10 ? '0' : ''}${s}s`
  }

  const isCriticalBreach = (seconds: number) => seconds <= 15 * 60 // under 15 min

  return (
    <AppShell active="Monitoring">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#378875]/40 bg-[#378875] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeading
        eyebrow="Monitoring"
        title="Human Review Queue & SLA"
        description="Prevent reviewer bottlenecks, track time-to-review velocity, and keep GST filing deadlines ahead of statutory cutoffs."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
            <button
              type="button"
              onClick={() => setSlaDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#393d68] shadow-2xs hover:bg-[#f8f7e2] transition"
            >
              <Sliders className="size-3.5 text-[#474c80]" />
              <span>SLA Settings</span>
            </button>
          </div>
        }
      />

      <MonitoringSubNav active="review" />

      {/* State Switcher & Queue Alert Banner */}
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
        <div className="flex items-center gap-4 text-xs font-medium text-[#686b86]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#378875] animate-pulse" />
            4 Active Reviewers Online
          </span>
          <span className="hidden sm:inline text-[#dedecb]">|</span>
          <span className="hidden sm:inline">Capacity: 28 max concurrent</span>
        </div>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {/* Empty State with Calm CSS Shapes */}
      {viewMode === 'empty' && (
        <div className="rounded-3xl border border-[#dedecb] bg-[#fffef4] p-12 text-center shadow-xs">
          {/* Calming abstract CSS illustration */}
          <div className="relative mx-auto mb-6 flex size-32 items-center justify-center">
            {/* Geometric layered rings & shapes */}
            <div className="absolute inset-0 rounded-full bg-[#378875]/10 animate-ping opacity-40" />
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#378875]/30 animate-spin" style={{ animationDuration: '24s' }} />
            <div className="absolute inset-4 rounded-3xl rotate-12 bg-[#f8f7e2] border border-[#dedecb]" />
            <div className="absolute inset-4 rounded-3xl -rotate-6 bg-[#378875]/15" />
            <div className="relative z-10 flex size-16 items-center justify-center rounded-2xl bg-[#378875] text-[#f8f7e2] shadow-md">
              <CheckCircle2 className="size-8 stroke-[2.5]" />
            </div>
          </div>
          <h3 className="text-xl font-black text-[#393d68]">Review queue is clear</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#686b86]">
            All flagged invoices have been resolved. Every document passed confidence thresholds or has been signed off by the finance controllers.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('normal')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#474c80] px-4 py-2.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
            >
              <RefreshCw className="size-3.5" />
              Reset to active queue
            </button>
          </div>
        </div>
      )}

      {viewMode === 'error' && (
        <ErrorPanel
          title="Review telemetry unavailable"
          message="Could not load human review queue state or SLA calculation metrics. Background queue worker might be restarting."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 1. KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Items waiting"
              value={`${queueItems.length} invoices`}
              note={`${kpis.highPriorityCount} urgent / high priority`}
              icon={Inbox}
            />
            <MetricCard
              label="Oldest item age"
              value={kpis.oldestItemDisplay}
              note="SLA limit: 4h 00m"
              icon={Clock}
            />
            <MetricCard
              label="Median time to review"
              value={`${kpis.medianTimeToReviewMinutes} min`}
              note="-45s faster than yesterday"
              icon={Timer}
            />
            <MetricCard
              label="SLA breaches today"
              value={`${kpis.slaBreachesToday} item`}
              note="Down from 4 last week"
              icon={AlertTriangle}
            />
          </div>

          {/* 2. Aging Chart & Why Items Land Here Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Aging Chart: Stacked bars of queue items by age bucket */}
            <div className="lg:col-span-7">
              <SectionCard
                title="Queue aging & depth trajectory"
                description="Hourly distribution of waiting invoices across age buckets with target SLA backlog threshold (12 items)."
              >
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="timeBucket"
                        stroke="#686b86"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#dedecb' }}
                      />
                      <YAxis
                        stroke="#686b86"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#dedecb' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fffef4',
                          borderColor: '#dedecb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          fontSize: '12px',
                          color: '#393d68',
                        }}
                      />
                      <ReferenceLine
                        y={12}
                        stroke="#cf9c50"
                        strokeDasharray="4 4"
                        label={{
                          value: 'SLA Capacity (12 items)',
                          position: 'top',
                          fill: '#cf9c50',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      />
                      {/* Stacked bars */}
                      <Bar dataKey="under1h" name="Under 1h" stackId="a" fill="#378875" />
                      <Bar dataKey="oneTo4h" name="1 to 4h" stackId="a" fill="#8b78ae" />
                      <Bar dataKey="fourTo24h" name="4 to 24h" stackId="a" fill="#cf9c50" />
                      <Bar dataKey="over24h" name="Over 24h" stackId="a" fill="#a24650" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#dedecb]/60 pt-3 text-xs text-[#686b86]">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-xs bg-[#378875]" /> &lt; 1 hour
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-xs bg-[#8b78ae]" /> 1 – 4 hours
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-xs bg-[#cf9c50]" /> 4 – 24 hours
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-xs bg-[#a24650]" /> &gt; 24 hours (Breach)
                    </span>
                  </div>
                  <span className="font-semibold text-[#393d68]">Current backlog: {queueItems.length} items</span>
                </div>
              </SectionCard>
            </div>

            {/* Why items land here: Horizontal bar chart */}
            <div className="lg:col-span-5">
              <SectionCard
                title="Why items land here"
                description="Root escalation drivers to guide upstream OCR calibration and prompt tuning."
              >
                <div className="space-y-3.5 pt-1">
                  {reasons.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#393d68] line-clamp-1">{r.reason}</span>
                        <span className="font-mono font-bold text-[#474c80]">{r.count} ({r.percentage}%)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#f8f7e2]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${r.percentage * 2}%`,
                            backgroundColor:
                              r.category === 'Confidence'
                                ? '#474c80'
                                : r.category === 'Rule engine'
                                ? '#8b78ae'
                                : r.category === 'Format'
                                ? '#cf9c50'
                                : '#a24650',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-3 text-xs text-[#686b86]">
                  <p className="font-medium">
                    <strong className="text-[#393d68]">Upstream insight:</strong> 41.2% of escalations stem from OCR confidence below 85% on scanned vendor receipts. Tuning character threshold could cut review volume by ~22%.
                  </p>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* 3. Reviewer Workload Cards (Drag-free dropdown assignment) */}
          <SectionCard
            title="Reviewer workload & capacity"
            description="Team distribution, active handling speeds, correction precision, and current queue saturation."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {reviewers.map((rev) => {
                const loadPct = Math.round((rev.openItems / rev.capacityMax) * 100)
                const isNearCapacity = loadPct >= 80

                return (
                  <div
                    key={rev.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-2xs transition hover:border-[#474c80]/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-9 items-center justify-center rounded-xl bg-[#474c80] text-xs font-bold text-[#f8f7e2]">
                            {rev.avatar}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#393d68]">{rev.name}</h4>
                            <p className="text-[11px] text-[#686b86]">{rev.role}</p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            rev.status === 'Available'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                          }`}
                        >
                          {rev.status}
                        </span>
                      </div>

                      {/* Workload Progress Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#686b86]">Assigned items</span>
                          <span className="text-[#393d68]">
                            {rev.openItems} / {rev.capacityMax} ({loadPct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#f8f7e2]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isNearCapacity ? 'bg-[#cf9c50]' : 'bg-[#378875]'
                            }`}
                            style={{ width: `${Math.min(100, loadPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Velocity Stats */}
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#dedecb]/60 pt-3 text-xs">
                        <div>
                          <span className="block text-[10px] text-[#686b86]">Avg handle time</span>
                          <span className="font-mono font-bold text-[#393d68]">{rev.avgHandlingTimeSec}s / inv</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#686b86]">Accuracy</span>
                          <span className="font-mono font-bold text-[#378875]">{rev.correctionAccuracyPct}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-[#dedecb]/60 pt-3">
                      <label className="block text-[10px] font-bold text-[#686b86] mb-1">
                        Batch assign pending items
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const unassigned = queueItems.find((q) => q.assignedTo === 'Unassigned')
                          if (unassigned) {
                            handleSingleAssign(unassigned.id, rev.name)
                          } else {
                            setToastMessage(`No unassigned items currently in queue`)
                          }
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 py-1.5 text-xs font-semibold text-[#393d68] hover:bg-[#474c80] hover:text-[#f8f7e2] transition"
                      >
                        <UserPlus className="size-3" />
                        <span>Assign Next Item</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* 4. Queue Table with Live Countdown & Bulk Controls */}
          <SectionCard
            title={`Active review queue (${filteredItems.length} items)`}
            description="Prioritized invoice items requiring manual validation before tax liability calculation."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-[#474c80] px-3 py-1.5 text-xs text-[#f8f7e2] shadow-sm animate-in fade-in">
                    <span className="font-bold">{selectedIds.length} selected</span>
                    <button
                      type="button"
                      onClick={handleRaisePriority}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#a24650] px-2 py-0.5 text-[11px] font-bold text-[#f8f7e2] hover:opacity-90"
                    >
                      <Zap className="size-3" />
                      Raise priority
                    </button>
                    <div className="flex items-center gap-1">
                      <select
                        value={bulkAssignTarget}
                        onChange={(e) => {
                          setBulkAssignTarget(e.target.value)
                          handleBulkAssign(e.target.value)
                        }}
                        className="rounded-lg bg-[#393d68] px-2 py-0.5 text-[11px] font-semibold text-[#f8f7e2] focus:outline-hidden"
                      >
                        <option value="">Assign to...</option>
                        {reviewers.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            }
          >
            {/* Table Filters Bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#dedecb]/60 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#686b86]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search invoice, vendor, reason..."
                    className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 py-1.5 pl-8 pr-3 text-xs text-[#393d68] placeholder:text-[#686b86]/70 focus:border-[#474c80] focus:outline-hidden"
                  />
                </div>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="All">All priorities</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                {/* Reason Category Filter */}
                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="All">All reasons</option>
                  <option value="Low confidence">Low confidence</option>
                  <option value="Rule failure">Rule failure</option>
                  <option value="Discrepancy">Discrepancy</option>
                  <option value="Missing doc">Missing doc</option>
                </select>

                {/* Assignee Filter */}
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="All">All assignees</option>
                  {reviewers.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>

              {/* Breaching Soon Toggle */}
              <button
                type="button"
                onClick={() => setBreachingSoonOnly((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  breachingSoonOnly
                    ? 'border-[#a24650] bg-[#a24650] text-[#f8f7e2]'
                    : 'border-[#dedecb] bg-[#fffef4] text-[#a24650] hover:bg-[#a24650]/10'
                }`}
              >
                <ShieldAlert className="size-3.5" />
                <span>Breaching soon (&lt;15m)</span>
              </button>
            </div>

            {/* Queue Table */}
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 pl-4 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredItems.length}
                        onChange={handleSelectAll}
                        className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                      />
                    </th>
                    <th className="py-3 px-3">Invoice / Vendor</th>
                    <th className="py-3 px-3">Escalation Reason</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Age & SLA Countdown</th>
                    <th className="py-3 px-3">Assignee</th>
                    <th className="py-3 px-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#686b86]">
                        No invoices match current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedIds.includes(item.id)
                      const isBreaching = isCriticalBreach(item.secondsLeft)

                      return (
                        <tr
                          key={item.id}
                          className={`transition hover:bg-[#f8f7e2]/40 ${
                            isSelected ? 'bg-[#f8f7e2]/70' : ''
                          } ${isBreaching ? 'bg-[#a24650]/5' : ''}`}
                        >
                          <td className="py-3 pl-4 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item.id)}
                              className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-[#393d68]">{item.invoiceNumber}</div>
                            <div className="text-[11px] text-[#686b86] flex items-center gap-1.5">
                              <span>{item.vendor}</span>
                              <span className="text-[#dedecb]">·</span>
                              <span className="font-mono">{formatRupees(item.amount)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 max-w-[280px]">
                            <span className="line-clamp-2 text-[#393d68] font-medium">
                              {item.reason}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                item.priority === 'Urgent'
                                  ? 'bg-[#a24650]/15 text-[#a24650]'
                                  : item.priority === 'High'
                                  ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                                  : item.priority === 'Medium'
                                  ? 'bg-[#8b78ae]/15 text-[#474c80]'
                                  : 'bg-[#dedecb]/40 text-[#686b86]'
                              }`}
                            >
                              {item.priority === 'Urgent' && <ShieldAlert className="size-2.5" />}
                              {item.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono text-xs font-bold ${
                                  isBreaching
                                    ? 'text-[#a24650] flex items-center gap-1 animate-pulse'
                                    : 'text-[#393d68]'
                                }`}
                              >
                                {isBreaching && <AlertTriangle className="size-3 text-[#a24650]" />}
                                {formatCountdown(item.secondsLeft)}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#686b86]">
                              In queue {Math.floor(item.ageMinutes / 60)}h {item.ageMinutes % 60}m
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {item.assignedTo !== 'Unassigned' ? (
                                <>
                                  <span className="flex size-6 items-center justify-center rounded-lg bg-[#474c80] text-[10px] font-bold text-[#f8f7e2]">
                                    {item.assignedAvatar}
                                  </span>
                                  <span className="text-[#393d68] font-medium">{item.assignedTo}</span>
                                </>
                              ) : (
                                <span className="rounded-md bg-[#dedecb]/50 px-2 py-0.5 text-[10px] font-semibold text-[#686b86]">
                                  Unassigned
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right pr-4 whitespace-nowrap">
                            <a
                              href={`/app/invoices/${item.id}/review`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
                            >
                              <span>Review</span>
                              <ExternalLink className="size-3" />
                            </a>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* 5. SLA Settings Drawer (Local State Only) */}
      {slaDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#fffef4] border-l border-[#dedecb] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#dedecb]">
                <div>
                  <h3 className="text-base font-black text-[#393d68]">SLA Configuration</h3>
                  <p className="text-xs text-[#686b86]">Set turnaround thresholds and breach triggers per priority tier.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSlaDrawerOpen(false)}
                  className="rounded-xl p-1.5 text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {/* Urgent SLA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#a24650] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#a24650]" />
                      Urgent Priority Target
                    </span>
                    <span className="font-mono text-[#393d68] font-bold">{slaSettings.urgentHours} hours</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.5}
                    value={slaSettings.urgentHours}
                    onChange={(e) =>
                      setSlaSettings({ ...slaSettings, urgentHours: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#a24650]"
                  />
                  <p className="text-[11px] text-[#686b86]">Invoices flagged for blocker errors or duplicate collisions.</p>
                </div>

                {/* High SLA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#cf9c50] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#cf9c50]" />
                      High Priority Target
                    </span>
                    <span className="font-mono text-[#393d68] font-bold">{slaSettings.highHours} hours</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    step={1}
                    value={slaSettings.highHours}
                    onChange={(e) =>
                      setSlaSettings({ ...slaSettings, highHours: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#cf9c50]"
                  />
                  <p className="text-[11px] text-[#686b86]">Tax amount or HSN discrepancies requiring rule review.</p>
                </div>

                {/* Medium SLA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#474c80] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#474c80]" />
                      Medium Priority Target
                    </span>
                    <span className="font-mono text-[#393d68] font-bold">{slaSettings.mediumHours} hours</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={24}
                    step={2}
                    value={slaSettings.mediumHours}
                    onChange={(e) =>
                      setSlaSettings({ ...slaSettings, mediumHours: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#474c80]"
                  />
                  <p className="text-[11px] text-[#686b86]">Secondary fields (PO reference, transport mode, remarks).</p>
                </div>

                {/* Breach Warning Window */}
                <div className="space-y-2 border-t border-[#dedecb]/60 pt-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#393d68]">Breach Alert Window (Red highlight)</span>
                    <span className="font-mono text-[#a24650] font-bold">{slaSettings.breachWarningMinutes} min</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={slaSettings.breachWarningMinutes}
                    onChange={(e) =>
                      setSlaSettings({ ...slaSettings, breachWarningMinutes: parseInt(e.target.value) })
                    }
                    className="w-full accent-[#474c80]"
                  />
                  <p className="text-[11px] text-[#686b86]">Triggers pulsating warning when countdown dips below this time.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-[#dedecb] pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSlaDrawerOpen(false)
                  setToastMessage('SLA settings applied for current session')
                }}
                className="flex-1 rounded-xl bg-[#474c80] py-2.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
              >
                Save Preferences
              </button>
              <button
                type="button"
                onClick={() => setSlaSettings(getDefaultSlaSettings())}
                className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2.5 text-xs font-semibold text-[#393d68] hover:bg-[#dedecb]/40"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
