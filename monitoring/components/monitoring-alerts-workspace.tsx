'use client'

import React, { useState, useMemo } from 'react'
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Filter,
  Plus,
  Sliders,
  Clock,
  Send,
  MessageSquare,
  Mail,
  Smartphone,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  UserCheck,
  Check,
  X,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  Activity,
  Calendar,
  Search,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { AppShell, MetricCard, PageHeading, SectionCard } from '@/components/app-shell'
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
  getAlertDetailsList,
  getAlertRulesList,
  getNotificationChannels,
  type AlertDetailItem,
  type AlertRuleItem,
  type NotificationChannelStatus,
  type Severity,
} from '@/lib/monitoring-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type ActiveTab = 'inbox' | 'rules'
type GroupByOption = 'none' | 'source' | 'severity'

// Toggle Control Component adhering to palette
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

export default function MonitoringAlertsWorkspace() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('inbox')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [alerts, setAlerts] = useState<AlertDetailItem[]>(getAlertDetailsList())
  const [rules, setRules] = useState<AlertRuleItem[]>(getAlertRulesList())
  const [channels, setChannels] = useState<NotificationChannelStatus[]>(getNotificationChannels())

  // Tab 1: Inbox Filter states
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(['critical', 'high', 'medium', 'low', 'info'])
  const [selectedSources, setSelectedSources] = useState<string[]>(['Pipeline', 'AI quality', 'Rules', 'Review queue', 'Filing', 'Vendors'])
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'acknowledged' | 'snoozed' | 'resolved'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')
  const [selectedAlertId, setSelectedAlertId] = useState<string>('ALT-1092')
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([])

  // Resolve dialog / Snooze popup / Assignee
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolveNote, setResolveNote] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [lastUndoAction, setLastUndoAction] = useState<(() => void) | null>(null)

  // Tab 2: Create Rule Dialog (3-step wizard)
  const [createRuleOpen, setCreateRuleOpen] = useState(false)
  const [ruleStep, setRuleStep] = useState<1 | 2 | 3>(1)
  const [simulatedChannelFail, setSimulatedChannelFail] = useState(false) // dev test toggle
  const [newRuleData, setNewRuleData] = useState({
    metricType: 'latency' as AlertRuleItem['metricType'],
    thresholdValue: 8,
    windowMinutes: 10,
    severity: 'high' as Severity,
    channels: ['in_app', 'email'] as ('in_app' | 'email' | 'whatsapp' | 'sms')[],
  })

  // Toast auto-clear
  const showToast = (msg: string, undoFn?: () => void) => {
    setToastMessage(msg)
    if (undoFn) setLastUndoAction(() => undoFn)
    else setLastUndoAction(null)
    setTimeout(() => {
      setToastMessage(null)
      setLastUndoAction(null)
    }, 4500)
  }

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (!selectedSeverities.includes(a.severity)) return false
      if (!selectedSources.includes(a.source)) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchTitle = a.title.toLowerCase().includes(q)
        const matchDesc = a.description.toLowerCase().includes(q)
        const matchId = a.id.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchId) return false
      }
      return true
    })
  }, [alerts, selectedSeverities, selectedSources, statusFilter, searchQuery])

  // Selected active alert detail
  const activeAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || filteredAlerts[0] || alerts[0]
  }, [alerts, selectedAlertId, filteredAlerts])

  // Multi-select helpers
  const handleSelectAll = () => {
    if (selectedAlertIds.length === filteredAlerts.length) {
      setSelectedAlertIds([])
    } else {
      setSelectedAlertIds(filteredAlerts.map((a) => a.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedAlertIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Alert Actions
  const handleAcknowledge = (targetIds: string[]) => {
    const prevAlerts = [...alerts]
    setAlerts((prev) =>
      prev.map((a) => (targetIds.includes(a.id) ? { ...a, status: 'acknowledged' } : a))
    )
    showToast(`Acknowledged ${targetIds.length} alert(s)`, () => setAlerts(prevAlerts))
    setSelectedAlertIds([])
  }

  const handleSnooze = (targetIds: string[], durationLabel: string) => {
    const prevAlerts = [...alerts]
    setAlerts((prev) =>
      prev.map((a) => (targetIds.includes(a.id) ? { ...a, status: 'snoozed' } : a))
    )
    showToast(`Snoozed ${targetIds.length} alert(s) (${durationLabel})`, () => setAlerts(prevAlerts))
    setSelectedAlertIds([])
  }

  const handleResolve = (targetIds: string[]) => {
    if (!resolveNote.trim()) return
    const prevAlerts = [...alerts]
    setAlerts((prev) =>
      prev.map((a) =>
        targetIds.includes(a.id)
          ? {
              ...a,
              status: 'resolved',
              history: [
                {
                  timestamp: 'Just now',
                  actor: 'Aditi Mehta (Lead Tax Controller)',
                  action: `Resolved: ${resolveNote}`,
                },
                ...a.history,
              ],
            }
          : a
      )
    )
    showToast(`Resolved ${targetIds.length} alert(s)`, () => setAlerts(prevAlerts))
    setResolveDialogOpen(false)
    setResolveNote('')
    setSelectedAlertIds([])
  }

  const handleAssign = (targetIds: string[], assigneeName: string) => {
    const avatar = assigneeName === 'Aditi Mehta' ? 'AM' : assigneeName === 'Rohan Shah' ? 'RS' : 'KN'
    setAlerts((prev) =>
      prev.map((a) =>
        targetIds.includes(a.id)
          ? { ...a, assignee: assigneeName, assigneeAvatar: avatar }
          : a
      )
    )
    showToast(`Assigned ${targetIds.length} alert(s) to ${assigneeName}`)
    setSelectedAlertIds([])
  }

  // Grouped Alerts Rendering
  const groupedAlerts = useMemo(() => {
    if (groupBy === 'none') {
      return [{ groupKey: 'All Alerts', items: filteredAlerts }]
    }
    const map = new Map<string, AlertDetailItem[]>()
    filteredAlerts.forEach((item) => {
      const key = groupBy === 'source' ? item.source : item.severity.toUpperCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    })
    return Array.from(map.entries()).map(([groupKey, items]) => ({ groupKey, items }))
  }, [filteredAlerts, groupBy])

  // Channel Testing
  const handleTestChannel = (channel: NotificationChannelStatus) => {
    if (simulatedChannelFail) {
      showToast(`Test failed: Connection timeout on ${channel.name} gateway`)
    } else {
      showToast(`Test notification successfully sent via ${channel.name} to ${channel.target}`)
    }
  }

  // Live sentence preview for rule wizard
  const ruleSentencePreview = useMemo(() => {
    const chanLabels = newRuleData.channels.map((c) =>
      c === 'in_app' ? 'In-App' : c === 'email' ? 'Email' : c === 'whatsapp' ? 'WhatsApp' : 'SMS'
    ).join(' and ')

    const metricText =
      newRuleData.metricType === 'latency'
        ? `Read stage p95 latency exceeds ${newRuleData.thresholdValue}s`
        : newRuleData.metricType === 'error_rate'
        ? `Document processing error rate exceeds ${newRuleData.thresholdValue}%`
        : newRuleData.metricType === 'confidence_drop'
        ? `Field confidence drops below ${newRuleData.thresholdValue}%`
        : newRuleData.metricType === 'review_queue_age'
        ? `Review queue oldest item exceeds ${newRuleData.thresholdValue} hours`
        : newRuleData.metricType === 'itc_at_risk'
        ? `Unreconciled ITC at risk exceeds ₹${(newRuleData.thresholdValue * 1000).toLocaleString('en-IN')}`
        : `Statutory GSTR-3B deadline is within ${newRuleData.thresholdValue} days`

    return `Alert me via ${chanLabels || 'selected channels'} with ${newRuleData.severity.toUpperCase()} severity when ${metricText} sustained over ${newRuleData.windowMinutes} minutes.`
  }, [newRuleData])

  const handleSaveNewRule = () => {
    const created: AlertRuleItem = {
      id: `RULE-0${rules.length + 1}`,
      name: `Custom ${newRuleData.metricType.replace('_', ' ')} rule`,
      conditionSummary: `${newRuleData.metricType} condition sustained over ${newRuleData.windowMinutes}m`,
      metricType: newRuleData.metricType,
      metricCondition: `Threshold: ${newRuleData.thresholdValue}`,
      windowMinutes: newRuleData.windowMinutes,
      severity: newRuleData.severity,
      channels: newRuleData.channels,
      enabled: true,
      lastFired: 'Never',
      source: 'Pipeline',
    }
    setRules([created, ...rules])
    setCreateRuleOpen(false)
    setRuleStep(1)
    showToast(`Created new alert rule: ${created.name}`)
  }

  return (
    <AppShell active="Monitoring">
      {/* Toast Notification with Undo */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-[#378875]/40 bg-[#378875] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
          {lastUndoAction && (
            <button
              type="button"
              onClick={() => {
                lastUndoAction()
                setToastMessage(null)
              }}
              className="ml-2 inline-flex items-center gap-1 rounded-md bg-[#fffef4] px-2 py-0.5 text-[11px] font-bold text-[#378875] hover:bg-[#f8f7e2]"
            >
              <RotateCcw className="size-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}

      <PageHeading
        eyebrow="Monitoring"
        title="Alerts Center & Signal Rules"
        description="Unified telemetry anomaly inbox, threshold trigger definitions, and multi-channel notification routing."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <MonitoringSubNav active="alerts" />

      {/* Primary Tab Navigation & State Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'inbox'
                  ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
                  : 'text-[#686b86] hover:text-[#393d68]'
              }`}
            >
              <Bell className="size-3.5" />
              <span>Alerts inbox ({alerts.filter((a) => a.status === 'open').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'rules'
                  ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
                  : 'text-[#686b86] hover:text-[#393d68]'
              }`}
            >
              <Sliders className="size-3.5" />
              <span>Alert rules ({rules.length})</span>
            </button>
          </div>

          {/* Dev Test Toggle */}
          {activeTab === 'rules' && (
            <div className="hidden sm:flex items-center gap-2 border-l border-[#dedecb] pl-3 text-xs text-[#686b86]">
              <span>Simulate notification failure:</span>
              <ToggleControl
                checked={simulatedChannelFail}
                onChange={setSimulatedChannelFail}
              />
            </div>
          )}
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
          title="No open alerts"
          description="All systems, validation rules, and filing deadlines are running within statutory thresholds."
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
          title="Alert cluster unreachable"
          message="Could not stream active signals from PagerDuty / CloudWatch notification gateway."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && activeTab === 'inbox' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Critical alerts"
              value={`${alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length} active`}
              note="Read stage p95 latency spike"
              icon={AlertOctagon}
            />
            <MetricCard
              label="High severity"
              value={`${alerts.filter((a) => a.severity === 'high' && a.status === 'open').length} active`}
              note="API rate limits & queue age"
              icon={AlertTriangle}
            />
            <MetricCard
              label="Resolved today"
              value={`${alerts.filter((a) => a.status === 'resolved').length} alerts`}
              note="All cleared under SLA"
              icon={CheckCircle2}
            />
            <MetricCard
              label="Mean time to detect"
              value="18 seconds"
              note="Interval: 5s streaming heartbeat"
              icon={Bell}
            />
          </div>

          {/* Main Inbox Layout: Filter Rail + Alert List + Detail Panel */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Filter Rail */}
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]/60">
                  <span className="text-xs font-black uppercase tracking-wider text-[#393d68] flex items-center gap-1.5">
                    <Filter className="size-3.5 text-[#474c80]" />
                    Filter Rail
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeverities(['critical', 'high', 'medium', 'low', 'info'])
                      setSelectedSources(['Pipeline', 'AI quality', 'Rules', 'Review queue', 'Filing', 'Vendors'])
                      setStatusFilter('all')
                      setSearchQuery('')
                    }}
                    className="text-[10px] font-bold text-[#474c80] hover:underline"
                  >
                    Reset
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#686b86]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search signals..."
                    className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 py-1.5 pl-8 pr-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#686b86]">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                  >
                    <option value="all">All statuses</option>
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="snoozed">Snoozed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                {/* Severity Checkboxes */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#686b86]">Severity</label>
                  <div className="space-y-1 text-xs">
                    {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((sev) => (
                      <label key={sev} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSeverities.includes(sev)}
                          onChange={() => {
                            setSelectedSeverities((prev) =>
                              prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
                            )
                          }}
                          className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                        />
                        <span className="capitalize text-[#393d68] font-medium">{sev}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Source Filter Checkboxes */}
                <div className="space-y-1.5 border-t border-[#dedecb]/60 pt-3">
                  <label className="block text-[11px] font-bold text-[#686b86]">Source Module</label>
                  <div className="space-y-1 text-xs">
                    {['Pipeline', 'AI quality', 'Rules', 'Review queue', 'Filing', 'Vendors'].map((src) => (
                      <label key={src} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSources.includes(src)}
                          onChange={() => {
                            setSelectedSources((prev) =>
                              prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
                            )
                          }}
                          className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                        />
                        <span className="text-[#393d68] font-medium">{src}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Alert List */}
            <div className="lg:col-span-5 space-y-3">
              {/* Controls bar: Group by & Bulk action */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-3.5 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedAlertIds.length > 0 && selectedAlertIds.length === filteredAlerts.length}
                    onChange={handleSelectAll}
                    className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                  />
                  <span className="font-semibold text-[#686b86]">
                    {selectedAlertIds.length > 0
                      ? `${selectedAlertIds.length} selected`
                      : `${filteredAlerts.length} signals`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#686b86]">Group:</span>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as any)}
                    className="rounded-lg border border-[#dedecb] bg-[#f8f7e2]/60 px-2 py-1 text-xs font-semibold text-[#393d68]"
                  >
                    <option value="none">None</option>
                    <option value="source">By Source</option>
                    <option value="severity">By Severity</option>
                  </select>
                </div>
              </div>

              {/* Bulk Action Bar (when selected) */}
              {selectedAlertIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#dedecb] bg-[#474c80] p-2.5 text-xs text-[#f8f7e2] animate-in fade-in">
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(selectedAlertIds)}
                    className="rounded-lg bg-[#393d68] px-2.5 py-1 font-bold hover:bg-[#393d68]/80"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSnooze(selectedAlertIds, '1 hour')}
                    className="rounded-lg bg-[#393d68] px-2.5 py-1 font-bold hover:bg-[#393d68]/80"
                  >
                    Snooze (1h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveDialogOpen(true)}
                    className="rounded-lg bg-[#378875] px-2.5 py-1 font-bold hover:bg-[#378875]/80"
                  >
                    Resolve...
                  </button>
                </div>
              )}

              {/* Alert items list */}
              <div className="space-y-3">
                {groupedAlerts.map(({ groupKey, items }) => (
                  <div key={groupKey} className="space-y-2">
                    {groupBy !== 'none' && (
                      <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                        <span>{groupKey}</span>
                        <span>{items.length} items</span>
                      </div>
                    )}
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#dedecb] bg-[#fffef4] p-6 text-center text-xs text-[#686b86]">
                        No matching alerts in this group.
                      </div>
                    ) : (
                      items.map((alert) => {
                        const isSelected = selectedAlertId === alert.id
                        const isChecked = selectedAlertIds.includes(alert.id)

                        return (
                          <div
                            key={alert.id}
                            onClick={() => setSelectedAlertId(alert.id)}
                            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                              isSelected
                                ? 'border-[#474c80] bg-[#fffef4] shadow-sm'
                                : 'border-[#dedecb] bg-[#fffef4] hover:bg-[#f8f7e2]/50'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleToggleSelect(alert.id)}
                                className="mt-1 rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <SeverityPill level={alert.severity} />
                                    <span className="rounded-md bg-[#f8f7e2] px-1.5 py-0.5 text-[10px] font-bold text-[#686b86]">
                                      {alert.source}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-[#686b86]">{alert.firedAt}</span>
                                </div>

                                <h4 className="mt-1.5 text-xs font-bold text-[#393d68] line-clamp-1">
                                  {alert.title}
                                </h4>

                                <div className="mt-2 flex items-center justify-between text-[11px] text-[#686b86]">
                                  <div className="flex items-center gap-1.5">
                                    {alert.assignee !== 'Unassigned' ? (
                                      <>
                                        <span className="flex size-4 items-center justify-center rounded-full bg-[#474c80] text-[8px] font-bold text-[#f8f7e2]">
                                          {alert.assigneeAvatar}
                                        </span>
                                        <span>{alert.assignee}</span>
                                      </>
                                    ) : (
                                      <span className="text-[#a24650] font-semibold">Unassigned</span>
                                    )}
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                      alert.status === 'open'
                                        ? 'bg-[#a24650]/15 text-[#a24650]'
                                        : alert.status === 'acknowledged'
                                        ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                                        : alert.status === 'snoozed'
                                        ? 'bg-[#8b78ae]/15 text-[#8b78ae]'
                                        : 'bg-[#378875]/15 text-[#378875]'
                                    }`}
                                  >
                                    {alert.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Detail Panel */}
            <div className="lg:col-span-4">
              {activeAlert ? (
                <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-5 space-y-5 shadow-2xs">
                  {/* Header & Status */}
                  <div className="space-y-2 pb-4 border-b border-[#dedecb]/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SeverityPill level={activeAlert.severity} />
                        <span className="font-mono text-xs font-bold text-[#686b86]">{activeAlert.id}</span>
                      </div>
                      <span className="rounded-full border border-[#dedecb] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#393d68]">
                        {activeAlert.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-[#393d68] leading-snug">
                      {activeAlert.title}
                    </h3>
                    <p className="text-xs text-[#686b86] leading-relaxed">
                      {activeAlert.description}
                    </p>
                  </div>

                  {/* Metric Snapshot Mini Chart */}
                  <div className="rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#686b86]">{activeAlert.metricLabel}</span>
                      <span className="font-mono font-bold text-[#a24650]">{activeAlert.metricValue}</span>
                    </div>

                    <div className="h-28 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activeAlert.metricTrend}>
                          <XAxis dataKey="time" stroke="#686b86" fontSize={10} tickLine={false} />
                          <YAxis stroke="#686b86" fontSize={10} tickLine={false} width={28} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fffef4',
                              borderColor: '#dedecb',
                              fontSize: '11px',
                              borderRadius: '8px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#a24650"
                            strokeWidth={2}
                            dot={{ fill: '#a24650', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Suggested Next Steps */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#393d68]">
                      Suggested next steps
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[#686b86]">
                      {activeAlert.suggestedSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ChevronRight className="size-3.5 mt-0.5 shrink-0 text-[#474c80]" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Linked Resource */}
                  {(activeAlert.linkedInvoiceId || activeAlert.linkedStage) && (
                    <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-3 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#686b86] block">Linked Resource</span>
                        <strong className="text-[#393d68] font-mono">
                          {activeAlert.linkedInvoiceId || `${activeAlert.linkedStage} pipeline stage`}
                        </strong>
                      </div>
                      <a
                        href={activeAlert.linkedInvoiceId ? `/app/invoices` : `/app/monitoring/pipeline`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#474c80] px-2.5 py-1 text-[11px] font-bold text-[#f8f7e2] hover:bg-[#393d68]"
                      >
                        <span>View</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 border-t border-[#dedecb]/60 pt-3">
                    <button
                      type="button"
                      onClick={() => handleAcknowledge([activeAlert.id])}
                      className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 py-2 text-xs font-bold text-[#393d68] hover:bg-[#f8f7e2]"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSnooze([activeAlert.id], 'until tomorrow')}
                      className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 py-2 text-xs font-bold text-[#393d68] hover:bg-[#f8f7e2]"
                    >
                      Snooze (24h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolveDialogOpen(true)}
                      className="col-span-2 rounded-xl bg-[#378875] py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#378875]/90 transition"
                    >
                      Resolve Alert
                    </button>
                  </div>

                  {/* Activity History */}
                  <div className="space-y-2 border-t border-[#dedecb]/60 pt-3">
                    <h4 className="text-[11px] font-bold text-[#686b86] uppercase tracking-wider">
                      Activity log
                    </h4>
                    <div className="space-y-2 text-xs">
                      {activeAlert.history.map((h, i) => (
                        <div key={i} className="rounded-lg bg-[#f8f7e2]/30 p-2 text-[11px]">
                          <div className="flex justify-between text-[#686b86]">
                            <span className="font-semibold text-[#393d68]">{h.actor}</span>
                            <span>{h.timestamp}</span>
                          </div>
                          <p className="mt-0.5 text-[#686b86]">{h.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#dedecb] bg-[#fffef4] p-8 text-center text-xs text-[#686b86]">
                  Select an alert to view diagnostics.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALERT RULES & CHANNELS */}
      {viewMode === 'normal' && activeTab === 'rules' && (
        <div className="space-y-7">
          {/* Rules Action Header */}
          <SectionCard
            title="Alert rules directory"
            description="Manage deterministic signal thresholds across pipeline latency, confidence drops, queue limits, and filing deadlines."
            action={
              <button
                type="button"
                onClick={() => setCreateRuleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
              >
                <Plus className="size-3.5" />
                <span>Create alert rule</span>
              </button>
            }
          >
            {/* Rules Table */}
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Rule Name & ID</th>
                    <th className="py-3 px-3">Condition Summary</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Channels</th>
                    <th className="py-3 px-3">Last Fired</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-[#f8f7e2]/40 transition">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <ToggleControl
                          checked={rule.enabled}
                          onChange={(val) => {
                            setRules((prev) =>
                              prev.map((r) => (r.id === rule.id ? { ...r, enabled: val } : r))
                            )
                            showToast(`Rule ${rule.id} ${val ? 'enabled' : 'disabled'}`)
                          }}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#393d68]">{rule.name}</div>
                        <span className="font-mono text-[10px] text-[#686b86]">{rule.id} · {rule.source}</span>
                      </td>
                      <td className="py-3 px-3 font-medium text-[#393d68] max-w-xs">
                        {rule.conditionSummary}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <SeverityPill level={rule.severity} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {rule.channels.map((ch) => (
                            <span
                              key={ch}
                              className="rounded-md bg-[#f8f7e2] px-2 py-0.5 text-[10px] font-bold uppercase text-[#474c80]"
                            >
                              {ch === 'in_app' ? 'App' : ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[#686b86] whitespace-nowrap">
                        {rule.lastFired}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Channels Card */}
          <SectionCard
            title="Notification delivery channels"
            description="Manage external webhook endpoints, email dispatchers, and SMS/WhatsApp alert numbers."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {channels.map((chan) => (
                <div
                  key={chan.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {chan.id === 'in_app' && <Bell className="size-4 text-[#474c80]" />}
                        {chan.id === 'email' && <Mail className="size-4 text-[#474c80]" />}
                        {chan.id === 'whatsapp' && <MessageSquare className="size-4 text-[#378875]" />}
                        {chan.id === 'sms' && <Smartphone className="size-4 text-[#cf9c50]" />}
                        <h4 className="text-xs font-bold text-[#393d68]">{chan.name}</h4>
                      </span>
                      <ToggleControl
                        checked={chan.active}
                        onChange={(val) => {
                          setChannels((prev) =>
                            prev.map((c) => (c.id === chan.id ? { ...c, active: val } : c))
                          )
                          showToast(`${chan.name} ${val ? 'activated' : 'paused'}`)
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-[#686b86] break-words">
                      {chan.target}
                    </p>

                    {/* Quiet Hours */}
                    <div className="mt-3 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 p-2.5 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#393d68]">Quiet hours</span>
                        <ToggleControl
                          checked={chan.quietHoursEnabled}
                          onChange={(val) => {
                            setChannels((prev) =>
                              prev.map((c) => (c.id === chan.id ? { ...c, quietHoursEnabled: val } : c))
                            )
                          }}
                        />
                      </div>
                      {chan.quietHoursEnabled && (
                        <div className="text-[10px] text-[#686b86]">
                          Muted: {chan.quietHoursStart} – {chan.quietHoursEnd}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[#dedecb]/60 pt-3">
                    <button
                      type="button"
                      onClick={() => handleTestChannel(chan)}
                      className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] py-1.5 text-xs font-semibold text-[#393d68] hover:bg-[#f8f7e2] transition"
                    >
                      Test channel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* RESOLVE ALERT MODAL (Note required) */}
      {resolveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <h3 className="text-base font-black text-[#393d68]">Resolve Alert Signal</h3>
              <button
                type="button"
                onClick={() => setResolveDialogOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-[#686b86]">
              A resolution note is required for the statutory audit trail. State the corrective action taken.
            </p>

            <textarea
              rows={4}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="e.g., Scaled GPU inferencing replicas to 8. Queue returned to normal latency."
              className="w-full rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/40 p-3 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResolveDialogOpen(false)}
                className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolveNote.trim()}
                onClick={() =>
                  handleResolve(
                    selectedAlertIds.length > 0 ? selectedAlertIds : [activeAlert.id]
                  )
                }
                className="rounded-xl bg-[#378875] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#378875]/90 transition disabled:opacity-50"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RULE 3-STEP DIALOG */}
      {createRuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Create New Alert Rule</h3>
                <span className="text-xs text-[#686b86]">Step {ruleStep} of 3</span>
              </div>
              <button
                type="button"
                onClick={() => setCreateRuleOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* STEP 1: Pick Metric */}
            {ruleStep === 1 && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-[#393d68]">
                  Select Signal Metric
                </label>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {[
                    { id: 'latency', label: 'Pipeline Latency' },
                    { id: 'error_rate', label: 'Stage Error Rate' },
                    { id: 'confidence_drop', label: 'AI Confidence Drop' },
                    { id: 'review_queue_age', label: 'Review Queue Age' },
                    { id: 'itc_at_risk', label: 'ITC At Risk (₹)' },
                    { id: 'days_to_deadline', label: 'Days to Deadline' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setNewRuleData({ ...newRuleData, metricType: m.id as any })
                      }
                      className={`rounded-xl border p-3 text-left transition font-semibold ${
                        newRuleData.metricType === m.id
                          ? 'border-[#474c80] bg-[#474c80] text-[#f8f7e2]'
                          : 'border-[#dedecb] bg-[#f8f7e2]/40 text-[#393d68] hover:bg-[#f8f7e2]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Condition & Window */}
            {ruleStep === 2 && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-[#393d68]">Threshold Value</label>
                  <input
                    type="number"
                    value={newRuleData.thresholdValue}
                    onChange={(e) =>
                      setNewRuleData({ ...newRuleData, thresholdValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2 text-xs font-mono font-bold text-[#393d68]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-[#393d68]">Evaluation Window</label>
                  <select
                    value={newRuleData.windowMinutes}
                    onChange={(e) =>
                      setNewRuleData({ ...newRuleData, windowMinutes: parseInt(e.target.value) })
                    }
                    className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2 text-xs font-semibold text-[#393d68]"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3: Severity & Channels */}
            {ruleStep === 3 && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-[#393d68]">Severity Level</label>
                  <div className="flex gap-2">
                    {(['critical', 'high', 'medium', 'low'] as Severity[]).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setNewRuleData({ ...newRuleData, severity: sev })}
                        className={`flex-1 rounded-xl border py-1.5 capitalize font-bold transition ${
                          newRuleData.severity === sev
                            ? 'border-[#474c80] bg-[#474c80] text-[#f8f7e2]'
                            : 'border-[#dedecb] bg-[#fffef4] text-[#686b86]'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-[#393d68]">Notification Channels</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'in_app', label: 'In-App Center' },
                      { id: 'email', label: 'Email' },
                      { id: 'whatsapp', label: 'WhatsApp' },
                      { id: 'sms', label: 'SMS' },
                    ].map((ch) => {
                      const active = newRuleData.channels.includes(ch.id as any)
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setNewRuleData({
                              ...newRuleData,
                              channels: active
                                ? newRuleData.channels.filter((c) => c !== ch.id)
                                : [...newRuleData.channels, ch.id as any],
                            })
                          }}
                          className={`rounded-xl border p-2 text-left font-semibold transition ${
                            active
                              ? 'border-[#378875] bg-[#378875]/10 text-[#378875]'
                              : 'border-[#dedecb] bg-[#fffef4] text-[#686b86]'
                          }`}
                        >
                          {ch.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Live Sentence Preview */}
            <div className="rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/60 p-3.5 text-xs text-[#393d68]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#686b86]">
                Rule Summary Preview
              </span>
              <p className="mt-1 font-semibold leading-relaxed">{ruleSentencePreview}</p>
            </div>

            {/* Step navigation buttons */}
            <div className="flex justify-between pt-2 border-t border-[#dedecb]">
              {ruleStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setRuleStep((prev) => (prev - 1) as any)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {ruleStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setRuleStep((prev) => (prev + 1) as any)}
                  className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveNewRule}
                  className="rounded-xl bg-[#378875] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
                >
                  Save & Activate Rule
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
