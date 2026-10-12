'use client'

import React, { useState, useMemo } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  UserCheck,
  FileCheck2,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Check,
  RotateCcw,
  AlertTriangle,
  Layers,
  Activity,
  HardDrive,
  Eye,
  Scale,
  RefreshCw,
  Flame,
  Smartphone,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  SkeletonPanel,
  TimeRangeControl,
  SeverityPill,
  StatusBadge,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  SecuritySubNav,
  DemoDataChip,
  RiskMeter,
  SecretField,
  RoleBadge,
  MaskedValue,
} from '@/components/security-kit'
import {
  getSecurityPostureSummary,
  getSecurityCategoryScores,
  getSecurityRecommendedActions,
  getThreatSignals,
  getActiveSessions,
  getSecurityMembers,
  getSecurityAuditEvents,
  getSecurityApiKeys,
  getDataProtectionSnapshot,
  type SecurityPostureSummary,
  type SecurityCategoryScore,
  type SecurityRecommendedAction,
  type ThreatSignal,
  type SessionInfo,
  type Member,
  type AuditEvent,
  type ApiKey,
  type DataProtectionTile,
} from '@/lib/security-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function SecurityOverviewWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [posture, setPosture] = useState<SecurityPostureSummary>(getSecurityPostureSummary())
  const [categories, setCategories] = useState<SecurityCategoryScore[]>(getSecurityCategoryScores())
  const [actions, setActions] = useState<SecurityRecommendedAction[]>(getSecurityRecommendedActions())
  const [threats, setThreats] = useState<ThreatSignal[]>(getThreatSignals())
  const [sessions, setSessions] = useState<SessionInfo[]>(getActiveSessions())
  const [members, setMembers] = useState<Member[]>(getSecurityMembers())
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(getSecurityAuditEvents())
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(getSecurityApiKeys())
  const [dataProtectionTiles, setDataProtectionTiles] = useState<DataProtectionTile[]>(getDataProtectionSnapshot())

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Pending actions vs completed actions
  const pendingActions = useMemo(() => actions.filter((a) => a.status === 'pending'), [actions])
  const completedActionsCount = useMemo(() => actions.filter((a) => a.status === 'done').length, [actions])

  // Dynamic score based on completed actions
  const currentScore = useMemo(() => {
    const baseScore = 78
    const gain = actions
      .filter((a) => a.status === 'done')
      .reduce((acc, a) => acc + a.scoreGain, 0)
    return Math.min(100, baseScore + gain)
  }, [actions])

  // MFA counts linked to actions
  const mfaCount = useMemo(() => {
    const isMfaFixed = actions.find((a) => a.id === 'act-1')?.status === 'done'
    return isMfaFixed ? '9 of 9 members' : '7 of 9 members'
  }, [actions])

  const openThreatsCount = useMemo(() => {
    const isThreatInvestigated = actions.find((a) => a.id === 'act-3')?.status === 'done'
    return isThreatInvestigated ? 1 : 2
  }, [actions])

  const keysNeedingRotationCount = useMemo(() => {
    const isKeyRotated = actions.find((a) => a.id === 'act-2')?.status === 'done'
    return isKeyRotated ? 0 : 1
  }, [actions])

  // Completing an action updates score, categories, and KPIs
  const handleCompleteAction = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'done' } : a))
    )
    const target = actions.find((a) => a.id === actionId)
    if (target) {
      showToast(`Action completed! Security posture raised by +${target.scoreGain} points.`)
      // Update category score
      setCategories((prev) =>
        prev.map((c) =>
          c.category === target.category
            ? { ...c, score: Math.min(100, c.score + target.scoreGain * 2) }
            : c
        )
      )
    }
  }

  const handleSnoozeAction = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'snoozed' } : a))
    )
    showToast('Action snoozed for 7 days.')
  }

  // Circular gauge score radius
  const scoreRadius = 52
  const circumference = 2 * Math.PI * scoreRadius
  const scoreOffset = circumference - (currentScore / 100) * circumference

  return (
    <AppShell active="Security">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#378875]/40 bg-[#378875] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeading
        eyebrow="Security"
        title="Security center"
        description="Access, data protection, threats, and compliance in one place."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <DemoDataChip />
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <SecuritySubNav active="overview" />

      {/* State Switcher */}
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
        <div className="flex items-center gap-3 text-xs text-[#686b86]">
          <span>Security Governance Engine: <strong className="text-[#378875]">Online</strong></span>
          <span className="text-[#dedecb]">·</span>
          <span>Last full audit: 09 Oct 2026</span>
        </div>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No security records recorded"
          description="Workspace security governance engine has not recorded events for this time window."
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
          title="Security telemetry unavailable"
          message="Could not stream posture scores from security audit cluster."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-7">
          {/* 1. POSTURE HERO CARD */}
          <div className="overflow-hidden rounded-3xl border border-[#dedecb] bg-radial from-[#fffef4] to-[#f8f7e2] p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
              {/* Left Column: Big Score Ring + Explanation */}
              <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-6">
                {/* Animated Circular Ring */}
                <div className="relative flex size-36 shrink-0 items-center justify-center">
                  <svg className="size-36 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r={scoreRadius}
                      stroke="#dedecb"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r={scoreRadius}
                      stroke={currentScore >= 90 ? '#378875' : currentScore >= 70 ? '#378875' : '#cf9c50'}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={scoreOffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-3xl font-black text-[#393d68]">
                      {currentScore}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#686b86]">
                      / 100 · {currentScore >= 90 ? 'Strong' : 'Good'}
                    </span>
                  </div>
                </div>

                {/* Score explanation */}
                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="inline-block rounded-full bg-[#378875]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#378875]">
                    {currentScore >= 90 ? 'Optimal Protection' : 'Well Protected'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-[#393d68] tracking-tight">
                    Workspace posture is healthy
                  </h2>
                  <p className="text-xs text-[#686b86] leading-relaxed">
                    {pendingActions.length > 0 ? (
                      <>
                        <strong className="text-[#393d68]">{pendingActions.length} recommended actions</strong> would raise this score to{' '}
                        <strong className="text-[#378875] font-mono">
                          {Math.min(100, currentScore + pendingActions.reduce((a, c) => a + c.scoreGain, 0))}
                        </strong>.
                      </>
                    ) : (
                      <>All high-priority security recommendations have been resolved.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Right Column: Category Breakdown Horizontal Bars */}
              <div className="lg:col-span-7 rounded-2xl border border-[#dedecb] bg-[#fffef4] p-5 shadow-2xs space-y-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                  Posture by category breakdown
                </span>
                <div className="space-y-2.5">
                  {categories.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#393d68]">{cat.category}</span>
                        <span className="font-mono font-bold text-[#474c80]">{cat.score}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#f8f7e2] border border-[#dedecb]/60">
                        <div
                          className="h-full rounded-full bg-[#474c80] transition-all duration-500"
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. KPI ROW (4 METRIC CARDS) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Members with MFA"
              value={mfaCount}
              note="Enforced for Owner & Admins"
              icon={KeyRound}
            />
            <MetricCard
              label="Active web sessions"
              value={`${sessions.length} sessions`}
              note="Zero unfamiliar foreign IPs"
              icon={UserCheck}
            />
            <MetricCard
              label="Open threat signals"
              value={`${openThreatsCount} signals`}
              note="1 E-invoice QR discrepancy"
              icon={ShieldAlert}
            />
            <MetricCard
              label="API keys needing rotation"
              value={`${keysNeedingRotationCount} key`}
              note="ERP webhook key age >45 days"
              icon={Lock}
            />
          </div>

          {/* 3. RECOMMENDED ACTIONS LIST */}
          <SectionCard
            title="Recommended security actions"
            description="High-impact configuration updates to harden your GST workspace against unauthorized access and audit penalties."
            action={
              <span className="text-xs font-semibold text-[#686b86]">
                {completedActionsCount} of {actions.length} completed
              </span>
            }
          >
            <div className="space-y-3 pt-1">
              {actions.map((act) => {
                const isDone = act.status === 'done'
                const isSnoozed = act.status === 'snoozed'

                return (
                  <div
                    key={act.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border p-4 transition ${
                      isDone
                        ? 'border-[#378875]/40 bg-[#378875]/5 opacity-80'
                        : isSnoozed
                        ? 'border-[#dedecb] bg-[#f8f7e2]/30 opacity-70'
                        : 'border-[#dedecb] bg-[#fffef4] hover:border-[#474c80]/50'
                    }`}
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityPill level={act.severity} />
                        <span className="font-bold text-xs text-[#393d68]">{act.title}</span>
                        <span className="rounded-full bg-[#378875]/15 px-2 py-0.5 text-[10px] font-mono font-bold text-[#378875]">
                          +{act.scoreGain} pts
                        </span>
                        {isDone && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#378875]">
                            <Check className="size-3" /> Resolved
                          </span>
                        )}
                        {isSnoozed && (
                          <span className="text-[10px] font-bold text-[#686b86]">Snoozed (7d)</span>
                        )}
                      </div>
                      <p className="text-xs text-[#686b86] leading-relaxed">{act.reason}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isDone && (
                        <>
                          <a
                            href={act.linkHref}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition shadow-2xs"
                          >
                            <span>{act.linkLabel}</span>
                            <ArrowRight className="size-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCompleteAction(act.id)}
                            className="rounded-xl border border-[#378875]/40 bg-[#378875]/10 px-3 py-1.5 text-xs font-bold text-[#378875] hover:bg-[#378875] hover:text-[#f8f7e2] transition"
                          >
                            Mark Done
                          </button>
                          {!isSnoozed && (
                            <button
                              type="button"
                              onClick={() => handleSnoozeAction(act.id)}
                              className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 px-2.5 py-1.5 text-xs font-semibold text-[#686b86] hover:bg-[#dedecb]"
                            >
                              Snooze
                            </button>
                          )}
                        </>
                      )}
                      {isDone && (
                        <button
                          type="button"
                          onClick={() => {
                            setActions((prev) =>
                              prev.map((a) => (a.id === act.id ? { ...a, status: 'pending' } : a))
                            )
                          }}
                          className="text-[11px] font-bold text-[#686b86] hover:underline"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* 4. TWO-COLUMN GRID: RECENT AUDIT EVENTS + OPEN THREAT SIGNALS */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Recent Security Audit Events (Last 8) */}
            <div className="lg:col-span-6">
              <SectionCard
                title="Recent security audit events"
                description="Chronological log of recent sensitive actions, role changes, and API calls."
                action={
                  <a
                    href="/app/security/audit"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#474c80] hover:underline"
                  >
                    <span>View full trail</span>
                    <ArrowRight className="size-3" />
                  </a>
                }
              >
                <div className="divide-y divide-[#dedecb]/60 pt-1">
                  {auditEvents.slice(0, 8).map((ev) => (
                    <div key={ev.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#393d68]">{ev.actor}</span>
                          <span className="text-[#dedecb]">·</span>
                          <span className="font-mono text-[11px] text-[#474c80]">{ev.action}</span>
                        </div>
                        <div className="text-[11px] text-[#686b86] flex items-center gap-2 font-mono">
                          <span>Target: {ev.target}</span>
                          <span>·</span>
                          <span>{ev.ip}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block rounded-md px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                            ev.result === 'success'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : ev.result === 'denied'
                              ? 'bg-[#a24650]/15 text-[#a24650]'
                              : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                          }`}
                        >
                          {ev.result}
                        </span>
                        <div className="text-[10px] text-[#686b86] mt-0.5">{ev.at}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* Right Column: Open Threat Signals (Top 4) */}
            <div className="lg:col-span-6">
              <SectionCard
                title="Active threat signals"
                description="Real-time behavioral anomalies and cryptographic integrity alerts."
                action={
                  <a
                    href="/app/security/threats"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#474c80] hover:underline"
                  >
                    <span>Threat center</span>
                    <ArrowRight className="size-3" />
                  </a>
                }
              >
                <div className="space-y-3 pt-1">
                  {threats.slice(0, 4).map((thr) => (
                    <div
                      key={thr.id}
                      className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-3.5 space-y-2 hover:border-[#474c80]/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SeverityPill level={thr.severity} />
                          <span className="font-bold text-xs text-[#393d68]">{thr.kind}</span>
                        </div>
                        <span className="text-[10px] text-[#686b86]">{thr.detectedAt}</span>
                      </div>

                      <p className="text-xs text-[#686b86] leading-relaxed">{thr.detail}</p>

                      <div className="flex items-center justify-between border-t border-[#dedecb]/60 pt-2 text-xs">
                        <span className="font-mono text-[10px] text-[#686b86]">ID: {thr.id}</span>
                        <a
                          href="/app/security/threats"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#474c80] hover:underline"
                        >
                          <span>Investigate</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* 5. DATA PROTECTION SNAPSHOT STRIP */}
          <SectionCard
            title="Data protection snapshot"
            description="Continuous verification of encryption tiers, customer-managed keys, and PII masking status."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {dataProtectionTiles.map((tile) => (
                <div
                  key={tile.id}
                  className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#393d68]">{tile.title}</span>
                    <StatusBadge status={tile.status} />
                  </div>
                  <div className="font-mono text-sm font-bold text-[#474c80]">{tile.statusText}</div>
                  <p className="text-[11px] text-[#686b86] leading-relaxed">{tile.description}</p>
                  <div className="border-t border-[#dedecb]/60 pt-2 text-[10px] font-mono text-[#686b86]">
                    {tile.spec}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 6. COMPLIANCE READINESS CARD */}
          <div className="rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#378875]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#378875]">
                  <Scale className="size-3" />
                  <span>Statutory Compliance Shield</span>
                </div>
                <h3 className="text-base font-black text-[#393d68]">
                  Digital Personal Data Protection (DPDP Act 2023) & GST Audit Readiness
                </h3>
                <p className="text-xs text-[#686b86] leading-relaxed">
                  Folio maintains continuous alignment with CBIC rule requirements and DPDP consent logging guidelines.
                </p>

                {/* Progress bar */}
                <div className="pt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#686b86]">Readiness index</span>
                    <span className="font-mono text-[#378875]">94.2%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f8f7e2] border border-[#dedecb]/60">
                    <div className="h-full rounded-full bg-[#378875]" style={{ width: '94.2%' }} />
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-end gap-2">
                <a
                  href="/app/security/compliance"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
                >
                  <span>View compliance dashboard</span>
                  <ArrowRight className="size-3.5" />
                </a>
                <span className="text-[11px] text-[#686b86]">
                  Annual audit package ready
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
