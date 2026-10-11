'use client'

import React, { useState, useMemo } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileSearch,
  Filter,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Plus,
  RefreshCw,
  ScanLine,
  Sliders,
  Sparkles,
  TrendingUp,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import { AppShell, MetricCard, PageHeading, SectionCard } from '@/components/app-shell'
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
  getExtractionKPIs,
  getCalibrationData,
  getConfidenceDistribution,
  getFieldAccuracyData,
  getSegmentBreakdown,
  getDriftNotices,
  getMostCorrectedFields,
  type FieldAccuracyItem,
  type SegmentBreakdownItem,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type SegmentTab = 'source' | 'language' | 'vendor'
type FieldSortMode = 'worst' | 'best'

interface ToastNotice {
  id: string
  message: string
}

export default function MonitoringExtractionWorkspace() {
  const [mounted, setMounted] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [segmentTab, setSegmentTab] = useState<SegmentTab>('source')
  const [fieldSortMode, setFieldSortMode] = useState<FieldSortMode>('worst')
  const [threshold, setThreshold] = useState<number>(85)
  const [toasts, setToasts] = useState<ToastNotice[]>([])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Re-sliced mock data based on time range
  const kpis = useMemo(() => getExtractionKPIs(timeRange), [timeRange])
  const calibrationData = useMemo(() => getCalibrationData(), [])
  const confidenceDistribution = useMemo(() => getConfidenceDistribution(), [])
  const fieldAccuracyRaw = useMemo(() => getFieldAccuracyData(), [])
  const segmentItems = useMemo(() => getSegmentBreakdown(segmentTab), [segmentTab])
  const driftNotices = useMemo(() => getDriftNotices(), [])
  const correctedFields = useMemo(() => getMostCorrectedFields(), [])

  // Dynamic calculation for the confidence review threshold slider
  const { reviewPercentage, estimatedReviewCount } = useMemo(() => {
    // Total fields: 31,700
    const totalFields = 31700
    let belowThresholdPct = 0

    confidenceDistribution.forEach((b) => {
      if (b.maxConfidence <= threshold) {
        belowThresholdPct += b.percentage
      } else if (b.minConfidence < threshold && b.maxConfidence > threshold) {
        const ratio = (threshold - b.minConfidence) / (b.maxConfidence - b.minConfidence)
        belowThresholdPct += b.percentage * ratio
      }
    })

    const finalPct = Number(belowThresholdPct.toFixed(1))
    const count = Math.round((finalPct / 100) * totalFields)

    return {
      reviewPercentage: finalPct,
      estimatedReviewCount: count,
    }
  }, [confidenceDistribution, threshold])

  // Sorted field accuracy data
  const fieldAccuracySorted = useMemo(() => {
    return [...fieldAccuracyRaw].sort((a, b) =>
      fieldSortMode === 'worst' ? a.accuracy - b.accuracy : b.accuracy - a.accuracy
    )
  }, [fieldAccuracyRaw, fieldSortMode])

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

  function handleCreateDriftAlert(noticeId: string, title: string) {
    showToast(`Sentinel alert rule configured for: "${title.slice(0, 42)}..."`)
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

      {/* 1. PageHeading */}
      <PageHeading
        eyebrow="Monitoring"
        title="AI extraction quality"
        description="Confidence calibration, field-level accuracy, and error drift analysis across Indian GST invoices."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <MonitoringSubNav active="extraction" />

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
          Evaluating Vision-LLM v3.2 · Time range: <strong className="text-[#393d68]">{timeRange}</strong>
        </span>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={6} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No extraction telemetry recorded"
          description="There are no OCR field extractions captured during the selected time period."
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
          title="Model quality telemetry unavailable"
          message="Could not stream inference evaluation metrics from Vision-LLM logging cluster."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 2. KPI row (Field accuracy, Auto-accept rate, Human-correction rate, Avg confidence) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: Field accuracy */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Field accuracy</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.fieldAccuracy.value}%
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <TrendDelta value={kpis.fieldAccuracy.delta} goodWhen="up" />
                <Sparkline data={kpis.fieldAccuracy.sparkline} tone="healthy" width={72} height={22} />
              </div>
            </div>

            {/* KPI 2: Auto-accept rate */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Auto-accept rate</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <Zap aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.autoAcceptRate.value}%
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <TrendDelta value={kpis.autoAcceptRate.delta} goodWhen="up" />
                <Sparkline data={kpis.autoAcceptRate.sparkline} tone="healthy" width={72} height={22} />
              </div>
            </div>

            {/* KPI 3: Human-correction rate */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Human-correction rate</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <ScanLine aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.humanCorrectionRate.value}%
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <TrendDelta value={kpis.humanCorrectionRate.delta} goodWhen="down" />
                <Sparkline data={kpis.humanCorrectionRate.sparkline} tone="degraded" width={72} height={22} />
              </div>
            </div>

            {/* KPI 4: Avg confidence */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]">
              <div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#f8f7e2] transition group-hover:scale-125" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#686b86]">Avg model confidence</p>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]">
                  <Sparkles aria-hidden="true" className="size-5" />
                </span>
              </div>
              <strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">
                {kpis.avgConfidence.value}%
              </strong>
              <div className="relative mt-2 flex items-center justify-between gap-2">
                <TrendDelta value={kpis.avgConfidence.delta} goodWhen="up" />
                <Sparkline data={kpis.avgConfidence.sparkline} tone="indigo" width={72} height={22} />
              </div>
            </div>
          </div>

          {/* 3. Hero Calibration Chart (Reliability Diagram) */}
          <SectionCard
            title="Model confidence calibration (Reliability diagram)"
            description="Comparing model-predicted confidence buckets against actual empirical accuracy. A calibrated model tracks the dashed diagonal."
          >
            {/* Dynamic plain-language caption banner */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#474c80] text-[#f8f7e2]">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-[#393d68]">
                    When Folio says 90% sure, it is right about 93.4% of the time.
                  </h3>
                  <p className="mt-0.5 text-xs text-[#686b86]">
                    The model displays slight conservative under-confidence on high-certainty fields—meaning true accuracy safely exceeds model predictions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#393d68]">
                  <span className="size-2.5 rounded-full bg-[#474c80]" /> Folio model curve
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#686b86]">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-[#686b86]" /> Ideal calibration
                </span>
              </div>
            </div>

            {/* Reliability Chart */}
            <div
              className="h-[320px] w-full"
              role="region"
              aria-label="Reliability diagram showing model accuracy vs predicted confidence"
              tabIndex={0}
            >
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 320 }}>
                  <LineChart data={calibrationData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis
                      dataKey="confidence"
                      type="number"
                      domain={[50, 100]}
                      stroke="#686b86"
                      fontSize={11}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[50, 100]}
                      stroke="#686b86"
                      fontSize={11}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#fffef4',
                        borderColor: '#dedecb',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#393d68',
                        boxShadow: '0 8px 24px rgba(57,61,104,0.12)',
                      }}
                      formatter={(val, name, item) => {
                        if (name === 'Actual Accuracy') {
                          return [`${val}% (${item.payload.sampleSize.toLocaleString()} samples)`, 'Actual Accuracy']
                        }
                        return [`${val}%`, 'Ideal Calibration']
                      }}
                      labelFormatter={(label) => `Confidence Bucket: ~${label}%`}
                    />
                    <Line
                      type="monotone"
                      dataKey="idealAccuracy"
                      name="Ideal Diagonal"
                      stroke="#686b86"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actualAccuracy"
                      name="Actual Accuracy"
                      stroke="#474c80"
                      strokeWidth={3}
                      dot={{ fill: '#378875', stroke: '#fffef4', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#474c80' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>
          </SectionCard>

          {/* 4. Confidence distribution with Interactive Review Threshold Slider */}
          <SectionCard
            title="Field confidence distribution & review threshold"
            description="Inspect the spread of model certainty. Adjust the threshold slider to preview how many fields route to human review."
          >
            {/* Interactive Threshold Slider Box */}
            <div className="mb-6 rounded-xl border border-[#dedecb] bg-[#fffef4] p-5 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="size-4 text-[#474c80]" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-[#393d68]">Review cut-off threshold</h3>
                    <span className="rounded-full bg-[#474c80] px-2.5 py-0.5 font-mono text-xs font-bold text-[#f8f7e2]">
                      {threshold}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#686b86]">
                    Fields scoring below {threshold}% confidence trigger mandatory manual review in the review queue.
                  </p>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-right">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-[#686b86]">
                      Routed to review
                    </span>
                    <strong className="text-base font-bold text-[#cf9c50]">
                      {reviewPercentage}%
                    </strong>
                  </div>
                  <div className="border-l border-[#dedecb] pl-4 text-left">
                    <span className="block text-[10px] uppercase tracking-wider text-[#686b86]">
                      Est. daily fields
                    </span>
                    <strong className="text-base font-bold text-[#393d68]">
                      ~{estimatedReviewCount.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Slider control */}
              <div className="mt-4 flex items-center gap-4">
                <span className="text-xs font-semibold text-[#686b86]">70%</span>
                <input
                  type="range"
                  min={70}
                  max={95}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  aria-label="Adjust confidence threshold"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#dedecb] accent-[#474c80]"
                />
                <span className="text-xs font-semibold text-[#686b86]">95%</span>
              </div>
            </div>

            {/* Histogram Chart with Threshold Reference Line */}
            <div
              className="h-[250px] w-full"
              role="region"
              aria-label="Histogram of field confidence distribution"
              tabIndex={0}
            >
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 250 }}>
                  <BarChart data={confidenceDistribution} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis dataKey="range" stroke="#686b86" fontSize={11} tickLine={false} />
                    <YAxis stroke="#686b86" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#fffef4',
                        borderColor: '#dedecb',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#393d68',
                      }}
                      formatter={(val, _, item) => [
                        `${val}% (${item.payload.fieldCount.toLocaleString()} fields)`,
                        'Share of Extractions',
                      ]}
                    />
                    <ReferenceLine
                      x="85-90%"
                      stroke="#a24650"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: `Threshold: ${threshold}%`,
                        fill: '#a24650',
                        fontSize: 10,
                        position: 'top',
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                      {confidenceDistribution.map((entry) => (
                        <Cell
                          key={entry.range}
                          fill={entry.maxConfidence <= threshold ? '#cf9c50' : '#474c80'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>
            <div className="mt-2 flex items-center justify-center gap-6 text-[11px] text-[#686b86]">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#cf9c50]" /> Below threshold (reviewed)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#474c80]" /> Above threshold (auto-accepted)
              </span>
            </div>
          </SectionCard>

          {/* 5. Accuracy by Field (Horizontal Bar Chart with Sort Toggle) */}
          <SectionCard
            title="Extraction accuracy by invoice field"
            description="Field-specific accuracy benchmarks across 31,700 processed invoice fields."
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#dedecb] pb-3 text-xs">
              <span className="text-[#686b86]">9 key GST fields evaluated</span>
              <button
                type="button"
                onClick={() => setFieldSortMode(fieldSortMode === 'worst' ? 'best' : 'worst')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 font-semibold text-[#393d68] transition hover:bg-[#f8f7e2]"
              >
                <ArrowUpDown className="size-3 text-[#474c80]" />
                <span>Sort: {fieldSortMode === 'worst' ? 'Lowest accuracy first' : 'Highest accuracy first'}</span>
              </button>
            </div>

            <div
              className="h-[300px] w-full"
              role="region"
              aria-label="Horizontal bar chart of field accuracy"
              tabIndex={0}
            >
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 300 }}>
                  <BarChart
                    data={fieldAccuracySorted}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid stroke="#dedecb" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis
                      type="number"
                      domain={[85, 100]}
                      stroke="#686b86"
                      fontSize={11}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="field"
                      stroke="#393d68"
                      fontSize={11}
                      fontWeight={600}
                      tickLine={false}
                      width={180}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#fffef4',
                        borderColor: '#dedecb',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#393d68',
                      }}
                      formatter={(val, _, item) => [
                        `${val}% (${item.payload.samplesTested.toLocaleString()} samples)`,
                        'Accuracy',
                      ]}
                    />
                    <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                      {fieldAccuracySorted.map((item) => (
                        <Cell
                          key={item.field}
                          fill={
                            item.accuracy >= 97
                              ? '#378875'
                              : item.accuracy >= 94
                              ? '#474c80'
                              : '#cf9c50'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-6 text-[11px] text-[#686b86]">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#378875]" /> Exceptional (≥97%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#474c80]" /> Strong (94–96.9%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#cf9c50]" /> Attention (&lt;94%)
              </span>
            </div>
          </SectionCard>

          {/* 6. Segment breakdown tabs (By source, By language, By vendor) */}
          <SectionCard
            title="Segment breakdown & performance cohorts"
            description="Dissecting extraction precision across document sources, regional scripts, and vendor formatting."
          >
            {/* Tabs */}
            <div className="mb-4 flex items-center gap-2 border-b border-[#dedecb] pb-3 text-xs">
              <span className="font-semibold text-[#686b86]">Group by:</span>
              {(['source', 'language', 'vendor'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSegmentTab(tab)}
                  className={`rounded-lg px-3.5 py-1.5 font-semibold capitalize transition ${
                    segmentTab === tab
                      ? 'bg-[#474c80] text-[#f8f7e2] shadow-2xs'
                      : 'border border-[#dedecb] bg-[#fffef4] text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
                  }`}
                >
                  {tab === 'source' ? 'By source' : tab === 'language' ? 'By language' : 'By vendor'}
                </button>
              ))}
            </div>

            {/* Segment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                    <th scope="col" className="pb-3 pr-4">Cohort</th>
                    <th scope="col" className="pb-3 px-4">Volume</th>
                    <th scope="col" className="pb-3 px-4">Extraction Accuracy</th>
                    <th scope="col" className="pb-3 px-4">Human Correction Rate</th>
                    <th scope="col" className="pb-3 px-4">7d Trend</th>
                    <th scope="col" className="pb-3 pl-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/50">
                  {segmentItems.map((item) => (
                    <tr
                      key={item.name}
                      className={`transition ${
                        item.isLowPerformer ? 'bg-[#cf9c50]/5 hover:bg-[#cf9c50]/10' : 'hover:bg-[#f8f7e2]/50'
                      }`}
                    >
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-[#393d68]">{item.name}</strong>
                          {item.tag && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                item.isLowPerformer
                                  ? 'bg-[#cf9c50]/20 text-[#cf9c50]'
                                  : 'bg-[#dedecb]/40 text-[#686b86]'
                              }`}
                            >
                              {item.tag}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#393d68]">
                        {item.volume.toLocaleString()} docs
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              item.accuracyPct >= 96
                                ? 'text-[#378875]'
                                : item.accuracyPct >= 90
                                ? 'text-[#393d68]'
                                : 'text-[#a24650]'
                            }`}
                          >
                            {item.accuracyPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#393d68]">
                        <span className={item.correctionRatePct > 10 ? 'text-[#a24650]' : 'text-[#393d68]'}>
                          {item.correctionRatePct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <TrendDelta value={item.trendDelta} goodWhen="up" />
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        {item.isLowPerformer ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#cf9c50]/30 bg-[#cf9c50]/10 px-2 py-0.5 text-[10px] font-bold text-[#cf9c50]">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            <span>Degraded</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#378875]/30 bg-[#378875]/10 px-2 py-0.5 text-[10px] font-bold text-[#378875]">
                            <Check className="size-3" aria-hidden="true" />
                            <span>Optimal</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 7 & 8: Bottom Grid - Drift Watch Card & Most Corrected Fields */}
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            {/* 7. Drift watch card */}
            <SectionCard
              title="Drift watch & distribution shifts"
              description="Automated telemetry detecting shifts in upload resolution, input mix, and unexpected formats."
            >
              <div className="space-y-3.5">
                {driftNotices.map((notice) => (
                  <div
                    key={notice.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4 transition hover:bg-[#f8f7e2] sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityPill level={notice.severity} />
                        <span className="font-mono text-[10px] text-[#686b86]">{notice.id}</span>
                        <time className="text-[10px] text-[#686b86]">· {notice.detectedAt}</time>
                      </div>
                      <h3 className="mt-1.5 text-xs font-bold text-[#393d68]">{notice.title}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-[#686b86]">{notice.detail}</p>
                      <div className="mt-2 text-[10px] font-semibold text-[#474c80]">
                        Impact: {notice.impact}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateDriftAlert(notice.id, notice.title)}
                      className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-[11px] font-bold text-[#474c80] shadow-2xs transition hover:bg-[#474c80] hover:text-[#f8f7e2]"
                    >
                      <Bell className="size-3" aria-hidden="true" />
                      <span>Create alert</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#dedecb] pt-3 text-xs text-[#686b86]">
                <span>Monitored continuous statistical drift window: 14 days</span>
                <span className="font-semibold text-[#378875]">Model weights: Stable</span>
              </div>
            </SectionCard>

            {/* 8. Most corrected fields list with before/after diffs */}
            <SectionCard
              title="Most corrected fields (Human-in-the-loop)"
              description="Recent ground truth corrections made by finance reviewers during invoice verification."
            >
              <div className="space-y-3.5">
                {correctedFields.map((sample) => (
                  <div
                    key={sample.id}
                    className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[#474c80] px-2 py-0.5 text-[10px] font-bold text-[#f8f7e2]">
                          {sample.fieldName}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#393d68]">
                          {sample.invoiceId}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#686b86]">{sample.vendor}</span>
                    </div>

                    {/* Before / After Diff */}
                    <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg border border-[#dedecb]/70 bg-[#f8f7e2]/40 p-2 text-xs">
                      <div>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[#a24650]">
                          Before (Model)
                        </span>
                        <span className="font-mono font-medium text-[#a24650] line-through">
                          {sample.beforeValue}
                        </span>
                      </div>
                      <div className="border-l border-[#dedecb] pl-2">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[#378875]">
                          After (Corrected)
                        </span>
                        <span className="font-mono font-bold text-[#378875]">
                          {sample.afterValue}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#686b86]">
                      <span className="line-clamp-1">{sample.reason}</span>
                      <span className="shrink-0 font-semibold text-[#393d68]">
                        {sample.occurrences} instances
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#dedecb] pt-3 text-xs">
                <span className="text-[#686b86]">Review queue feedback loops automatically into prompt few-shot cache</span>
                <a
                  href="/app/monitoring/review"
                  className="inline-flex items-center gap-1 font-bold text-[#474c80] hover:text-[#393d68]"
                >
                  Inspect review queue
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
