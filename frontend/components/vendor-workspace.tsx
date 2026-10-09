'use client'

import { useEffect, useMemo, useState } from 'react'
import { MobileWorkspaceNav } from '@/components/app-shell'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Check,
  CircleHelp,
  Copy,
  FileCheck2,
  FileText,
  Mail,
  MessageCircle,
  MessageSquareText,
  Search,
  Send,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type RiskTag = 'Reliable' | 'Watch' | 'High risk'
type Channel = 'WhatsApp' | 'Email' | 'SMS'
type Tone = 'Polite' | 'Firm'
type Language = 'EN' | 'HI' | 'MR'
type Vendor = {
  id: string
  name: string
  gstin: string
  contact: string
  phone: string
  email: string
  score: number
  trend: number
  timeliness: number[]
  errorRate: number
  exposure: number
  tag: RiskTag
  responseTime: string
  lateFilings: number
  invoiceMismatches: number
  rateErrors: number
  gstinStatus: number
  responseRisk: number
  invoice: string
  issue: string
  expectedValue: string
  requestedAction: string
  communication: { date: string; channel: Channel; detail: string; status: string }[]
  errorSeries: { month: string; mismatches: number; rateErrors: number }[]
}

const vendors: Vendor[] = [
  {
    id: 'aster-facilities', name: 'Aster Facilities India', gstin: '27AAECA3348D1ZQ', contact: 'Neha', phone: '+91 98765 43210', email: 'accounts@asterfacilities.in',
    score: 84, trend: 9, timeliness: [78, 56, 66, 42, 53, 38], errorRate: 8.4, exposure: 318400, tag: 'High risk', responseTime: '5.2 days', lateFilings: 27, invoiceMismatches: 22, rateErrors: 15, gstinStatus: 8, responseRisk: 12,
    invoice: 'AFI/25-26/557', issue: 'the invoice is not yet reflected in GSTR-2B', expectedValue: 'INR 8,100', requestedAction: 'please file the return and confirm once it appears',
    communication: [{ date: '8 Apr 2026 · 10:15 AM', channel: 'Email', detail: 'GSTR-2B filing reminder for AFI/25-26/557', status: 'No reply yet' }, { date: '2 Apr 2026 · 3:40 PM', channel: 'WhatsApp', detail: 'Asked for an updated filing date', status: 'Delivered' }],
    errorSeries: [{ month: 'Nov', mismatches: 3, rateErrors: 2 }, { month: 'Dec', mismatches: 4, rateErrors: 2 }, { month: 'Jan', mismatches: 3, rateErrors: 4 }, { month: 'Feb', mismatches: 5, rateErrors: 3 }, { month: 'Mar', mismatches: 6, rateErrors: 4 }, { month: 'Apr', mismatches: 7, rateErrors: 5 }],
  },
  {
    id: 'kaveri-packaging', name: 'Kaveri Packaging Co.', gstin: '29AACFK7812L1ZP', contact: 'Rohan', phone: '+91 99887 76655', email: 'finance@kaveripackaging.in',
    score: 67, trend: 5, timeliness: [84, 71, 64, 80, 59, 61], errorRate: 5.1, exposure: 246200, tag: 'Watch', responseTime: '2.8 days', lateFilings: 18, invoiceMismatches: 21, rateErrors: 11, gstinStatus: 5, responseRisk: 12,
    invoice: 'KPC/2026/1189', issue: 'the invoice is missing from GSTR-2B', expectedValue: 'INR 14,400', requestedAction: 'please check the filing and share an update',
    communication: [{ date: '6 Apr 2026 · 11:20 AM', channel: 'Email', detail: 'Requested an update on invoice KPC/2026/1189', status: 'Replied · filing this week' }],
    errorSeries: [{ month: 'Nov', mismatches: 2, rateErrors: 1 }, { month: 'Dec', mismatches: 2, rateErrors: 2 }, { month: 'Jan', mismatches: 4, rateErrors: 2 }, { month: 'Feb', mismatches: 3, rateErrors: 3 }, { month: 'Mar', mismatches: 4, rateErrors: 3 }, { month: 'Apr', mismatches: 5, rateErrors: 4 }],
  },
  {
    id: 'meridian-cloud', name: 'Meridian Cloud Services', gstin: '29AAGCM9214R1Z2', contact: 'Aarav', phone: '+91 98123 45678', email: 'billing@meridiancloud.in',
    score: 53, trend: -4, timeliness: [88, 90, 74, 84, 79, 91], errorRate: 3.8, exposure: 186000, tag: 'Watch', responseTime: '1.6 days', lateFilings: 11, invoiceMismatches: 22, rateErrors: 8, gstinStatus: 4, responseRisk: 8,
    invoice: 'MCS/26/0318', issue: 'the GST credit differs by INR 720 from our records', expectedValue: 'INR 21,600', requestedAction: 'please review the tax amount and issue a credit note if needed',
    communication: [{ date: '4 Apr 2026 · 9:05 AM', channel: 'WhatsApp', detail: 'Shared the GSTR-2B tax difference', status: 'Read · awaiting response' }],
    errorSeries: [{ month: 'Nov', mismatches: 2, rateErrors: 2 }, { month: 'Dec', mismatches: 3, rateErrors: 1 }, { month: 'Jan', mismatches: 3, rateErrors: 2 }, { month: 'Feb', mismatches: 4, rateErrors: 2 }, { month: 'Mar', mismatches: 3, rateErrors: 2 }, { month: 'Apr', mismatches: 2, rateErrors: 1 }],
  },
  {
    id: 'blue-dune', name: 'Blue Dune Hospitality', gstin: '27AAGFB0112C1ZS', contact: 'Priya', phone: '+91 99001 12045', email: 'accounts@bluedune.in',
    score: 39, trend: -3, timeliness: [88, 95, 90, 85, 94, 90], errorRate: 2.2, exposure: 94000, tag: 'Watch', responseTime: '1.1 days', lateFilings: 9, invoiceMismatches: 10, rateErrors: 8, gstinStatus: 4, responseRisk: 8,
    invoice: 'BDH/2026/092', issue: 'we need to confirm the eligibility of this expense', expectedValue: 'INR 5,400', requestedAction: 'please share the supporting invoice details',
    communication: [{ date: '29 Mar 2026 · 2:10 PM', channel: 'Email', detail: 'Requested supporting details for BDH/2026/092', status: 'Replied · documents shared' }],
    errorSeries: [{ month: 'Nov', mismatches: 1, rateErrors: 1 }, { month: 'Dec', mismatches: 2, rateErrors: 1 }, { month: 'Jan', mismatches: 1, rateErrors: 2 }, { month: 'Feb', mismatches: 2, rateErrors: 1 }, { month: 'Mar', mismatches: 1, rateErrors: 1 }, { month: 'Apr', mismatches: 1, rateErrors: 1 }],
  },
  {
    id: 'northstar-office', name: 'Northstar Office Systems', gstin: '27AAKCS8421M1Z5', contact: 'Vikram', phone: '+91 98220 11334', email: 'gst@northstaroffice.in',
    score: 22, trend: -7, timeliness: [96, 100, 94, 100, 98, 96], errorRate: 0.8, exposure: 48200, tag: 'Reliable', responseTime: '0.6 days', lateFilings: 5, invoiceMismatches: 5, rateErrors: 4, gstinStatus: 3, responseRisk: 5,
    invoice: 'SOS/25-26/0842', issue: 'we are confirming the details for our records', expectedValue: 'INR 9,360', requestedAction: 'please confirm the invoice details at your convenience',
    communication: [{ date: '27 Mar 2026 · 4:15 PM', channel: 'Email', detail: 'Quarter-end invoice confirmation', status: 'Replied · confirmed' }],
    errorSeries: [{ month: 'Nov', mismatches: 1, rateErrors: 0 }, { month: 'Dec', mismatches: 0, rateErrors: 1 }, { month: 'Jan', mismatches: 1, rateErrors: 0 }, { month: 'Feb', mismatches: 0, rateErrors: 1 }, { month: 'Mar', mismatches: 1, rateErrors: 0 }, { month: 'Apr', mismatches: 0, rateErrors: 0 }],
  },
  {
    id: 'prism-print', name: 'Prism Print & Paper', gstin: '27AAEFP1428H1ZL', contact: 'Sonal', phone: '+91 99705 38110', email: 'accounts@prismprint.in',
    score: 14, trend: -2, timeliness: [100, 96, 100, 95, 100, 98], errorRate: 0.4, exposure: 38200, tag: 'Reliable', responseTime: '0.4 days', lateFilings: 3, invoiceMismatches: 4, rateErrors: 2, gstinStatus: 1, responseRisk: 4,
    invoice: 'PPP/25-26/4401', issue: 'we are confirming the invoice details for our records', expectedValue: 'INR 3,780', requestedAction: 'please confirm when convenient',
    communication: [{ date: '22 Mar 2026 · 12:30 PM', channel: 'WhatsApp', detail: 'Confirmed invoice PPP/25-26/4401', status: 'Replied · confirmed' }],
    errorSeries: [{ month: 'Nov', mismatches: 0, rateErrors: 0 }, { month: 'Dec', mismatches: 1, rateErrors: 0 }, { month: 'Jan', mismatches: 0, rateErrors: 0 }, { month: 'Feb', mismatches: 0, rateErrors: 1 }, { month: 'Mar', mismatches: 0, rateErrors: 0 }, { month: 'Apr', mismatches: 0, rateErrors: 0 }],
  },
]

