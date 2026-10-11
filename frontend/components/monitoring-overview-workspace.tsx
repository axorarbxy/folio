'use client'

import React, { useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck2,
  FileSearch,
  FileText,
  Info,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { AppShell, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
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
  getStagesHealth,
  getAlerts,
  getSystemBannerInfo,
  getAITrustScorecard,
  getFilingWatchInfo,
  getRecentActivityEvents,
  getOverviewKPIs,
  type AlertItem,
  type StageHealth,
} from '@/lib/monitoring-data'

type BannerStateMode = 'operational' | 'degraded' | 'outage'
type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

interface ToastNotice {
  id: string
  message: string
}

function GaugeMeter({
  value,
  max = 100,
  strokeColor,
  size = 96,
}: {
  value: number
  max?: number
  strokeColor: string
  size?: number
}) {
  const strokeWidth = 7
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const clampedValue = Math.min(Math.max(value, 0), max)
  const offset = circumference - (clampedValue / max) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#dedecb"
          strokeWidth={strokeWidth}
          fill="none"
          className="opacity-40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold tracking-tight text-[#393d68]">
          {value}%
        </span>
      </div>
    </div>
  )
}

export default function MonitoringOverviewWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [bannerMode, setBannerMode] = useState<BannerStateMode>('degraded')
  const [alertsState, setAlertsState] = useState<AlertItem[]>(() => getAlerts())
  const [toasts, setToasts] = useState<ToastNotice[]>([])

  // Derived mock data that updates consistently with bannerMode
  const bannerInfo = getSystemBannerInfo(bannerMode)
  const stages: StageHealth[] = getStagesHealth(bannerMode)
  const kpis = getOverviewKPIs()
  const trustScorecard = getAITrustScorecard()
  const filingWatch = getFilingWatchInfo()
  const activityEvents = getRecentActivityEvents()

  const topAlerts = alertsState.slice(0, 5)

  function acknowledgeAlert(alertId: string) {
    setAlertsState((prev) =>
      prev.map((item) => (item.id === alertId ? { ...item, status: 'acknowledged' } : item))
    )

    const notice: ToastNotice = {
      id: `${alertId}-${Date.now()}`,
      message: `Alert ${alertId} acknowledged`,
    }

    setToasts((prev) => [...prev, notice])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== notice.id))
    }, 3500)
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
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
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="ml-2 rounded p-1 text-[#f8f7e2]/70 hover:text-white"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {/* 1. PageHeading */}
      <PageHeading
        eyebrow="Monitoring"
        title="Workspace health"
        description="Pipeline, AI quality, and filing readiness at a glance."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <MonitoringSubNav active="overview" />

      {/* State Simulator (dev-only inspector for normal, skeleton, empty, error) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#686b86]">
          <span>View state:</span>
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
        <span className="text-xs text-[#686b86]">Folio monitoring telemetry v2.1</span>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={6} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No workspace metrics found"
          description="Folio has not received pipeline activity in the selected interval."
          action={
            <button
              type="button"
              onClick={() => setViewMode('normal')}
              className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
            >
              Reset to active metrics
            </button>
          }
        />
      )}

      {viewMode === 'error' && (
        <ErrorPanel
          title="Telemetry connection interrupted"
          message="Could not stream telemetry data from ingestion broker."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 2. Status Banner (full width) with Dev-only toggle */}
          <div
            className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs transition sm:p-6 ${
              bannerMode === 'operational'
                ? 'border-[#378875]/30 bg-[#378875]/10'
                : bannerMode === 'degraded'
                ? 'border-[#cf9c50]/35 bg-[#cf9c50]/15'
                : 'border-[#a24650]/35 bg-[#a24650]/15'
            }`}
          >
            {/* Small dev-only state toggle in top-right */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    bannerMode === 'operational'
                      ? 'bg-[#378875] text-[#f8f7e2]'
                      : bannerMode === 'degraded'
                      ? 'bg-[#cf9c50] text-[#fffef4]'
                      : 'bg-[#a24650] text-[#fffef4]'
                  }`}
                >
                  {bannerMode === 'operational' ? (
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  ) : bannerMode === 'degraded' ? (
                    <AlertTriangle className="size-5" aria-hidden="true" />
                  ) : (
                    <AlertOctagon className="size-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2
                      className={`text-base font-bold tracking-tight sm:text-lg ${
                        bannerMode === 'operational'
                          ? 'text-[#378875]'
                          : bannerMode === 'degraded'
                          ? 'text-[#cf9c50]'
                          : 'text-[#a24650]'
                      }`}
                    >
                      {bannerInfo.title}
                    </h2>
                    <span className="rounded-full border border-black/10 bg-white/40 px-2 py-0.5 text-[10px] font-medium text-[#686b86]">
                      {bannerInfo.lastChecked}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#393d68]">
                    {bannerInfo.description}
                  </p>
                  {bannerInfo.incidentLink && (
                    <a
                      href={bannerInfo.incidentLink}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-[#393d68] hover:underline"
                    >
                      <span>View incident ({bannerInfo.incidentId})</span>
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>

              {/* Dev-only toggle */}
              <div className="flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-[#dedecb] bg-[#fffef4] p-1 text-[11px] font-semibold text-[#686b86]">
                <span className="px-2 text-[10px] uppercase tracking-wider text-[#686b86]/80">
                  Dev:
                </span>
                {(['operational', 'degraded', 'outage'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBannerMode(mode)}
                    aria-pressed={bannerMode === mode}
                    className={`rounded-lg px-2.5 py-1 capitalize transition ${
                      bannerMode === mode
                        ? mode === 'operational'
                          ? 'bg-[#378875] text-[#f8f7e2]'
                          : mode === 'degraded'
                          ? 'bg-[#cf9c50] text-[#fffef4]'
                          : 'bg-[#a24650] text-[#fffef4]'
                        : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. KPI row (4 MetricCards with embedded sparklines) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: Invoices processed today */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Invoices processed today</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.invoicesProcessedToday.value}
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#686b86]">{kpis.invoicesProcessedToday.note}</p>
                <Sparkline
                  data={kpis.invoicesProcessedToday.sparkline}
                  tone="healthy"
                  width={72}
                  height={22}
                />
              </div>
            </div>

            {/* KPI 2: Median processing time */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Median processing time</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <Clock aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.medianProcessingTime.value}
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#686b86]">{kpis.medianProcessingTime.note}</p>
                <Sparkline
                  data={kpis.medianProcessingTime.sparkline}
                  tone={bannerMode === 'degraded' ? 'degraded' : 'indigo'}
                  width={72}
                  height={22}
                />
              </div>
            </div>

            {/* KPI 3: Auto-accepted rate */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Auto-accepted rate</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.autoAcceptedRate.value}
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#686b86]">{kpis.autoAcceptedRate.note}</p>
                <Sparkline
                  data={kpis.autoAcceptedRate.sparkline}
                  tone="healthy"
                  width={72}
                  height={22}
                />
              </div>
            </div>

            {/* KPI 4: Open alerts */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Open alerts</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <Bell aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {alertsState.filter((a) => a.status === 'open').length} active
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#686b86]">{kpis.openAlerts.note}</p>
                <Sparkline
                  data={kpis.openAlerts.sparkline}
                  tone="degraded"
                  width={72}
                  height={22}
                />
              </div>
            </div>
          </div>

          {/* 4. Pipeline strip: six small stage cards connected by arrows */}
          <SectionCard
            title="Pipeline stages"
            description="Continuous invoice flow across stages. Select any stage to drill down."
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none sm:gap-3">
              {stages.map((stage, idx) => (
                <React.Fragment key={stage.stage}>
                  <a
                    href={`/app/monitoring/pipeline?stage=${stage.stage}`}
                    className="group flex min-w-[170px] flex-1 flex-col justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:border-[#474c80] hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#393d68] group-hover:text-[#474c80]">
                          {stage.stage}
                        </span>
                        <StatusBadge status={stage.status} />
                      </div>
                      <p className="mt-2 text-[10px] text-[#686b86] line-clamp-1">
                        {stage.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#dedecb]/50 pt-2.5 text-[11px]">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-[#686b86]">
                          Throughput
                        </span>
                        <strong className="font-semibold text-[#393d68]">
                          {stage.throughputPerMin}/m
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-[#686b86]">
                          p95 latency
                        </span>
                        <strong
                          className={`font-mono font-semibold ${
                            stage.status === 'degraded'
                              ? 'text-[#cf9c50]'
                              : stage.status === 'down'
                              ? 'text-[#a24650]'
                              : 'text-[#393d68]'
                          }`}
                        >
                          {stage.p95Ms}ms
                        </strong>
                      </div>
                    </div>
                  </a>

                  {idx < stages.length - 1 && (
                    <ArrowRight
                      className="size-4 shrink-0 text-[#dedecb]"
                      aria-hidden="true"
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </SectionCard>

          {/* 5. Two-column grid: AI trust scorecard & Filing watch */}
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            {/* Left: AI trust scorecard */}
            <SectionCard
              title="AI trust scorecard"
              description="OCR accuracy, confidence calibration, and human correction metrics."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Gauge 1: Extraction accuracy */}
                <div className="flex flex-col items-center rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-4 text-center">
                  <GaugeMeter
                    value={trustScorecard.extractionAccuracy.value}
                    strokeColor="#378875"
                  />
                  <h3 className="mt-3 text-xs font-bold text-[#393d68]">Extraction accuracy</h3>
                  <p className="mt-0.5 text-[10px] text-[#686b86]">
                    {trustScorecard.extractionAccuracy.note}
                  </p>
                  <div className="mt-3">
                    <TrendDelta
                      value={trustScorecard.extractionAccuracy.delta7d}
                      goodWhen="up"
                    />
                    <span className="ml-1 text-[10px] text-[#686b86]">vs last 7d</span>
                  </div>
                </div>

                {/* Gauge 2: Confidence calibration */}
                <div className="flex flex-col items-center rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-4 text-center">
                  <GaugeMeter
                    value={trustScorecard.confidenceCalibration.value}
                    strokeColor="#474c80"
                  />
                  <h3 className="mt-3 text-xs font-bold text-[#393d68]">Confidence calibration</h3>
                  <p className="mt-0.5 text-[10px] text-[#686b86]">
                    {trustScorecard.confidenceCalibration.note}
                  </p>
                  <div className="mt-3">
                    <TrendDelta
                      value={trustScorecard.confidenceCalibration.delta7d}
                      goodWhen="up"
                    />
                    <span className="ml-1 text-[10px] text-[#686b86]">vs last 7d</span>
                  </div>
                </div>

                {/* Gauge 3: Human correction rate */}
                <div className="flex flex-col items-center rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-4 text-center">
                  <GaugeMeter
                    value={trustScorecard.humanCorrectionRate.value}
                    max={20}
                    strokeColor="#cf9c50"
                  />
                  <h3 className="mt-3 text-xs font-bold text-[#393d68]">Human correction</h3>
                  <p className="mt-0.5 text-[10px] text-[#686b86]">
                    {trustScorecard.humanCorrectionRate.note}
                  </p>
                  <div className="mt-3">
                    <TrendDelta
                      value={trustScorecard.humanCorrectionRate.delta7d}
                      goodWhen="down"
                    />
                    <span className="ml-1 text-[10px] text-[#686b86]">vs last 7d</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#dedecb] pt-3 text-xs">
                <span className="text-[#686b86]">
                  Vision-LLM OCR evaluated on 1,240 Indian invoice layouts
                </span>
                <a
                  href="/app/monitoring/extraction"
                  className="inline-flex items-center gap-1 font-bold text-[#474c80] hover:text-[#393d68]"
                >
                  View extraction telemetry
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </SectionCard>

            {/* Right: Filing watch card */}
            <SectionCard
              title="Filing watch"
              description={`${filingWatch.period} · ${filingWatch.filingType} deadline sentinel`}
            >
              <div className="space-y-4">
                {/* Countdown banner */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[#dedecb] bg-[#474c80] p-4 text-[#f8f7e2]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#d7d8ef]">
                      Next statutory filing
                    </span>
                    <strong className="mt-0.5 block text-2xl font-bold tracking-tight text-[#f8f7e2]">
                      {filingWatch.daysRemaining} days remaining
                    </strong>
                    <p className="mt-0.5 text-xs text-[#f8f7e2]/80">
                      Due {filingWatch.dueDate} ({filingWatch.filingType})
                    </p>
                  </div>
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#f8f7e2]">
                    <CalendarDays className="size-6" aria-hidden="true" />
                  </span>
                </div>

                {/* ITC Exposure and Readiness */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-3.5">
                    <span className="text-[10px] text-[#686b86]">ITC ready to claim</span>
                    <strong className="mt-1 block text-base font-bold text-[#378875]">
                      {formatRupees(filingWatch.itcClaimableInr)}
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-[#686b86]">
                      {filingWatch.matchedInvoices} invoices matched
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-3.5">
                    <span className="text-[10px] text-[#686b86]">ITC at risk</span>
                    <strong className="mt-1 block text-base font-bold text-[#a24650]">
                      {formatRupees(filingWatch.itcAtRiskInr)}
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-[#a24650]">
                      {filingWatch.unresolvedCount} exceptions pending
                    </span>
                  </div>
                </div>

                {/* Readiness progress */}
                <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#393d68]">Reconciliation readiness</span>
                    <strong className="font-bold text-[#393d68]">{filingWatch.readinessPct}%</strong>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dedecb]/50">
                    <div
                      className="h-full rounded-full bg-[#474c80] transition-all duration-500"
                      style={{ width: `${filingWatch.readinessPct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-[#686b86]">
                    <span>45 of 48 invoices reconciled</span>
                    <span>3 pending match</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#dedecb] pt-3 text-xs">
                <span className="text-[#686b86]">Reconciled against GSTN GSTR-2B feed</span>
                <a
                  href="/app/monitoring/filing"
                  className="inline-flex items-center gap-1 font-bold text-[#474c80] hover:text-[#393d68]"
                >
                  Open filing sentinel
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </SectionCard>
          </div>

          {/* 6. Bottom grid: Active alerts (top 5 with ack button) & Recent activity timeline */}
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            {/* Left: Active alerts */}
            <SectionCard
              title="Active alerts"
              description="Top 5 priority issues requiring operational or finance review."
            >
              <div className="space-y-3">
                {topAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-3.5 transition hover:bg-[#f8f7e2]/70 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityPill level={alert.severity} />
                        <span className="font-mono text-[10px] font-semibold text-[#686b86]">
                          {alert.id}
                        </span>
                        <span className="text-[10px] text-[#686b86]">· {alert.source}</span>
                      </div>
                      <h3 className="mt-1.5 text-xs font-bold text-[#393d68]">{alert.title}</h3>
                      <p className="mt-0.5 text-[11px] leading-4 text-[#686b86]">{alert.detail}</p>
                      {(alert.invoiceId || alert.vendor) && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[#686b86]">
                          {alert.invoiceId && (
                            <span className="font-bold text-[#474c80]">{alert.invoiceId}</span>
                          )}
                          {alert.vendor && <span>· {alert.vendor}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <time className="text-[10px] text-[#686b86]">{alert.firedAt}</time>
                      {alert.status === 'open' ? (
                        <button
                          type="button"
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-[11px] font-semibold text-[#393d68] shadow-2xs transition hover:bg-[#474c80] hover:text-[#f8f7e2]"
                        >
                          <Check className="size-3" aria-hidden="true" />
                          <span>Acknowledge</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#378875]/30 bg-[#378875]/10 px-2 py-0.5 text-[10px] font-semibold text-[#378875]">
                          <Check className="size-2.5" aria-hidden="true" />
                          <span>Acknowledged</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#dedecb] pt-3 text-xs">
                <span className="text-[#686b86]">
                  Showing 5 of {alertsState.length} tracked alerts
                </span>
                <a
                  href="/app/monitoring/alerts"
                  className="inline-flex items-center gap-1 font-bold text-[#474c80] hover:text-[#393d68]"
                >
                  View all alerts
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </SectionCard>

            {/* Right: Recent activity timeline (last 10 events) */}
            <SectionCard
              title="Recent activity"
              description="Chronological log of pipeline, model, and rule engine milestones."
            >
              <div className="relative space-y-4 pl-4 before:absolute before:left-1.5 before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-[#dedecb]">
                {activityEvents.map((evt) => (
                  <div key={evt.id} className="relative flex items-start gap-3">
                    <span className="absolute -left-4 top-1 size-2 rounded-full border-2 border-[#fffef4] bg-[#474c80]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#393d68]">{evt.title}</span>
                        <time className="text-[10px] text-[#686b86]">{evt.timeAgo}</time>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-[#686b86]">{evt.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#dedecb] pt-3 text-xs">
                <span className="text-[#686b86]">Recorded over the past 24 hours</span>
                <a
                  href="/app/monitoring/traces"
                  className="inline-flex items-center gap-1 font-bold text-[#474c80] hover:text-[#393d68]"
                >
                  Explore traces
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </AppShell>
  )
}
