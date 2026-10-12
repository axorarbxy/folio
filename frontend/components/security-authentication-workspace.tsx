'use client'

import React, { useState, useMemo } from 'react'
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Lock,
  Globe,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Download,
  Sliders,
  LogOut,
  Trash2,
  Plus,
  X,
  ExternalLink,
  HelpCircle,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'
import {
  EmptyPanel,
  ErrorPanel,
  LiveIndicator,
  SkeletonPanel,
  TimeRangeControl,
  type TimeRange,
} from '@/components/monitoring-kit'
import {
  SecuritySubNav,
  DemoDataChip,
  SecretField,
  ConfirmDialog,
} from '@/components/security-kit'
import {
  getSignInMethods,
  getDefaultAuthPolicySettings,
  getActiveSessions,
  getLoginHistory,
  getTrustedDevices,
  getIpAllowlist,
  type SignInMethod,
  type AuthPolicySettings,
  type SessionInfo,
  type LoginHistoryItem,
  type TrustedDevice,
  type IpAllowlistEntry,
} from '@/lib/security-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'

export default function SecurityAuthenticationWorkspace() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [methods, setMethods] = useState<SignInMethod[]>(getSignInMethods())
  const [policy, setPolicy] = useState<AuthPolicySettings>(getDefaultAuthPolicySettings())
  const [originalPolicy, setOriginalPolicy] = useState<AuthPolicySettings>(getDefaultAuthPolicySettings())
  const [sessions, setSessions] = useState<SessionInfo[]>(getActiveSessions())
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>(getLoginHistory())
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>(getTrustedDevices())
  const [ipAllowlist, setIpAllowlist] = useState<IpAllowlistEntry[]>(getIpAllowlist())

  // Dirty Policy State Tracking
  const isPolicyDirty = useMemo(() => {
    return JSON.stringify(policy) !== JSON.stringify(originalPolicy)
  }, [policy, originalPolicy])

  // Live password strength preview input
  const [previewPassword, setPreviewPassword] = useState('Folio#Tax2026')

  // Modals & Dialogs
  const [totpSetupOpen, setTotpSetupOpen] = useState(false)
  const [totpStep, setTotpStep] = useState<1 | 2>(1) // 1: QR & Code, 2: Recovery Codes
  const [totpCodeInput, setTotpCodeInput] = useState('')
  const [recoveryCodesRevealed, setRecoveryCodesRevealed] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  // Not Me? Incident Wizard State
  const [notMeIncidentItem, setNotMeIncidentItem] = useState<LoginHistoryItem | null>(null)
  const [notMeStep, setNotMeStep] = useState<1 | 2 | 3>(1) // 1: Password, 2: Signout, 3: Notify Admin

  // IP Allowlist Editor Modal
  const [ipModalOpen, setIpModalOpen] = useState(false)
  const [newIpCidr, setNewIpCidr] = useState('')
  const [newIpLabel, setNewIpLabel] = useState('')
  const [ipInputError, setIpInputError] = useState<string | null>(null)

  // Generic Confirm Dialog State
  const [confirmDialogData, setConfirmDialogData] = useState<{
    isOpen: boolean
    title: string
    body: string
    confirmLabel: string
    danger: boolean
    action: () => void
  } | null>(null)

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Live Policy Strength Calculator
  const passwordStrength = useMemo(() => {
    let score = 0
    if (previewPassword.length >= policy.minLength) score += 30
    if (policy.requireUppercase && /[A-Z]/.test(previewPassword)) score += 20
    if (policy.requireLowercase && /[a-z]/.test(previewPassword)) score += 15
    if (policy.requireNumber && /[0-9]/.test(previewPassword)) score += 15
    if (policy.requireSymbol && /[^A-Za-z0-9]/.test(previewPassword)) score += 20

    if (score >= 90) return { label: 'Very Strong', color: '#378875', percent: 100 }
    if (score >= 65) return { label: 'Strong', color: '#378875', percent: 75 }
    if (score >= 45) return { label: 'Moderate', color: '#cf9c50', percent: 50 }
    return { label: 'Weak', color: '#a24650', percent: 25 }
  }, [previewPassword, policy])

  // Fake Recovery Codes
  const recoveryCodes = [
    'A9X2-88F1-4K90',
    '7B01-44E2-99L1',
    '3F82-11D0-55P8',
    '88C9-22B4-77Q2',
    '11E0-66F5-33R9',
    '55A8-99D2-11T4',
    '99L2-33K8-44V0',
    '44P1-77M9-88X5',
  ]

  // Session Management
  const handleSignoutSession = (session: SessionInfo) => {
    setSessions((prev) => prev.filter((s) => s.id !== session.id))
    showToast(`Signed out session from ${session.location} (${session.ip})`)
  }

  const handleSignoutAllOtherSessions = () => {
    setConfirmDialogData({
      isOpen: true,
      title: 'Sign Out All Other Sessions?',
      body: 'This will terminate 4 other active sessions across mobile devices and external office laptops. Only your current browser session will remain authenticated.',
      confirmLabel: 'Sign Out All Others',
      danger: true,
      action: () => {
        setSessions((prev) => prev.filter((s) => s.current))
        showToast('All other remote sessions have been terminated')
      },
    })
  }

  // Trusted Device Removal
  const handleRemoveDevice = (device: TrustedDevice) => {
    setConfirmDialogData({
      isOpen: true,
      title: `Remove ${device.name}?`,
      body: `This device fingerprint will be invalidated. Subsequent sign-ins from this hardware will require full MFA re-authentication.`,
      confirmLabel: 'Remove Device',
      danger: true,
      action: () => {
        setTrustedDevices((prev) => prev.filter((d) => d.id !== device.id))
        showToast(`${device.name} removed from trusted hardware`)
      },
    })
  }

  // IP Allowlist Validation & Addition
  const handleAddIpAllowlist = (e: React.FormEvent) => {
    e.preventDefault()
    setIpInputError(null)

    // Regex check for IPv4 or IPv4 CIDR (e.g. 192.168.1.1 or 192.168.1.0/24)
    const ipv4CidrRegex =
      /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\/([0-9]|[1-2][0-9]|3[0-2]))?$/

    if (!ipv4CidrRegex.test(newIpCidr.trim())) {
      setIpInputError('Invalid IPv4 address or CIDR notation (e.g., 103.21.124.0/24 or 49.207.210.15/32)')
      return
    }

    const newEntry: IpAllowlistEntry = {
      id: `ip-${Date.now()}`,
      cidr: newIpCidr.trim(),
      label: newIpLabel.trim() || 'Custom Authorized IP',
      addedBy: 'Aditi Mehta (Owner)',
      addedAt: 'Today',
    }

    setIpAllowlist([newEntry, ...ipAllowlist])
    setIpModalOpen(false)
    setNewIpCidr('')
    setNewIpLabel('')
    showToast(`Added ${newEntry.cidr} to security IP allowlist`)
  }

  const handleRemoveIp = (entry: IpAllowlistEntry) => {
    setIpAllowlist((prev) => prev.filter((ip) => ip.id !== entry.id))
    showToast(`Removed ${entry.cidr} from allowlist`)
  }

  // Copy Recovery Codes
  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
    showToast('All 8 emergency recovery codes copied to clipboard')
  }

  const handleDownloadRecoveryCodes = () => {
    showToast('Downloaded folio-emergency-recovery-codes.txt')
  }

  return (
    <AppShell active="Security">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#378875]/40 bg-[#378875] px-4 py-3 text-xs font-semibold text-[#f8f7e2] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialogData && (
        <ConfirmDialog
          isOpen={confirmDialogData.isOpen}
          onClose={() => setConfirmDialogData(null)}
          onConfirm={confirmDialogData.action}
          title={confirmDialogData.title}
          body={confirmDialogData.body}
          confirmLabel={confirmDialogData.confirmLabel}
          danger={confirmDialogData.danger}
        />
      )}

      <PageHeading
        eyebrow="Security"
        title="Authentication & Sessions"
        description="Configure MFA requirements, manage enterprise password policies, inspect active user sessions, and enforce static IP allowlists."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <DemoDataChip />
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <SecuritySubNav active="authentication" />

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
          <span>MFA Protection: <strong className="text-[#378875]">Enforced on Privileged Roles</strong></span>
          <span className="text-[#dedecb]">·</span>
          <span>Argon2id Memory Hardened</span>
        </div>
      </div>

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No authentication records"
          description="Session manager has not recorded active logins or identity challenges for this timeframe."
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
          title="Authentication service unreachable"
          message="Could not stream active sessions and MFA enrollment telemetry from auth cluster."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'normal' && (
        <div className="space-y-8 pb-16">
          {/* SECTION 1: SIGN-IN METHODS */}
          <SectionCard
            title="Sign-in methods & multi-factor authentication (MFA)"
            description="Manage authentication factors for workspace access. Enabling modern MFA cuts credential stuffing risk by 99%."
          >
            <div className="divide-y divide-[#dedecb]/60">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#393d68]">{method.name}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          method.statusBadge === 'Enforced'
                            ? 'bg-[#378875]/15 text-[#378875]'
                            : method.statusBadge === 'Active'
                            ? 'bg-[#474c80]/15 text-[#474c80]'
                            : method.statusBadge === 'Available'
                            ? 'bg-[#8b78ae]/15 text-[#8b78ae]'
                            : 'bg-[#dedecb]/60 text-[#686b86]'
                        }`}
                      >
                        {method.statusBadge}
                      </span>
                    </div>
                    <p className="text-xs text-[#686b86] leading-relaxed">{method.description}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Toggle enable */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={method.enabled}
                      onClick={() => {
                        setMethods((prev) =>
                          prev.map((m) =>
                            m.id === method.id
                              ? {
                                  ...m,
                                  enabled: !m.enabled,
                                  statusBadge: !m.enabled ? 'Active' : 'Disabled',
                                }
                              : m
                          )
                        )
                        showToast(`${method.name} ${!method.enabled ? 'enabled' : 'disabled'}`)
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
                        method.enabled ? 'bg-[#378875]' : 'bg-[#dedecb]'
                      }`}
                    >
                      <span
                        className={`inline-block size-3.5 transform rounded-full bg-[#fffef4] transition mt-0.75 ml-0.75 shadow-xs ${
                          method.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    {/* Configure button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (method.type === 'totp') {
                          setTotpSetupOpen(true)
                          setTotpStep(1)
                        } else {
                          showToast(`Opened configuration panel for ${method.name}`)
                        }
                      }}
                      className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#393d68] hover:bg-[#f8f7e2] transition shadow-2xs"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 2: PASSWORD & LOCKOUT POLICY */}
          <SectionCard
            title="Password & account lockout policy"
            description="Enterprise credentials governance, entropy rules, automatic credential expiration, and brute-force lockouts."
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
              {/* Controls Column */}
              <div className="lg:col-span-7 space-y-5">
                {/* Length Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#393d68]">Minimum Password Length</span>
                    <span className="font-mono font-bold text-[#474c80]">{policy.minLength} characters</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={20}
                    step={1}
                    value={policy.minLength}
                    onChange={(e) => setPolicy({ ...policy, minLength: parseInt(e.target.value) })}
                    className="w-full accent-[#474c80]"
                  />
                  <div className="flex justify-between text-[10px] text-[#686b86]">
                    <span>8 (Basic)</span>
                    <span>12 (Recommended)</span>
                    <span>20 (Paranoid)</span>
                  </div>
                </div>

                {/* Character Requirements Checkboxes */}
                <div className="space-y-2 border-t border-[#dedecb]/60 pt-3 text-xs">
                  <label className="block font-bold text-[#393d68]">Complexity Rules</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#393d68]">
                      <input
                        type="checkbox"
                        checked={policy.requireUppercase}
                        onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })}
                        className="rounded-xs border-[#dedecb] text-[#474c80]"
                      />
                      <span>Uppercase (A–Z)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#393d68]">
                      <input
                        type="checkbox"
                        checked={policy.requireLowercase}
                        onChange={(e) => setPolicy({ ...policy, requireLowercase: e.target.checked })}
                        className="rounded-xs border-[#dedecb] text-[#474c80]"
                      />
                      <span>Lowercase (a–z)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#393d68]">
                      <input
                        type="checkbox"
                        checked={policy.requireNumber}
                        onChange={(e) => setPolicy({ ...policy, requireNumber: e.target.checked })}
                        className="rounded-xs border-[#dedecb] text-[#474c80]"
                      />
                      <span>Numbers (0–9)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#393d68]">
                      <input
                        type="checkbox"
                        checked={policy.requireSymbol}
                        onChange={(e) => setPolicy({ ...policy, requireSymbol: e.target.checked })}
                        className="rounded-xs border-[#dedecb] text-[#474c80]"
                      />
                      <span>Symbols (!@#$%)</span>
                    </label>
                  </div>
                </div>

                {/* Expiry & Lockout Selects */}
                <div className="grid grid-cols-2 gap-4 border-t border-[#dedecb]/60 pt-3 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#393d68]">Password Expiry</label>
                    <select
                      value={policy.passwordExpiryDays}
                      onChange={(e) =>
                        setPolicy({ ...policy, passwordExpiryDays: parseInt(e.target.value) })
                      }
                      className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2 font-semibold text-[#393d68]"
                    >
                      <option value={0}>Never expire</option>
                      <option value={30}>Every 30 days</option>
                      <option value={60}>Every 60 days</option>
                      <option value={90}>Every 90 days (Recommended)</option>
                      <option value={180}>Every 180 days</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#393d68]">Lockout Threshold</label>
                    <select
                      value={policy.lockoutAfterAttempts}
                      onChange={(e) =>
                        setPolicy({ ...policy, lockoutAfterAttempts: parseInt(e.target.value) })
                      }
                      className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2 font-semibold text-[#393d68]"
                    >
                      <option value={3}>After 3 failed attempts</option>
                      <option value={5}>After 5 failed attempts</option>
                      <option value={10}>After 10 failed attempts</option>
                    </select>
                  </div>
                </div>

                {/* Master Require MFA Toggle with Warning */}
                <div className="rounded-2xl border border-[#cf9c50]/40 bg-[#cf9c50]/10 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#393d68]">
                        Require MFA for all workspace members
                      </h4>
                      <p className="text-[11px] text-[#686b86]">
                        Enforces mandatory two-factor enrollment upon next sign-in.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={policy.requireMfaForAllMembers}
                      onClick={() =>
                        setPolicy({
                          ...policy,
                          requireMfaForAllMembers: !policy.requireMfaForAllMembers,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
                        policy.requireMfaForAllMembers ? 'bg-[#378875]' : 'bg-[#dedecb]'
                      }`}
                    >
                      <span
                        className={`inline-block size-3.5 transform rounded-full bg-[#fffef4] transition mt-0.75 ml-0.75 shadow-xs ${
                          policy.requireMfaForAllMembers ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {!policy.requireMfaForAllMembers && (
                    <div className="text-[11px] text-[#a24650] font-semibold flex items-center gap-1.5 pt-1">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>Warning: 2 active members (Ananya Sharma, Devendra Kulkarni) will be forced to enroll immediately upon enabling.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Policy Strength Preview Column */}
              <div className="lg:col-span-5 rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/30 p-5 space-y-4">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#686b86]">
                  Live Policy Strength Preview
                </span>

                <div className="space-y-1.5 text-xs">
                  <label className="block text-[#686b86]">Test sample user password:</label>
                  <input
                    type="text"
                    value={previewPassword}
                    onChange={(e) => setPreviewPassword(e.target.value)}
                    placeholder="Enter sample password..."
                    className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5 font-mono text-xs font-bold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                  />
                </div>

                {/* Score bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#686b86]">Evaluated Strength</span>
                    <span className="font-bold font-mono" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#dedecb]/60">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${passwordStrength.percent}%`,
                        backgroundColor: passwordStrength.color,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-[#686b86] pt-1">
                  <div className="flex items-center gap-1.5">
                    {previewPassword.length >= policy.minLength ? (
                      <Check className="size-3.5 text-[#378875]" />
                    ) : (
                      <X className="size-3.5 text-[#a24650]" />
                    )}
                    <span>Length &ge; {policy.minLength} characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/[A-Z]/.test(previewPassword) ? (
                      <Check className="size-3.5 text-[#378875]" />
                    ) : (
                      <X className="size-3.5 text-[#a24650]" />
                    )}
                    <span>Contains uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/[0-9]/.test(previewPassword) ? (
                      <Check className="size-3.5 text-[#378875]" />
                    ) : (
                      <X className="size-3.5 text-[#a24650]" />
                    )}
                    <span>Contains numeric digit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/[^A-Za-z0-9]/.test(previewPassword) ? (
                      <Check className="size-3.5 text-[#378875]" />
                    ) : (
                      <X className="size-3.5 text-[#a24650]" />
                    )}
                    <span>Contains special symbol</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 3: ACTIVE SESSIONS */}
          <SectionCard
            title={`Active web sessions (${sessions.length})`}
            description="Concurrent sessions authenticated into your workspace. Suspicious sessions can be invalidated in real time."
            action={
              sessions.length > 1 && (
                <button
                  type="button"
                  onClick={handleSignoutAllOtherSessions}
                  className="rounded-xl border border-[#a24650]/40 bg-[#fffef4] px-3.5 py-1.5 text-xs font-bold text-[#a24650] hover:bg-[#a24650] hover:text-[#f8f7e2] transition shadow-2xs"
                >
                  Sign out all other sessions
                </button>
              )
            }
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Device & Browser</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3">Session Started</th>
                    <th className="py-3 px-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-[#f8f7e2]/40 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Laptop className="size-4 text-[#474c80]" />
                          <span className="font-bold text-[#393d68]">{sess.device}</span>
                          {sess.current && (
                            <span className="rounded-full bg-[#378875]/15 px-2 py-0.2 text-[9px] font-bold text-[#378875]">
                              This device
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#686b86]">{sess.location}</td>
                      <td className="py-3 px-3 font-mono text-[#686b86]">
                        {/* Masked last octet for privacy */}
                        {sess.ip.replace(/\.\d+$/, '.•••')}
                      </td>
                      <td className="py-3 px-3 text-[#686b86] whitespace-nowrap">{sess.startedAt}</td>
                      <td className="py-3 px-3 text-right pr-4 whitespace-nowrap">
                        {!sess.current ? (
                          <button
                            type="button"
                            onClick={() => handleSignoutSession(sess)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#a24650]/30 px-2 py-1 text-[11px] font-bold text-[#a24650] hover:bg-[#a24650]/10 transition"
                          >
                            <LogOut className="size-3" />
                            <span>Sign out</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#378875] font-semibold">Active now</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* SECTION 4: LOGIN HISTORY TIMELINE */}
          <SectionCard
            title="Authentication event history"
            description="Timeline of the last 20 sign-in requests across password, SSO, and hardware biometric keys."
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-3">Time (IST)</th>
                    <th className="py-3 px-3">User</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Location & IP</th>
                    <th className="py-3 px-3">Verdict</th>
                    <th className="py-3 px-3 text-right pr-4">Security Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {loginHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f8f7e2]/40 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#686b86]">{item.at}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#393d68]">{item.actor}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#474c80] font-medium">
                        {item.method}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#686b86]">
                        {item.location} ({item.ip.replace(/\.\d+$/, '.•••')})
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                            item.status === 'success'
                              ? 'bg-[#378875]/15 text-[#378875]'
                              : item.status === 'failed'
                              ? 'bg-[#a24650]/15 text-[#a24650]'
                              : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setNotMeIncidentItem(item)
                            setNotMeStep(1)
                          }}
                          className="text-[11px] font-bold text-[#a24650] hover:underline"
                        >
                          Not me?
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* SECTION 5: TRUSTED DEVICES & IP ALLOWLIST */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Trusted Devices (Left 6 cols) */}
            <div className="lg:col-span-6">
              <SectionCard
                title="Trusted hardware devices"
                description="Laptops and biometric phones authorized with remembered credentials."
              >
                <div className="space-y-3 pt-1">
                  {trustedDevices.map((dev) => (
                    <div
                      key={dev.id}
                      className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-3.5 flex justify-between items-start"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Laptop className="size-4 text-[#474c80]" />
                          <h4 className="font-bold text-xs text-[#393d68]">{dev.name}</h4>
                        </div>
                        <p className="text-[11px] text-[#686b86]">{dev.platform}</p>
                        <div className="text-[10px] text-[#686b86] font-mono">
                          {dev.fingerprint} · Last active: {dev.lastUsed}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(dev)}
                        className="rounded-lg p-1.5 text-[#686b86] hover:bg-[#a24650]/10 hover:text-[#a24650] transition"
                        title="Remove trusted device"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* IP Allowlist (Right 6 cols) */}
            <div className="lg:col-span-6">
              <SectionCard
                title="Corporate IP allowlist"
                description="Restrict access strictly to verified enterprise office gateways or VPN CIDR blocks."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setIpModalOpen(true)
                      setIpInputError(null)
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#474c80] px-3 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                  >
                    <Plus className="size-3" />
                    <span>Add IP block</span>
                  </button>
                }
              >
                <div className="space-y-3 pt-1">
                  {ipAllowlist.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-3.5 flex justify-between items-start"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Globe className="size-4 text-[#378875]" />
                          <span className="font-mono text-xs font-bold text-[#393d68]">
                            {entry.cidr}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#686b86]">{entry.label}</p>
                        <div className="text-[10px] text-[#686b86]">
                          Added by {entry.addedBy} on {entry.addedAt}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveIp(entry)}
                        className="rounded-lg p-1.5 text-[#686b86] hover:bg-[#a24650]/10 hover:text-[#a24650] transition"
                        title="Remove IP from allowlist"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* STICKY POLICY SAVE BAR */}
          {isPolicyDirty && (
            <div className="fixed bottom-6 inset-x-6 sm:inset-x-auto sm:right-6 sm:left-auto z-40 flex items-center justify-between gap-4 rounded-2xl border border-[#474c80] bg-[#fffef4] p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#393d68]">
                <span className="size-2 rounded-full bg-[#cf9c50] animate-pulse" />
                <span>You have unsaved changes to authentication & lockout policies.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPolicy({ ...originalPolicy })
                    showToast('Authentication changes discarded')
                  }}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-3.5 py-1.5 text-xs font-semibold text-[#393d68] hover:bg-[#dedecb]/40"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOriginalPolicy({ ...policy })
                    showToast('Authentication policy saved successfully')
                  }}
                  className="rounded-xl bg-[#474c80] px-4 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOTP AUTHENTICATOR APP SETUP DIALOG */}
      {totpSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Configure Authenticator App</h3>
                <span className="text-xs text-[#686b86]">Step {totpStep} of 2</span>
              </div>
              <button
                type="button"
                onClick={() => setTotpSetupOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* STEP 1: QR & Setup Key & 6-Digit Code */}
            {totpStep === 1 && (
              <div className="space-y-4 text-xs">
                {/* CSS Square Placeholder QR */}
                <div className="mx-auto flex size-36 items-center justify-center rounded-2xl border-2 border-dashed border-[#474c80] bg-[#f8f7e2] p-3">
                  <div className="grid grid-cols-4 gap-1.5 size-full">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-xs ${
                          i % 2 === 0 || i % 5 === 0 ? 'bg-[#393d68]' : 'bg-[#fffef4]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <label className="block text-[#686b86]">Or enter setup key manually:</label>
                  <SecretField value="JBSWY3DPEHPK3PXP" />
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="block font-bold text-[#393d68]">
                    Enter 6-digit confirmation code:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCodeInput}
                    onChange={(e) => setTotpCodeInput(e.target.value)}
                    placeholder="e.g., 492 108"
                    className="w-full text-center tracking-widest font-mono text-base font-bold rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2 text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#dedecb]">
                  <button
                    type="button"
                    onClick={() => setTotpSetupOpen(false)}
                    className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 font-semibold text-[#393d68]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={totpCodeInput.length < 6}
                    onClick={() => setTotpStep(2)}
                    className="rounded-xl bg-[#474c80] px-4 py-2 font-bold text-[#f8f7e2] hover:bg-[#393d68] disabled:opacity-50"
                  >
                    Verify & Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: RECOVERY CODES */}
            {totpStep === 2 && (
              <div className="space-y-4 text-xs">
                <p className="text-[#686b86] leading-relaxed">
                  Save these emergency recovery codes in a secure password vault. Each code can only be used once if you lose device access.
                </p>

                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/50 p-3 font-mono text-xs">
                  {recoveryCodes.map((code, idx) => (
                    <div key={idx} className="rounded-lg bg-[#fffef4] p-1.5 text-center font-bold text-[#393d68]">
                      {recoveryCodesRevealed ? code : '••••-••••-••••'}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryCodesRevealed(!recoveryCodesRevealed)}
                    className="inline-flex items-center gap-1 text-[#474c80] font-bold hover:underline"
                  >
                    {recoveryCodesRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    <span>{recoveryCodesRevealed ? 'Hide codes' : 'Reveal codes'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRecoveryCodes}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 font-bold text-[#393d68]"
                    >
                      {copiedCodes ? <Check className="size-3 text-[#378875]" /> : <Copy className="size-3" />}
                      <span>Copy all</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadRecoveryCodes}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 font-bold text-[#393d68]"
                    >
                      <Download className="size-3" />
                      <span>.txt</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#dedecb] flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTotpSetupOpen(false)
                      showToast('Authenticator app configured and active')
                    }}
                    className="rounded-xl bg-[#378875] px-4 py-2 font-bold text-[#f8f7e2] hover:bg-[#378875]/90"
                  >
                    Done & Saved
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOT ME? INCIDENT RESPONSE WIZARD */}
      {notMeIncidentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#a24650]/40 bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#a24650]">
                  Security Incident: Unrecognized Sign-in
                </h3>
                <span className="text-xs text-[#686b86]">Remediation Step {notMeStep} of 3</span>
              </div>
              <button
                type="button"
                onClick={() => setNotMeIncidentItem(null)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 p-3 text-xs space-y-1">
              <div>Event: <strong className="text-[#393d68]">{notMeIncidentItem.actor}</strong></div>
              <div className="text-[#686b86]">{notMeIncidentItem.location} ({notMeIncidentItem.ip}) at {notMeIncidentItem.at}</div>
            </div>

            {/* Step 1: Change Password */}
            {notMeStep === 1 && (
              <div className="space-y-3 text-xs">
                <p className="text-[#686b86]">
                  Step 1: Invalidate your existing credentials immediately and set a fresh enterprise password.
                </p>
                <input
                  type="password"
                  placeholder="Enter new strong password..."
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setNotMeStep(2)}
                  className="w-full rounded-xl bg-[#474c80] py-2 font-bold text-[#f8f7e2]"
                >
                  Confirm Password Reset & Continue
                </button>
              </div>
            )}

            {/* Step 2: Sign out sessions */}
            {notMeStep === 2 && (
              <div className="space-y-3 text-xs">
                <p className="text-[#686b86]">
                  Step 2: Terminate all remote sessions to disconnect any potential unauthorized actors.
                </p>
                <button
                  type="button"
                  onClick={() => setNotMeStep(3)}
                  className="w-full rounded-xl bg-[#a24650] py-2 font-bold text-[#f8f7e2]"
                >
                  Terminate All Remote Sessions
                </button>
              </div>
            )}

            {/* Step 3: Notify Admin */}
            {notMeStep === 3 && (
              <div className="space-y-3 text-xs">
                <p className="text-[#686b86]">
                  Step 3: Alert workspace administrators (Aditi Mehta, Rohan Shah) and log high-priority security signal THR-113.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNotMeIncidentItem(null)
                    showToast('Credentials rotated, sessions killed, and security incident dispatched to lead controller.')
                  }}
                  className="w-full rounded-xl bg-[#378875] py-2 font-bold text-[#f8f7e2]"
                >
                  Dispatch Incident & Return
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IP ALLOWLIST EDITOR MODAL */}
      {ipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Add Authorized IP / CIDR</h3>
                <p className="text-xs text-[#686b86]">Permit traffic from corporate VPNs or branch static IPs.</p>
              </div>
              <button
                type="button"
                onClick={() => setIpModalOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleAddIpAllowlist} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">IPv4 Address or CIDR Block</label>
                <input
                  type="text"
                  required
                  value={newIpCidr}
                  onChange={(e) => setNewIpCidr(e.target.value)}
                  placeholder="e.g., 103.21.124.0/24 or 49.207.210.15"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 font-mono text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
                {ipInputError && (
                  <p className="text-[11px] font-bold text-[#a24650] flex items-center gap-1 mt-1">
                    <AlertTriangle className="size-3" />
                    <span>{ipInputError}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Location / Gateway Label</label>
                <input
                  type="text"
                  required
                  value={newIpLabel}
                  onChange={(e) => setNewIpLabel(e.target.value)}
                  placeholder="e.g., Chennai Accounting Office VPN"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedecb]">
                <button
                  type="button"
                  onClick={() => setIpModalOpen(false)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 font-semibold text-[#393d68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#474c80] px-4 py-2 font-bold text-[#f8f7e2] hover:bg-[#393d68]"
                >
                  Save IP Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