const money = (value: number) => `INR ${new Intl.NumberFormat('en-IN').format(value)}`
const monthLabels = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']
const chartConfig = {
  mismatches: { label: 'Invoice mismatches', color: 'var(--chart-1)' },
  rateErrors: { label: 'Rate errors', color: 'var(--chart-2)' },
} satisfies ChartConfig

function scoreTone(tag: RiskTag) {
  if (tag === 'High risk') return 'border-rose-200 bg-rose-50 text-rose-800'
  if (tag === 'Watch') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-emerald-200 bg-emerald-50 text-emerald-800'
}

function ScoreRing({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
  const color = score >= 70 ? '#e11d48' : score >= 35 ? '#d97706' : '#0f766e'
  const dimension = size === 'large' ? 'size-[84px]' : 'size-11'
  const labelSize = size === 'large' ? 'text-2xl' : 'text-xs'
  return <div role="img" aria-label={`Risk score ${score} out of 100`} className={`relative grid shrink-0 place-items-center rounded-full ${dimension}`} style={{ background: `conic-gradient(${color} ${score}%, #e2e8f0 0)` }}><div className={`grid place-items-center rounded-full bg-white font-semibold tracking-tight text-slate-900 ${size === 'large' ? 'size-[68px]' : 'size-9'} ${labelSize}`}>{score}</div></div>
}

function WorkspaceShell({ children, active = 'Vendors' }: { children: React.ReactNode; active?: string }) {
  const nav = [
    { label: 'Overview', href: '/app', icon: '⌂' },
    { label: 'Invoices', href: '/app/invoices', icon: '▤' },
    { label: 'ITC reconciliation', href: '/app/itc', icon: '◫' },
    { label: 'Vendors', href: '/app/vendors', icon: '◇' },
    { label: 'Reports', href: '/app/reports', icon: '◷' },
  ]
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/15 bg-[#474c80] px-4 text-[#f8f7e2] shadow-[0_8px_28px_rgba(38,40,73,0.18)] sm:px-7">
      <div className="flex items-center gap-3"><a href="/" aria-label="Folio home" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#f8f7e2] text-[#474c80]"><FileText className="size-5" /></span><span className="text-2xl font-bold tracking-[-0.06em] text-[#f8f7e2]">folio<span className="text-[#c7c8e5]">.</span></span></a><span className="hidden h-5 w-px bg-white/25 sm:block" /><span className="hidden text-sm text-[#f8f7e2]/75 sm:block">GST workspace</span></div>
      <div className="flex items-center gap-2 sm:gap-4"><span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 md:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" />All systems operational</span><a href="/app/settings?section=notifications" aria-label="Notification preferences" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell className="size-4" /></a><a href="https://www.gst.gov.in/" target="_blank" rel="noreferrer" aria-label="GST portal help" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><CircleHelp className="size-4" /></a><a href="/app/settings" className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-900" aria-label="Account settings for Aditi Rao">AR</a></div>
    </header>
    <div className="mx-auto flex min-h-[calc(100vh-66px)] max-w-[1600px]">
      <aside className="hidden w-[240px] shrink-0 border-r border-[#393d68] bg-[#474c80] px-4 py-7 text-[#f8f7e2] lg:block"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p><nav aria-label="Workspace" className="mt-3 flex flex-col gap-1">{nav.map((item) => <a key={item.label} href={item.href} aria-current={active === item.label ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active === item.label ? 'bg-[#f8f7e2] text-[#393d68]' : 'text-[#f8f7e2]/80 hover:bg-white/10 hover:text-white'}`}><span aria-hidden="true" className="w-4 text-center text-base">{item.icon}</span>{item.label}</a>)}</nav><div className="mt-8 border-t border-slate-100 pt-5"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Manage</p><nav aria-label="Manage workspace" className="mt-3 flex flex-col gap-1"><a href="/app/settings" className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">GST settings</a><a href="/app/settings?section=team" className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Team members</a></nav></div><div className="mt-8 rounded-xl border border-teal-100 bg-teal-50/60 p-3.5"><span className="flex size-8 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><ShieldAlert className="size-4" /></span><p className="mt-3 text-xs font-semibold text-slate-800">Know your vendor risk</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Keep filing patterns and invoice issues in view.</p></div></aside>
      <main className="min-w-0 flex-1"><MobileWorkspaceNav active={active} /><div className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">{children}</div></main>
    </div>
  </div>
}

function MiniTimeliness({ values }: { values: number[] }) {
  return <div role="img" aria-label={`Filing timeliness over the last six months: ${values.join(', ')} percent`} className="flex h-10 items-end gap-1">{values.map((value, index) => <span key={`${index}-${value}`} title={`${monthLabels[index + 6]}: ${value}% on time`} className={`min-w-1 flex-1 rounded-t-sm ${value >= 85 ? 'bg-teal-600' : value >= 65 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ height: `${Math.max(18, value * 0.4)}px` }} />)}</div>
}

function VendorList() {
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('All vendors')
  const [sort, setSort] = useState('risk')
  const filtered = useMemo(() => vendors.filter((vendor) => (riskFilter === 'All vendors' || vendor.tag === riskFilter) && `${vendor.name} ${vendor.gstin}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'exposure' ? b.exposure - a.exposure : b.score - a.score), [query, riskFilter, sort])
  const totalExposure = vendors.reduce((total, vendor) => total + vendor.exposure, 0)
  return <WorkspaceShell><div className="relative mb-7 flex flex-col justify-between gap-5 overflow-hidden rounded-[1.75rem] bg-[#474c80] px-6 py-7 text-[#f8f7e2] shadow-[0_18px_45px_rgba(45,49,91,0.18)] sm:flex-row sm:items-end sm:px-8 sm:py-8"><div><div className="mb-3 flex items-center gap-2 text-sm text-[#d7d8ef]"><span>Workspace</span><span className="text-white/45">/</span><span className="font-semibold text-[#f8f7e2]">Vendors</span></div><h1 className="text-4xl font-bold tracking-[-0.055em] text-[#f8f7e2] sm:text-5xl">Vendor risk</h1><p className="mt-2 text-base text-[#f8f7e2]/75">Spot filing patterns, invoice errors, and ITC exposure across your suppliers.</p></div><a href="/app/itc" className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:self-auto"><FileCheck2 className="size-3.5" />Open ITC reconciliation</a></div>
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: 'Tracked vendors', value: String(vendors.length), detail: 'With current activity', icon: Activity },
      { label: 'High risk', value: String(vendors.filter((vendor) => vendor.tag === 'High risk').length), detail: 'Needs follow-up', icon: ShieldAlert },
      { label: 'Open ITC exposure', value: money(totalExposure), detail: 'Across tracked vendors', icon: FileCheck2 },
      { label: 'Average on-time filing', value: `${Math.round(vendors.reduce((sum, vendor) => sum + vendor.timeliness.reduce((a, b) => a + b, 0) / vendor.timeliness.length, 0) / vendors.length)}%`, detail: 'Last six months', icon: CalendarClock },
    ].map((stat) => <div key={stat.label} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="flex items-center justify-between"><p className="text-[11px] font-medium text-slate-500">{stat.label}</p><stat.icon className="size-4 text-slate-400" /></div><strong className="mt-1 block truncate text-xl font-semibold tracking-tight text-slate-900">{stat.value}</strong><p className="mt-0.5 text-[10px] text-slate-400">{stat.detail}</p></div>)}</div>
    <section aria-label="Vendor filters and results" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Supplier portfolio <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{filtered.length}</span></h2><p className="mt-0.5 text-[11px] text-slate-400">Risk score combines filing behavior and invoice accuracy</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><span className="sr-only">Search vendors</span><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendor or GSTIN" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10 sm:w-56" /></label><label className="sr-only" htmlFor="vendor-risk-filter">Risk category</label><select id="vendor-risk-filter" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><option>All vendors</option><option>Reliable</option><option>Watch</option><option>High risk</option></select><label className="sr-only" htmlFor="vendor-sort">Sort vendors</label><select id="vendor-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><option value="risk">Highest risk</option><option value="exposure">Highest exposure</option></select></div></div>
    {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-slate-50/80"><tr className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400"><th className="px-5 py-3">Vendor</th><th className="px-3 py-3">Risk score</th><th className="px-3 py-3">Filing · last 6 months</th><th className="px-3 py-3 text-right">Error rate</th><th className="px-3 py-3 text-right">ITC exposure</th><th className="px-5 py-3">Risk</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((vendor) => <tr key={vendor.id} className="transition hover:bg-slate-50/60"><td className="px-5 py-3.5"><a href={`/app/vendors/${vendor.id}`} className="block font-semibold text-slate-800 hover:text-teal-800">{vendor.name}</a><span className="mt-1 inline-flex rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-slate-500">GSTIN {vendor.gstin}</span></td><td className="px-3 py-3.5"><div className="flex items-center gap-2.5"><ScoreRing score={vendor.score} size="small" /><span className={`inline-flex items-center gap-1 text-[10px] font-medium ${vendor.trend > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{vendor.trend > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(vendor.trend)} pts</span></div></td><td className="w-40 px-3 py-3.5"><MiniTimeliness values={vendor.timeliness} /><div className="mt-1 flex justify-between text-[8px] text-slate-400"><span>Nov</span><span>Apr</span></div></td><td className="px-3 py-3.5 text-right text-xs font-semibold text-slate-700">{vendor.errorRate}%</td><td className="px-3 py-3.5 text-right text-xs font-semibold text-slate-700">{money(vendor.exposure)}</td><td className="px-5 py-3.5"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${scoreTone(vendor.tag)}`}>{vendor.tag}</span></td></tr>)}</tbody></table></div> : <div className="px-6 py-14 text-center"><Search className="mx-auto size-5 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">No vendors match those filters</p><p className="mt-1 text-xs text-slate-400">Try another name, GSTIN, or risk category.</p></div>}
    </section><p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><CircleHelp className="size-3" />Risk scores are directional indicators for review, not tax or credit advice.</p>
  </WorkspaceShell>
}

function ScoreBreakdown({ vendor }: { vendor: Vendor }) {
  const factors = [
    { label: 'Late filings', value: vendor.lateFilings, max: 30, note: 'Return filed after due date' },
    { label: 'Invoice mismatches', value: vendor.invoiceMismatches, max: 30, note: 'Books do not match GSTR-2B' },
    { label: 'Rate errors', value: vendor.rateErrors, max: 20, note: 'Tax rate or amount variance' },
    { label: 'GSTIN status', value: vendor.gstinStatus, max: 10, note: 'Registration validation signals' },
    { label: 'Response time', value: vendor.responseRisk, max: 15, note: 'Average time to respond' },
  ]
  return <div className="flex flex-col gap-4">{factors.map((factor) => <div key={factor.label}><div className="flex items-center justify-between gap-4"><span className="text-xs font-medium text-slate-700">{factor.label}</span><span className="text-[10px] font-semibold tabular-nums text-slate-500">{factor.value} pts</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${factor.value / factor.max >= 0.7 ? 'bg-rose-500' : factor.value / factor.max >= 0.4 ? 'bg-amber-500' : 'bg-teal-600'}`} style={{ width: `${Math.min(100, factor.value / factor.max * 100)}%` }} /></div><p className="mt-1 text-[9px] text-slate-400">{factor.note}</p></div>)}</div>
}

function FilingHeatmap({ score }: { score: number }) {
  return <div><div className="grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-4 xl:grid-cols-6">{monthLabels.map((month, monthIndex) => {
    const performance = Math.max(25, 100 - score + ((monthIndex * 13) % 24) - 10)
    return <div key={month} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2"><span className="w-7 text-[10px] font-medium text-slate-500">{month}</span><span className="flex flex-1 gap-1" role="img" aria-label={`${month}: filing compliance was ${performance >= 80 ? 'mostly on time' : performance >= 55 ? 'mixed' : 'frequently late'}`}>{Array.from({ length: 5 }, (_, week) => <span key={week} className={`size-3 rounded-[3px] ${performance >= 85 || (performance > 60 && week < 4) ? 'bg-teal-500' : performance >= 55 && week < 3 ? 'bg-amber-400' : 'bg-rose-400'}`} />)}</span></div>
  })}</div><div className="mt-3 flex items-center justify-end gap-2 text-[9px] text-slate-400"><span>More late</span><span className="size-2.5 rounded-[2px] bg-rose-400" /><span className="size-2.5 rounded-[2px] bg-amber-400" /><span className="size-2.5 rounded-[2px] bg-teal-500" /><span>More on time</span></div></div>
}

function VendorDetail({ vendor, communications, onLog, notice, clearNotice }: { vendor: Vendor; communications: Vendor['communication']; onLog: (entry: Vendor['communication'][number]) => void; notice: string; clearNotice: () => void }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const invoices = [
    { number: vendor.invoice, date: '25 Mar 2026', value: vendor.expectedValue, issue: vendor.issue, state: vendor.tag === 'Reliable' ? 'Reviewed' : 'Needs follow-up' },
    { number: vendor.id === 'meridian-cloud' ? 'MCS/26/0311' : `${vendor.id.slice(0, 3).toUpperCase()}/26/0284`, date: '18 Mar 2026', value: money(Math.round(vendor.exposure * 0.22)), issue: 'Taxable value variance', state: 'Mismatch' },
    { number: vendor.id === 'aster-facilities' ? 'AFI/25-26/524' : `${vendor.id.slice(0, 3).toUpperCase()}/26/0261`, date: '11 Mar 2026', value: money(Math.round(vendor.exposure * 0.14)), issue: 'Filing not reflected in GSTR-2B', state: 'Open' },
  ]
  return <WorkspaceShell><div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><a href="/app/vendors" className="hover:text-teal-800">Vendors</a><span className="text-slate-300">/</span><span className="font-medium text-teal-800">{vendor.name}</span></div>
    {notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-medium text-teal-900"><span>{notice}</span><button type="button" onClick={clearNotice} aria-label="Dismiss notification" className="rounded p-1 hover:bg-teal-100"><X className="size-3.5" /></button></div>}
    <div className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:p-5"><div className="flex items-center gap-4"><ScoreRing score={vendor.score} /><div><div className="mb-1.5 flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{vendor.name}</h1><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${scoreTone(vendor.tag)}`}>{vendor.tag}</span></div><p className="text-xs text-slate-500">GSTIN <span className="font-medium text-slate-700">{vendor.gstin}</span> <span className="mx-1.5 text-slate-300">·</span> Vendor since Jan 2024</p><p className={`mt-1.5 flex items-center gap-1 text-[10px] font-medium ${vendor.trend > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{vendor.trend > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{vendor.trend > 0 ? 'Risk up' : 'Risk down'} {Math.abs(vendor.trend)} points over the last 30 days</p></div></div><button type="button" onClick={() => setComposerOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-900"><MessageSquareText className="size-3.5" />Message vendor</button></div>
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: 'ITC exposure', value: money(vendor.exposure), note: 'Under review' },
      { label: 'Invoice error rate', value: `${vendor.errorRate}%`, note: 'Last 12 months' },
      { label: 'Average response', value: vendor.responseTime, note: 'To vendor requests' },
      { label: 'Filing timeliness', value: `${Math.round(vendor.timeliness.reduce((a, b) => a + b, 0) / vendor.timeliness.length)}%`, note: 'Last six months' },
    ].map((stat) => <div key={stat.label} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5"><p className="text-[11px] font-medium text-slate-500">{stat.label}</p><strong className="mt-1 block text-lg font-semibold tracking-tight text-slate-900">{stat.value}</strong><p className="mt-0.5 text-[10px] text-slate-400">{stat.note}</p></div>)}</div>
    <div className="mb-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]"><section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">Why this score?</h2><p className="mt-1 text-[10px] text-slate-400">Signals contributing to the vendor risk index</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-500">0–100 scale</span></div><ScoreBreakdown vendor={vendor} /></section><section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4"><h2 className="text-sm font-semibold text-slate-900">Filing history</h2><p className="mt-1 text-[10px] text-slate-400">Monthly filing timeliness · last 12 months</p></div><FilingHeatmap score={vendor.score} /></section></div>
    <div className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">Invoice errors over time</h2><p className="mt-1 text-[10px] text-slate-400">Mismatch and tax-rate issues by month</p></div><ChartContainer config={chartConfig} className="h-[210px] w-full aspect-auto"><BarChart accessibilityLayer data={vendor.errorSeries} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} /><Bar dataKey="mismatches" fill="var(--color-mismatches)" radius={[4, 4, 0, 0]} maxBarSize={22} /><Bar dataKey="rateErrors" fill="var(--color-rateErrors)" radius={[4, 4, 0, 0]} maxBarSize={22} /></BarChart></ChartContainer><div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[var(--chart-1)]" />Invoice mismatches</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[var(--chart-2)]" />Rate errors</span></div></section><section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold text-slate-900">Communication log</h2><p className="mt-1 text-[10px] text-slate-400">Messages and responses with this vendor</p></div><div className="max-h-[270px] overflow-y-auto px-4 py-2 sm:px-5">{communications.map((entry, index) => <div key={`${entry.date}-${index}`} className="relative flex gap-3 py-3"><div className="relative flex flex-col items-center"><span className={`z-10 flex size-7 items-center justify-center rounded-full ${entry.channel === 'Email' ? 'bg-sky-50 text-sky-700' : entry.channel === 'WhatsApp' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>{entry.channel === 'Email' ? <Mail className="size-3.5" /> : entry.channel === 'WhatsApp' ? <MessageCircle className="size-3.5" /> : <MessageSquareText className="size-3.5" />}</span>{index < communications.length - 1 && <span className="absolute top-7 h-full w-px bg-slate-100" />}</div><div className="min-w-0 flex-1 pb-1"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="text-[10px] font-semibold text-slate-700">{entry.channel} · {entry.status}</span><time className="text-[9px] text-slate-400">{entry.date}</time></div><p className="mt-1 text-[11px] leading-4 text-slate-600">{entry.detail}</p></div></div>)}</div>{communications.length === 0 && <p className="px-5 py-8 text-center text-xs text-slate-400">No communication yet.</p>}</section></div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold text-slate-900">Invoice history</h2><p className="mt-1 text-[10px] text-slate-400">Recent invoices and items requiring attention</p></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-50/80"><tr className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400"><th className="px-5 py-3">Invoice</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Issue</th><th className="px-3 py-3 text-right">ITC</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={invoice.number}><td className="px-5 py-3.5 text-xs font-semibold text-slate-800">{invoice.number}</td><td className="px-3 py-3.5 text-[11px] text-slate-500">{invoice.date}</td><td className="max-w-[280px] truncate px-3 py-3.5 text-[11px] text-slate-600">{invoice.issue}</td><td className="px-3 py-3.5 text-right text-xs font-medium text-slate-800">{invoice.value}</td><td className="px-5 py-3.5"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${invoice.state === 'Reviewed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : invoice.state === 'Mismatch' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{invoice.state}</span></td></tr>)}</tbody></table></div></section>
    <VendorMessageComposer vendor={vendor} onLog={onLog} open={composerOpen} onOpenChange={setComposerOpen} />
  </WorkspaceShell>
}

function buildDraft(vendor: Vendor, tone: Tone, language: Language) {
  if (language === 'HI') {
    const issue = vendor.id === 'meridian-cloud'
      ? 'GSTR-2B में GST क्रेडिट हमारी पुस्तकों से INR 720 कम है'
      : vendor.id === 'blue-dune'
        ? 'हमें इस खर्च की ITC पात्रता की पुष्टि करनी है'
        : 'यह इनवॉइस अभी GSTR-2B में दिखाई नहीं दे रहा है'
    const action = vendor.id === 'meridian-cloud'
      ? 'कृपया GST राशि की समीक्षा करें और आवश्यकता होने पर क्रेडिट नोट जारी करें'
      : vendor.id === 'aster-facilities'
        ? 'कृपया रिटर्न फाइल करके GSTR-2B में दिखाई देने पर पुष्टि करें'
        : 'कृपया जांच करके हमें अपडेट दें'
    return tone === 'Firm'
      ? `नमस्ते ${vendor.contact}, इनवॉइस ${vendor.invoice} के बारे में कृपया अपडेट दें। ${issue}। हमारी पुस्तकों में अपेक्षित GST राशि ${vendor.expectedValue} है। ${action}।`
      : `नमस्ते ${vendor.contact}, आशा है आप कुशल होंगे। इनवॉइस ${vendor.invoice} पर कृपया सहायता करें। ${issue}। हमारी पुस्तकों में GST राशि ${vendor.expectedValue} है। ${action}। धन्यवाद।`
  }
  if (language === 'MR') {
    const issue = vendor.id === 'meridian-cloud'
      ? 'GSTR-2B मधील GST क्रेडिट आमच्या नोंदींपेक्षा INR 720 ने कमी आहे'
      : vendor.id === 'blue-dune'
        ? 'या खर्चावरील ITC पात्रतेची आम्हाला खात्री करायची आहे'
        : 'हे इनव्हॉइस अद्याप GSTR-2B मध्ये दिसत नाही'
    const action = vendor.id === 'meridian-cloud'
      ? 'कृपया कराच्या रकमेची तपासणी करून आवश्यक असल्यास क्रेडिट नोट जारी करा'
      : vendor.id === 'aster-facilities'
        ? 'कृपया रिटर्न दाखल करून GSTR-2B मध्ये दिसल्यावर कळवा'
        : 'कृपया तपासून आम्हाला अपडेट द्या'
    return tone === 'Firm'
      ? `नमस्कार ${vendor.contact}, इनव्हॉइस ${vendor.invoice} बाबत कृपया अपडेट द्या. ${issue}. आमच्या नोंदीनुसार अपेक्षित GST ${vendor.expectedValue} आहे. ${action}.`
      : `नमस्कार ${vendor.contact}, आपण ठीक असाल अशी आशा आहे. इनव्हॉइस ${vendor.invoice} बाबत कृपया मदत करा. ${issue}. आमच्या नोंदीनुसार GST ${vendor.expectedValue} आहे. ${action}. धन्यवाद.`
  }
  return tone === 'Firm'
    ? `Hello ${vendor.contact}, we need an update on invoice ${vendor.invoice}. ${vendor.issue}. Our expected GST value is ${vendor.expectedValue}. ${vendor.requestedAction}. Please reply with an update by the next business day.`
    : `Hello ${vendor.contact}, hope you are well. We are reviewing invoice ${vendor.invoice} because ${vendor.issue}. Our books show an expected GST value of ${vendor.expectedValue}. Could you please help us by sharing an update? ${vendor.requestedAction}. Thank you.`
}

function VendorMessageComposer({ vendor, onLog, open, onOpenChange }: { vendor: Vendor; onLog: (entry: Vendor['communication'][number]) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [channel, setChannel] = useState<Channel>('WhatsApp')
  const [tone, setTone] = useState<Tone>('Polite')
  const [language, setLanguage] = useState<Language>('EN')
  const [message, setMessage] = useState(() => buildDraft(vendor, 'Polite', 'EN'))
  const [withAttachment, setWithAttachment] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [notice, setNotice] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  useEffect(() => {
    if (open) {
      setNotice('')
      setScheduleError('')
    }
  }, [open])
  const subject = `Action requested: ${vendor.invoice} · GST reconciliation`
  const variables = [
    { label: 'Invoice no.', value: vendor.invoice },
    { label: 'Expected value', value: vendor.expectedValue },
    { label: 'Requested action', value: vendor.requestedAction },
  ]
  const addLog = (detail: string, status: string) => {
    onLog({ date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), channel, detail, status })
  }
  const performPrimaryAction = () => {
    if (channel === 'WhatsApp') {
      const number = vendor.phone.replace(/\D/g, '')
      const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      window.open(url, '_blank', 'noopener,noreferrer')
      addLog(`WhatsApp draft opened for ${vendor.invoice}`, 'Draft opened')
      setNotice('WhatsApp message opened in a new tab.')
      return
    }
    if (channel === 'Email') {
      addLog(`${subject} · ${message}`, 'Sent · demo')
      setNotice('Email sent in demo mode and added to the communication log.')
      onOpenChange(false)
      return
    }
    addLog(`SMS draft prepared for ${vendor.invoice} · ${message}`, 'Draft prepared')
    setNotice('SMS draft prepared and added to the communication log.')
    onOpenChange(false)
  }
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      addLog(`Copied ${channel} message for ${vendor.invoice}`, 'Copied')
      setNotice('Message copied and added to the communication log.')
    } catch {
      setNotice('Clipboard access is unavailable in this browser.')
    }
  }
  const scheduleFollowUp = () => {
    if (!followUpDate) {
      setScheduleError('Choose a date for the follow-up.')
      return
    }
    const date = new Date(`${followUpDate}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    addLog(`Follow-up scheduled for ${date} · ${vendor.invoice}`, 'Scheduled')
    setNotice(`Follow-up scheduled for ${date}.`)
    setScheduleError('')
    onOpenChange(false)
  }
  const today = new Date().toISOString().slice(0, 10)
  return <>
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) setNotice(''); onOpenChange(nextOpen) }}>
      <DialogContent showCloseButton className="max-h-[92vh] w-[calc(100%-2rem)] max-w-[860px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:!max-w-[860px]">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 pr-12 sm:px-6"><DialogTitle className="text-base font-semibold text-slate-950">Message {vendor.name}</DialogTitle><DialogDescription className="text-xs text-slate-500">A draft is ready with the invoice, issue, expected value, and next action. Email and SMS are demo-only; WhatsApp opens a prefilled draft.</DialogDescription></DialogHeader>
        {notice && <p role="status" className="mx-5 mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-medium text-teal-900 sm:mx-6">{notice}</p>}
        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex min-w-0 flex-col gap-4">
            <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Channel</p><div role="group" aria-label="Message channel" className="grid grid-cols-3 rounded-lg bg-slate-100 p-1">{(['WhatsApp', 'Email', 'SMS'] as Channel[]).map((item) => <button key={item} type="button" aria-pressed={channel === item} onClick={() => setChannel(item)} className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition ${channel === item ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{item === 'WhatsApp' ? <MessageCircle className="size-3.5" /> : item === 'Email' ? <Mail className="size-3.5" /> : <MessageSquareText className="size-3.5" />}{item}</button>)}</div></div>
            {channel === 'Email' && <label className="flex flex-col gap-1.5 text-[10px] font-medium text-slate-500">Subject<input value={subject} readOnly className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700" /></label>}
            <label htmlFor="vendor-message" className="flex flex-col gap-1.5 text-[10px] font-medium text-slate-500">Message<textarea id="vendor-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-slate-700 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10" /></label>
            <div className="flex flex-wrap items-end gap-3"><label className="flex flex-1 flex-col gap-1.5 text-[10px] font-medium text-slate-500">Tone<select aria-label="Message tone" value={tone} onChange={(event) => { const next = event.target.value as Tone; setTone(next); setMessage(buildDraft(vendor, next, language)) }} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"><option>Polite</option><option>Firm</option></select></label><label className="flex flex-1 flex-col gap-1.5 text-[10px] font-medium text-slate-500">Language<select aria-label="Message language" value={language} onChange={(event) => { const next = event.target.value as Language; setLanguage(next); setMessage(buildDraft(vendor, tone, next)) }} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"><option value="EN">English</option><option value="HI">हिन्दी</option><option value="MR">मराठी</option></select></label></div>
            <div><p className="mb-2 text-[10px] font-medium text-slate-500">Insert details</p><div className="flex flex-wrap gap-1.5">{variables.map((item) => <button type="button" key={item.label} onClick={() => setMessage((current) => `${current}\n${item.label}: ${item.value}`)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-medium text-slate-600 hover:border-teal-200 hover:bg-teal-50">+ {item.label}</button>)}</div></div>
            <label className="flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={withAttachment} onChange={(event) => setWithAttachment(event.target.checked)} className="size-4 accent-teal-800" />Attach annotated invoice snapshot</label>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={performPrimaryAction} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-3 text-[11px] font-semibold text-white hover:bg-teal-900">{channel === 'WhatsApp' ? <><MessageCircle className="size-3.5" />Open in WhatsApp</> : channel === 'Email' ? <><Send className="size-3.5" />Send email</> : <><MessageSquareText className="size-3.5" />Prepare SMS</>}</button><button type="button" onClick={copyMessage} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><Copy className="size-3.5" />Copy</button></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-slate-700"><CalendarClock className="size-3.5 text-slate-500" />Schedule follow-up</div><div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Follow-up date</span><input type="date" min={today} value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); setScheduleError('') }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700" /></label><button type="button" onClick={scheduleFollowUp} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">Schedule</button></div>{scheduleError && <p role="alert" className="mt-1.5 text-[10px] text-rose-700">{scheduleError}</p>}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold text-slate-800">Live preview</p><p className="mt-0.5 text-[9px] text-slate-400">{channel === 'WhatsApp' ? 'WhatsApp · mobile view' : channel === 'Email' ? `Email to ${vendor.email}` : `SMS · ${vendor.phone}`}</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-medium text-slate-500">{language}</span></div>{channel === 'Email' && <div className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[9px] text-slate-400">To: <span className="text-slate-600">{vendor.email}</span></p><p className="mt-1 text-[9px] text-slate-400">Subject: <span className="text-slate-700">{subject}</span></p></div>}<div className={`rounded-2xl border border-emerald-100 bg-[#e9f7eb] p-3 text-[11px] leading-[1.65] text-slate-700 shadow-sm ${channel === 'Email' ? 'rounded-lg border-slate-200 bg-white' : ''}`}><p className="whitespace-pre-wrap break-words">{message}</p>{withAttachment && <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white/80 p-2"><span className="flex size-8 items-center justify-center rounded-md bg-rose-50 text-rose-700"><FileText className="size-4" /></span><span className="min-w-0"><span className="block truncate text-[9px] font-semibold text-slate-700">{vendor.invoice} · annotated</span><span className="text-[8px] text-slate-400">Invoice snapshot · PDF</span></span><Check className="ml-auto size-3.5 text-emerald-700" /></div>}<p className="mt-2 text-right text-[8px] text-slate-400">10:42 AM <span className="ml-1 text-teal-700">✓✓</span></p></div><p className="mt-3 text-[9px] leading-4 text-slate-400">Review the message before sharing. This preview uses sample vendor contact details.</p></div>
        </div>
      </DialogContent>
    </Dialog>
  </>
}

export default function VendorWorkspace({ vendorId }: { vendorId?: string }) {
  const vendor = vendorId ? vendors.find((item) => item.id === vendorId) : undefined
  const [communications, setCommunications] = useState<Vendor['communication']>(() => vendor?.communication ?? [])
  const [notice, setNotice] = useState('')
  const addCommunication = (entry: Vendor['communication'][number]) => setCommunications((current) => [entry, ...current])
  if (!vendorId) return <VendorList />
  if (!vendor) return <WorkspaceShell><div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center"><h1 className="text-lg font-semibold text-slate-900">Vendor not found</h1><p className="mt-2 text-sm text-slate-500">This vendor may have been removed from the workspace.</p><a href="/app/vendors" className="mt-4 inline-flex text-sm font-medium text-teal-800 hover:underline">Back to vendors</a></div></WorkspaceShell>
  return <VendorDetail vendor={vendor} communications={communications} onLog={(entry) => { addCommunication(entry); setNotice(`${entry.channel}: ${entry.status}`) }} notice={notice} clearNotice={() => setNotice('')} />
}


