'use client'

import React, { useState, useEffect } from 'react'
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  Flame,
  HelpCircle,
  Inbox,
  Info,
  LayoutDashboard,
  Minus,
  RefreshCw,
  Scale,
  SearchCode,
  UserCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { Status, Severity } from '@/lib/monitoring-data'

export const MONITORING_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', href: '/app/monitoring', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', href: '/app/monitoring/pipeline', icon: Workflow },
  { id: 'extraction', label: 'Extraction', href: '/app/monitoring/extraction', icon: FileSearch },
  { id: 'rules', label: 'Rules', href: '/app/monitoring/rules', icon: Scale },
  { id: 'review', label: 'Review', href: '/app/monitoring/review', icon: UserCheck },
  { id: 'filing', label: 'Filing', href: '/app/monitoring/filing', icon: CalendarClock },
  { id: 'alerts', label: 'Alerts', href: '/app/monitoring/alerts', icon: Bell },
  { id: 'traces', label: 'Traces', href: '/app/monitoring/traces', icon: SearchCode },
  { id: 'incidents', label: 'Incidents', href: '/app/monitoring/incidents', icon: Flame },
] as const

export type MonitoringNavId = (typeof MONITORING_NAV_ITEMS)[number]['id']

export function MonitoringSubNav({ active }: { active: MonitoringNavId | string }) {
  return (
    <nav
      aria-label="Monitoring sub-navigation"
      className="mb-7 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
    >
      {MONITORING_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id || active === item.href

        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
              isActive
                ? 'bg-[#474c80] text-[#f8f7e2] shadow-[0_4px_14px_rgba(57,61,104,0.18)]'
                : 'border border-[#dedecb] bg-[#fffef4] text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

export function StatusBadge({
  status,
  className = '',
}: {
  status: Status
  className?: string
}) {
  switch (status) {
    case 'healthy':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#378875]/25 bg-[#378875]/10 px-2.5 py-1 text-xs font-semibold text-[#378875] ${className}`}
        >
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Healthy</span>
        </span>
      )
    case 'degraded':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#cf9c50]/30 bg-[#cf9c50]/15 px-2.5 py-1 text-xs font-semibold text-[#cf9c50] ${className}`}
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Degraded</span>
        </span>
      )
    case 'down':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#a24650]/30 bg-[#a24650]/15 px-2.5 py-1 text-xs font-semibold text-[#a24650] ${className}`}
        >
          <AlertOctagon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Down</span>
        </span>
      )
    case 'unknown':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#dedecb] bg-[#dedecb]/30 px-2.5 py-1 text-xs font-semibold text-[#686b86] ${className}`}
        >
          <HelpCircle className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Unknown</span>
        </span>
      )
  }
}

export function SeverityPill({
  level,
  className = '',
}: {
  level: Severity
  className?: string
}) {
  switch (level) {
    case 'critical':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-[#a24650]/30 bg-[#a24650]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#a24650] ${className}`}
        >
          <AlertOctagon className="size-3 shrink-0" aria-hidden="true" />
          <span>Critical</span>
        </span>
      )
    case 'high':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-[#a24650]/20 bg-[#a24650]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#a24650] ${className}`}
        >
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          <span>High</span>
        </span>
      )
    case 'medium':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-[#cf9c50]/30 bg-[#cf9c50]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#cf9c50] ${className}`}
        >
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          <span>Medium</span>
        </span>
      )
    case 'low':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-[#8b78ae]/30 bg-[#8b78ae]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#8b78ae] ${className}`}
        >
          <Info className="size-3 shrink-0" aria-hidden="true" />
          <span>Low</span>
        </span>
      )
    case 'info':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-[#474c80]/25 bg-[#474c80]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#474c80] ${className}`}
        >
          <Info className="size-3 shrink-0" aria-hidden="true" />
          <span>Info</span>
        </span>
      )
  }
}

export type TimeRange = '1h' | '24h' | '7d' | '30d'

export function TimeRangeControl({
  value,
  onChange,
  className = '',
}: {
  value: TimeRange
  onChange: (val: TimeRange) => void
  className?: string
}) {
  const options: TimeRange[] = ['1h', '24h', '7d', '30d']

  return (
    <div
      role="group"
      aria-label="Time range selector"
      className={`inline-flex items-center rounded-xl border border-[#dedecb] bg-[#fffef4] p-1 shadow-xs ${className}`}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === option
              ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
              : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function LiveIndicator({ className = '' }: { className?: string }) {
  const [secondsAgo, setSecondsAgo] = useState(4)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener?.('change', handleMotionChange)

    let timer: ReturnType<typeof setInterval> | null = null

    const startTimer = () => {
      if (!timer) {
        timer = setInterval(() => {
          setSecondsAgo((prev) => {
            const simulatedValues = [2, 3, 4, 5, 6]
            const next = simulatedValues[Math.floor(Math.random() * simulatedValues.length)]
            return next
          })
        }, 5000)
      }
    }

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer()
      } else {
        startTimer()
      }
    }

    if (!document.hidden) {
      startTimer()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      mediaQuery.removeEventListener?.('change', handleMotionChange)
    }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border border-[#dedecb] bg-[#fffef4] px-3 py-1 text-xs font-medium text-[#686b86] shadow-xs ${className}`}
    >
      <span className="relative flex size-2">
        {!prefersReducedMotion && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#378875] opacity-75"
            aria-hidden="true"
          />
        )}
        <span
          className="relative inline-flex size-2 rounded-full bg-[#378875]"
          aria-hidden="true"
        />
      </span>
      <span>
        Live <span className="text-[#dedecb]">·</span> updated {secondsAgo}s ago
      </span>
    </div>
  )
}

