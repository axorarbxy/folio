'use client'

import React, { useState, useMemo } from 'react'
import {
  UserCheck,
  Users,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Mail,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Shield,
  Clock,
  LogOut,
  Trash2,
  Lock,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard } from '@/components/app-shell'
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
  RoleBadge,
  PermissionDot,
  ConfirmDialog,
  type PermissionLevel,
} from '@/components/security-kit'
import {
  getSecurityMembers,
  getCapabilitiesMatrix,
  getSeparationOfDutiesRules,
  getSecurityAuditEvents,
  getActiveSessions,
  type Member,
  type Role,
  type CapabilityPermission,
  type SeparationOfDutiesRule,
  type AuditEvent,
  type SessionInfo,
} from '@/lib/security-data'

type ViewMode = 'normal' | 'skeleton' | 'empty' | 'error'
type AccessTab = 'members' | 'roles_permissions'

export default function SecurityAccessWorkspace() {
  const [activeTab, setActiveTab] = useState<AccessTab>('members')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // Datasets
  const [members, setMembers] = useState<Member[]>(getSecurityMembers())
  const [capabilities, setCapabilities] = useState<CapabilityPermission[]>(getCapabilitiesMatrix())
  const [sodRules, setSodRules] = useState<SeparationOfDutiesRule[]>(getSeparationOfDutiesRules())
  const [auditEvents] = useState<AuditEvent[]>(getSecurityAuditEvents())
  const [sessions, setSessions] = useState<SessionInfo[]>(getActiveSessions())

  // Tab 1: Member Filters & Selection
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [mfaFilter, setMfaFilter] = useState<'All' | 'Enabled' | 'Disabled'>('All')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  // Drawer & Modal States
  const [drawerMember, setDrawerMember] = useState<Member | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [customRoleModalOpen, setCustomRoleModalOpen] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    isOpen: boolean
    title: string
    body: string
    confirmLabel: string
    danger: boolean
    requireTyping?: string
    action: () => void
  } | null>(null)

  // Dev Toggle: Simulate role change failure
  const [failRoleChange, setFailRoleChange] = useState(false)

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('Reviewer')
  const [inviteExpiry, setInviteExpiry] = useState('')
  const [inviteNote, setInviteNote] = useState('')

  // Custom Role Form State
  const [customRoleName, setCustomRoleName] = useState('')
  const [customRoleCopyFrom, setCustomRoleCopyFrom] = useState<Role>('Reviewer')
  const [selectedCustomCaps, setSelectedCustomCaps] = useState<string[]>(['cap-1', 'cap-2'])

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== 'All' && m.role !== roleFilter) return false
      if (statusFilter !== 'All' && m.status !== statusFilter) return false
      if (mfaFilter === 'Enabled' && !m.mfa) return false
      if (mfaFilter === 'Disabled' && m.mfa) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchName = m.name.toLowerCase().includes(q)
        const matchEmail = m.email.toLowerCase().includes(q)
        if (!matchName && !matchEmail) return false
      }
      return true
    })
  }, [members, roleFilter, statusFilter, mfaFilter, searchQuery])

  // Multi-select helpers
  const handleSelectAll = () => {
    if (selectedMemberIds.length === filteredMembers.length) {
      setSelectedMemberIds([])
    } else {
      setSelectedMemberIds(filteredMembers.map((m) => m.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Member Actions
  const handleRoleChange = (memberId: string, newRole: Role) => {
    if (failRoleChange) {
      showToast('Error: Failed to change role. Enterprise authorization policy rejected change.')
      return
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    )
    if (drawerMember?.id === memberId) {
      setDrawerMember((prev) => (prev ? { ...prev, role: newRole } : null))
    }
    showToast(`Role updated to ${newRole}`)
  }

  const handleSuspendMember = (member: Member) => {
    setConfirmDialogData({
      isOpen: true,
      title: `Suspend ${member.name}?`,
      body: `Suspending this user will immediately revoke all active web sessions and prevent authentication until unsuspended by an Admin or Owner.`,
      confirmLabel: 'Suspend Member',
      danger: true,
      action: () => {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, status: 'suspended' } : m))
        )
        if (drawerMember?.id === member.id) {
          setDrawerMember((prev) => (prev ? { ...prev, status: 'suspended' } : null))
        }
        showToast(`${member.name} has been suspended`)
      },
    })
  }

  const handleRemoveMember = (member: Member) => {
    setConfirmDialogData({
      isOpen: true,
      title: `Permanently Remove ${member.name}?`,
      body: `This action will permanently delete access rights and revoke all API keys associated with this account. Please type the user's name to confirm.`,
      confirmLabel: 'Delete Member',
      danger: true,
      requireTyping: member.name,
      action: () => {
        setMembers((prev) => prev.filter((m) => m.id !== member.id))
        if (drawerMember?.id === member.id) {
          setDrawerMember(null)
        }
        showToast(`${member.name} removed from workspace`)
      },
    })
  }

  const handleResetMfa = (member: Member) => {
    setConfirmDialogData({
      isOpen: true,
      title: `Reset MFA for ${member.name}?`,
      body: `The user will be required to re-configure their TOTP authenticator application upon their next login.`,
      confirmLabel: 'Reset MFA Token',
      danger: false,
      action: () => {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, mfa: false } : m))
        )
        if (drawerMember?.id === member.id) {
          setDrawerMember((prev) => (prev ? { ...prev, mfa: false } : null))
        }
        showToast(`MFA reset for ${member.name}. User must enroll on next login.`)
      },
    })
  }

  // Bulk actions
  const handleBulkSuspend = () => {
    setConfirmDialogData({
      isOpen: true,
      title: `Suspend ${selectedMemberIds.length} Members?`,
      body: `This will suspend access for all selected members and terminate their current active sessions.`,
      confirmLabel: 'Suspend Selected',
      danger: true,
      action: () => {
        setMembers((prev) =>
          prev.map((m) => (selectedMemberIds.includes(m.id) ? { ...m, status: 'suspended' } : m))
        )
        showToast(`Suspended ${selectedMemberIds.length} members`)
        setSelectedMemberIds([])
      },
    })
  }

  const handleBulkRequireMfa = () => {
    setMembers((prev) =>
      prev.map((m) => (selectedMemberIds.includes(m.id) ? { ...m, mfa: true } : m))
    )
    showToast(`MFA requirement enforced on ${selectedMemberIds.length} members`)
    setSelectedMemberIds([])
  }

  // Invite Submit
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    const newMember: Member = {
      id: `usr-${Date.now()}`,
      name: inviteName || inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      mfa: false,
      lastActive: `Invited today (Expires: ${inviteExpiry || '30 days'})`,
      status: 'invited',
    }
    setMembers([newMember, ...members])
    setInviteModalOpen(false)
    setInviteEmail('')
    setInviteName('')
    setInviteNote('')
    showToast(`Invitation sent to ${newMember.email} with role ${newMember.role}`)
  }

  // Custom Role Risk Warning
  const isRiskyCustomRole = useMemo(() => {
    // Risky: Approves validation (cap-3) AND Sends vendor messages (cap-4) OR Edits invoices (cap-2)
    return selectedCustomCaps.includes('cap-3') && selectedCustomCaps.includes('cap-4')
  }, [selectedCustomCaps])

  const handleCreateCustomRole = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customRoleName) return
    showToast(`Custom role "${customRoleName}" defined with ${selectedCustomCaps.length} capabilities`)
    setCustomRoleModalOpen(false)
    setCustomRoleName('')
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
          requireTyping={confirmDialogData.requireTyping}
        />
      )}

      <PageHeading
        eyebrow="Security"
        title="Access Control & RBAC Matrix"
        description="Enforce least-privilege principles, manage workspace memberships, review active sessions, and configure granular role capabilities."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <DemoDataChip />
            <LiveIndicator />
            <TimeRangeControl value={timeRange} onChange={setTimeRange} />
          </div>
        }
      />

      <SecuritySubNav active="access" />

      {/* Primary Tab Navigation & State Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dedecb] bg-[#fffef4] px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-[#dedecb] bg-[#f8f7e2]/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'members'
                  ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
                  : 'text-[#686b86] hover:text-[#393d68]'
              }`}
            >
              <Users className="size-3.5" />
              <span>Members ({members.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roles_permissions')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'roles_permissions'
                  ? 'bg-[#474c80] text-[#f8f7e2] shadow-xs'
                  : 'text-[#686b86] hover:text-[#393d68]'
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Roles & permissions</span>
            </button>
          </div>

          {/* Dev Toggle */}
          <label className="hidden sm:flex items-center gap-2 text-xs text-[#686b86] border-l border-[#dedecb] pl-3 cursor-pointer">
            <input
              type="checkbox"
              checked={failRoleChange}
              onChange={(e) => setFailRoleChange(e.target.checked)}
              className="rounded-xs border-[#dedecb] text-[#474c80]"
            />
            <span>Simulate role error</span>
          </label>
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

      {viewMode === 'skeleton' && <SkeletonPanel rows={7} />}

      {viewMode === 'empty' && (
        <EmptyPanel
          title="No pending members or invites"
          description="Workspace directory currently has no users matching the active criteria."
          action={
            <button
              type="button"
              onClick={() => {
                setRoleFilter('All')
                setStatusFilter('All')
                setMfaFilter('All')
                setSearchQuery('')
                setViewMode('normal')
              }}
              className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2]"
            >
              Reset filters
            </button>
          }
        />
      )}

      {viewMode === 'error' && (
        <ErrorPanel
          title="RBAC Directory Unreachable"
          message="Could not stream active role assignments from enterprise identity provider."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {/* TAB 1: MEMBERS DIRECTORY */}
      {viewMode === 'normal' && activeTab === 'members' && (
        <div className="space-y-6">
          <SectionCard
            title={`Workspace members (${filteredMembers.length})`}
            description="Manage identity lifecycle, MFA enforcement, and access levels across accounting and audit personnel."
            action={
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
              >
                <Plus className="size-3.5" />
                <span>Invite member</span>
              </button>
            }
          >
            {/* Filter & Search Bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#dedecb]/60 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#686b86]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or email..."
                    className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 py-1.5 pl-8 pr-3 text-xs text-[#393d68] placeholder:text-[#686b86]/70 focus:border-[#474c80] focus:outline-hidden"
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="All">All roles</option>
                  <option value="Owner">Owner</option>
                  <option value="Admin">Admin</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Reviewer">Reviewer</option>
                  <option value="Auditor">Auditor</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="All">All statuses</option>
                  <option value="active">Active</option>
                  <option value="invited">Pending Invite</option>
                  <option value="suspended">Suspended</option>
                </select>

                {/* MFA Filter */}
                <select
                  value={mfaFilter}
                  onChange={(e) => setMfaFilter(e.target.value as any)}
                  className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="All">All MFA states</option>
                  <option value="Enabled">MFA Enrolled</option>
                  <option value="Disabled">MFA Missing</option>
                </select>
              </div>

              {/* Bulk Action Trigger Bar */}
              {selectedMemberIds.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-[#474c80] px-3 py-1.5 text-xs text-[#f8f7e2] animate-in fade-in">
                  <span className="font-bold">{selectedMemberIds.length} selected</span>
                  <button
                    type="button"
                    onClick={handleBulkRequireMfa}
                    className="rounded-lg bg-[#393d68] px-2 py-0.5 text-[11px] font-bold hover:bg-[#393d68]/80"
                  >
                    Require MFA
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSuspend}
                    className="rounded-lg bg-[#a24650] px-2 py-0.5 text-[11px] font-bold hover:bg-[#a24650]/80"
                  >
                    Suspend Selected
                  </button>
                </div>
              )}
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 pl-4 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.length > 0 && selectedMemberIds.length === filteredMembers.length}
                        onChange={handleSelectAll}
                        className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                      />
                    </th>
                    <th className="py-3 px-3">Member & Email</th>
                    <th className="py-3 px-3">Assigned Role</th>
                    <th className="py-3 px-3">MFA Status</th>
                    <th className="py-3 px-3">Last Active</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {filteredMembers.map((member) => {
                    const isSelected = selectedMemberIds.includes(member.id)
                    const avatarInitials = member.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')

                    return (
                      <tr
                        key={member.id}
                        onClick={() => setDrawerMember(member)}
                        className={`cursor-pointer transition hover:bg-[#f8f7e2]/40 ${
                          isSelected ? 'bg-[#f8f7e2]/70' : ''
                        }`}
                      >
                        <td className="py-3 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(member.id)}
                            className="rounded-sm border-[#dedecb] text-[#474c80] focus:ring-0"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 items-center justify-center rounded-xl bg-[#474c80] text-[10px] font-bold text-[#f8f7e2]">
                              {avatarInitials}
                            </span>
                            <div>
                              <div className="font-bold text-[#393d68]">{member.name}</div>
                              <div className="text-[11px] text-[#686b86]">{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {member.mfa ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#378875]">
                              <ShieldCheck className="size-3.5 text-[#378875]" />
                              <span>Enforced (TOTP)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#cf9c50]">
                              <ShieldAlert className="size-3.5 text-[#cf9c50]" />
                              <span>Not enrolled</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#686b86] whitespace-nowrap">
                          {member.lastActive}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              member.status === 'active'
                                ? 'bg-[#378875]/15 text-[#378875]'
                                : member.status === 'invited'
                                ? 'bg-[#cf9c50]/15 text-[#cf9c50]'
                                : 'bg-[#a24650]/15 text-[#a24650]'
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDrawerMember(member)}
                              className="rounded-lg border border-[#dedecb] bg-[#fffef4] px-2 py-1 text-[11px] font-semibold text-[#393d68] hover:bg-[#f8f7e2]"
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
      {viewMode === 'normal' && activeTab === 'roles_permissions' && (
        <div className="space-y-7">
          {/* Permission Matrix */}
          <SectionCard
            title="Capability permissions matrix"
            description="Deterministic RBAC permissions defining what each role can access across the GST lifecycle."
            action={
              <button
                type="button"
                onClick={() => setCustomRoleModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#474c80] px-3.5 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] shadow-2xs transition"
              >
                <Plus className="size-3.5" />
                <span>Create custom role</span>
              </button>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-[#dedecb]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dedecb] bg-[#f8f7e2]/60 text-[11px] font-bold text-[#686b86]">
                    <th className="py-3 px-4 min-w-[280px]">Capability & Description</th>
                    <th className="py-3 px-3 text-center">Owner</th>
                    <th className="py-3 px-3 text-center">Admin</th>
                    <th className="py-3 px-3 text-center">Accountant</th>
                    <th className="py-3 px-3 text-center">Reviewer</th>
                    <th className="py-3 px-3 text-center">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedecb]/70 bg-[#fffef4]">
                  {capabilities.map((cap) => (
                    <tr key={cap.id} className="hover:bg-[#f8f7e2]/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#393d68]">{cap.name}</div>
                        <p className="text-[11px] text-[#686b86]">{cap.description}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <PermissionDot level={cap.roles.Owner} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <PermissionDot level={cap.roles.Admin} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <PermissionDot level={cap.roles.Accountant} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <PermissionDot level={cap.roles.Reviewer} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <PermissionDot level={cap.roles.Auditor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#dedecb]/60 pt-3 text-xs text-[#686b86]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><PermissionDot level="admin" /></span>
                <span className="flex items-center gap-1.5"><PermissionDot level="edit" /></span>
                <span className="flex items-center gap-1.5"><PermissionDot level="view" /></span>
                <span className="flex items-center gap-1.5"><PermissionDot level="none" /></span>
              </div>
              <span>Built-in roles are immutable to guarantee statutory compliance.</span>
            </div>
          </SectionCard>

          {/* Separation of Duties Card */}
          <SectionCard
            title="Separation of duties (SoD) enforcement"
            description="Automated dual-control rules preventing fraudulent invoice approvals or unauthorized bank changes."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {sodRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-2xl border border-[#dedecb] bg-[#fffef4] p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#393d68]">{rule.title}</h4>
                      <span
                        className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                          rule.riskLevel === 'critical'
                            ? 'bg-[#a24650]/15 text-[#a24650]'
                            : 'bg-[#cf9c50]/15 text-[#cf9c50]'
                        }`}
                      >
                        {rule.riskLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#686b86] leading-relaxed">{rule.description}</p>
                  </div>

                  <div className="border-t border-[#dedecb]/60 pt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#686b86]">Enforce rule</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSodRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
                        )
                        showToast(`SoD Rule "${rule.title}" ${!rule.enabled ? 'activated' : 'deactivated'}`)
                      }}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                        rule.enabled
                          ? 'bg-[#378875] text-[#f8f7e2]'
                          : 'bg-[#dedecb] text-[#686b86]'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* MEMBER DETAILS RIGHT DRAWER */}
      {drawerMember && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#fffef4] border-l border-[#dedecb] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#dedecb]">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-[#474c80] text-sm font-bold text-[#f8f7e2]">
                    {drawerMember.name.split(' ').map((p) => p[0]).join('')}
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#393d68]">{drawerMember.name}</h3>
                    <p className="text-xs text-[#686b86]">{drawerMember.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerMember(null)}
                  className="rounded-xl p-1.5 text-[#686b86] hover:bg-[#f8f7e2]"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Role Selector */}
              <div className="rounded-2xl border border-[#dedecb] bg-[#f8f7e2]/40 p-4 space-y-2">
                <label className="block text-xs font-bold text-[#393d68]">Assigned Role</label>
                <div className="flex items-center gap-2">
                  <select
                    value={drawerMember.role}
                    disabled={drawerMember.role === 'Owner'}
                    onChange={(e) => handleRoleChange(drawerMember.id, e.target.value as Role)}
                    className="flex-1 rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-2 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden disabled:opacity-60"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Auditor">Auditor</option>
                  </select>
                  <RoleBadge role={drawerMember.role} />
                </div>
                <p className="text-[11px] text-[#686b86]">
                  {drawerMember.role === 'Owner'
                    ? 'Owner role cannot be downgraded without transferring workspace ownership.'
                    : 'Modifying role immediately updates accessible routes and permission checks.'}
                </p>
              </div>

              {/* Per-Area Access Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#393d68]">
                  Effective Access Levels
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { area: 'Invoices & OCR', level: drawerMember.role === 'Reviewer' ? 'edit' : 'admin' },
                    { area: 'Statutory Validation', level: drawerMember.role === 'Reviewer' ? 'none' : 'edit' },
                    { area: 'GSTR-2B Matching', level: drawerMember.role === 'Reviewer' ? 'none' : 'edit' },
                    { area: 'Security & Keys', level: drawerMember.role === 'Admin' || drawerMember.role === 'Owner' ? 'admin' : 'none' },
                  ].map((acc, i) => (
                    <div key={i} className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5">
                      <span className="block font-semibold text-[#393d68]">{acc.area}</span>
                      <PermissionDot level={acc.level as any} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Sessions for this User */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#393d68]">
                  Active Web Sessions
                </h4>
                <div className="space-y-2 text-xs">
                  {sessions.slice(0, 2).map((s) => (
                    <div key={s.id} className="rounded-xl border border-[#dedecb] bg-[#fffef4] p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-[#393d68]">{s.device}</div>
                        <div className="text-[11px] text-[#686b86]">{s.location} · {s.ip}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => showToast(`Terminated remote session ${s.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#a24650]/30 px-2 py-1 text-[11px] font-bold text-[#a24650] hover:bg-[#a24650]/10"
                      >
                        <LogOut className="size-3" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity (5 audit events) */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#393d68]">
                  Recent Audit Activity
                </h4>
                <div className="space-y-2 text-xs">
                  {auditEvents.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/30 p-2.5">
                      <div className="flex justify-between font-mono text-[10px] text-[#686b86]">
                        <span>{ev.action}</span>
                        <span>{ev.at}</span>
                      </div>
                      <p className="text-[11px] text-[#393d68] mt-0.5">Target: {ev.target}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              {drawerMember.role !== 'Owner' && (
                <div className="rounded-2xl border border-[#a24650]/30 bg-[#a24650]/5 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-[#a24650] uppercase tracking-wider">
                    Danger Zone
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleResetMfa(drawerMember)}
                      className="rounded-xl border border-[#dedecb] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#393d68] hover:bg-[#dedecb]/40"
                    >
                      Reset MFA Token
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSuspendMember(drawerMember)}
                      className="rounded-xl border border-[#a24650] bg-[#fffef4] px-3 py-1.5 text-xs font-bold text-[#a24650] hover:bg-[#a24650] hover:text-[#f8f7e2]"
                    >
                      Suspend Access
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(drawerMember)}
                      className="rounded-xl bg-[#a24650] px-3 py-1.5 text-xs font-bold text-[#f8f7e2] hover:bg-[#a24650]/90"
                    >
                      Remove from Workspace
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INVITE MEMBER MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Invite Team Member</h3>
                <p className="text-xs text-[#686b86]">Grant access to accounting, review, or statutory audit workflows.</p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g., Rajesh Krishnan"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Work Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.in"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Role Assignment</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2.5 text-xs font-semibold text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                >
                  <option value="Admin">Admin · Full operational & team control</option>
                  <option value="Accountant">Accountant · Edit invoices & reconcile GSTR-2B</option>
                  <option value="Reviewer">Reviewer · Human-in-the-loop low confidence fixes</option>
                  <option value="Auditor">Auditor · Read-only audit trail & ledger exports</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Temporary Access Expiry (Optional)</label>
                <input
                  type="date"
                  value={inviteExpiry}
                  onChange={(e) => setInviteExpiry(e.target.value)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
                <span className="text-[10px] text-[#686b86]">Leave blank for permanent membership.</span>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Invitation Note</label>
                <textarea
                  rows={2}
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  placeholder="Welcome to our GST reconciliation workspace..."
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#dedecb]">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM ROLE BUILDER DIALOG */}
      {customRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#dedecb] bg-[#fffef4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dedecb]">
              <div>
                <h3 className="text-base font-black text-[#393d68]">Define Custom Role</h3>
                <p className="text-xs text-[#686b86]">Select specific capabilities to tailor granular permissions.</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomRoleModalOpen(false)}
                className="rounded-xl p-1 text-[#686b86] hover:bg-[#f8f7e2]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Role Title</label>
                <input
                  type="text"
                  required
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  placeholder="e.g., Senior Tax Reviewer"
                  className="w-full rounded-xl border border-[#dedecb] bg-[#f8f7e2]/40 p-2.5 text-xs text-[#393d68] focus:border-[#474c80] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#393d68]">Copy Template Permissions From</label>
                <select
                  value={customRoleCopyFrom}
                  onChange={(e) => setCustomRoleCopyFrom(e.target.value as Role)}
                  className="w-full rounded-xl border border-[#dedecb] bg-[#fffef4] p-2 text-xs font-semibold text-[#393d68]"
                >
                  <option value="Reviewer">Reviewer Template</option>
                  <option value="Accountant">Accountant Template</option>
                  <option value="Auditor">Auditor Template</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-[#393d68]">Assign Capabilities</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[#dedecb] rounded-xl p-3 bg-[#f8f7e2]/30">
                  {capabilities.map((c) => {
                    const isChecked = selectedCustomCaps.includes(c.id)
                    return (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedCustomCaps((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }}
                          className="rounded-xs border-[#dedecb] text-[#474c80]"
                        />
                        <span className="font-semibold text-[#393d68]">{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Risky Combination Warning */}
              {isRiskyCustomRole && (
                <div className="rounded-xl border border-[#cf9c50] bg-[#cf9c50]/10 p-3 text-[11px] text-[#393d68] flex items-start gap-2">
                  <AlertTriangle className="size-4 text-[#cf9c50] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#393d68] block">Separation of Duties Notice</strong>
                    This role combines invoice approval with vendor dispatch capabilities. Consider separating approval authority to uphold internal audit standards.
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#dedecb]">
                <button
                  type="button"
                  onClick={() => setCustomRoleModalOpen(false)}
                  className="rounded-xl border border-[#dedecb] bg-[#f8f7e2]/50 px-4 py-2 text-xs font-semibold text-[#393d68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#474c80] px-4 py-2 text-xs font-bold text-[#f8f7e2] hover:bg-[#393d68] transition"
                >
                  Create Custom Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
