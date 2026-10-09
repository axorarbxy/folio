'use client'

import { useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowUpRight, BarChart3, Check, ChevronDown, Clock3, FileCheck2, FileSpreadsheet, FileText, Filter, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { AppShell, MetricCard, PageHeading, SectionCard, formatRupees } from '@/components/app-shell'

type ReportName = 'Monthly GST health' | 'ITC summary' | 'Error analysis' | 'Vendor risk' | 'Audit-ready invoice pack'
type EventType = 'Invoice extracted' | 'Field edited' | 'Validated' | 'Message sent'
type AuditEvent = { id: number; type: EventType; actor: string; invoice: string; vendor: string; time: string; detail: string; before?: string; after?: string }

const reports: { title: ReportName; description: string; icon: typeof FileText; detail: string; tone: string }[] = [
  { title: 'Monthly GST health', description: 'Filing readiness, invoice coverage, and exceptions for your selected period.', icon: BarChart3, detail: '48 invoices · 94% matched', tone: 'bg-teal-50 text-teal-800' },
  { title: 'ITC summary', description: 'Eligible, pending, and at-risk input tax credit across your purchase register.', icon: FileCheck2, detail: 'INR 2.84L eligible ITC', tone: 'bg-emerald-50 text-emerald-800' },
  { title: 'Error analysis', description: 'A prioritized view of validation failures and fields that need review.', icon: Activity, detail: '6 items need attention', tone: 'bg-amber-50 text-amber-800' },
  { title: 'Vendor risk', description: 'Supplier filing patterns, GSTIN checks, and invoice mismatch trends.', icon: ShieldCheck, detail: '2 vendors flagged', tone: 'bg-sky-50 text-sky-800' },
  { title: 'Audit-ready invoice pack', description: 'A clean export of source invoices, validations, and supporting records.', icon: FileSpreadsheet, detail: '48 source documents', tone: 'bg-violet-50 text-violet-800' },
]

const initialDownloads = [
  { name: 'GST health — Apr 2026', format: 'PDF', date: '14 Apr 2026', owner: 'Aditi Mehta', status: 'Ready' },
  { name: 'ITC summary — Mar 2026', format: 'Excel', date: '08 Apr 2026', owner: 'Rohan Shah', status: 'Ready' },
  { name: 'Audit pack — Feb 2026', format: 'CSV', date: '01 Apr 2026', owner: 'Aditi Mehta', status: 'Ready' },
]

const events: AuditEvent[] = [
  { id: 1, type: 'Field edited', actor: 'Aditi Mehta', invoice: 'INV-2026-0418', vendor: 'Northstar Supplies', time: '14 Apr, 10:42 AM', detail: 'Updated taxable value after checking the source invoice.', before: 'INR 48,000', after: 'INR 48,500' },
  { id: 2, type: 'Validated', actor: 'System', invoice: 'INV-2026-0418', vendor: 'Northstar Supplies', time: '14 Apr, 10:40 AM', detail: 'GSTIN, tax split, and invoice date checks passed.' },
  { id: 3, type: 'Invoice extracted', actor: 'Aditi Mehta', invoice: 'INV-2026-0418', vendor: 'Northstar Supplies', time: '14 Apr, 10:38 AM', detail: 'Invoice fields extracted with 98% confidence.' },
  { id: 4, type: 'Message sent', actor: 'Rohan Shah', invoice: 'INV-2026-0392', vendor: 'Aster Office Mart', time: '13 Apr, 04:16 PM', detail: 'Requested a corrected invoice over WhatsApp.' },
  { id: 5, type: 'Field edited', actor: 'Rohan Shah', invoice: 'INV-2026-0392', vendor: 'Aster Office Mart', time: '13 Apr, 04:10 PM', detail: 'Corrected the invoice date to match the source document.', before: '11 Apr 2026', after: '12 Apr 2026' },
  { id: 6, type: 'Validated', actor: 'CA / Auditor', invoice: 'INV-2026-0355', vendor: 'Kaveri Components', time: '12 Apr, 02:24 PM', detail: 'Reviewed and approved for ITC reconciliation.' },
  { id: 7, type: 'Invoice extracted', actor: 'Aditi Mehta', invoice: 'INV-2026-0318', vendor: 'Paperplane Studio', time: '11 Apr, 11:05 AM', detail: 'Invoice fields extracted with 91% confidence.' },
  { id: 8, type: 'Message sent', actor: 'Aditi Mehta', invoice: 'INV-2026-0299', vendor: 'Cedar & Co.', time: '10 Apr, 09:32 AM', detail: 'Sent a payment and invoice status reminder.' },
]

const eventTones: Record<EventType, string> = {
  'Invoice extracted': 'bg-sky-50 text-sky-800',
  'Field edited': 'bg-amber-50 text-amber-800',
  Validated: 'bg-emerald-50 text-emerald-800',
  'Message sent': 'bg-violet-50 text-violet-800',
}

export default function ReportsWorkspace() {
  const [period, setPeriod] = useState('Apr 2026')
  const [format, setFormat] = useState('PDF')
  const [activeReport, setActiveReport] = useState<ReportName | null>(null)
  const [generating, setGenerating] = useState<ReportName | null>(null)
  const [downloads, setDownloads] = useState(initialDownloads)
  const [query, setQuery] = useState('')
  const [eventFilter, setEventFilter] = useState('All events')
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent>(events[0])

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesType = eventFilter === 'All events' || event.type === eventFilter
    const searchable = `${event.actor} ${event.invoice} ${event.vendor} ${event.detail}`.toLowerCase()
    return matchesType && searchable.includes(query.toLowerCase())
  }), [eventFilter, query])

  function generateReport(title: ReportName) {
    setActiveReport(title)
    setGenerating(title)
    window.setTimeout(() => {
      setDownloads((current) => [{ name: `${title} — ${period}`, format, date: '14 Apr 2026', owner: 'Aditi Mehta', status: 'Ready' }, ...current].slice(0, 5))
      setGenerating(null)
    }, 950)
  }

  function downloadCsv(name: string) {
    const rows = [['Invoice', 'Vendor', 'Action', 'Actor', 'Time'], ...events.map((event) => [event.invoice, event.vendor, event.type, event.actor, event.time])]
    const blob = new Blob([rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.csv`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <AppShell active="Reports">
    <PageHeading eyebrow="Reports" title="Reports & audit trail" description="Create a clear picture of your GST health and keep a searchable record of every important change." action={<span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-900"><Sparkles className="size-3.5" />Preview data</span>} />
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Invoices in period" value="48" note="April 2026" icon={FileText} />
      <MetricCard label="Matched to GSTR-2B" value="94%" note="45 of 48 invoices" icon={Check} />
      <MetricCard label="Eligible ITC" value={formatRupees(284200)} note="Across 42 matched invoices" icon={FileCheck2} />
      <MetricCard label="Open exceptions" value="6" note="2 high priority" icon={Clock3} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
      <SectionCard title="GST reports" description="Choose a report, period, and export format.">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Period<select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal normal-case tracking-normal text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Apr 2026</option><option>Mar 2026</option><option>Feb 2026</option><option>FY 2025–26</option></select></label>
          <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Format<select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal normal-case tracking-normal text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700" value={format} onChange={(event) => setFormat(event.target.value)}><option>PDF</option><option>Excel</option><option>CSV</option></select></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map(({ title, description, icon: Icon, detail, tone }) => <article key={title} className={`rounded-xl border p-4 transition ${activeReport === title ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 hover:border-teal-200'}`}>
            <div className="flex items-start justify-between gap-3"><span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" aria-hidden="true" /></span><span className="text-[10px] font-medium text-slate-400">{detail}</span></div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 min-h-10 text-[11px] leading-5 text-slate-500">{description}</p>
            <button type="button" onClick={() => generateReport(title)} disabled={generating === title} className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg bg-teal-800 px-3 text-[11px] font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60" aria-live="polite">{generating === title ? <><span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />Preparing report…</> : <><ArrowUpRight className="size-3.5" />Generate</>}</button>
          </article>)}
        </div>
      </SectionCard>
      <SectionCard title="Audit trail" description="Search who changed what, and when.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search audit events</span><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, vendor, user…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10" /></label>
          <label className="relative"><span className="sr-only">Filter event type</span><Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" /><select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-700 outline-none focus:border-teal-700 sm:w-[148px]"><option>All events</option>{(['Invoice extracted', 'Field edited', 'Validated', 'Message sent'] as EventType[]).map((type) => <option key={type}>{type}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" /></label>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {filteredEvents.length ? filteredEvents.map((event) => <button type="button" key={event.id} onClick={() => setSelectedEvent(event)} className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-3 text-left transition hover:bg-slate-50 ${selectedEvent.id === event.id ? 'bg-teal-50/60' : ''}`} aria-pressed={selectedEvent.id === event.id}>
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200"><Activity className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${eventTones[event.type]}`}>{event.type}</span><span className="truncate text-[10px] text-slate-400">{event.time}</span></span><span className="mt-1 block truncate text-[11px] font-medium text-slate-800">{event.invoice} <span className="font-normal text-slate-500">· {event.vendor}</span></span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{event.actor} · {event.detail}</span></span>
          </button>) : <p className="py-8 text-center text-xs text-slate-500">No events match your search and filters.</p>}
        </div>
        {selectedEvent.before && selectedEvent.after && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-slate-700">Field change details</p><span className="text-[9px] text-slate-400">{selectedEvent.actor}</span></div><p className="mt-1 text-[10px] text-slate-500">{selectedEvent.detail}</p><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="rounded-md bg-rose-50 px-2.5 py-2"><span className="block text-[9px] uppercase tracking-wide text-rose-700">Before</span><span className="text-xs font-semibold text-rose-900">{selectedEvent.before}</span></div><ArrowUpRight className="size-3.5 text-slate-400" /><div className="rounded-md bg-emerald-50 px-2.5 py-2"><span className="block text-[9px] uppercase tracking-wide text-emerald-700">After</span><span className="text-xs font-semibold text-emerald-900">{selectedEvent.after}</span></div></div></div>}
      </SectionCard>
    </div>
    <div className="mt-5"><SectionCard title="Recent downloads" description="Reports generated in this preview are sample files.">
      <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400"><th className="px-2 py-2">Report</th><th className="px-2 py-2">Format</th><th className="px-2 py-2">Generated</th><th className="px-2 py-2">Owner</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Action</th></tr></thead><tbody>{downloads.map((download, index) => <tr key={`${download.name}-${index}`} className="border-b border-slate-50 last:border-0"><td className="px-2 py-3 text-xs font-medium text-slate-800">{download.name}</td><td className="px-2 py-3"><span className="rounded border border-slate-200 px-1.5 py-1 text-[9px] font-medium text-slate-600">{download.format}</span></td><td className="px-2 py-3 text-[11px] text-slate-500">{download.date}</td><td className="px-2 py-3 text-[11px] text-slate-500">{download.owner}</td><td className="px-2 py-3"><span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700"><Check className="size-3" />{download.status}</span></td><td className="px-2 py-3 text-right"><button type="button" onClick={() => downloadCsv(download.name)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-50"><ArrowDownToLine className="size-3" />Download</button></td></tr>)}</tbody></table></div>
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><FileText className="size-3" />Demo exports download an audit-event CSV in this preview.</p>
    </SectionCard></div>
  </AppShell>
}
