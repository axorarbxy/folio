'use client'

import { useMemo, useRef, useState } from 'react'
import { MobileWorkspaceNav } from '@/components/app-shell'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileJson,
  FileText,
  Info,
  Mail,
  PanelRightClose,
  Search,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react'

type Status = 'Matched' | 'Mismatch' | 'Missing in GSTR-2B' | 'Vendor not filed' | 'Ineligible'
type ReconciliationRow = {
  id: string
  vendor: string
  gstin: string
  invoice: string
  date: string
  books: number
  gstr2b: number | null
  difference: number | null
  status: Status
  irn: boolean
  ewb: boolean
  action: string
  data: { field: string; books: string; gstr2b: string; einvoice: string; differs?: boolean }[]
}

const rows: ReconciliationRow[] = [
  { id: '1', vendor: 'Northstar Office Systems', gstin: '27AAKCS8421M1Z5', invoice: 'SOS/25-26/0842', date: '18 Mar 2026', books: 9360, gstr2b: 9360, difference: 0, status: 'Matched', irn: true, ewb: false, action: 'Ready to claim', data: [{ field: 'Taxable value', books: 'INR 52,000', gstr2b: 'INR 52,000', einvoice: 'INR 52,000' }, { field: 'Input tax credit', books: 'INR 9,360', gstr2b: 'INR 9,360', einvoice: 'INR 9,360' }, { field: 'Invoice date', books: '18 Mar 2026', gstr2b: '18 Mar 2026', einvoice: '18 Mar 2026' }] },
  { id: '2', vendor: 'Meridian Cloud Services', gstin: '29AAGCM9214R1Z2', invoice: 'MCS/26/0318', date: '21 Mar 2026', books: 21600, gstr2b: 20880, difference: 720, status: 'Mismatch', irn: true, ewb: false, action: 'Review tax difference', data: [{ field: 'Taxable value', books: 'INR 1,20,000', gstr2b: 'INR 1,20,000', einvoice: 'INR 1,20,000' }, { field: 'Input tax credit', books: 'INR 21,600', gstr2b: 'INR 20,880', einvoice: 'INR 21,600', differs: true }, { field: 'Invoice date', books: '21 Mar 2026', gstr2b: '21 Mar 2026', einvoice: '21 Mar 2026' }] },
  { id: '3', vendor: 'Kaveri Packaging Co.', gstin: '29AACFK7812L1ZP', invoice: 'KPC/2026/1189', date: '23 Mar 2026', books: 14400, gstr2b: null, difference: null, status: 'Missing in GSTR-2B', irn: true, ewb: true, action: 'Check next GSTR-2B', data: [{ field: 'Taxable value', books: 'INR 80,000', gstr2b: 'Not found', einvoice: 'INR 80,000', differs: true }, { field: 'Input tax credit', books: 'INR 14,400', gstr2b: 'Not found', einvoice: 'INR 14,400', differs: true }, { field: 'IRN', books: 'Present', gstr2b: '—', einvoice: 'Present' }] },
  { id: '4', vendor: 'Aster Facilities India', gstin: '27AAECA3348D1ZQ', invoice: 'AFI/25-26/557', date: '25 Mar 2026', books: 8100, gstr2b: null, difference: null, status: 'Vendor not filed', irn: true, ewb: false, action: 'Remind vendor', data: [{ field: 'Taxable value', books: 'INR 45,000', gstr2b: 'Not filed', einvoice: 'INR 45,000', differs: true }, { field: 'Input tax credit', books: 'INR 8,100', gstr2b: 'Not filed', einvoice: 'INR 8,100', differs: true }, { field: 'Supplier return', books: 'Expected', gstr2b: 'Not filed', einvoice: 'Filed' }] },
  { id: '5', vendor: 'Blue Dune Hospitality', gstin: '27AAGFB0112C1ZS', invoice: 'BDH/2026/092', date: '27 Mar 2026', books: 5400, gstr2b: 5400, difference: 0, status: 'Ineligible', irn: false, ewb: false, action: 'Reverse ITC', data: [{ field: 'Taxable value', books: 'INR 30,000', gstr2b: 'INR 30,000', einvoice: 'INR 30,000' }, { field: 'Input tax credit', books: 'INR 5,400', gstr2b: 'INR 5,400', einvoice: 'INR 5,400' }, { field: 'Expense type', books: 'Client entertainment', gstr2b: 'Business expense', einvoice: 'Catering', differs: true }] },
  { id: '6', vendor: 'Prism Print & Paper', gstin: '27AAEFP1428H1ZL', invoice: 'PPP/25-26/4401', date: '29 Mar 2026', books: 3780, gstr2b: 3780, difference: 0, status: 'Matched', irn: true, ewb: false, action: 'Ready to claim', data: [{ field: 'Taxable value', books: 'INR 21,000', gstr2b: 'INR 21,000', einvoice: 'INR 21,000' }, { field: 'Input tax credit', books: 'INR 3,780', gstr2b: 'INR 3,780', einvoice: 'INR 3,780' }, { field: 'Invoice date', books: '29 Mar 2026', gstr2b: '29 Mar 2026', einvoice: '29 Mar 2026' }] },
  { id: '7', vendor: 'Orbit Network Solutions', gstin: '29AABCO9540J1ZN', invoice: 'ONS/INV/7702', date: '30 Mar 2026', books: 11700, gstr2b: 12060, difference: -360, status: 'Mismatch', irn: true, ewb: true, action: 'Verify credit note', data: [{ field: 'Taxable value', books: 'INR 65,000', gstr2b: 'INR 67,000', einvoice: 'INR 65,000', differs: true }, { field: 'Input tax credit', books: 'INR 11,700', gstr2b: 'INR 12,060', einvoice: 'INR 11,700', differs: true }, { field: 'Invoice date', books: '30 Mar 2026', gstr2b: '30 Mar 2026', einvoice: '30 Mar 2026' }] },
  { id: '8', vendor: 'Cedar & Finch Consulting', gstin: '27AANFC4910K1ZE', invoice: 'CFC/2026/203', date: '31 Mar 2026', books: 6200, gstr2b: 6200, difference: 0, status: 'Matched', irn: false, ewb: false, action: 'Ready to claim', data: [{ field: 'Taxable value', books: 'INR 34,444', gstr2b: 'INR 34,444', einvoice: 'INR 34,444' }, { field: 'Input tax credit', books: 'INR 6,200', gstr2b: 'INR 6,200', einvoice: 'INR 6,200' }, { field: 'Invoice date', books: '31 Mar 2026', gstr2b: '31 Mar 2026', einvoice: '31 Mar 2026' }] },
]

