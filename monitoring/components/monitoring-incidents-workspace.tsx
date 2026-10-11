'use client'

import React, { useState, useMemo } from 'react'
import {
  Flame,
  Clock,
  CheckCircle2,
  AlertOctagon,
  ShieldAlert,
  Sliders,
  Bell,
  Mail,
  Smartphone,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UserCheck,
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
  ExternalLink,
  Lock,
  EyeOff,
  Check,
  X,
  Send,
  RefreshCw,
  HardDrive,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  MonitoringSubNav,
  SkeletonPanel,
  StatusBadge,
  TimeRangeControl,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  getComponentUptimes,
  getActiveIncident,
  getPostmortemIncidents,
  getReliabilityKpis,
  getDefaultMonitoringSettings,
  getMonitoringAccessMembers,
  type ComponentUptimeSummary,
  type ActiveIncidentDetail,
  type PostmortemIncidentItem,
  type ReliabilityKpiSummary,
  type MonitoringSettingsConfig,
  type MonitoringAccessMember,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type IncidentsTab = 'status_incidents' | 'settings'

// Custom Toggle Component matching app palette
function ToggleControl({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div
        className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-hidden ${
          checked ? 'bg-[#378875]' : 'bg-[#dedecb]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div
          className={`size-3.5 bg-[#fffef4] rounded-full transition-transform transform mt-0.75 ml-0.75 shadow-xs ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      {label && <span className="ml-2 text-xs font-semibold text-[#393d68]">{label}</span>}
    </label>
  )
}

export default function MonitoringIncidentsWorkspace() {
  const [activeTab, setActiveTab] = useState<IncidentsTab>('status_incidents')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [uptimes, setUptimes] = useState<ComponentUptimeSummary[]>(getComponentUptimes())
  const [activeIncident, setActiveIncident] = useState<ActiveIncidentDetail | null>(getActiveIncident())
  const [postmortems, setPostmortems] = useState<PostmortemIncidentItem[]>(getPostmortemIncidents())
  const [kpis, setKpis] = useState<ReliabilityKpiSummary>(getReliabilityKpis())
  const [accessMembers, setAccessMembers] = useState<MonitoringAccessMember[]>(getMonitoringAccessMembers())

  // Settings & Dirty Tracking
  const [settings, setSettings] = useState<MonitoringSettingsConfig>(getDefaultMonitoringSettings())
  const [originalSettings, setOriginalSettings] = useState<MonitoringSettingsConfig>(getDefaultMonitoringSettings())
  const isSettingsDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings)
  }, [settings, originalSettings])

  // Filters & Accordions
  const [componentFilter, setComponentFilter] = useState<string>('All')
  const [impactFilter, setImpactFilter] = useState<string>('All')
  const [expandedIncidentIds, setExpandedIncidentIds] = useState<string[]>(['INC-2026-05'])

  // Subscribe Dialog & Toasts
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [subEmail, setSubEmail] = useState('')
  const [subWhatsapp, setSubWhatsapp] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Filtered postmortems
  const filteredPostmortems = useMemo(() => {
    return postmortems.filter((item) => {
      if (componentFilter !== 'All' && item.component !== componentFilter) return false
      if (impactFilter !== 'All' && item.impact !== impactFilter) return false
      return true
    })
  }, [postmortems, componentFilter, impactFilter])

  const toggleIncidentAccordion = (id: string) => {
    setExpandedIncidentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subEmail && !subWhatsapp) return
    showToast(`Subscribed to status broadcasts (${subEmail || subWhatsapp})`)
    setSubscribeOpen(false)
    setSubEmail('')
    setSubWhatsapp('')
  }

  const handleSaveSettings = () => {
    setOriginalSettings({ ...settings })
    showToast('Monitoring configuration saved successfully')
  }

  const handleDiscardSettings = () => {
    setSettings({ ...originalSettings })
    showToast('Settings changes discarded')
  }

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
        title="Incidents, Uptime & System Settings"
        description="Public SLA transparency, active degradation status timelines, postmortems, and configurable telemetry thresholds."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
            <button
              type="button"
              onClick={() => setSubscribeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#393d68] shadow-2xs hover:bg-[#f8f7e2] transition"
            >
              <Bell className="size-3.5 text-[#474c80]" />
              <span>Subscribe to updates</span>
            </button>
          </div>
        }
      />

      <MonitoringSubNav active="incidents" />

      {/* Primary Tab Navigation & State Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-4 py-2.5 shadow-2xs">
        <div className="flex rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('status_incidents')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'status_incidents'
                ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
                : 'text-[#686b86] hover:text-[#393d68]'
            }`}
          >
            <Flame className="size-3.5" />
            <span>Status & incidents</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'settings'
                ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
                : 'text-[#686b86] hover:text-[#393d68]'
            }`}
          >
            <Sliders className="size-3.5" />
            <span>Monitoring settings</span>
          </button>
        </div>

        {/* State Simulator */}
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
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={6} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No incidents recorded"
          description="Folio has maintained 100% uninterrupted uptime with zero degradation events across all components."
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
          title="Incident registry unreachable"
          message="Failed to load incident history and postmortem records from status daemon."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {/* TAB 1: STATUS AND INCIDENTS */}
      {viewMode === 'normal' && activeTab === 'status_incidents' && (
        <div className="space-y-7">
          {/* 1. Active Incident Card (Aligned with "Degraded Read stage" scenario) */}
          {activeIncident && (
            <div className="rounded-3xl border border-[#cf9c50] bg-radial from-[#fffef4] to-[#f8f7e2] p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-3 items-center justify-center">
                    <span className="size-2.5 rounded-full bg-[#cf9c50] animate-ping" />
                  </span>
                  <span className="rounded-full bg-[#cf9c50]/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#cf9c50]">
                    Active Incident · {activeIncident.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#686b86]">{activeIncident.id}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#686b86]">
                  <span>Started: <strong>{activeIncident.startedAt}</strong></span>
                  <span className="text-[#dedecb]">·</span>
                  <span className="text-[#378875] font-semibold">{activeIncident.eta}</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-[#393d68]">{activeIncident.title}</h3>
                <p className="mt-1 text-xs text-[#686b86] leading-relaxed">
                  {activeIncident.currentUpdate}
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-xs text-[#686b86]">
                  <span className="font-bold text-[#393d68]">Affected components:</span>
                  {activeIncident.affectedComponents.map((c) => (
                    <span key={c} className="rounded-md bg-[#fffef4] border border-[#dedecb] px-2 py-0.5 text-[10px] font-bold text-[#474c80]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Live Timeline of Updates */}
              <div className="border-t border-[#dedecb]/60 pt-3 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                  Incident Timeline
                </h4>
                <div className="space-y-2 text-xs">
                  {activeIncident.timeline.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-[#fffef4]/80 p-2.5 border border-[#dedecb]/40">
                      <span className="font-mono text-[11px] text-[#686b86] shrink-0 mt-0.5">
                        {ev.time}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold shrink-0 ${
                          ev.status === 'Resolved'
                            ? 'bg-[#378875]/15 text-[#378875]'
                            : ev.status === 'Monitoring'
                            ? 'bg-[#8b78ae]/15 text-[#474c80]'
                            : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                        }`}
                      >
                        {ev.status}
                      </span>
                      <p className="text-[11px] text-[#393d68]">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. 90-Day Component Uptime Strip */}
          <SectionCard
            title="Component uptime history (Past 90 days)"
            description="Operational availability across daily intervals for all Folio pipeline services."
          >
            <div className="space-y-5 pt-2">
              {uptimes.map((comp) => (
                <div key={comp.component} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#393d68]">{comp.component}</span>
                    <span className="font-mono font-bold text-[#378875]">{comp.uptimePct}%</span>
                  </div>

                  {/* 90 daily bars */}
                  <div className="flex items-center gap-[2px] h-6 overflow-hidden">
                    {comp.days.map((day, idx) => {
                      const barColor =
                        day.status === 'healthy'
                          ? 'bg-[#378875]'
                          : day.status === 'degraded'
                          ? 'bg-[#cf9c50]'
                          : 'bg-[#a24650]'

                      return (
                        <div
                          key={idx}
                          className={`flex-1 h-full rounded-[1px] ${barColor} hover:opacity-75 transition-opacity cursor-pointer`}
                          title={`${day.dateString} (${day.uptimePct}%) - ${day.status.toUpperCase()}${
                            day.incidentTitle ? `: ${day.incidentTitle}` : ''
                          }`}
                        />
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#686b86]">
                    <span>90 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#dedecb]/60 pt-3 text-xs text-[#686b86]">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-[#378875]" /> Operational (100%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-[#cf9c50]" /> Degraded performance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-[#a24650]" /> Partial outage
              </span>
            </div>
          </SectionCard>

          {/* 3. Reliability KPIs Row & Error Budget */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Mean time to detect (MTTD)"
                  value={`${kpis.mttdMinutes} minutes`}
                  note="Telemetry check frequency: 5s"
                  icon={Clock}
                />
                <MetricCard
                  label="Mean time to resolve (MTTR)"
                  value={`${kpis.mttrMinutes} minutes`}
                  note="-22m faster vs prior quarter"
                  icon={CheckCircle2}
                />
                <MetricCard
                  label="Incidents this quarter"
                  value={`${kpis.incidentsThisQuarter} events`}
                  note="1 down · 3 degraded"
                  icon={Flame}
                />
              </div>
            </div>

            {/* Error Budget Burn Bar */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 space-y-3 shadow-2xs h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#393d68]">
                      Error Budget Burn
                    </span>
                    <span className="font-mono text-xs font-bold text-[#378875]">
                      {kpis.errorBudgetRemainingPct}% Left
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#686b86]">
                    Quarterly SLA target: <strong className="text-[#393d68]">{kpis.quarterTargetSla}</strong>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#f8f7e2]">
                    <div
                      className="h-full rounded-full bg-[#378875] transition-all duration-500"
                      style={{ width: `${kpis.errorBudgetRemainingPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#686b86]">
                    <span>Burned: {kpis.errorBudgetBurnPct}%</span>
                    <span>Remaining: {kpis.errorBudgetRemainingPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Incident History & Postmortem Cards */}
          <SectionCard
            title="Incident history & postmortems"
            description="Historical analysis, root cause breakdowns, and permanent architectural remediations."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={componentFilter}
                  onChange={(e) => setComponentFilter(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs font-semibold text-[#393d68]"
                >
                  <option value="All">All components</option>
                  <option value="Reading">Reading</option>
                  <option value="Validation">Validation</option>
                  <option value="Reconciliation">Reconciliation</option>
                </select>
                <select
                  value={impactFilter}
                  onChange={(e) => setImpactFilter(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs font-semibold text-[#393d68]"
                >
                  <option value="All">All impacts</option>
                  <option value="degraded">Degraded</option>
                  <option value="down">Outage</option>
                </select>
              </div>
            }
          >
            <div className="space-y-3.5 pt-1">
              {filteredPostmortems.map((item) => {
                const isExpanded = expandedIncidentIds.includes(item.id)

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#dedecb] bg-[#fffef4] overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => toggleIncidentAccordion(item.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f8f7e2]/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.impact} />
                          <span className="font-mono text-xs font-bold text-[#474c80]">{item.id}</span>
                          <span className="rounded-md bg-[#f8f7e2] px-2 py-0.5 text-[10px] font-bold text-[#686b86]">
                            {item.component}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#393d68]">{item.title}</h4>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-[11px] text-[#686b86]">
                          <div>{item.startedAt}</div>
                          <span className="font-bold text-[#393d68]">Duration: {item.duration}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </div>
                    </button>

                    {/* Expandable Postmortem Card */}
                    {isExpanded && (
                      <div className="border-t border-[#dedecb] p-5 bg-[#f8f7e2]/25 space-y-4 text-xs">
                        <p className="text-[#686b86] leading-relaxed">{item.summary}</p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                            <span className="block text-[10px] font-bold uppercase text-[#686b86]">Invoices Delayed</span>
                            <span className="font-mono text-sm font-bold text-[#393d68]">{item.invoicesDelayed}</span>
                          </div>
                          <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                            <span className="block text-[10px] font-bold uppercase text-[#686b86]">Users Affected</span>
                            <span className="font-mono text-sm font-bold text-[#393d68]">{item.usersAffected}</span>
                          </div>
                          <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                            <span className="block text-[10px] font-bold uppercase text-[#686b86]">Time to Detect</span>
                            <span className="font-mono text-sm font-bold text-[#378875]">{item.timeToDetectMin} min</span>
                          </div>
                          <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3">
                            <span className="block text-[10px] font-bold uppercase text-[#686b86]">Time to Resolve</span>
                            <span className="font-mono text-sm font-bold text-[#474c80]">{item.timeToResolveMin} min</span>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4">
                          <div>
                            <span className="font-bold text-[#393d68]">Root Cause: </span>
                            <span className="text-[#686b86]">{item.rootCause}</span>
                          </div>
                          <div className="border-t border-[#dedecb]/60 pt-2">
                            <span className="font-bold text-[#378875]">What We Changed: </span>
                            <span className="text-[#686b86]">{item.preventiveChanges}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 2: MONITORING SETTINGS */}
      {viewMode === 'normal' && activeTab === 'settings' && (
        <div className="space-y-7 pb-16">
          {/* 1. Metric Thresholds */}
          <SectionCard
            title="Telemetry metric thresholds"
            description="Adjust operational SLAs and alert triggers. Plain-language impact previews are shown in real time."
          >
            <div className="space-y-6 pt-2">
              {/* Latency Limit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#393d68]">Read Stage p95 Latency Limit</span>
                  <span className="font-mono font-bold text-[#474c80]">
                    {(settings.latencyLimitMs / 1000).toFixed(1)}s ({settings.latencyLimitMs}ms)
                  </span>
                </div>
                <input
                  type="range"
                  min={3000}
                  max={20000}
                  step={500}
                  value={settings.latencyLimitMs}
                  onChange={(e) =>
                    setSettings({ ...settings, latencyLimitMs: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#474c80]"
                />
                <p className="text-[11px] text-[#686b86]">
                  <strong>Effect:</strong> Read stage triggers critical alert and marks system Degraded if p95 latency sustains above {(settings.latencyLimitMs / 1000).toFixed(1)}s for &gt;10 min.
                </p>
              </div>

              {/* Error Rate Limit */}
              <div className="space-y-2 border-t border-[#dedecb]/60 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#393d68]">Maximum Pipeline Error Rate</span>
                  <span className="font-mono font-bold text-[#a24650]">
                    {settings.errorRateLimitPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10.0}
                  step={0.5}
                  value={settings.errorRateLimitPct}
                  onChange={(e) =>
                    setSettings({ ...settings, errorRateLimitPct: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#a24650]"
                />
                <p className="text-[11px] text-[#686b86]">
                  <strong>Effect:</strong> Dispatches emergency pager alert if invoice failure rate exceeds {settings.errorRateLimitPct}% over a 15-minute sliding window.
                </p>
              </div>

              {/* Review Queue Age Limit */}
              <div className="space-y-2 border-t border-[#dedecb]/60 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#393d68]">Review Queue Oldest Item Age SLA</span>
                  <span className="font-mono font-bold text-[#cf9c50]">
                    {settings.reviewQueueAgeLimitHours} hours
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={settings.reviewQueueAgeLimitHours}
                  onChange={(e) =>
                    setSettings({ ...settings, reviewQueueAgeLimitHours: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#cf9c50]"
                />
                <p className="text-[11px] text-[#686b86]">
                  <strong>Effect:</strong> Unresolved invoices waiting longer than {settings.reviewQueueAgeLimitHours} hours will escalate to team leads with high-priority status.
                </p>
              </div>

              {/* ITC at Risk Limit */}
              <div className="space-y-2 border-t border-[#dedecb]/60 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#393d68]">ITC-at-Risk Threshold Trigger</span>
                  <span className="font-mono font-bold text-[#393d68]">
                    {formatRupees(settings.itcAtRiskLimitRupees)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={200000}
                  step={5000}
                  value={settings.itcAtRiskLimitRupees}
                  onChange={(e) =>
                    setSettings({ ...settings, itcAtRiskLimitRupees: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#474c80]"
                />
                <p className="text-[11px] text-[#686b86]">
                  <strong>Effect:</strong> Flags filing sentinel banner in amber whenever unreconciled input tax credit exposure breaches {formatRupees(settings.itcAtRiskLimitRupees)}.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* 2. Data Retention Policy */}
          <SectionCard
            title="Data retention & privacy controls"
            description="Statutory log retention settings and Personally Identifiable Information (PII) masking."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4">
                <label className="block font-bold text-[#393d68]">Logs Retention</label>
                <select
                  value={settings.logsRetentionDays}
                  onChange={(e) =>
                    setSettings({ ...settings, logsRetentionDays: parseInt(e.target.value) as any })
                  }
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-2 text-xs font-semibold text-[#393d68]"
                >
                  <option value={30}>30 Days (Standard)</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={365}>365 Days (Annual Audit)</option>
                </select>
                <span className="text-[10px] text-[#686b86]">Raw worker container stdout logs</span>
              </div>

              <div className="space-y-1.5 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4">
                <label className="block font-bold text-[#393d68]">Traces Retention</label>
                <select
                  value={settings.tracesRetentionDays}
                  onChange={(e) =>
                    setSettings({ ...settings, tracesRetentionDays: parseInt(e.target.value) as any })
                  }
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-2 text-xs font-semibold text-[#393d68]"
                >
                  <option value={30}>30 Days (Standard)</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={365}>365 Days (Annual Audit)</option>
                </select>
                <span className="text-[10px] text-[#686b86]">OpenTelemetry waterfall span buffers</span>
              </div>

              <div className="space-y-1.5 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4">
                <label className="block font-bold text-[#393d68]">Metrics Retention</label>
                <select
                  value={settings.metricsRetentionDays}
                  onChange={(e) =>
                    setSettings({ ...settings, metricsRetentionDays: parseInt(e.target.value) as any })
                  }
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-2 text-xs font-semibold text-[#393d68]"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>365 Days (Statutory GST)</option>
                </select>
                <span className="text-[10px] text-[#686b86]">Aggregated hourly & daily KPIs</span>
              </div>
            </div>

            {/* Privacy Toggles */}
            <div className="mt-5 space-y-3 border-t border-[#dedecb]/60 pt-4">
              <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-xs">
                <div>
                  <span className="font-bold text-[#393d68] block">Mask Supplier GSTINs in Log Stream</span>
                  <span className="text-[11px] text-[#686b86]">Replaces characters 3–12 with asterisks (e.g., 27*****1ZM) in public logs.</span>
                </div>
                <ToggleControl
                  checked={settings.maskGstinInLogs}
                  onChange={(val) => setSettings({ ...settings, maskGstinInLogs: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-xs">
                <div>
                  <span className="font-bold text-[#393d68] block">Mask Invoice Amounts in Debug Logs</span>
                  <span className="text-[11px] text-[#686b86]">Hides taxable gross and IGST/CGST figures in developer console.</span>
                </div>
                <ToggleControl
                  checked={settings.maskAmountsInLogs}
                  onChange={(val) => setSettings({ ...settings, maskAmountsInLogs: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 text-xs">
                <div>
                  <span className="font-bold text-[#393d68] block">Exclude Original Scanned Images in Trace Storage</span>
                  <span className="text-[11px] text-[#686b86]">Only store bounding box metadata and OCR tokens to minimize storage tier footprint.</span>
                </div>
                <ToggleControl
                  checked={settings.excludeInvoiceImagesInTraces}
                  onChange={(val) => setSettings({ ...settings, excludeInvoiceImagesInTraces: val })}
                />
              </div>
            </div>
          </SectionCard>

          {/* 3. Access Controls */}
          <SectionCard
            title="Monitoring access permissions"
            description="Manage role-based access for workspace members and external statutory auditors."
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Member Name</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">View Monitoring</th>
                    <th className="py-3 px-3">Acknowledge Alerts</th>
                    <th className="py-3 px-3">Manage Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {accessMembers.map((mem) => (
                    <tr key={mem.id}>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#393d68]">{mem.name}</div>
                        <span className="text-[10px] text-[#686b86]">{mem.email}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="rounded-md bg-[#dedecb]/50 px-2 py-0.5 text-[10px] font-bold text-[#393d68]">
                          {mem.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#378875]">
                          <Check className="size-3.5" /> Allowed
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {mem.acknowledgeAlerts ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#378875]">
                            <Check className="size-3.5" /> Allowed
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#686b86]">Read-only</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {mem.manageRules ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#378875]">
                            <Check className="size-3.5" /> Allowed
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#686b86]">Disabled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Sticky Save Bar (Appears when settings are modified) */}
          {isSettingsDirty && (
            <div className="fixed bottom-6 inset-x-6 sm:inset-x-auto sm:right-6 sm:left-auto z-40 flex items-center justify-between gap-4 rounded-2xl border border-[#474c80] bg-[#fffef4] p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#393d68]">
                <span className="size-2 rounded-full bg-[#cf9c50] animate-pulse" />
                <span>You have unsaved changes to monitoring thresholds.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscardSettings}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-3.5 py-1.5 text-xs font-semibold text-[#393d68] hover:bg-[#dedecb]/40"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="rounded-xl bg-[#474c80] px-4 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBSCRIBE TO UPDATES DIALOG */}
      {subscribeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Subscribe to Status Updates</h3>
                <p className="text-xs text-[#686b86]">Receive SMS or email broadcasts when pipeline components degrade.</p>
              </div>
              <button
                type="button"
                onClick={() => setSubscribeOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubscribe} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Email Address</label>
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="finance-lead@company.in"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">WhatsApp Number (Optional)</label>
                <input
                  type="tel"
                  value={subWhatsapp}
                  onChange={(e) => setSubWhatsapp(e.target.value)}
                  placeholder="+91 98201 00000"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-3 text-[11px] text-[#686b86]">
                You will only receive major incident updates, resolution notices, and monthly uptime summary reports.
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSubscribeOpen(false)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                >
                  Subscribe Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
