'use client'

import React, { useState, useMemo } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Send,
  Calendar as CalendarIcon,
  List,
  ExternalLink,
  Info,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Mail,
  Phone,
  X,
  FileText,
  Sliders,
  DollarSign,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
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
  getFilingCountdownSummary,
  getDeadlineCalendarEvents,
  getReadinessChecklist,
  getItcRiskTrends,
  getVendorNonFilers,
  type FilingCountdownSummary,
  type DeadlineCalendarEvent,
  type ReadinessChecklistItem,
  type ItcRiskTrendPoint,
  type VendorNonFilerWatchItem,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function MonitoringFilingWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Data states
  const [countdown, setCountdown] = useState<FilingCountdownSummary>(getFilingCountdownSummary())
  const [calendarEvents, setCalendarEvents] = useState<DeadlineCalendarEvent[]>(getDeadlineCalendarEvents())
  const [checklist, setChecklist] = useState<ReadinessChecklistItem[]>(getReadinessChecklist())
  const [itcTrends, setItcTrends] = useState<ItcRiskTrendPoint[]>(getItcRiskTrends())
  const [vendorWatchlist, setVendorWatchlist] = useState<VendorNonFilerWatchItem[]>(getVendorNonFilers())

  // Interactive UI states
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedEventId, setSelectedEventId] = useState<string>('cal-1')
  const [activeVendorReminder, setActiveVendorReminder] = useState<VendorNonFilerWatchItem | null>(null)
  const [reminderNote, setReminderNote] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // What-if simulator state (0 to 100% delinquent vendor defaults)
  const [delinquentVendorMultiplier, setDelinquentVendorMultiplier] = useState<number>(100) // 100% of non-filing watchlist
  const totalWatchlistExposure = useMemo(() => {
    return vendorWatchlist.reduce((acc, v) => acc + v.itcExposureRupees, 0)
  }, [vendorWatchlist])

  const simulatedLoss = useMemo(() => {
    const baseRisk = countdown.itcAtRiskRupees
    const nonFilerImpact = Math.round((totalWatchlistExposure * delinquentVendorMultiplier) / 100)
    return baseRisk + nonFilerImpact
  }, [countdown.itcAtRiskRupees, totalWatchlistExposure, delinquentVendorMultiplier])

  // Selected calendar event detail
  const activeEvent = useMemo(() => {
    return calendarEvents.find((e) => e.id === selectedEventId) || calendarEvents[0]
  }, [calendarEvents, selectedEventId])

  const handleSendReminder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeVendorReminder) return
    setToastMessage(`Filing nudge dispatched to ${activeVendorReminder.vendorName} (${activeVendorReminder.contactEmail})`)
    setActiveVendorReminder(null)
    setReminderNote('')
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Circular progress math
  const readinessRadius = 42
  const circumference = 2 * Math.PI * readinessRadius
  const readinessOffset = circumference - (countdown.readinessPct / 100) * circumference

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
        title="Compliance & Filing Watch"
        description="Turns GST statutory deadlines and ITC clawback risk into something you can monitor ahead of time, not discover too late."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <MonitoringSubNav active="filing" />

      {/* State Switcher & Freshness Indicator */}
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
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#686b86]">
          <span className="font-medium">
            Rules and dates last updated: <strong className="text-[#393d68]">02 Oct 2026</strong>
          </span>
          <span className="text-[#dedecb]">·</span>
          <a
            href="https://services.gst.gov.in"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#474c80] hover:underline"
          >
            <span>Verify on official GST portal</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No filing cycle active"
          description="All monthly statutory filings (GSTR-1, GSTR-2B, GSTR-3B) are reconciled with zero pending exceptions."
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
          title="Filing sentinel telemetry offline"
          message="Could not connect to GSTN statutory filing calendar service or calculate ITC risk trajectory."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 1. Countdown Hero Card */}
          <div className="overflow-hidden rounded-3xl border border-[#dedecb] bg-radial from-[#fffef4] to-[#f8f7e2] p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Left Column: Big Due Date & Subtext */}
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#dedecb] bg-[#fffef4] px-3 py-1 text-xs font-bold text-[#474c80]">
                  <CalendarClock className="size-3.5 text-[#cf9c50]" />
                  <span>Tax Period: {countdown.period}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-[#393d68] tracking-tight">
                  GSTR-3B due in{' '}
                  <span className="text-[#cf9c50]">{countdown.daysUntilGstr3B} days</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#686b86] leading-relaxed">
                  Due on <strong>{countdown.gstr3BDueDate}</strong>. {countdown.gstr2BNote} Ensure all supplier purchase invoices are signed off to claim eligible ITC.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <a
                    href="/app/itc"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
                  >
                    <span>Run ITC Reconciliation</span>
                    <ArrowRight className="size-3.5" />
                  </a>
                  <a
                    href="/app/invoices"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#dedecb] bg-[#fffef4] px-4 py-2 text-xs font-bold text-[#393d68] hover:bg-[#f8f7e2] transition"
                  >
                    <span>Review Purchase Vouchers</span>
                  </a>
                </div>
              </div>

              {/* Right Column: Readiness Ring + ITC At Risk Rupee Callout */}
              <div className="flex flex-wrap items-center gap-6 sm:gap-8 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-5 shadow-2xs">
                {/* Circular Gauge */}
                <div className="flex items-center gap-3.5">
                  <div className="relative flex size-24 items-center justify-center">
                    <svg className="size-24 -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r={readinessRadius}
                        stroke="#dedecb"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={readinessRadius}
                        stroke="#378875"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={readinessOffset}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="font-mono text-xl font-black text-[#393d68]">
                        {countdown.readinessPct}%
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#686b86]">
                        Ready
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                      Filing readiness
                    </span>
                    <div className="text-xs font-semibold text-[#393d68] mt-0.5">
                      45 of 48 vouchers matched
                    </div>
                    <span className="inline-block mt-1 text-[10px] text-[#378875] font-bold">
                      +14% vs last month
                    </span>
                  </div>
                </div>

                <div className="h-12 w-px bg-[#dedecb] hidden sm:block" />

                {/* ITC at Risk Callout */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#686b86] flex items-center gap-1.5">
                    <ShieldAlert className="size-3 text-[#cf9c50]" />
                    ITC at risk
                  </span>
                  <div className="font-mono text-2xl font-black text-[#cf9c50]">
                    {formatRupees(countdown.itcAtRiskRupees)}
                  </div>
                  <div className="text-[11px] text-[#686b86]">
                    Total eligible: <strong className="text-[#393d68] font-mono">{formatRupees(countdown.totalItcRupees)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Deadline Calendar & Readiness Checklist Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Deadline Calendar */}
            <div className="lg:col-span-7">
              <SectionCard
                title="Statutory deadline calendar (October 2026)"
                description="Upcoming statutory filing windows, auto-drafted statement dates, and e-invoicing cutoff points."
                action={
                  <div className="flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-1">
                    <button
                      type="button"
                      onClick={() => setCalendarViewMode('grid')}
                      className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                        calendarViewMode === 'grid'
                          ? 'bg-[#474c80] text-[#f8f7e2]'
                          : 'text-[#686b86] hover:text-[#393d68]'
                      }`}
                    >
                      <CalendarIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarViewMode('list')}
                      className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                        calendarViewMode === 'list'
                          ? 'bg-[#474c80] text-[#f8f7e2]'
                          : 'text-[#686b86] hover:text-[#393d68]'
                      }`}
                    >
                      <List className="size-3.5" />
                    </button>
                  </div>
                }
              >
                {calendarViewMode === 'grid' ? (
                  <div className="space-y-4">
                    {/* Days of week header */}
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-[#686b86]">
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                      <span>Sun</span>
                    </div>

                    {/* October 2026 Calendar Grid (Starts on Thursday Oct 1) */}
                    <div className="grid grid-cols-7 gap-1.5 text-xs">
                      {/* Empty padding for Mon, Tue, Wed */}
                      <div className="h-12 rounded-xl bg-[#f8f7e2]/30 opacity-40" />
                      <div className="h-12 rounded-xl bg-[#f8f7e2]/30 opacity-40" />
                      <div className="h-12 rounded-xl bg-[#f8f7e2]/30 opacity-40" />

                      {/* Days 1 to 31 */}
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                        const event = calendarEvents.find((e) => e.day === day)
                        const isSelected = activeEvent?.day === day
                        const isToday = day === 11 // Mock today: 11 Oct 2026

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => event && setSelectedEventId(event.id)}
                            className={`group relative flex h-12 flex-col justify-between rounded-xl border p-1.5 text-left transition ${
                              event
                                ? isSelected
                                  ? 'border-[#474c80] bg-[#474c80] text-[#f8f7e2] shadow-sm'
                                  : event.status === 'Urgent'
                                  ? 'border-[#cf9c50] bg-[#cf9c50]/15 hover:bg-[#cf9c50]/25'
                                  : 'border-[#474c80]/40 bg-[#f8f7e2] hover:bg-[#fffef4]'
                                : 'border-[#dedecb]/50 bg-[#fffef4] hover:bg-[#f8f7e2]/40 text-[#686b86]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-mono text-xs font-bold ${
                                  isSelected ? 'text-[#f8f7e2]' : isToday ? 'text-[#a24650]' : ''
                                }`}
                              >
                                {day}
                              </span>
                              {isToday && (
                                <span className="size-1.5 rounded-full bg-[#a24650]" title="Today" />
                              )}
                            </div>

                            {event && (
                              <div
                                className={`truncate text-[9px] font-bold ${
                                  isSelected
                                    ? 'text-[#f8f7e2]'
                                    : event.status === 'Urgent'
                                    ? 'text-[#cf9c50]'
                                    : 'text-[#474c80]'
                                }`}
                              >
                                {event.form}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  /* Mobile/List view */
                  <div className="space-y-2.5">
                    {calendarEvents.map((event) => {
                      const isSelected = activeEvent?.id === event.id
                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEventId(event.id)}
                          className={`cursor-pointer flex items-center justify-between rounded-2xl border p-3.5 transition ${
                            isSelected
                              ? 'border-[#474c80] bg-[#f8f7e2]'
                              : 'border-[#dedecb] bg-[#fffef4] hover:bg-[#f8f7e2]/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-[#474c80]">
                              {event.dateString}
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-[#393d68]">{event.title}</h4>
                              <p className="text-[11px] text-[#686b86]">{event.statutoryRule}</p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              event.status === 'Urgent'
                                ? 'bg-[#cf9c50]/20 text-[#cf9c50]'
                                : 'bg-[#474c80]/15 text-[#474c80]'
                            }`}
                          >
                            {event.form}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Selected Date Detail Panel */}
                <div className="mt-5 rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#474c80]">
                          {activeEvent.dateString}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            activeEvent.status === 'Urgent'
                              ? 'bg-[#cf9c50]/20 text-[#cf9c50]'
                              : 'bg-[#474c80]/15 text-[#474c80]'
                          }`}
                        >
                          {activeEvent.form}
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-bold text-[#393d68]">{activeEvent.title}</h4>
                      <p className="mt-1 text-xs text-[#686b86]">{activeEvent.description}</p>
                      <div className="mt-2 text-[10px] text-[#686b86] font-mono">
                        Rule: {activeEvent.statutoryRule}
                      </div>
                    </div>
                    {activeEvent.actionLabel && activeEvent.actionHref && (
                      <a
                        href={activeEvent.actionHref}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                      >
                        <span>{activeEvent.actionLabel}</span>
                        <ArrowRight className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Readiness Checklist */}
            <div className="lg:col-span-5">
              <SectionCard
                title="Filing readiness checklist"
                description="Prerequisite milestones required before final GSTR-3B liability discharge."
              >
                <div className="space-y-3 pt-1">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-3.5 transition hover:border-[#474c80]/40"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5">
                          {item.status === 'done' ? (
                            <CheckCircle2 className="size-4 text-[#378875]" />
                          ) : item.status === 'in_progress' ? (
                            <Clock className="size-4 text-[#cf9c50]" />
                          ) : (
                            <AlertCircle className="size-4 text-[#a24650]" />
                          )}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-[#393d68]">{item.title}</h4>
                          <p className="text-[11px] text-[#686b86]">{item.subtitle}</p>
                          <a
                            href={item.linkHref}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#474c80] hover:underline"
                          >
                            <span>{item.linkText}</span>
                            <ArrowRight className="size-2.5" />
                          </a>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.status === 'done'
                            ? 'bg-[#378875]/15 text-[#378875]'
                            : item.status === 'in_progress'
                            ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                            : 'bg-[#a24650]/15 text-[#a24650]'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* 3. ITC-at-Risk Trend: Line chart & Stacked breakdown */}
          <SectionCard
            title="ITC-at-risk historical trajectory"
            description="Six-period clawback risk trend broken down by reconciliation failure reason: missing in 2B, non-filer, mismatch, or Section 17(5) ineligible."
          >
            <div className="h-68 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={itcTrends} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dedecb" vertical={false} />
                  <XAxis
                    dataKey="period"
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
                    tickFormatter={(val) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fffef4',
                      borderColor: '#dedecb',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#393d68',
                    }}
                    formatter={(val: any) => [formatRupees(Number(val)), '']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    iconType="circle"
                  />
                  <Bar dataKey="missingIn2B" name="Missing in GSTR-2B" stackId="itc" fill="#a24650" />
                  <Bar dataKey="vendorNotFiled" name="Vendor not filed" stackId="itc" fill="#cf9c50" />
                  <Bar dataKey="mismatch" name="Value / Tax mismatch" stackId="itc" fill="#8b78ae" />
                  <Bar dataKey="ineligible" name="Section 17(5) Ineligible" stackId="itc" fill="#474c80" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#dedecb]/60 pt-3 text-xs text-[#686b86]">
              <span>September 2026 peak risk: <strong className="text-[#a24650] font-mono">₹64,500</strong></span>
              <span>Average recovery rate post-vendor reminder: <strong className="text-[#378875]">88.4%</strong></span>
            </div>
          </SectionCard>

          {/* 4. Vendor Non-Filing Watchlist & What-If Simulator */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Vendor Non-filing watchlist */}
            <div className="lg:col-span-8">
              <SectionCard
                title="Vendor non-filing watchlist"
                description="Suppliers who have not uploaded GSTR-1 for the period, leaving your ITC claim in jeopardy under Section 16(2)(aa)."
              >
                <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                        <th className="py-3 px-3">Supplier Name & GSTIN</th>
                        <th className="py-3 px-3">ITC Exposure</th>
                        <th className="py-3 px-3">Days Late</th>
                        <th className="py-3 px-3">Last Contacted</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                      {vendorWatchlist.map((vendor) => (
                        <tr key={vendor.id} className="hover:bg-[#f8f7e2]/40 transition">
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#393d68]">{vendor.vendorName}</div>
                            <span className="font-mono text-[10px] text-[#686b86]">{vendor.gstin}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-[#cf9c50]">
                            {formatRupees(vendor.itcExposureRupees)}
                            <div className="text-[10px] font-normal text-[#686b86]">
                              {vendor.invoicesCount} invoices
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-[#a24650]">{vendor.daysLate} days</span>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-[#686b86] whitespace-nowrap">
                            {vendor.lastContacted}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                vendor.status === 'Reminder sent'
                                  ? 'bg-[#378875]/15 text-[#378875]'
                                  : vendor.status === 'Unresponsive'
                                  ? 'bg-[#a24650]/15 text-[#a24650]'
                                  : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                              }`}
                            >
                              {vendor.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right pr-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveVendorReminder(vendor)
                                setReminderNote(
                                  `Dear Accounts Team at ${vendor.vendorName},\n\nOur purchase register indicates ₹${vendor.itcExposureRupees.toLocaleString('en-IN')} in pending ITC from your invoices. Kindly upload GSTR-1 prior to the 11th Oct statutory cutoff so credits appear in our auto-drafted GSTR-2B.`
                                )
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#474c80] px-2.5 py-1 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                            >
                              <Send className="size-3" />
                              <span>Remind</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            {/* What-If Live Simulator */}
            <div className="lg:col-span-4">
              <SectionCard
                title="What-if projection simulator"
                description="Live tax liability impact if delinquent suppliers fail to file GSTR-1 before statutory locking."
              >
                <div className="space-y-4 pt-1">
                  <div className="rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#393d68]">Vendor default rate by 11th</span>
                      <span className="font-mono text-sm font-bold text-[#a24650]">
                        {delinquentVendorMultiplier}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={delinquentVendorMultiplier}
                      onChange={(e) => setDelinquentVendorMultiplier(parseInt(e.target.value))}
                      className="w-full accent-[#a24650]"
                    />

                    <div className="flex justify-between text-[10px] text-[#686b86]">
                      <span>0% (All file on time)</span>
                      <span>50%</span>
                      <span>100% (Full default)</span>
                    </div>
                  </div>

                  {/* Impact Result Card */}
                  <div className="rounded-2xl border border-[#cf9c50]/50 bg-[#fffef4] p-4 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#686b86]">
                      Projected cash payout / ITC reversal
                    </span>
                    <div className="font-mono text-2xl font-black text-[#a24650]">
                      {formatRupees(simulatedLoss)}
                    </div>
                    <p className="text-[11px] text-[#686b86] leading-relaxed">
                      If {delinquentVendorMultiplier}% of watchlist suppliers miss the filing deadline, you must discharge this amount via cash ledger to avoid Section 50 interest penalties.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Composer Dialog */}
      {activeVendorReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">
                  Send GSTR-1 Filing Reminder
                </h3>
                <p className="text-xs text-[#686b86]">
                  To: {activeVendorReminder.vendorName} ({activeVendorReminder.gstin})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVendorReminder(null)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSendReminder} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#393d68]">
                  Recipient Contact
                </label>
                <div className="flex items-center gap-2 text-xs text-[#686b86]">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3 text-[#474c80]" />
                    {activeVendorReminder.contactEmail}
                  </span>
                  <span className="text-[#dedecb]">·</span>
                  <span className="flex items-center gap-1">
                    <Phone className="size-3 text-[#474c80]" />
                    {activeVendorReminder.contactPhone}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#393d68]">
                  Reminder Message Body
                </label>
                <textarea
                  rows={5}
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  className="w-full rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/40 p-3 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-3 text-[11px] text-[#686b86]">
                Includes automated summary attachment of {activeVendorReminder.invoicesCount} purchase invoices amounting to {formatRupees(activeVendorReminder.itcExposureRupees)}.
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveVendorReminder(null)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
                >
                  <Send className="size-3.5" />
                  <span>Send Reminder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