const statuses: Status[] = ['Matched', 'Mismatch', 'Missing in GSTR-2B', 'Vendor not filed', 'Ineligible']
const amounts = { Matched: 19340, Mismatch: 1080, 'Missing in GSTR-2B': 14400, 'Vendor not filed': 8100, Ineligible: 5400 }
const statusTone: Record<Status, string> = {
  Matched: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Mismatch: 'border-amber-200 bg-amber-50 text-amber-800',
  'Missing in GSTR-2B': 'border-orange-200 bg-orange-50 text-orange-800',
  'Vendor not filed': 'border-rose-200 bg-rose-50 text-rose-800',
  Ineligible: 'border-slate-200 bg-slate-100 text-slate-700',
}
const formatMoney = (value: number) => `INR ${new Intl.NumberFormat('en-IN').format(value)}`

function SourceBadge({ label, present }: { label: string; present: boolean }) {
  return <span title={`${label} ${present ? 'available' : 'not available'}`} className={`inline-flex size-6 items-center justify-center rounded-md border text-[9px] font-bold ${present ? 'border-teal-100 bg-teal-50 text-teal-800' : 'border-slate-100 bg-slate-50 text-slate-300'}`} aria-label={`${label} ${present ? 'available' : 'not available'}`}>
    {present ? <Check className="size-3" aria-hidden="true" /> : <span aria-hidden="true">—</span>}<span className="sr-only">{label}</span>
  </span>
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="itc-modal-title" aria-describedby="itc-modal-description" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="itc-modal-title" className="text-base font-semibold text-slate-950">{title}</h2><p id="itc-modal-description" className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button></div>
      {children}
    </section>
  </div>
}