export function Sparkline({
  data,
  tone = 'indigo',
  width = 80,
  height = 28,
  className = '',
}: {
  data: number[] | { value: number }[]
  tone?: 'healthy' | 'degraded' | 'down' | 'indigo' | 'violet' | 'neutral'
  width?: number | string
  height?: number
  className?: string
}) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const formattedData = React.useMemo(() => {
    return data.map((item, index) => ({
      index,
      value: typeof item === 'number' ? item : item.value,
    }))
  }, [data])

  const strokeColor = React.useMemo(() => {
    switch (tone) {
      case 'healthy':
        return '#378875'
      case 'degraded':
        return '#cf9c50'
      case 'down':
        return '#a24650'
      case 'violet':
        return '#8b78ae'
      case 'neutral':
        return '#686b86'
      case 'indigo':
      default:
        return '#474c80'
    }
  }, [tone])

  const numWidth = typeof width === 'number' ? width : 80

  return (
    <div
      className={`inline-block overflow-hidden ${className}`}
      style={{ width: typeof width === 'number' ? `${width}px` : width, height: `${height}px` }}
      aria-hidden="true"
    >
      {mounted ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: numWidth, height }}
        >
          <LineChart data={formattedData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  )
}

export function TrendDelta({
  value,
  goodWhen = 'up',
  suffix = '%',
  className = '',
}: {
  value: number
  goodWhen: 'up' | 'down' | 'flat'
  suffix?: string
  className?: string
}) {
  const isUp = value > 0
  const isDown = value < 0
  const isFlat = value === 0

  let isGood = false
  if (isUp && goodWhen === 'up') isGood = true
  if (isDown && goodWhen === 'down') isGood = true
  if (isFlat && goodWhen === 'flat') isGood = true

  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus

  const toneClass = isFlat
    ? 'border-[#dedecb] bg-[#dedecb]/20 text-[#686b86]'
    : isGood
    ? 'border-[#378875]/25 bg-[#378875]/10 text-[#378875]'
    : 'border-[#a24650]/25 bg-[#a24650]/10 text-[#a24650]'

  const sign = isUp ? '+' : ''

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${toneClass} ${className}`}
      aria-label={`${isGood ? 'Positive trend' : isFlat ? 'Neutral trend' : 'Negative trend'}: ${sign}${value}${suffix}`}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>
        {sign}
        {value}
        {suffix}
      </span>
    </span>
  )
}

export function EmptyPanel({
  title = 'No records found',
  description = 'There is currently no telemetry or data recorded for this view.',
  action,
  icon: Icon = Inbox,
  className = '',
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedecb] bg-[#fffef4] px-6 py-12 text-center shadow-xs ${className}`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f8f7e2] text-[#474c80] shadow-xs">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-[#393d68]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-[#686b86]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SkeletonPanel({
  rows = 4,
  className = '',
}: {
  rows?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      className={`space-y-4 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="h-6 w-1/3 animate-pulse rounded-lg bg-[#dedecb]/60" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-[#dedecb]/60" />
      </div>
      <div className="h-4 w-2/3 animate-pulse rounded-md bg-[#dedecb]/40" />
      <div className="pt-2 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-xl border border-[#dedecb]/40 bg-[#f8f7e2]/50 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 animate-pulse rounded-lg bg-[#dedecb]/70" />
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-[#dedecb]/60" />
                <div className="h-3 w-48 animate-pulse rounded bg-[#dedecb]/40" />
              </div>
            </div>
            <div className="h-5 w-16 animate-pulse rounded bg-[#dedecb]/50" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ErrorPanel({
  title = 'Failed to load telemetry',
  message = 'An unexpected error occurred while fetching real-time monitoring metrics.',
  onRetry,
  className = '',
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-[#a24650]/30 bg-[#fffef4] p-6 shadow-xs ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#a24650]/30 bg-[#a24650]/10 text-[#a24650]">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#393d68]">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-[#686b86]">{message}</p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#474c80] px-4 py-2.5 text-xs font-bold text-[#f8f7e2] transition hover:bg-[#393d68] shadow-xs"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  )
}
