'use client'

import React, { useState, useEffect } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  UserCheck,
  KeyRound,
  FileCheck2,
  AlertTriangle,
  Flame,
  Bot,
  Webhook,
  Scale,
  type LucideIcon,
  CircleDot,
  CheckCircle2,
  X,
  HelpCircle,
} from 'lucide-react'
import type { Role } from '@/lib/security-data'

// ------------------------------------------
// 1. SUB-NAVIGATION TABS
// ------------------------------------------

export const SECURITY_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', href: '/app/security', icon: ShieldCheck },
  { id: 'access', label: 'Access & RBAC', href: '/app/security/access', icon: UserCheck },
  { id: 'authentication', label: 'Auth & Sessions', href: '/app/security/authentication', icon: KeyRound },
  { id: 'data', label: 'Data & Secrets', href: '/app/security/data', icon: Lock },
  { id: 'audit', label: 'Audit Trail', href: '/app/security/audit', icon: FileCheck2 },
  { id: 'threats', label: 'Threats & Signals', href: '/app/security/threats', icon: Flame },
  { id: 'ai', label: 'AI Guardrails', href: '/app/security/ai', icon: Bot },
  { id: 'integrations', label: 'API & Integrations', href: '/app/security/integrations', icon: Webhook },
  { id: 'compliance', label: 'DPDP & Compliance', href: '/app/security/compliance', icon: Scale },
] as const

export type SecurityNavId = (typeof SECURITY_NAV_ITEMS)[number]['id']

export function SecuritySubNav({ active }: { active: SecurityNavId | string }) {
  return (
    <nav
      aria-label="Security sub-navigation"
      className="mb-7 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
    >
      {SECURITY_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id || active === item.href

        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
              isActive
                ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
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

// ------------------------------------------
// 2. SECRET FIELD WITH TIMED AUTO RE-MASK
// ------------------------------------------

export function SecretField({
  value,
  maskedPlaceholder = '••••••••••••••••',
  className = '',
}: {
  value: string
  maskedPlaceholder?: string
  className?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Auto re-mask after 10 seconds
  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => {
        setRevealed(false)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [revealed])

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 px-3 py-1.5 font-mono text-xs ${className}`}
    >
      <span className="font-semibold text-[#393d68]">
        {revealed ? value : maskedPlaceholder}
      </span>
      <div className="flex items-center gap-1 border-l border-[#dedecb] pl-2 text-[#686b86]">
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          title={revealed ? 'Hide secret (auto-hides in 10s)' : 'Reveal secret'}
          className="rounded-md p-1 hover:bg-[#dedecb]/50 hover:text-[#393d68] transition"
        >
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy secret"
          className="rounded-md p-1 hover:bg-[#dedecb]/50 hover:text-[#393d68] transition"
        >
          {copied ? <Check className="size-3.5 text-[#378875]" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------
// 3. ROLE BADGE
// ------------------------------------------

export function RoleBadge({ role, className = '' }: { role: Role | string; className?: string }) {
  const styles: Record<string, string> = {
    Owner: 'bg-[#474c80]/15 text-[#474c80] border-[#474c80]/30',
    Admin: 'bg-[#8b78ae]/20 text-[#474c80] border-[#8b78ae]/40',
    Accountant: 'bg-[#378875]/15 text-[#378875] border-[#378875]/30',
    Reviewer: 'bg-[#cf9c50]/15 text-[#cf9c50] border-[#cf9c50]/30',
    Auditor: 'bg-[#dedecb]/70 text-[#686b86] border-[#dedecb]',
  }

  const normalized = styles[role] || 'bg-[#dedecb]/50 text-[#686b86] border-[#dedecb]'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${normalized} ${className}`}
    >
      <span>{role === 'Auditor' ? 'Auditor (read-only)' : role}</span>
    </span>
  )
}

// ------------------------------------------
// 4. RISK METER (0 to 100)
// ------------------------------------------

export function RiskMeter({
  score,
  label = 'Posture score',
  className = '',
}: {
  score: number // 0 to 100
  label?: string
  className?: string
}) {
  // Green below 30, Amber 30 to 70, Red above 70 (or posture 78 is strong if posture score)
  // README: green below 30, amber 30 to 70, red above 70 with a text label
  let toneColor = '#378875' // green
  let statusText = 'Low Risk'

  if (score >= 70) {
    toneColor = '#a24650' // red
    statusText = 'Critical Risk'
  } else if (score >= 30) {
    toneColor = '#cf9c50' // amber
    statusText = 'Elevated Risk'
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#686b86]">{label}</span>
        <span className="font-mono font-bold" style={{ color: toneColor }}>
          {score}/100 ({statusText})
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#f8f7e2] border border-[#dedecb]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: toneColor }}
        />
      </div>
    </div>
  )
}

// ------------------------------------------
// 5. PERMISSION DOT
// ------------------------------------------

export type PermissionLevel = 'none' | 'view' | 'edit' | 'admin'

export function PermissionDot({
  level,
  className = '',
}: {
  level: PermissionLevel
  className?: string
}) {
  const configs: Record<PermissionLevel, { label: string; color: string; bg: string }> = {
    none: { label: 'No access', color: '#686b86', bg: 'bg-[#dedecb]' },
    view: { label: 'View only', color: '#8b78ae', bg: 'bg-[#8b78ae]' },
    edit: { label: 'Edit & Review', color: '#cf9c50', bg: 'bg-[#cf9c50]' },
    admin: { label: 'Full Admin', color: '#378875', bg: 'bg-[#378875]' },
  }

  const { label, bg, color } = configs[level] || configs.none

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}
      style={{ color }}
    >
      <span className={`size-2 rounded-full ${bg}`} />
      <span>{label}</span>
    </span>
  )
}

