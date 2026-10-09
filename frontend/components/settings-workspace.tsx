'use client'

import { useMemo, useState } from 'react'
import { Bell, Building2, Check, ChevronRight, CircleHelp, Database, Globe2, Link2, LockKeyhole, Plus, Save, ShieldCheck, SlidersHorizontal, Trash2, Users, X } from 'lucide-react'
import { AppShell, PageHeading, SectionCard, ToggleControl } from '@/components/app-shell'

export type SettingsSection = 'Business profile' | 'Team & roles' | 'Validation rules' | 'Notifications' | 'Integrations' | 'Language & display' | 'Data & privacy'
const sections: { name: SettingsSection; icon: typeof Building2; description: string }[] = [
  { name: 'Business profile', icon: Building2, description: 'Your legal entity and filing details' },
  { name: 'Team & roles', icon: Users, description: 'Manage members and permissions' },
  { name: 'Validation rules', icon: SlidersHorizontal, description: 'Tune invoice review checks' },
  { name: 'Notifications', icon: Bell, description: 'Choose what updates your team' },
  { name: 'Integrations', icon: Link2, description: 'Connect your accounting tools' },
  { name: 'Language & display', icon: Globe2, description: 'Set language and number formats' },
  { name: 'Data & privacy', icon: LockKeyhole, description: 'Control retention and exports' },
]
const fieldClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10'
const teamSeed = [
  { name: 'Aditi Mehta', email: 'aditi@meridiandesign.in', role: 'Owner', initials: 'AM', tone: 'bg-amber-100 text-amber-900' },
  { name: 'Rohan Shah', email: 'rohan@meridiandesign.in', role: 'Accountant', initials: 'RS', tone: 'bg-sky-100 text-sky-900' },
  { name: 'Nisha Kulkarni', email: 'nisha@clearbooks.co', role: 'CA / Auditor', initials: 'NK', tone: 'bg-violet-100 text-violet-900' },
]
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export default function SettingsWorkspace({ initialSection = 'Business profile' }: { initialSection?: SettingsSection }) {
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const [saved, setSaved] = useState(false)
  const [business, setBusiness] = useState({ name: 'Meridian Design Studio Pvt. Ltd.', gstin: '27AABCU9603R1ZM', state: 'Maharashtra', frequency: 'Monthly', year: '2025–26' })
  const [team, setTeam] = useState(teamSeed)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Accountant')
  const [rules, setRules] = useState({ rounding: '1.00', confidence: 82, irn: true, duplicate: true, gstin: true })
  const [channels, setChannels] = useState({ extraction: { email: true, whatsapp: false, app: true }, exception: { email: true, whatsapp: true, app: true }, filing: { email: false, whatsapp: false, app: true }, team: { email: false, whatsapp: false, app: true } })
  const [quietHours, setQuietHours] = useState('21:00 – 08:00')
  const [connections, setConnections] = useState<Record<string, boolean>>({})
  const [language, setLanguage] = useState('English')
  const [theme, setTheme] = useState('Light')
  const [numberFormat, setNumberFormat] = useState('Indian (1,23,456)')
  const [retention, setRetention] = useState('8 years')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleteStatus, setDeleteStatus] = useState('')

  const gstinValid = useMemo(() => gstinRegex.test(business.gstin.trim().toUpperCase()), [business.gstin])

  function saveSettings() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2400)
  }

  function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = inviteEmail.trim()
    if (!trimmed) return
    setTeam((current) => [...current, { name: trimmed.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), email: trimmed, role: inviteRole, initials: trimmed.slice(0, 2).toUpperCase(), tone: 'bg-teal-100 text-teal-900' }])
    setInviteEmail('')
    setInviteOpen(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2400)
  }

  function exportSettings() {
    const payload = { business, team, rules, channels, quietHours, language, theme, numberFormat, retention, exportedAt: new Date().toISOString() }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'folio-workspace-export.json'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function toggleChannel(eventKey: keyof typeof channels, channel: 'email' | 'whatsapp' | 'app') {
    setChannels((current) => ({ ...current, [eventKey]: { ...current[eventKey], [channel]: !current[eventKey][channel] } }))
  }

  function renderContent() {
    if (section === 'Business profile') return <div className="flex flex-col gap-5">
      <SectionCard title="Legal entity" description="Details used on your reports and GST documents.">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-[11px] font-medium text-slate-600 sm:col-span-2">Legal business name<input className={fieldClass} value={business.name} onChange={(event) => setBusiness({ ...business, name: event.target.value })} /></label><label className="text-[11px] font-medium text-slate-600">GSTIN<div className="relative"><input className={`${fieldClass} pr-24 font-mono uppercase`} maxLength={15} value={business.gstin} onChange={(event) => setBusiness({ ...business, gstin: event.target.value.toUpperCase() })} aria-describedby="gstin-status" /><span id="gstin-status" className={`absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${gstinValid ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}><span className={`size-1.5 rounded-full ${gstinValid ? 'bg-emerald-500' : 'bg-rose-500'}`} />{gstinValid ? 'GSTIN verified' : 'Check GSTIN'}</span></div></label><label className="text-[11px] font-medium text-slate-600">State<select className={fieldClass} value={business.state} onChange={(event) => setBusiness({ ...business, state: event.target.value })}>{['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Gujarat'].map((stateName) => <option key={stateName}>{stateName}</option>)}</select></label><label className="text-[11px] font-medium text-slate-600">Filing frequency<select className={fieldClass} value={business.frequency} onChange={(event) => setBusiness({ ...business, frequency: event.target.value })}><option>Monthly</option><option>Quarterly</option></select></label><label className="text-[11px] font-medium text-slate-600">Financial year<select className={fieldClass} value={business.year} onChange={(event) => setBusiness({ ...business, year: event.target.value })}><option>2025–26</option><option>2026–27</option><option>2024–25</option></select></label></div>
      </SectionCard>
      <div className="flex justify-end"><button type="button" onClick={saveSettings} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-4 text-xs font-semibold text-white hover:bg-teal-900"><Save className="size-3.5" />Save changes</button></div>
    </div>

    if (section === 'Team & roles') return <div className="flex flex-col gap-5">
      <SectionCard title="Team members" description="Role-based access helps keep sensitive GST records protected.">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400"><th className="px-2 py-2">Member</th><th className="px-2 py-2">Role</th><th className="px-2 py-2">Access</th><th className="px-2 py-2 text-right">Manage</th></tr></thead><tbody>{team.map((member, index) => <tr key={`${member.email}-${index}`} className="border-b border-slate-50 last:border-0"><td className="px-2 py-3"><span className="flex items-center gap-2.5"><span className={`flex size-8 items-center justify-center rounded-full text-[10px] font-semibold ${member.tone}`}>{member.initials}</span><span><span className="block text-xs font-medium text-slate-800">{member.name}</span><span className="block text-[10px] text-slate-500">{member.email}</span></span></span></td><td className="px-2 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${member.role === 'Owner' ? 'bg-amber-50 text-amber-800' : member.role === 'Accountant' ? 'bg-sky-50 text-sky-800' : 'bg-violet-50 text-violet-800'}`}>{member.role}</span></td><td className="px-2 py-3 text-[10px] text-slate-500">{member.role === 'CA / Auditor' ? 'Read only' : 'Can edit'}</td><td className="px-2 py-3 text-right">{member.role === 'Owner' ? <span className="text-[10px] text-slate-400">Primary owner</span> : <button type="button" aria-label={`Remove ${member.name}`} onClick={() => setTeam((current) => current.filter((_, memberIndex) => memberIndex !== index))} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X className="size-3.5" /></button>}</td></tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-500">3 of 5 seats in use · CA / Auditor members can view, not edit.</p><button type="button" onClick={() => setInviteOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-800 px-3 text-[10px] font-semibold text-white hover:bg-teal-900"><Plus className="size-3.5" />Invite teammate</button></div>
      </SectionCard>
      <SectionCard title="Role permissions" description="A quick overview of what each role can do."><div className="grid gap-3 sm:grid-cols-3">{[['Owner', 'Full workspace access, billing, and settings.'], ['Accountant', 'Manage invoices, vendors, and reports.'], ['CA / Auditor', 'Review records and export reports only.']].map(([role, detail]) => <div key={role} className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-800">{role}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p></div>)}</div></SectionCard>
      {inviteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false) }}><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="invite-title"><div className="flex items-start justify-between"><div><h2 id="invite-title" className="text-base font-semibold text-slate-900">Invite a teammate</h2><p className="mt-1 text-xs text-slate-500">Add a collaborator to your Folio workspace.</p></div><button type="button" onClick={() => setInviteOpen(false)} aria-label="Close invite dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div><form onSubmit={sendInvite} className="mt-5 flex flex-col gap-4"><label className="text-[11px] font-medium text-slate-600">Work email<input autoFocus required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" className={fieldClass} /></label><label className="text-[11px] font-medium text-slate-600">Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className={fieldClass}><option>Accountant</option><option>CA / Auditor</option></select></label><p className="text-[10px] text-slate-500">Demo only — no email will be sent.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setInviteOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-600">Cancel</button><button type="submit" className="h-9 rounded-lg bg-teal-800 px-3 text-xs font-semibold text-white">Add teammate</button></div></form></section></div>}
    </div>

    if (section === 'Validation rules') return <div className="flex flex-col gap-5"><SectionCard title="Invoice review thresholds" description="Decide which documents need a closer look before filing.">
      <div className="divide-y divide-slate-100">{[
        { key: 'gstin' as const, title: 'Validate GSTIN format', text: 'Flag invalid or incomplete supplier GSTINs.' },
        { key: 'irn' as const, title: 'Check IRN details', text: 'Match invoice reference numbers when available.' },
        { key: 'duplicate' as const, title: 'Detect duplicate invoices', text: 'Compare vendor, invoice number, and date.' },
      ].map((rule) => <div key={rule.key} className="flex items-center justify-between gap-4 py-3.5"><div><p className="text-xs font-medium text-slate-800">{rule.title}</p><p className="mt-0.5 text-[10px] text-slate-500">{rule.text}</p></div><ToggleControl label={rule.title} checked={rules[rule.key]} onChange={(checked) => setRules((current) => ({ ...current, [rule.key]: checked }))} /></div>)}</div>
      <div className="mt-3 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"><label className="text-[11px] font-medium text-slate-700">Rounding tolerance (INR)<input type="number" min="0" step="0.5" value={rules.rounding} onChange={(event) => setRules((current) => ({ ...current, rounding: event.target.value }))} className={fieldClass} /><span className="mt-1 block text-[10px] font-normal text-slate-500">Differences below this amount will not be flagged.</span></label><label className="text-[11px] font-medium text-slate-700">Human review confidence <span className="float-right text-teal-800">{rules.confidence}%</span><input type="range" min="50" max="99" value={rules.confidence} onChange={(event) => setRules((current) => ({ ...current, confidence: Number(event.target.value) }))} className="mt-3 w-full accent-teal-800" /><span className="block text-[10px] font-normal text-slate-500">Invoices below this score are sent for review.</span></label></div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={saveSettings} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-4 text-xs font-semibold text-white hover:bg-teal-900"><Save className="size-3.5" />Save changes</button></div>
    </SectionCard></div>

    if (section === 'Notifications') return <SectionCard title="Notification preferences" description="Choose how Folio should notify your team about workspace activity.">
      <div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] font-semibold uppercase tracking-wide text-slate-400"><th className="px-2 py-3">Event</th><th className="px-2 py-3 text-center">Email</th><th className="px-2 py-3 text-center">WhatsApp</th><th className="px-2 py-3 text-center">In-app</th></tr></thead><tbody>{([['extraction', 'Invoice processed'], ['exception', 'Validation exception'], ['filing', 'Filing reminder'], ['team', 'Team activity']] as const).map(([eventKey, label]) => <tr key={eventKey} className="border-b border-slate-50 last:border-0"><td className="px-2 py-3 text-xs font-medium text-slate-700">{label}</td>{(['email', 'whatsapp', 'app'] as const).map((channel) => <td key={channel} className="px-2 py-3 text-center"><input type="checkbox" checked={channels[eventKey][channel]} onChange={() => toggleChannel(eventKey, channel)} aria-label={`${label} via ${channel === 'app' ? 'in-app' : channel}`} className="size-4 accent-teal-800" /></td>)}</tr>)}</tbody></table></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-xs font-medium text-slate-800">Quiet hours</p><p className="mt-0.5 text-[10px] text-slate-500">Pause non-urgent notifications during this window.</p></div><select value={quietHours} onChange={(event) => setQuietHours(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"><option>21:00 – 08:00</option><option>22:00 – 07:00</option><option>Custom</option></select></div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={saveSettings} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-4 text-xs font-semibold text-white hover:bg-teal-900"><Save className="size-3.5" />Save changes</button></div>
    </SectionCard>

    if (section === 'Integrations') return <div className="flex flex-col gap-5"><div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5"><div className="flex gap-2.5"><CircleHelp className="mt-0.5 size-4 shrink-0 text-sky-800" /><div><p className="text-xs font-semibold text-sky-900">Connectors are demo placeholders</p><p className="mt-0.5 text-[10px] leading-4 text-sky-800">These cards preview future integrations. No external account is contacted or connected.</p></div></div></div><div className="grid gap-3 sm:grid-cols-2">{[
      { name: 'Tally', description: 'Sync ledgers, purchase registers, and vouchers.', initials: 'Ta', tone: 'bg-blue-50 text-blue-800' },
      { name: 'Zoho Books', description: 'Bring invoices and vendor records into Folio.', initials: 'Z', tone: 'bg-rose-50 text-rose-800' },
      { name: 'QuickBooks', description: 'Keep expenses and tax categories in sync.', initials: 'QB', tone: 'bg-emerald-50 text-emerald-800' },
      { name: 'GST Portal', description: 'Prepare for secure filing and GSTR data import.', initials: 'GST', tone: 'bg-amber-50 text-amber-900' },
    ].map((integration) => <article key={integration.name} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={`flex size-10 items-center justify-center rounded-xl text-xs font-bold ${integration.tone}`}>{integration.initials}</span><div><h3 className="text-sm font-semibold text-slate-900">{integration.name}</h3><span className="mt-1 inline-flex items-center gap-1.5 text-[9px] font-medium text-slate-500"><span className={`size-1.5 rounded-full ${connections[integration.name] ? 'bg-amber-500' : 'bg-slate-300'}`} />{connections[integration.name] ? 'Demo request queued' : 'Not connected'}</span></div></div><button type="button" onClick={() => setConnections((current) => ({ ...current, [integration.name]: !current[integration.name] }))} className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50">{connections[integration.name] ? 'Cancel' : 'Connect'}</button></div><p className="mt-3 text-[11px] leading-5 text-slate-500">{integration.description}</p></article>)}</div></div>

    if (section === 'Language & display') return <div className="flex flex-col gap-5"><SectionCard title="Preferences" description="Adjust how dates, amounts, and the workspace are displayed."><div className="grid gap-4 sm:grid-cols-2"><label className="text-[11px] font-medium text-slate-600">Language<select className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>हिन्दी</option><option>मराठी</option></select></label><label className="text-[11px] font-medium text-slate-600">Theme<select className={fieldClass} value={theme} onChange={(event) => setTheme(event.target.value)}><option>Light</option><option>Dark</option><option>System</option></select></label><label className="text-[11px] font-medium text-slate-600 sm:col-span-2">Number format<select className={fieldClass} value={numberFormat} onChange={(event) => setNumberFormat(event.target.value)}><option>Indian (1,23,456)</option><option>International (123,456)</option></select></label></div><div className="mt-4 flex justify-end"><button type="button" onClick={saveSettings} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-4 text-xs font-semibold text-white hover:bg-teal-900"><Save className="size-3.5" />Save changes</button></div></SectionCard><div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3.5 text-[10px] leading-4 text-slate-500"><Globe2 className="mt-0.5 size-3.5 shrink-0 text-teal-800" />Language and theme preferences are shown for preview; this demo does not persist settings between sessions.</div></div>

    return <div className="flex flex-col gap-5"><SectionCard title="Data retention" description="Manage how long your source documents remain available in this workspace."><label className="block max-w-xs text-[11px] font-medium text-slate-600">Retention period<select className={fieldClass} value={retention} onChange={(event) => setRetention(event.target.value)}><option>1 year</option><option>3 years</option><option>5 years</option><option>8 years</option></select></label><p className="mt-3 text-[10px] text-slate-500">GST records are commonly retained for up to 8 years. Confirm your obligations with your tax advisor.</p><button type="button" onClick={exportSettings} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"><Database className="size-3.5" />Export my data</button><p className="mt-1.5 text-[9px] text-slate-400">Downloads a JSON copy of this preview&apos;s workspace settings.</p></SectionCard><section className="rounded-xl border border-rose-200 bg-white"><div className="border-b border-rose-100 px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2"><Trash2 className="size-4 text-rose-700" /><h2 className="text-sm font-semibold text-rose-900">Danger zone</h2></div><p className="mt-0.5 text-[11px] text-slate-500">Delete account is a preview-only confirmation and will not contact any service.</p></div><div className="p-4 sm:p-5"><p className="text-xs text-slate-700">Type <strong className="font-mono text-rose-800">DELETE MERIDIAN</strong> to enable the demo action.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={deletePhrase} onChange={(event) => { setDeletePhrase(event.target.value); setDeleteStatus('') }} aria-label="Type DELETE MERIDIAN to confirm" placeholder="Type DELETE MERIDIAN" className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-rose-500" /><button type="button" disabled={deletePhrase !== 'DELETE MERIDIAN'} onClick={() => setDeleteStatus('Confirmation recorded for this preview. No account data was deleted.')} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="size-3.5" />Delete account</button></div>{deleteStatus && <p role="status" className="mt-2 text-[10px] font-medium text-emerald-700">{deleteStatus}</p>}</div></section></div>
  }

  return <AppShell active="">
    <PageHeading eyebrow="Settings" title="Workspace settings" description="Manage your business profile, team access, validation rules, and data preferences." action={saved ? <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800"><Check className="size-3.5" />Changes saved</span> : undefined} />
    <div className="grid items-start gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 md:flex-col">{sections.map(({ name, icon: Icon, description }) => <button key={name} type="button" onClick={() => setSection(name)} aria-current={section === name ? 'page' : undefined} className={`group flex min-w-fit items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition md:w-full ${section === name ? 'bg-teal-50 text-teal-900' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className={`size-4 shrink-0 ${section === name ? 'text-teal-800' : 'text-slate-400'}`} aria-hidden="true" /><span className="min-w-0"><span className="block text-[11px] font-semibold">{name}</span><span className="hidden text-[9px] text-slate-500 md:block">{description}</span></span><ChevronRight className="ml-auto hidden size-3.5 text-teal-700 md:block" /></button>)}</nav>
      <div className="min-w-0">{renderContent()}</div>
    </div>
  </AppShell>
}
