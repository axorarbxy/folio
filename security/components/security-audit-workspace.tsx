'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Search,
  Filter,
  CheckCircle2,
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Download,
  Share2,
  RefreshCw,
  SlidersHorizontal,
  Lock,
  Unlock,
  KeyRound,
  FileText,
  User,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Bookmark,
  Layers,
  Database,
  Calendar,
  Radio,
  Scale,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { AppShell, MetricCard, PageHeading, SectionCard } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  SkeletonPanel,
  StatusBadge,
} from '@/components/monitoring-kit'
import {
  SecuritySubNav,
  DemoDataChip,
  ConfirmDialog,
  MaskedValue,
} from '@/components/security-kit'
import {
  getSecurityAuditEvents,
  getSavedAuditViews,
  getAuditDailyInsights,
  getAuditTopActors,
  getAuditDeniedBreakdown,
  getAuditIntegrityStatus,
  type AuditEvent,
  type AuditActionType,
  type SavedAuditView,
  type AuditDailyInsight,
  type AuditActorStat,
  type AuditDeniedBreakdown,
  type AuditIntegrityStatus,
} from '@/lib/security-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type Density = 'comfortable' | 'compact'
type DateFilter = 'all' | 'today' | '24h' | '7d' | '30d'

export default function SecurityAuditWorkspace() {
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [density, setDensity] = useState<Density>('comfortable')
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [maskAllIps, setMaskAllIps] = useState<boolean>(true)
  const [revealedIps, setRevealedIps] = useState<Record<string, boolean>>({})

  // Datasets
  const [events, setEvents] = useState<AuditEvent[]>(getSecurityAuditEvents())
  const [savedViews, setSavedViews] = useState<SavedAuditView[]>(getSavedAuditViews())
  const [activeViewId, setActiveViewId] = useState<string>('view-all')
  const dailyInsights = useMemo(() => getAuditDailyInsights(), [])
  const topActors = useMemo(() => getAuditTopActors(), [])
  const deniedBreakdown = useMemo(() => getAuditDeniedBreakdown(), [])

  // Collapsible insights
  const [showInsights, setShowInsights] = useState<boolean>(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<string>('all')

  // Sorting
  const [sortField, setSortField] = useState<'at' | 'actor' | 'action' | 'result'>('at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Selected event for detail drawer
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null
  }, [events, selectedEventId])

  // Hash chain verification state
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [verifyProgress, setVerifyProgress] = useState<number>(0)
  const [simulateTampered, setSimulateTampered] = useState<boolean>(false)
  const [integrityStatus, setIntegrityStatus] = useState<AuditIntegrityStatus>(
    getAuditIntegrityStatus(false)
  )
  const [verifyMessage, setVerifyMessage] = useState<string>('')

  // Export Dialog
  const [exportOpen, setExportOpen] = useState<boolean>(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv')
  const [exportIncludeProof, setExportIncludeProof] = useState<boolean>(true)
  const [exportIncludeDiff, setExportIncludeDiff] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportProgress, setExportProgress] = useState<number>(0)
  const [exportSuccessToast, setExportSuccessToast] = useState<string | null>(null)

  // Share with Auditor Dialog
  const [shareOpen, setShareOpen] = useState<boolean>(false)
  const [shareExpiry, setShareExpiry] = useState<string>('7d')
  const [sharePassphrase, setSharePassphrase] = useState<boolean>(true)
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false)
  const [generatedShareLink, setGeneratedShareLink] = useState<string>(
    'https://folio.tax/audits/share/aud_7xK9p2Lm8Q'
  )

  // Save View Dialog / Popover
  const [saveViewOpen, setSaveViewOpen] = useState<boolean>(false)
  const [newViewName, setNewViewName] = useState<string>('')

  // Toast copied hash tracker
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null)

  // Toggle IP reveal per row
  const toggleRevealIp = (id: string) => {
    setRevealedIps((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Handle Hash Copy
  const handleCopyHash = (id: string, fullHash?: string, shortHash?: string) => {
    const textToCopy = fullHash || shortHash || id
    navigator.clipboard?.writeText(textToCopy)
    setCopiedHashId(id)
    setTimeout(() => {
      setCopiedHashId(null)
    }, 2000)
  }

  // Run Hash Chain Verification simulation
  const handleVerifyIntegrity = () => {
    setIsVerifying(true)
    setVerifyProgress(0)
    setVerifyMessage('Initializing Merkle leaf traversal (12,480 events)...')

    const timer1 = setTimeout(() => {
      setVerifyProgress(35)
      setVerifyMessage('Computing HMAC-SHA256 signature chain across block hashes...')
    }, 500)

    const timer2 = setTimeout(() => {
      setVerifyProgress(70)
      setVerifyMessage('Verifying root anchor signature with HSM-IN-MUM-01 key...')
    }, 1100)

    const timer3 = setTimeout(() => {
      setVerifyProgress(100)
      setIsVerifying(false)
      const newStatus = getAuditIntegrityStatus(simulateTampered)
      setIntegrityStatus(newStatus)
    }, 1700)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }

  // Handle Export Generation
  const handleGenerateExport = () => {
    setIsExporting(true)
    setExportProgress(15)

    const timer1 = setTimeout(() => setExportProgress(55), 400)
    const timer2 = setTimeout(() => setExportProgress(90), 800)
    const timer3 = setTimeout(() => {
      setExportProgress(100)
      setIsExporting(false)
      setExportOpen(false)
      const fileName = `folio_audit_trail_${new Date().toISOString().slice(0, 10)}.${exportFormat}`
      setExportSuccessToast(`Export ready! Downloaded ${fileName} (2.4 MB) with integrity proof.`)
      setTimeout(() => setExportSuccessToast(null), 5000)
    }, 1200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }

  // Apply Saved View
  const handleSelectSavedView = (viewId: string) => {
    setActiveViewId(viewId)
    const found = savedViews.find((v) => v.id === viewId)
    if (!found) return

    setActorFilter(found.actor || 'all')
    setActionFilter(found.actionCategory || 'all')
    setResultFilter(found.result || 'all')
    setDateFilter((found.dateRange as DateFilter) || 'all')
    setSearchQuery(found.search || '')
    setCurrentPage(1)
  }

  // Save current view
  const handleSaveCurrentView = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newViewName.trim()) return

    const newView: SavedAuditView = {
      id: `view-custom-${Date.now()}`,
      name: newViewName.trim(),
      actor: actorFilter !== 'all' ? actorFilter : undefined,
      actionCategory: actionFilter !== 'all' ? actionFilter : undefined,
      result: resultFilter !== 'all' ? resultFilter : undefined,
      dateRange: dateFilter !== 'all' ? dateFilter : undefined,
      search: searchQuery.trim() ? searchQuery.trim() : undefined,
    }

    setSavedViews((prev) => [...prev, newView])
    setActiveViewId(newView.id)
    setNewViewName('')
    setSaveViewOpen(false)
  }

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('')
    setDateFilter('all')
    setActorFilter('all')
    setActionFilter('all')
    setResultFilter('all')
    setActiveViewId('view-all')
    setCurrentPage(1)
  }

  // Unique lists for dropdowns
  const uniqueActors = useMemo(() => {
    const list = Array.from(new Set(events.map((e) => e.actor)))
    return list.sort()
  }, [events])

  const actionCategories: AuditActionType[] = [
    'Login',
    'Invoice edit',
    'Rule override',
    'Export',
    'Role change',
    'Key created',
    'Settings change',
    'Consent revoke',
    'Data purge',
  ]

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    if (viewMode === 'empty') return []

    return events.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesQuery =
          item.id.toLowerCase().includes(q) ||
          item.actor.toLowerCase().includes(q) ||
          (item.actorEmail && item.actorEmail.toLowerCase().includes(q)) ||
          item.action.toLowerCase().includes(q) ||
          (item.actionCategory && item.actionCategory.toLowerCase().includes(q)) ||
          item.target.toLowerCase().includes(q) ||
          item.ip.toLowerCase().includes(q) ||
          item.hash.toLowerCase().includes(q)
        if (!matchesQuery) return false
      }

      // Actor
      if (actorFilter !== 'all' && item.actor !== actorFilter) {
        return false
      }

      // Action category
      if (actionFilter !== 'all' && item.actionCategory !== actionFilter) {
        return false
      }

      // Result
      if (resultFilter !== 'all' && item.result !== resultFilter) {
        return false
      }

      // Date Range
      if (dateFilter === 'today') {
        if (!item.at.includes('11 Oct 2026')) return false
      } else if (dateFilter === '24h') {
        if (!item.at.includes('11 Oct 2026') && !item.at.includes('10 Oct 2026, 2')) return false
      } else if (dateFilter === '7d') {
        // past 7 days: 05 Oct to 11 Oct
        const day = parseInt(item.at.slice(0, 2), 10)
        if (day < 5) return false
      }

      return true
    })
  }, [events, viewMode, searchQuery, actorFilter, actionFilter, resultFilter, dateFilter])

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      let comparison = 0
      if (sortField === 'at') {
        comparison = (a.timestampIso || a.at).localeCompare(b.timestampIso || b.at)
      } else if (sortField === 'actor') {
        comparison = a.actor.localeCompare(b.actor)
      } else if (sortField === 'action') {
        comparison = (a.actionCategory || a.action).localeCompare(b.actionCategory || b.action)
      } else if (sortField === 'result') {
        comparison = a.result.localeCompare(b.result)
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
  }, [filteredEvents, sortField, sortOrder])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize))
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedEvents.slice(start, start + pageSize)
  }, [sortedEvents, currentPage, pageSize])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    dateFilter !== 'all' ||
    actorFilter !== 'all' ||
    actionFilter !== 'all' ||
    resultFilter !== 'all'

  return (
    <AppShell active="Security">
      {/* 1. Header & Actions */}
      <PageHeading
        eyebrow="Security & Governance"
        title="Audit Log Explorer"
        description="Tamper-evident, cryptographically chained audit trail of all workspace actions, GST edits, and access events."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* View State Simulator */}
            <div className="flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#fffef4] p-1 text-xs">
              <span className="px-1 text-[11px] font-semibold text-[#686b86]">State:</span>
              {(['normal', 'skeleton', 'empty', 'error'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-2 py-0.5 capitalize transition ${
                    viewMode === mode
                      ? 'bg-[#474c80] font-bold text-[#f8f7e2]'
                      : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <DemoDataChip />

            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs font-semibold text-[#393d68] hover:bg-[#f8f7e2] transition shadow-xs"
            >
              <Share2 className="size-3.5 text-[#474c80]" />
              <span>Share with Auditor</span>
            </button>

            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition shadow-xs"
            >
              <Download className="size-3.5" />
              <span>Export Logs</span>
            </button>
          </div>
        }
      />

      {/* Sub navigation */}
      <SecuritySubNav active="audit" />

      {/* Success Notification Toast */}
      {exportSuccessToast && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-[#378875]/30 bg-[#378875]/10 px-4 py-3 text-xs font-semibold text-[#378875]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{exportSuccessToast}</span>
          </div>
          <button onClick={() => setExportSuccessToast(null)} className="text-[#378875] hover:opacity-75">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 2. Cryptographic Integrity Banner */}
      <div
        className={`mb-6 rounded-2xl border p-4.5 transition-all ${
          integrityStatus.verified
            ? 'border-[#dedecb] bg-[#fffef4]'
            : 'border-[#a24650] bg-[#a24650]/10'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                integrityStatus.verified
                  ? 'bg-[#378875]/15 text-[#378875]'
                  : 'bg-[#a24650] text-[#f8f7e2]'
              }`}
            >
              {integrityStatus.verified ? (
                <ShieldCheck className="size-5" />
              ) : (
                <AlertOctagon className="size-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-[#393d68]">
                  {integrityStatus.verified
                    ? 'Log Integrity Verified'
                    : 'Tampering Detected in Cryptographic Hash Chain!'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    integrityStatus.verified
                      ? 'bg-[#378875]/15 text-[#378875]'
                      : 'bg-[#a24650] text-[#f8f7e2]'
                  }`}
                >
                  {integrityStatus.verified ? (
                    <>
                      <Check className="size-3" />
                      Continuous HMAC-SHA256
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-3" />
                      Broken Block Link #8,214
                    </>
                  )}
                </span>
              </div>

              <p className="mt-1 text-xs text-[#686b86]">
                {integrityStatus.verified ? (
                  <>
                    <span className="font-semibold text-[#393d68]">
                      {integrityStatus.totalEvents.toLocaleString()} events
                    </span>{' '}
                    chained · Merkle root{' '}
                    <code className="rounded bg-[#f8f7e2] px-1 py-0.5 font-mono text-[11px] text-[#474c80]">
                      {integrityStatus.merkleRoot}
                    </code>{' '}
                    · Last check {integrityStatus.lastCheckedAt} · Signed by{' '}
                    <span className="font-medium text-[#393d68]">{integrityStatus.hsmSigner}</span>
                  </>
                ) : (
                  <>
                    Tampering detected at event #8,214! Expected hash{' '}
                    <code className="rounded bg-[#a24650]/20 px-1 py-0.5 font-mono text-[11px] text-[#a24650]">
                      {integrityStatus.expectedHash}
                    </code>{' '}
                    does not match stored payload digest{' '}
                    <code className="rounded bg-[#a24650]/20 px-1 py-0.5 font-mono text-[11px] text-[#a24650]">
                      {integrityStatus.brokenLeafHash}
                    </code>
                    . Cryptographic continuity severed between leaf 8,213 and 8,214.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dev toggle to simulate tampering */}
            <button
              onClick={() => {
                const nextTamper = !simulateTampered
                setSimulateTampered(nextTamper)
                setIntegrityStatus(getAuditIntegrityStatus(nextTamper))
              }}
              title="Developer toggle to simulate tamper detection"
              className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                simulateTampered
                  ? 'border-[#a24650] bg-[#a24650] text-[#f8f7e2]'
                  : 'border-[#dedecb] bg-[#f8f7e2] text-[#686b86] hover:text-[#393d68]'
              }`}
            >
              {simulateTampered ? 'Tamper Active (Simulated)' : 'Simulate Tampering'}
            </button>

            <button
              onClick={handleVerifyIntegrity}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#474c80] px-3 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`size-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying Chain...' : 'Verify Now'}</span>
            </button>
          </div>
        </div>

        {/* Verification Progress Bar */}
        {isVerifying && (
          <div className="mt-4 border-t border-[#dedecb] pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#474c80] flex items-center gap-1.5">
                <LiveIndicator status="healthy" />
                {verifyMessage}
              </span>
              <span className="font-mono font-bold text-[#393d68]">{verifyProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#dedecb]">
              <div
                className="h-full bg-[#474c80] transition-all duration-300"
                style={{ width: `${verifyProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Insights Strip Above Table */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#474c80]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#686b86]">
              Audit Telemetry & Activity Insights
            </h3>
          </div>
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center gap-1 text-xs font-semibold text-[#686b86] hover:text-[#393d68]"
          >
            {showInsights ? (
              <>
                <span>Hide Insights</span>
                <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                <span>Show Insights</span>
                <ChevronDown className="size-3.5" />
              </>
            )}
          </button>
        </div>

        {showInsights && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 1. Events Per Day Chart */}
            <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#393d68]">Events Per Day (7d)</span>
                <span className="text-[11px] font-semibold text-[#378875] bg-[#378875]/10 px-2 py-0.5 rounded-full">
                  +14% wow
                </span>
              </div>
              <p className="text-[11px] text-[#686b86] mb-3">Total events committed to immutable ledger</p>
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyInsights} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#474c80" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#474c80" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      stroke="#686b86"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#dedecb' }}
                    />
                    <YAxis
                      stroke="#686b86"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 200', 'dataMax + 200']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fffef4',
                        borderColor: '#dedecb',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#393d68',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#474c80"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#eventGradient)"
                      name="Events"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Top Actors Distribution */}
            <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#393d68]">Top Actors Distribution</span>
                <span className="text-[11px] font-medium text-[#686b86]">Ranked by volume</span>
              </div>
              <div className="mt-2 space-y-2">
                {topActors.slice(0, 4).map((item) => (
                  <div key={item.actor} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#474c80]/10 text-[9px] font-bold text-[#474c80]">
                          {item.avatar}
                        </span>
                        <span className="truncate font-semibold text-[#393d68]">{item.actor}</span>
                      </div>
                      <span className="font-mono text-[#686b86] shrink-0">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#dedecb]">
                      <div
                        className="h-full rounded-full bg-[#474c80]"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Denied Actions by Type */}
            <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#393d68]">Security Denials by Type</span>
                <span className="text-[11px] font-semibold text-[#cf9c50] bg-[#cf9c50]/15 px-2 py-0.5 rounded-full">
                  102 blocked
                </span>
              </div>
              <div className="mt-2 space-y-2.5">
                {deniedBreakdown.map((item) => (
                  <div key={item.reason} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="size-2 shrink-0 rounded-full bg-[#cf9c50]" />
                      <span className="truncate font-medium text-[#393d68]">{item.reason}</span>
                    </div>
                    <span className="font-mono font-bold text-[#a24650] shrink-0">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Filter Bar & Saved Views */}
      <div className="mb-4 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-xs">
        <div className="flex flex-col gap-3">
          {/* Top Row: Search + Saved Views Dropdown + Date Range */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#686b86]" />
              <input
                type="text"
                placeholder="Search actor, action, invoice #, IP, hash, or event ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 py-2 pl-9 pr-8 text-xs text-[#393d68] placeholder:text-[#686b86] focus:border-[#474c80] focus:bg-[#fffef4] focus:outline-none focus:ring-1 focus:ring-[#474c80] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#686b86] hover:text-[#393d68]"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Saved Views Control */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={activeViewId}
                  onChange={(e) => handleSelectSavedView(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-none"
                >
                  {savedViews.map((v) => (
                    <option key={v.id} value={v.id}>
                      View: {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setSaveViewOpen(true)}
                title="Save current filters as named view"
                className="inline-flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#f8f7e2] px-2.5 py-2 text-xs font-semibold text-[#474c80] hover:bg-[#dedecb]/50 transition"
              >
                <Bookmark className="size-3.5" />
                <span>Save view</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#dedecb]/60">
            {/* Date Presets */}
            <div className="flex items-center gap-1 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 p-1 text-xs">
              <span className="px-1 text-[11px] font-semibold text-[#686b86]">Range:</span>
              {(['all', 'today', '24h', '7d', '30d'] as DateFilter[]).map((df) => (
                <button
                  key={df}
                  onClick={() => {
                    setDateFilter(df)
                    setCurrentPage(1)
                  }}
                  className={`rounded-lg px-2 py-0.5 text-[11px] capitalize transition ${
                    dateFilter === df
                      ? 'bg-[#474c80] font-bold text-[#f8f7e2]'
                      : 'text-[#686b86] hover:bg-[#f8f7e2] hover:text-[#393d68]'
                  }`}
                >
                  {df}
                </button>
              ))}
            </div>

            {/* Actor Filter */}
            <select
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
            >
              <option value="all">All Actors</option>
              {uniqueActors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>

            {/* Action Type Filter */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
            >
              <option value="all">All Action Types</option>
              {actionCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Result Filter */}
            <select
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-2.5 py-1.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
            >
              <option value="all">All Results</option>
              <option value="success">Success</option>
              <option value="denied">Denied</option>
              <option value="failed">Failed</option>
            </select>

            {/* Active filter chips & Clear all */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="ml-auto inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-[#a24650] hover:bg-[#a24650]/10 transition"
              >
                <X className="size-3" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8f7e2] px-2.5 py-0.5 text-[11px] font-medium text-[#393d68] border border-[#dedecb]">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-[#a24650]">
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {actorFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8f7e2] px-2.5 py-0.5 text-[11px] font-medium text-[#393d68] border border-[#dedecb]">
                  Actor: {actorFilter}
                  <button onClick={() => setActorFilter('all')} className="hover:text-[#a24650]">
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {actionFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8f7e2] px-2.5 py-0.5 text-[11px] font-medium text-[#393d68] border border-[#dedecb]">
                  Action: {actionFilter}
                  <button onClick={() => setActionFilter('all')} className="hover:text-[#a24650]">
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {resultFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8f7e2] px-2.5 py-0.5 text-[11px] font-medium text-[#393d68] border border-[#dedecb]">
                  Result: {resultFilter}
                  <button onClick={() => setResultFilter('all')} className="hover:text-[#a24650]">
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {dateFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8f7e2] px-2.5 py-0.5 text-[11px] font-medium text-[#393d68] border border-[#dedecb]">
                  Range: {dateFilter}
                  <button onClick={() => setDateFilter('all')} className="hover:text-[#a24650]">
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Event Table Section */}
      <div className="rounded-2xl border border-[#dedecb] bg-[#fffef4] shadow-xs overflow-hidden">
        {/* Table Controls Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#dedecb] px-4 py-3 bg-[#f8f7e2]/30">
          <div className="flex items-center gap-2 text-xs text-[#686b86]">
            <span>
              Showing{' '}
              <strong className="text-[#393d68]">
                {filteredEvents.length === 0
                  ? '0'
                  : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                      currentPage * pageSize,
                      sortedEvents.length
                    )}`}
              </strong>{' '}
              of <strong className="text-[#393d68]">{sortedEvents.length}</strong> events
            </span>
            <span className="text-[#dedecb]">|</span>
            <span className="text-[11px]">12,480 recorded in ledger</span>
          </div>

          <div className="flex items-center gap-3">
            {/* IP Mask Toggle */}
            <button
              onClick={() => setMaskAllIps(!maskAllIps)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#686b86] hover:text-[#393d68]"
            >
              {maskAllIps ? (
                <>
                  <EyeOff className="size-3" />
                  <span>Mask all IPs</span>
                </>
              ) : (
                <>
                  <Eye className="size-3" />
                  <span>Unmask IPs</span>
                </>
              )}
            </button>

            <span className="text-[#dedecb]">|</span>

            {/* Density Toggle */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-[#686b86]">Density:</span>
              <button
                onClick={() => setDensity('comfortable')}
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                  density === 'comfortable'
                    ? 'bg-[#474c80] text-[#f8f7e2]'
                    : 'text-[#686b86] hover:text-[#393d68]'
                }`}
              >
                Comfortable
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                  density === 'compact'
                    ? 'bg-[#474c80] text-[#f8f7e2]'
                    : 'text-[#686b86] hover:text-[#393d68]'
                }`}
              >
                Compact
              </button>
            </div>

            <span className="text-[#dedecb]">|</span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-[#686b86]">Rows:</span>
              {[10, 25, 50].map((sz) => (
                <button
                  key={sz}
                  onClick={() => {
                    setPageSize(sz)
                    setCurrentPage(1)
                  }}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    pageSize === sz
                      ? 'bg-[#474c80] text-[#f8f7e2]'
                      : 'text-[#686b86] hover:text-[#393d68]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* State: SKELETON */}
        {viewMode === 'skeleton' && (
          <div className="p-6">
            <SkeletonPanel message="Loading cryptographically chained audit events..." />
          </div>
        )}

        {/* State: ERROR */}
        {viewMode === 'error' && (
          <div className="p-6">
            <ErrorPanel
              title="Audit Ledger Synchronization Error"
              message="Failed to fetch cryptographic event signatures from the ledger replica. Please try again."
              onRetry={() => setViewMode('normal')}
            />
          </div>
        )}

        {/* State: EMPTY */}
        {viewMode === 'normal' && sortedEvents.length === 0 && (
          <div className="p-8">
            <EmptyPanel
              icon={FileSearchIcon}
              title="No audit events found"
              message="No recorded audit actions match your selected search query or active filter parameters."
              actionLabel="Clear all filters"
              onAction={handleClearFilters}
            />
          </div>
        )}

        {/* State: NORMAL TABLE */}
        {viewMode === 'normal' && sortedEvents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[#dedecb] bg-[#f8f7e2] text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                <tr>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-[#393d68]"
                    onClick={() => {
                      if (sortField === 'at') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      else {
                        setSortField('at')
                        setSortOrder('desc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp (IST)</span>
                      {sortField === 'at' && (
                        <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-[#393d68]"
                    onClick={() => {
                      if (sortField === 'actor') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      else {
                        setSortField('actor')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Actor</span>
                      {sortField === 'actor' && (
                        <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-[#393d68]"
                    onClick={() => {
                      if (sortField === 'action') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      else {
                        setSortField('action')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Action</span>
                      {sortField === 'action' && (
                        <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3">Target / Resource</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-[#393d68]"
                    onClick={() => {
                      if (sortField === 'result') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      else {
                        setSortField('result')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Result</span>
                      {sortField === 'result' && (
                        <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3">Hash & Proof</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedecb]/60">
                {paginatedEvents.map((event) => {
                  const isCompact = density === 'compact'
                  const isRevealed = !maskAllIps || revealedIps[event.id]
                  const displayIp = isRevealed
                    ? event.ip
                    : event.ip.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.•••.•••')

                  return (
                    <tr
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className={`cursor-pointer transition hover:bg-[#f8f7e2]/40 ${
                        selectedEventId === event.id ? 'bg-[#f8f7e2]/60' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className={`whitespace-nowrap px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <div className="font-medium text-[#393d68]">{event.at}</div>
                        {!isCompact && (
                          <div className="text-[10px] text-[#686b86] font-mono">{event.id}</div>
                        )}
                      </td>

                      {/* Actor */}
                      <td className={`px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#474c80]/15 text-[10px] font-bold text-[#474c80]">
                            {event.actorAvatar || event.actor.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="truncate">
                            <span className="font-semibold text-[#393d68] block truncate max-w-[150px]">
                              {event.actor}
                            </span>
                            {!isCompact && event.actorEmail && (
                              <span className="text-[10px] text-[#686b86] block truncate max-w-[150px]">
                                {event.actorEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className={`px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                              event.actionCategory === 'Invoice edit'
                                ? 'border-[#8b78ae]/30 bg-[#8b78ae]/10 text-[#8b78ae]'
                                : event.actionCategory === 'Rule override'
                                ? 'border-[#cf9c50]/30 bg-[#cf9c50]/10 text-[#cf9c50]'
                                : event.actionCategory === 'Role change'
                                ? 'border-[#a24650]/30 bg-[#a24650]/10 text-[#a24650]'
                                : event.actionCategory === 'Export'
                                ? 'border-[#474c80]/30 bg-[#474c80]/10 text-[#474c80]'
                                : 'border-[#dedecb] bg-[#f8f7e2] text-[#686b86]'
                            }`}
                          >
                            {event.actionCategory || 'Action'}
                          </span>
                        </div>
                        {!isCompact && (
                          <div className="font-mono text-[10px] text-[#686b86] mt-0.5 truncate max-w-[160px]">
                            {event.action}
                          </div>
                        )}
                      </td>

                      {/* Target */}
                      <td className={`px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <div className="truncate max-w-[160px]">
                          {event.targetUrl ? (
                            <a
                              href={event.targetUrl}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-[#474c80] hover:underline flex items-center gap-1 truncate"
                            >
                              <span className="truncate">{event.target}</span>
                              <ExternalLink className="size-2.5 shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <span className="font-medium text-[#393d68] truncate">
                              {event.target}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className={`whitespace-nowrap px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-[#686b86]">
                          <span>{displayIp}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRevealIp(event.id)
                            }}
                            title={isRevealed ? 'Mask IP' : 'Reveal IP'}
                            className="text-[#686b86] hover:text-[#393d68]"
                          >
                            {isRevealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                          </button>
                        </div>
                      </td>

                      {/* Result */}
                      <td className={`whitespace-nowrap px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            event.result === 'success'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : event.result === 'denied'
                              ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                              : 'bg-[#a24650]/15 text-[#a24650]'
                          }`}
                        >
                          {event.result === 'success' ? (
                            <Check className="size-3" />
                          ) : event.result === 'denied' ? (
                            <AlertTriangle className="size-3" />
                          ) : (
                            <X className="size-3" />
                          )}
                          <span className="capitalize">{event.result}</span>
                        </span>
                      </td>

                      {/* Hash with Copy */}
                      <td className={`whitespace-nowrap px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-[10px] text-[#686b86] bg-[#f8f7e2] px-1.5 py-0.5 rounded border border-[#dedecb]">
                            {event.hash}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyHash(event.id, event.fullHash, event.hash)
                            }}
                            title="Copy full HMAC hash"
                            className="text-[#686b86] hover:text-[#393d68]"
                          >
                            {copiedHashId === event.id ? (
                              <Check className="size-3 text-[#378875]" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Details button */}
                      <td className={`px-4 text-right ${isCompact ? 'py-2' : 'py-3'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEventId(event.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#dedecb] bg-[#fffef4] px-2 py-1 text-[11px] font-semibold text-[#474c80] hover:bg-[#f8f7e2] transition shadow-xs"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="size-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {viewMode === 'normal' && sortedEvents.length > 0 && (
          <div className="flex flex-wrap items-center justify-between border-t border-[#dedecb] px-4 py-3 bg-[#f8f7e2]/20">
            <span className="text-xs text-[#686b86]">
              Page <strong className="text-[#393d68]">{currentPage}</strong> of{' '}
              <strong className="text-[#393d68]">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs font-semibold text-[#393d68] hover:bg-[#f8f7e2] transition disabled:opacity-40"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      currentPage === pageNum
                        ? 'bg-[#474c80] text-[#f8f7e2]'
                        : 'border border-[#dedecb] bg-[#fffef4] text-[#393d68] hover:bg-[#f8f7e2]'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-xs font-semibold text-[#393d68] hover:bg-[#f8f7e2] transition disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Statutory Retention Note */}
      <div className="mt-6 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#474c80]/10 text-[#474c80]">
            <Scale className="size-5" />
          </div>
          <div className="text-xs text-[#686b86]">
            <h4 className="font-bold text-[#393d68]">
              Statutory 72-Month Audit Trail Retention Notice
            </h4>
            <p className="mt-1">
              Audit logs in Folio are write-once, append-only, and retained for 72 months to comply
              with Section 36 of the Central Goods and Services Tax (CGST) Act, 2017. Hashes are
              anchored hourly with FIPS 140-3 Level 3 HSM hardware signatures.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <a
                href="/app/security/data"
                className="font-bold text-[#474c80] hover:underline inline-flex items-center gap-1"
              >
                <span>Manage Data Retention Rules in Data & Secrets</span>
                <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. SLIDE-OUT EVENT DETAIL DRAWER */}
      {/* ======================================================== */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-[#393d68]/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-xl bg-[#fffef4] shadow-2xl border-l border-[#dedecb] flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#dedecb] px-6 py-4 bg-[#f8f7e2]">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-[#474c80] text-[#f8f7e2]">
                    <FileCheck2 className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono text-sm font-bold text-[#393d68]">
                        {selectedEvent.id}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          selectedEvent.result === 'success'
                            ? 'bg-[#378875]/15 text-[#378875]'
                            : selectedEvent.result === 'denied'
                            ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                            : 'bg-[#a24650]/15 text-[#a24650]'
                        }`}
                      >
                        {selectedEvent.result}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#686b86]">{selectedEvent.at}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEventId(null)}
                  className="rounded-xl border border-[#dedecb] p-1.5 text-[#686b86] hover:bg-[#fffef4] hover:text-[#393d68]"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Actor & Session Info */}
                <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-3">
                    Actor & Authentication Context
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[#686b86] block text-[11px]">Actor Name</span>
                      <span className="font-semibold text-[#393d68]">{selectedEvent.actor}</span>
                    </div>
                    <div>
                      <span className="text-[#686b86] block text-[11px]">Role</span>
                      <span className="font-medium text-[#474c80]">
                        {selectedEvent.actorRole || 'Workspace Member'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686b86] block text-[11px]">Email</span>
                      <span className="font-mono text-[11px] text-[#393d68]">
                        {selectedEvent.actorEmail || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686b86] block text-[11px]">IP & Geo</span>
                      <span className="font-mono text-[11px] text-[#393d68]">
                        {selectedEvent.ip} ({selectedEvent.geo || 'India'})
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686b86] block text-[11px]">Session ID</span>
                      <span className="font-mono text-[11px] text-[#686b86]">
                        {selectedEvent.sessionId || 'sess_default'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686b86] block text-[11px]">Correlation ID</span>
                      <span className="font-mono text-[11px] text-[#686b86]">
                        {selectedEvent.correlationId || 'corr_auto'}
                      </span>
                    </div>
                  </div>
                  {selectedEvent.userAgent && (
                    <div className="mt-3 pt-3 border-t border-[#dedecb]/60">
                      <span className="text-[#686b86] block text-[10px]">User-Agent</span>
                      <span className="font-mono text-[10px] text-[#686b86] break-all">
                        {selectedEvent.userAgent}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Action & Target Resource */}
                <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-3">
                    Action & Target Resource
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#686b86]">Action Identifier:</span>
                      <code className="rounded bg-[#dedecb]/40 px-2 py-0.5 font-mono text-[11px] text-[#474c80]">
                        {selectedEvent.action}
                      </code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#686b86]">Category:</span>
                      <span className="font-semibold text-[#393d68]">
                        {selectedEvent.actionCategory || 'Operation'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#686b86]">Target Entity:</span>
                      {selectedEvent.targetUrl ? (
                        <a
                          href={selectedEvent.targetUrl}
                          className="font-bold text-[#474c80] hover:underline flex items-center gap-1"
                        >
                          <span>{selectedEvent.target}</span>
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="font-semibold text-[#393d68]">
                          {selectedEvent.target}
                        </span>
                      )}
                    </div>
                    {selectedEvent.reason && (
                      <div className="pt-2 border-t border-[#dedecb]/60 text-[11px]">
                        <span className="text-[#686b86] block font-medium">Rationale / Note:</span>
                        <p className="mt-0.5 text-[#393d68] italic">"{selectedEvent.reason}"</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. BEFORE AND AFTER DIFF FOR EDITS */}
                {selectedEvent.diff && selectedEvent.diff.length > 0 && (
                  <div className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#393d68] flex items-center gap-1.5">
                        <SlidersHorizontal className="size-3.5 text-[#474c80]" />
                        <span>State Mutation Diff (Before / After)</span>
                      </h4>
                      <span className="text-[10px] font-semibold text-[#686b86] bg-[#f8f7e2] px-2 py-0.5 rounded-full border border-[#dedecb]">
                        {selectedEvent.diff.length} field{selectedEvent.diff.length > 1 ? 's' : ''}{' '}
                        altered
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedEvent.diff.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#dedecb] bg-[#f8f7e2]/30 p-3 text-xs"
                        >
                          <div className="font-bold text-[#393d68] mb-2">{item.field}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Before value (Red strikethrough) */}
                            <div className="rounded border border-[#a24650]/30 bg-[#a24650]/10 p-2 text-[#a24650]">
                              <span className="block text-[10px] font-bold uppercase opacity-80 mb-0.5">
                                Before
                              </span>
                              <span className="line-through font-mono text-[11px] break-all">
                                {item.before}
                              </span>
                            </div>
                            {/* After value (Green highlight) */}
                            <div className="rounded border border-[#378875]/30 bg-[#378875]/10 p-2 text-[#378875]">
                              <span className="block text-[10px] font-bold uppercase opacity-80 mb-0.5">
                                After
                              </span>
                              <span className="font-mono text-[11px] font-bold break-all">
                                {item.after}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Cryptographic Hash Chain Continuity */}
                <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] flex items-center gap-1.5">
                      <Lock className="size-3.5 text-[#378875]" />
                      <span>Cryptographic Hash Chain Link</span>
                    </h4>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#378875]">
                      <CheckCircle2 className="size-3" />
                      Verified Continuity
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2 rounded bg-[#fffef4] border border-[#dedecb]">
                      <span className="text-[10px] text-[#686b86] block font-sans">
                        Previous Block Hash (Parent Link):
                      </span>
                      <span className="text-[11px] text-[#474c80]">
                        {selectedEvent.prevHash || '00000000...genesis'}
                      </span>
                    </div>

                    <div className="flex justify-center text-[#686b86]">
                      <ArrowRight className="size-4 rotate-90" />
                    </div>

                    <div className="p-2 rounded bg-[#fffef4] border border-[#378875]/40">
                      <span className="text-[10px] text-[#378875] block font-sans font-bold">
                        Current Event Digest (HMAC-SHA256):
                      </span>
                      <span className="text-[11px] font-bold text-[#393d68] break-all">
                        {selectedEvent.fullHash || selectedEvent.hash}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(selectedEvent, null, 2))
                      setCopiedHashId('drawer_json')
                      setTimeout(() => setCopiedHashId(null), 2000)
                    }}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dedecb] bg-[#fffef4] py-2 text-xs font-semibold text-[#474c80] hover:bg-[#f8f7e2] transition"
                  >
                    {copiedHashId === 'drawer_json' ? (
                      <>
                        <Check className="size-3.5 text-[#378875]" />
                        <span>JSON Payload Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copy Raw Event Payload (JSON)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 5. Related Events */}
                {selectedEvent.relatedIds && selectedEvent.relatedIds.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#686b86] mb-2">
                      Related Events in Sequence
                    </h4>
                    <div className="space-y-1.5">
                      {selectedEvent.relatedIds.map((relId) => {
                        const relEvent = events.find((e) => e.id === relId)
                        if (!relEvent) return null

                        return (
                          <div
                            key={relId}
                            onClick={() => setSelectedEventId(relId)}
                            className="flex items-center justify-between rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5 text-xs cursor-pointer hover:bg-[#f8f7e2] transition"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono text-[10px] font-bold text-[#474c80]">
                                {relEvent.id}
                              </span>
                              <span className="truncate font-medium text-[#393d68]">
                                {relEvent.actionCategory || relEvent.action}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#686b86] shrink-0 font-mono">
                              {relEvent.at.split(',')[1]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. EXPORT AUDIT LOGS MODAL */}
      {/* ======================================================== */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#393d68]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#dedecb] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Download className="size-4 text-[#474c80]" />
                <h3 className="text-sm font-bold text-[#393d68]">Export Audit Trail</h3>
              </div>
              <button onClick={() => setExportOpen(false)} className="text-[#686b86] hover:text-[#393d68]">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1.5">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['csv', 'json', 'pdf'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`rounded-xl border py-2 text-xs font-bold uppercase transition ${
                        exportFormat === fmt
                          ? 'border-[#474c80] bg-[#474c80] text-[#f8f7e2]'
                          : 'border-[#dedecb] bg-[#f8f7e2]/50 text-[#686b86] hover:bg-[#dedecb]/50'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1.5">
                  Export Scope
                </label>
                <p className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-[11px] text-[#686b86]">
                  Exports currently filtered records ({sortedEvents.length} events) with cryptographic
                  hash proofs.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportIncludeProof}
                    onChange={(e) => setExportIncludeProof(e.target.checked)}
                    className="size-4 rounded border-[#dedecb] accent-[#474c80]"
                  />
                  <span className="text-[#393d68] font-medium">
                    Include Merkle Root & Cryptographic Chain Proofs
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportIncludeDiff}
                    onChange={(e) => setExportIncludeDiff(e.target.checked)}
                    className="size-4 rounded border-[#dedecb] accent-[#474c80]"
                  />
                  <span className="text-[#393d68] font-medium">
                    Include Field-Level State Mutation Diffs
                  </span>
                </label>
              </div>

              {isExporting && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-[#686b86] mb-1 font-semibold">
                    <span>Generating verifiable audit export...</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#dedecb] overflow-hidden">
                    <div
                      className="h-full bg-[#474c80] transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#dedecb] pt-4">
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="rounded-xl border border-[#dedecb] px-3.5 py-2 text-xs font-semibold text-[#686b86] hover:bg-[#f8f7e2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateExport}
                disabled={isExporting}
                className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition disabled:opacity-50"
              >
                {isExporting ? 'Generating...' : 'Download Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. SHARE WITH AUDITOR MODAL */}
      {/* ======================================================== */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#393d68]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#dedecb] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-[#474c80]" />
                <h3 className="text-sm font-bold text-[#393d68]">
                  Share Read-Only View with Auditor
                </h3>
              </div>
              <button onClick={() => setShareOpen(false)} className="text-[#686b86] hover:text-[#393d68]">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#686b86]">
                Generates a secure, expiring link giving statutory auditors read-only access to
                verified logs and cryptographic proofs without granting workspace member access.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1.5">
                  Link Expiry
                </label>
                <select
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(e.target.value)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
                >
                  <option value="24h">24 Hours (Spot Audit)</option>
                  <option value="7d">7 Days (Statutory Tax Audit)</option>
                  <option value="14d">14 Days (Quarterly Assessment)</option>
                  <option value="30d">30 Days (Annual GST Audit)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1.5">
                  Read-Only Secure URL
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={generatedShareLink}
                    className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-3 py-2 font-mono text-[11px] text-[#474c80] select-all focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(generatedShareLink)
                      setCopiedShareLink(true)
                      setTimeout(() => setCopiedShareLink(false), 2000)
                    }}
                    className="shrink-0 rounded-xl bg-[#474c80] px-3 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                  >
                    {copiedShareLink ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </button>
                </div>
                {copiedShareLink && (
                  <span className="text-[11px] font-semibold text-[#378875] mt-1 block">
                    Link copied to clipboard!
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-3 text-[11px] text-[#686b86]">
                <span className="font-bold text-[#393d68] block mb-0.5">
                  Security Protections:
                </span>
                Auditor sessions are watermarked, logged in real-time, and restricted from viewing
                raw member credentials or unmasked PANs.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#dedecb] pt-4">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. SAVE CURRENT VIEW DIALOG */}
      {/* ======================================================== */}
      {saveViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#393d68]/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveCurrentView}
            className="w-full max-w-sm rounded-2xl border border-[#dedecb] bg-[#fffef4] p-5 shadow-xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-[#dedecb] pb-2 mb-3">
              <h3 className="text-sm font-bold text-[#393d68]">Save Current Filter View</h3>
              <button
                type="button"
                onClick={() => setSaveViewOpen(false)}
                className="text-[#686b86] hover:text-[#393d68]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#686b86]">
                Save current search parameters and filter selections for one-click access later.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#393d68] mb-1">
                  View Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. High-Risk GSTIN Overrides"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-[#dedecb] pt-3">
              <button
                type="button"
                onClick={() => setSaveViewOpen(false)}
                className="rounded-xl border border-[#dedecb] px-3 py-1.5 text-xs font-semibold text-[#686b86] hover:bg-[#f8f7e2]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#474c80] px-4 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68]"
              >
                Save View
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  )
}

function FileSearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Search {...props} />
}