// ------------------------------------------
// 6. CONFIRM DIALOG (DESTRUCTIVE ACTIONS)
// ------------------------------------------

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  danger = true,
  requireTyping,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
  requireTyping?: string // e.g. "REVOKE" or resource name
}) {
  const [typedValue, setTypedValue] = useState('')

  if (!isOpen) return null

  const isConfirmDisabled = requireTyping ? typedValue.trim() !== requireTyping.trim() : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
          <div className="flex items-center gap-2">
            {danger ? (
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#a24650]/15 text-[#a24650]">
                <AlertTriangle className="size-4" />
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#474c80]/15 text-[#474c80]">
                <Shield className="size-4" />
              </span>
            )}
            <h3 className="text-base font-black text-[#393d68]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-xs text-[#686b86] leading-relaxed">{body}</p>

        {requireTyping && (
          <div className="space-y-1.5 pt-1 text-xs">
            <label className="block text-[#686b86]">
              Please type <strong className="font-mono text-[#393d68]">{requireTyping}</strong> to proceed:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requireTyping}
              className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 px-3 py-2 font-mono text-xs font-bold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
            />
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#dedecb]/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68] hover:bg-[#dedecb]/40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold text-[#f8f7e2] transition shadow-xs disabled:opacity-50 ${
              danger ? 'bg-[#a24650] hover:bg-[#a24650]/90' : 'bg-[#474c80] hover:bg-[#393d68]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------
// 7. MASKED VALUE (GSTIN, PHONE, EMAIL, AMOUNT)
// ------------------------------------------

export function MaskedValue({
  value,
  kind,
  className = '',
}: {
  value: string | number
  kind: 'gstin' | 'phone' | 'email' | 'amount'
  className?: string
}) {
  const [revealed, setRevealed] = useState(false)

  const stringVal = String(value)

  const getMasked = () => {
    switch (kind) {
      case 'gstin':
        // e.g. 27AABCU9603R1ZM -> 27AA••••••1ZM
        if (stringVal.length >= 8) {
          return `${stringVal.slice(0, 4)}••••••${stringVal.slice(-3)}`
        }
        return '•••••••••••••••'
      case 'phone':
        // +91 98201 44820 -> +91 ••••• ••820
        return '+91 ••••• ••' + stringVal.slice(-3)
      case 'email':
        // aditi.mehta@folio-tax.in -> a•••a@folio-tax.in
        const parts = stringVal.split('@')
        if (parts.length === 2) {
          const user = parts[0]
          return `${user[0]}•••${user[user.length - 1]}@${parts[1]}`
        }
        return '•••••@••••.in'
      case 'amount':
        return '₹•••••••'
      default:
        return '••••••••'
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}>
      <span className="text-[#393d68] font-semibold">{revealed ? stringVal : getMasked()}</span>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        title={revealed ? 'Mask value' : 'Reveal value'}
        className="rounded p-0.5 text-[#686b86] hover:text-[#393d68]"
      >
        {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </button>
    </span>
  )
}

// ------------------------------------------
// 8. DEMO DATA CHIP
// ------------------------------------------

export function DemoDataChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#dedecb] bg-[#fffef4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#686b86] shadow-2xs">
      <CircleDot className="size-2 text-[#cf9c50]" />
      <span>Demo Data</span>
    </span>
  )
}