export default function ItcReconciliation() {
  const [period, setPeriod] = useState('Mar 2026')
  const [activeTab, setActiveTab] = useState<'All' | Status>('All')
  const [selectedRow, setSelectedRow] = useState<ReconciliationRow | null>(null)
  const [riskCount, setRiskCount] = useState(2)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [resolved, setResolved] = useState<Record<string, string>>({})
  const [uploaded, setUploaded] = useState(false)
  const [search, setSearch] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const hasGstrData = period !== 'Apr 2026' || uploaded

  const filteredRows = useMemo(() => rows.filter((row) => (activeTab === 'All' || row.status === activeTab) && `${row.vendor} ${row.invoice} ${row.gstin}`.toLowerCase().includes(search.toLowerCase())), [activeTab, search])
  const projectedRisk = 9360 + riskCount * 4050
  const pendingCount = rows.filter((row) => row.status === 'Vendor not filed').length

  const handleFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) throw new Error('Invalid GSTR-2B JSON shape')
      setUploaded(true)
      setNotice('GSTR-2B JSON added for Apr 2026. Reconciliation is ready to review.')
    } catch {
      setNotice('We couldn\'t read that file. Upload a valid GSTR-2B JSON export.')
    }
  }

  const resolveRow = (row: ReconciliationRow, action: string) => {
    setResolved((current) => ({ ...current, [row.id]: action }))
    setSelectedRow(null)
    setNotice(`${row.invoice} marked: ${action}`)
  }

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/15 bg-[#474c80] px-4 text-[#f8f7e2] shadow-[0_8px_28px_rgba(38,40,73,0.18)] sm:px-7">
      <div className="flex items-center gap-3"><a href="/" aria-label="Folio home" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#f8f7e2] text-[#474c80]"><FileText className="size-5" /></span><span className="text-2xl font-bold tracking-[-0.06em] text-[#f8f7e2]">folio<span className="text-[#c7c8e5]">.</span></span></a><span className="hidden h-5 w-px bg-white/25 sm:block" /><span className="hidden text-sm text-[#f8f7e2]/75 sm:block">GST workspace</span></div>
      <div className="flex items-center gap-2 sm:gap-4"><span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 md:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" />All systems operational</span><a href="/app/settings?section=notifications" aria-label="Notification preferences" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell className="size-4" /></a><a href="https://www.gst.gov.in/" target="_blank" rel="noreferrer" aria-label="GST portal help" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><CircleHelp className="size-4" /></a><div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-900" aria-label="Account: Aditi Rao">AR</div></div>
    </header>
    <div className="mx-auto flex min-h-[calc(100vh-66px)] max-w-[1600px]">
      <aside className="hidden w-[240px] shrink-0 border-r border-[#393d68] bg-[#474c80] px-4 py-7 text-[#f8f7e2] lg:block">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
        <nav aria-label="Workspace" className="mt-3 flex flex-col gap-1">
          {[
            { label: 'Overview', href: '/app', icon: '⌂' },
            { label: 'Invoices', href: '/app/invoices', icon: '▤' },
            { label: 'ITC reconciliation', href: '/app/itc', icon: '◫' },
            { label: 'Vendors', href: '/app/vendors', icon: '◇' },
            { label: 'Reports', href: '/app/reports', icon: '◷' },
          ].map((item) => <a key={item.label} href={item.href} aria-current={item.label === 'ITC reconciliation' ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${item.label === 'ITC reconciliation' ? 'bg-[#f8f7e2] text-[#393d68]' : 'text-[#f8f7e2]/80 hover:bg-white/10 hover:text-white'}`}><span aria-hidden="true" className="w-4 text-center text-base">{item.icon}</span>{item.label}</a>)}
        </nav>
        <div className="mt-8 border-t border-slate-100 pt-5"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Manage</p><nav aria-label="Manage workspace" className="mt-3 flex flex-col gap-1"><a href="/app/settings" className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">GST settings</a><a href="/app/settings?section=team" className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Team members</a></nav></div>
        <div className="mt-8 rounded-xl border border-teal-100 bg-teal-50/60 p-3.5"><span className="flex size-8 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><BookOpenCheck className="size-4" /></span><p className="mt-3 text-xs font-semibold text-slate-800">Reconcile with confidence</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Match purchase books to GSTR-2B before filing.</p></div>
      </aside>
      <main className="min-w-0 flex-1">
        <MobileWorkspaceNav active="ITC reconciliation" />
        <div className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
          <div className="relative mb-7 flex flex-col justify-between gap-5 overflow-hidden rounded-[1.75rem] bg-[#474c80] px-6 py-7 text-[#f8f7e2] shadow-[0_18px_45px_rgba(45,49,91,0.18)] xl:flex-row xl:items-end sm:px-8 sm:py-8">
            <div><div className="mb-3 flex items-center gap-2 text-sm text-[#d7d8ef]"><span>Workspace</span><span className="text-white/45">/</span><span className="font-semibold text-[#f8f7e2]">ITC reconciliation</span></div><h1 className="text-4xl font-bold tracking-[-0.055em] text-[#f8f7e2] sm:text-5xl">ITC reconciliation</h1><p className="mt-2 text-base text-[#f8f7e2]/75">See what matches, what needs attention, and what could put your credit at risk.</p></div>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="flex flex-col gap-1 text-[10px] font-medium text-slate-500">Tax period<select aria-label="Tax period" value={period} onChange={(event) => { setPeriod(event.target.value); setUploaded(false) }} className="h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><option>Mar 2026</option><option>Apr 2026</option><option>Feb 2026</option></select></label>
              <div className="flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[11px] font-medium text-amber-900"><Clock3 className="size-3.5" /><span>11 Apr filing · <strong>8 days left</strong></span></div>
              <button type="button" onClick={() => setReminderOpen(true)} disabled={!hasGstrData || pendingCount === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Mail className="size-3.5" />Send reminders to all pending vendors <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{pendingCount}</span></button>
            </div>
          </div>

          {notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-medium text-teal-900"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification" className="rounded p-1 hover:bg-teal-100"><X className="size-3.5" /></button></div>}

          {!hasGstrData ? <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-10">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-800"><FileJson className="size-6" /></span><h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">Add your GSTR-2B for April</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Upload the JSON file from the GST portal to compare your purchase register with filed supplier invoices.</p>
            <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Upload GSTR-2B JSON" onChange={(event) => handleFile(event.target.files?.[0])} /><button type="button" onClick={() => fileInput.current?.click()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900"><Upload className="size-4" />Upload GSTR-2B JSON</button><p className="mt-4 text-xs text-slate-500">Need a hand? <a href="https://www.gst.gov.in/" target="_blank" rel="noreferrer" className="font-medium text-teal-800 underline underline-offset-2">How to download GSTR-2B <ArrowRight className="inline size-3" /></a></p>
          </section> : <>
            <section aria-label="Input tax credit summary" className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="p-4 sm:p-5 lg:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{period} · purchase register vs GSTR-2B</p><h2 className="mt-1 text-sm font-semibold text-slate-800">ITC at risk</h2><p className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.05em] text-rose-700">{formatMoney(amounts.Mismatch + amounts['Missing in GSTR-2B'] + amounts['Vendor not filed'])}<span className="ml-2 text-xs font-medium tracking-normal text-slate-500">across 3 categories</span></p></div><div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Return due</p><p className="mt-1 text-sm font-semibold text-slate-900">11 Apr 2026</p><p className="mt-0.5 text-[10px] text-amber-800">8 days to review</p></div></div>
                  <div className="mt-5" role="img" aria-label="ITC distribution by reconciliation status"><div className="flex h-3 overflow-hidden rounded-full bg-slate-100">{statuses.map((status) => <div key={status} style={{ width: `${(amounts[status] / 54320) * 100}%` }} className={{ Matched: 'bg-emerald-500', Mismatch: 'bg-amber-400', 'Missing in GSTR-2B': 'bg-orange-500', 'Vendor not filed': 'bg-rose-500', Ineligible: 'bg-slate-400' }[status]} title={`${status}: ${formatMoney(amounts[status])}`} />)}</div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{statuses.map((status) => <div key={status} className="flex items-center gap-1.5 text-[10px] text-slate-600"><span className={`size-2 rounded-full ${{ Matched: 'bg-emerald-500', Mismatch: 'bg-amber-400', 'Missing in GSTR-2B': 'bg-orange-500', 'Vendor not filed': 'bg-rose-500', Ineligible: 'bg-slate-400' }[status]}`} /><span>{status}</span><strong className="font-semibold text-slate-800">{formatMoney(amounts[status])}</strong></div>)}</div>
                  </div>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-1.5"><h3 className="text-xs font-semibold text-slate-900">Risk simulator</h3><span title="Estimate only. Final eligibility depends on your filed returns and applicable GST rules." className="group relative inline-flex"><Info className="size-3.5 text-slate-400" /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-2 text-[10px] leading-4 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">Estimate only. Confirm eligibility against filed returns and applicable GST rules.</span></span></div><p className="mt-1 text-[10px] leading-4 text-slate-500">If these vendors don't file by the 11th…</p></div><ShieldAlert className="size-4 text-amber-600" /></div>
                  <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500"><label htmlFor="risk-vendors">Vendors still pending</label><span className="font-semibold text-slate-900">{riskCount}</span></div><input id="risk-vendors" type="range" min="0" max="8" value={riskCount} onChange={(event) => setRiskCount(Number(event.target.value))} className="mt-2 w-full accent-teal-800" /><div className="mt-3 flex items-end justify-between gap-2"><span className="text-[10px] text-slate-500">Projected ITC exposure</span><span className="text-lg font-semibold tracking-tight text-rose-700">{formatMoney(projectedRisk)}</span></div><div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2 text-[9px] leading-4 text-amber-900"><AlertCircle className="mt-0.5 size-3 shrink-0" />Estimate only — credit eligibility depends on filing and applicable GST rules.</div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]" aria-label="ITC reconciliation records">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5"><div><h2 className="text-sm font-semibold text-slate-900">Reconciliation register <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{filteredRows.length}</span></h2><p className="mt-0.5 text-[11px] text-slate-400">Books compared with GSTR-2B and source documents</p></div><label className="relative block w-full sm:w-56"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search vendor or invoice" aria-label="Search vendor or invoice" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-teal-700" /></label></div>
              <div className="border-b border-slate-100 px-3 pt-2 sm:px-5"><div role="tablist" aria-label="Filter reconciliation by status" className="flex gap-1 overflow-x-auto">{(['All', ...statuses] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-t-lg border-b-2 px-2.5 py-2.5 text-[10px] font-medium transition ${activeTab === tab ? 'border-teal-800 text-teal-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab}</button>)}</div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[1030px] text-left"><thead className="bg-slate-50/80"><tr className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400"><th className="px-4 py-3 pl-5">Vendor / invoice</th><th className="px-3 py-3 text-right">Books</th><th className="px-3 py-3 text-right">GSTR-2B</th><th className="px-3 py-3 text-right">Difference</th><th className="px-3 py-3">Sources</th><th className="px-3 py-3">Status</th><th className="px-4 py-3 pr-5">Suggested action</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRow(row) } }} className="cursor-pointer transition hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700">
                <td className="px-4 py-3.5 pl-5"><div className="text-xs font-semibold text-slate-900">{row.vendor}</div><div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500"><span className="font-mono">{row.invoice}</span><span className="text-slate-300">·</span>{row.date}</div><div className="mt-1 text-[9px] text-slate-400">GSTIN {row.gstin}</div></td>
                <td className="px-3 py-3.5 text-right text-xs font-medium tabular-nums text-slate-800">{formatMoney(row.books)}</td><td className="px-3 py-3.5 text-right text-xs font-medium tabular-nums text-slate-700">{row.gstr2b === null ? <span className="text-slate-400">—</span> : formatMoney(row.gstr2b)}</td><td className="px-3 py-3.5 text-right text-xs font-semibold tabular-nums">{row.difference === null ? <span className="text-slate-400">—</span> : row.difference === 0 ? <span className="text-emerald-700">INR 0</span> : <span className="text-rose-700">{row.difference < 0 ? '−' : '+'}{formatMoney(Math.abs(row.difference))}</span>}</td>
                <td className="px-3 py-3.5"><div className="flex gap-1"><SourceBadge label="Books" present /><SourceBadge label="2B" present={row.gstr2b !== null} /><SourceBadge label="IRN" present={row.irn} /><SourceBadge label="EWB" present={row.ewb} /></div></td>
                <td className="px-3 py-3.5"><span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${statusTone[row.status]}`}>{resolved[row.id] ? 'Resolved' : row.status}</span></td><td className="px-4 py-3.5 pr-5"><span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-800">{resolved[row.id] || row.action}<ArrowRight className="size-3" /></span></td>
              </tr>)}</tbody></table></div>
              {filteredRows.length === 0 && <div className="px-6 py-12 text-center"><p className="text-sm font-medium text-slate-800">No invoices in this view</p><p className="mt-1 text-xs text-slate-500">Try a different status or search term.</p></div>}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:px-5"><span>Showing {filteredRows.length} of 48 purchase invoices · last synced just now</span><span className="inline-flex items-center gap-1"><Info className="size-3" />Amounts shown are illustrative mock data</span></div>
            </section>
          </>}
        </div>
      </main>
    </div>

    {selectedRow && <div className="fixed inset-0 z-40 bg-slate-950/30" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRow(null) }}><aside role="dialog" aria-modal="true" aria-labelledby="reconciliation-detail-title" className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-7"><div><div className="mb-1 flex items-center gap-2 text-[10px] text-slate-400"><span>ITC reconciliation</span><ArrowRight className="size-3" /><span>Invoice detail</span></div><h2 id="reconciliation-detail-title" className="text-lg font-semibold tracking-tight text-slate-950">{selectedRow.vendor}</h2><p className="mt-1 text-xs text-slate-500">{selectedRow.invoice} · {selectedRow.date} · GSTIN {selectedRow.gstin}</p></div><button type="button" onClick={() => setSelectedRow(null)} aria-label="Close invoice details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><PanelRightClose className="size-4" /></button></div>
      <div className="flex-1 px-5 py-5 sm:px-7"><div className="mb-5 flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone[selectedRow.status]}`}>{selectedRow.status}</span><span className="text-xs text-slate-500">Books ITC <strong className="text-slate-800">{formatMoney(selectedRow.books)}</strong></span>{selectedRow.difference !== null && <span className="text-xs text-slate-500">Difference <strong className={selectedRow.difference === 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatMoney(Math.abs(selectedRow.difference))}</strong></span>}</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-xl border border-slate-200"><div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-semibold text-slate-800">Your books</p><p className="mt-0.5 text-[9px] text-slate-400">Purchase register</p></div></div><div className="rounded-xl border border-slate-200"><div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-semibold text-slate-800">GSTR-2B</p><p className="mt-0.5 text-[9px] text-slate-400">Supplier-filed data</p></div></div><div className="rounded-xl border border-slate-200"><div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-semibold text-slate-800">E-invoice</p><p className="mt-0.5 text-[9px] text-slate-400">IRN / EWB source</p></div></div>
          {selectedRow.data.map((item) => <div key={`books-${item.field}`} className={`rounded-lg px-3 py-2.5 ${item.differs ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50/80'}`}><p className="text-[9px] font-medium text-slate-400">{item.field}</p><p className="mt-1 text-[11px] font-semibold text-slate-800">{item.books}</p></div>)}
          {selectedRow.data.map((item) => <div key={`2b-${item.field}`} className={`rounded-lg px-3 py-2.5 ${item.differs ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50/80'}`}><p className="text-[9px] font-medium text-slate-400">{item.field}</p><p className="mt-1 text-[11px] font-semibold text-slate-800">{item.gstr2b}</p></div>)}
          {selectedRow.data.map((item) => <div key={`einvoice-${item.field}`} className={`rounded-lg px-3 py-2.5 ${item.differs ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50/80'}`}><p className="text-[9px] font-medium text-slate-400">{item.field}</p><p className="mt-1 text-[11px] font-semibold text-slate-800">{item.einvoice}</p></div>)}
        </div>
        <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/50 p-4"><div className="flex items-start gap-2.5"><FileCheck2 className="mt-0.5 size-4 text-teal-800" /><div><p className="text-xs font-semibold text-slate-900">Suggested next step</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{selectedRow.action}. Compare the source documents and choose how to record this invoice for the current return.</p></div></div></div>
        <div className="mt-6"><label htmlFor="resolve-action" className="text-xs font-semibold text-slate-800">Resolve this invoice</label><p className="mt-1 text-[10px] text-slate-500">Choose how this item should be tracked for the period.</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><select id="resolve-action" defaultValue="" className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><option value="" disabled>Select an action</option><option>Contact vendor</option><option>Defer to next month</option><option>Reverse ITC</option><option>Accept difference</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /></div><button type="button" onClick={() => { const select = document.getElementById('resolve-action') as HTMLSelectElement | null; if (select?.value) resolveRow(selectedRow, select.value) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 text-xs font-semibold text-white hover:bg-teal-900"><CheckCircle2 className="size-3.5" />Save resolution</button></div></div>
      </div><div className="border-t border-slate-100 px-5 py-3 sm:px-7"><div className="flex items-center gap-2 text-[10px] text-slate-400"><BadgeCheck className="size-3.5 text-teal-700" />This review is a decision aid, not tax advice.</div></div>
    </aside></div>}

    {reminderOpen && <Modal title={`Send reminders to ${pendingCount} pending vendor${pendingCount === 1 ? '' : 's'}?`} description="We'll prepare a reminder for each vendor whose invoice is not yet reflected in GSTR-2B. Review before sending from your connected email." onClose={() => setReminderOpen(false)}><div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2"><Mail className="size-4 text-teal-800" /><p className="text-xs font-medium text-slate-800">{rows.filter((row) => row.status === 'Vendor not filed').map((row) => row.vendor).join(', ')}</p></div><p className="mt-2 text-[10px] text-slate-500">Reminders are mock-only in this UI preview.</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReminderOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={() => { setReminderOpen(false); setNotice(`Reminder${pendingCount === 1 ? '' : 's'} prepared for ${pendingCount} pending vendor${pendingCount === 1 ? '' : 's'}.`) }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3 text-xs font-semibold text-white hover:bg-teal-900"><Mail className="size-3.5" />Prepare reminders</button></div></Modal>}
  </div>
}
