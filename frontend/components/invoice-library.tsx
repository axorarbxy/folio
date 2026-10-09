'use client'

import { useMemo, useState } from 'react'
import { MobileWorkspaceNav } from '@/components/app-shell'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  FileImage,
  FileText,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-react'

type InvoiceStatus = 'Clean' | 'Issues' | 'Needs review' | 'Fixed'
type Invoice = {
  id: string
  number: string
  vendor: string
  gstin: string
  date: string
  taxable: number
  gst: number
  total: number
  status: InvoiceStatus
  confidence: number
  issueCount: number
  severity: 'Low' | 'Medium' | 'High'
  type: 'Purchase' | 'Sales' | 'Credit note'
}
type ColumnKey = 'invoice' | 'vendor' | 'date' | 'taxable' | 'gst' | 'total' | 'status' | 'confidence' | 'issues'

const vendors = [
  { name: 'Blue Tokai Coffee Roasters', gstin: '07AAGCB9842D1ZT' },
  { name: 'Paper Boat Foods', gstin: '29AAGCP4528P1ZK' },
  { name: 'Razorpay Software Pvt Ltd', gstin: '29AAFCN2484P1ZV' },
  { name: 'WeWork India', gstin: '27AACCM8732F1ZP' },
  { name: 'Moglix Business', gstin: '09AAECM5186G1Z2' },
  { name: 'Studio Nicobar', gstin: '07AAUCS9926R1Z3' },
  { name: 'Freshworks Technologies', gstin: '33AAECF4211P1ZQ' },
  { name: 'The Whole Truth Foods', gstin: '27AAHCT3765C1ZW' },
]
const statuses: InvoiceStatus[] = ['Clean', 'Clean', 'Issues', 'Needs review', 'Fixed', 'Clean', 'Needs review', 'Issues']
const dates = ['2026-03-28', '2026-03-26', '2026-03-25', '2026-03-23', '2026-03-21', '2026-03-19', '2026-03-17', '2026-03-16', '2026-03-12', '2026-03-10', '2026-03-08', '2026-03-05']
const columns: { key: ColumnKey; label: string }[] = [
  { key: 'invoice', label: 'Invoice no.' }, { key: 'vendor', label: 'Vendor' }, { key: 'date', label: 'Date' },
  { key: 'taxable', label: 'Taxable value' }, { key: 'gst', label: 'GST amount' }, { key: 'total', label: 'Total' },
  { key: 'status', label: 'Status' }, { key: 'confidence', label: 'Confidence' }, { key: 'issues', label: 'Issues' },
]
const sortableColumns: Record<ColumnKey, keyof Invoice> = {
  invoice: 'number', vendor: 'vendor', date: 'date', taxable: 'taxable', gst: 'gst',
  total: 'total', status: 'status', confidence: 'confidence', issues: 'issueCount',
}

const invoices: Invoice[] = Array.from({ length: 48 }, (_, index) => {
  const vendor = vendors[index % vendors.length]
  const taxable = 1480 + ((index * 1783) % 78400)
  const gst = Math.round(taxable * (index % 3 === 0 ? 0.05 : 0.18))
  const status = statuses[index % statuses.length]
  const issueCount = status === 'Issues' ? 1 + (index % 3) : status === 'Needs review' ? 1 : 0
  return {
    id: `inv-${index + 1}`,
    number: `INV-${String(2026).slice(2)}-${String(1384 + index).padStart(4, '0')}`,
    vendor: vendor.name,
    gstin: vendor.gstin,
    date: dates[index % dates.length],
    taxable,
    gst,
    total: taxable + gst,
    status,
    confidence: status === 'Needs review' ? 72 + (index % 12) : status === 'Issues' ? 84 + (index % 10) : 94 + (index % 6),
    issueCount,
    severity: issueCount > 1 ? 'High' : issueCount === 1 ? 'Medium' : 'Low',
    type: index % 11 === 0 ? 'Credit note' : index % 6 === 0 ? 'Sales' : 'Purchase',
  }
})

const formatCurrency = (amount: number) => `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))

function StatusPill({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    Clean: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Issues: 'border-rose-200 bg-rose-50 text-rose-700',
    'Needs review': 'border-amber-200 bg-amber-50 text-amber-800',
    Fixed: 'border-sky-200 bg-sky-50 text-sky-800',
  }
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>
}

function InvoiceThumbnail({ index }: { index: number }) {
  return (
    <div className="relative flex h-10 w-8 shrink-0 flex-col gap-1 overflow-hidden rounded border border-slate-200 bg-white p-1 shadow-sm" aria-hidden="true">
      <span className={`h-1 w-4 rounded-sm ${index % 3 === 0 ? 'bg-amber-200' : 'bg-teal-200'}`} />
      <span className="h-px w-full bg-slate-200" /><span className="h-px w-4/5 bg-slate-200" /><span className="h-px w-full bg-slate-100" />
      <span className="mt-auto h-1 w-3 self-end rounded-sm bg-slate-300" />
    </div>
  )
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="flex min-w-[120px] flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
      {label}
      <span className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white py-0 pl-3 pr-8 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10">
          {options.map((option) => <option key={option} value={option === 'All' ? '' : option}>{option}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
      </span>
    </label>
  )
}

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-emerald-50 text-emerald-800' : value >= 80 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${color}`}>{value}%</span>
}

function QuickPeek({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const findings = invoice.issueCount > 0
    ? ['GSTIN could not be matched to the vendor master', 'Tax amount differs from expected rate']
    : ['Invoice totals are balanced', 'GSTIN format is valid', 'Date and invoice number detected']
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="peek-title" className="flex h-full w-full max-w-[420px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Invoice preview</p><h2 id="peek-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{invoice.number}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close invoice preview" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex min-h-[270px] max-w-[280px] flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-8 flex items-center justify-between"><span className="flex size-8 items-center justify-center rounded-lg bg-teal-800 text-white"><FileText className="size-4" /></span><span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Tax invoice</span></div>
            <span className="text-[9px] uppercase tracking-widest text-slate-400">Billed by</span><strong className="mt-1 text-xs text-slate-800">{invoice.vendor}</strong><span className="mt-1 text-[9px] text-slate-500">GSTIN {invoice.gstin}</span>
            <div className="my-5 h-px bg-slate-100" /><span className="text-[9px] uppercase tracking-widest text-slate-400">Invoice details</span><div className="mt-3 flex justify-between text-[10px] text-slate-600"><span>Number</span><span>{invoice.number}</span></div><div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>Date</span><span>{formatDate(invoice.date)}</span></div>
            <div className="mt-5 flex justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-800"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
          </div>
          <div className="mt-7"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Validation checks</h3><StatusPill status={invoice.status} /></div><ul className="mt-3 flex flex-col gap-3">{findings.slice(0, 3).map((finding, index) => <li key={finding} className="flex items-start gap-2.5 text-xs leading-5 text-slate-600"><span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${invoice.issueCount && index < invoice.issueCount ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{invoice.issueCount && index < invoice.issueCount ? <span className="text-[10px] font-bold">!</span> : <Check className="size-3" />}</span>{finding}</li>)}</ul></div>
        </div>
        <div className="border-t border-slate-100 p-5"><a href={`/app/invoices/${invoice.id}/review`} className="flex h-10 w-full items-center justify-center rounded-lg bg-teal-800 text-sm font-semibold text-white transition hover:bg-teal-900">Review extraction</a></div>
      </aside>
    </div>
  )
}

export function InvoiceLibrary() {
  const [rows, setRows] = useState(invoices)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severity, setSeverity] = useState('')
  const [vendor, setVendor] = useState('')
  const [invoiceType, setInvoiceType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState<{ key: keyof Invoice; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(columns.map((column) => column.key))
  const [peek, setPeek] = useState<Invoice | null>(null)
  const [savedView, setSavedView] = useState(false)
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => {
    const result = rows.filter((invoice) => {
      const matchesSearch = `${invoice.number} ${invoice.vendor} ${invoice.gstin}`.toLowerCase().includes(query.toLowerCase())
      return matchesSearch && (!statusFilter || invoice.status === statusFilter) && (!severity || invoice.severity === severity)
        && (!vendor || invoice.vendor === vendor) && (!invoiceType || invoice.type === invoiceType)
        && (!startDate || invoice.date >= startDate) && (!endDate || invoice.date <= endDate)
        && (!minAmount || invoice.total >= Number(minAmount)) && (!maxAmount || invoice.total <= Number(maxAmount))
    })
    return result.sort((a, b) => {
      const left = a[sort.key]
      const right = b[sort.key]
      const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [rows, query, statusFilter, severity, vendor, invoiceType, startDate, endDate, minAmount, maxAmount, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const pageIds = paginated.map((invoice) => invoice.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))

  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1) }
  const clearFilters = () => { setQuery(''); setStatusFilter(''); setSeverity(''); setVendor(''); setInvoiceType(''); setStartDate(''); setEndDate(''); setMinAmount(''); setMaxAmount(''); setPage(1) }
  const toggleSort = (key: keyof Invoice) => setSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600) }
  const exportRows = () => {
    const selectedRows = selected.length ? rows.filter((invoice) => selected.includes(invoice.id)) : filtered
    const header = ['Invoice number', 'Vendor', 'GSTIN', 'Date', 'Taxable value', 'GST amount', 'Total', 'Status', 'Confidence', 'Issues']
    const csv = [header, ...selectedRows.map((invoice) => [invoice.number, invoice.vendor, invoice.gstin, invoice.date, invoice.taxable, invoice.gst, invoice.total, invoice.status, invoice.confidence, invoice.issueCount])]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'folio-invoices.csv'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showNotice(`Exported ${selectedRows.length} invoice${selectedRows.length === 1 ? '' : 's'} to CSV`)
  }
  const markReviewed = (ids: string[]) => {
    const reviewable = rows.filter((invoice) => ids.includes(invoice.id) && (invoice.status === 'Needs review' || invoice.status === 'Issues'))
    if (!reviewable.length) {
      showNotice('No selected invoices need review')
      return
    }
    const reviewedIds = new Set(reviewable.map((invoice) => invoice.id))
    setRows((current) => current.map((invoice) => reviewedIds.has(invoice.id) ? { ...invoice, status: invoice.status === 'Issues' ? 'Fixed' : 'Clean', issueCount: 0, severity: 'Low' } : invoice))
    showNotice(`${reviewable.length} invoice${reviewable.length === 1 ? '' : 's'} marked as reviewed`)
    setSelected((current) => current.filter((id) => !reviewedIds.has(id)))
  }
  const removeSelected = () => {
    if (!window.confirm(`Delete ${selected.length} selected invoice${selected.length === 1 ? '' : 's'} from this preview?`)) return
    setRows((current) => current.filter((invoice) => !selected.includes(invoice.id)))
    setSelected([])
    setPage(1)
    showNotice('Selected invoices deleted')
  }
  const toggleColumn = (key: ColumnKey) => setVisibleColumns((current) => current.includes(key) ? current.length > 1 ? current.filter((item) => item !== key) : current : [...current, key])
  const activeFilters = [
    ...(statusFilter ? [{ label: statusFilter, clear: () => setFilter(setStatusFilter, '') }] : []),
    ...(severity ? [{ label: `${severity} severity`, clear: () => setFilter(setSeverity, '') }] : []),
    ...(vendor ? [{ label: vendor, clear: () => setFilter(setVendor, '') }] : []),
    ...(invoiceType ? [{ label: invoiceType, clear: () => setFilter(setInvoiceType, '') }] : []),
    ...(startDate || endDate ? [{ label: `${startDate || 'Any date'} – ${endDate || 'Today'}`, clear: () => { setStartDate(''); setEndDate('') } }] : []),
    ...(minAmount || maxAmount ? [{ label: `${minAmount || 'INR 0'} – ${maxAmount || 'Any amount'}`, clear: () => { setMinAmount(''); setMaxAmount('') } }] : []),
  ]

  const renderValue = (invoice: Invoice, key: ColumnKey) => {
    switch (key) {
      case 'invoice': return <span className="font-semibold text-slate-800">{invoice.number}</span>
      case 'vendor': return <div className="min-w-[160px]"><span className="block max-w-[195px] truncate font-medium text-slate-800">{invoice.vendor}</span><span className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">GSTIN {invoice.gstin}</span></div>
      case 'date': return <span className="whitespace-nowrap text-slate-600">{formatDate(invoice.date)}</span>
      case 'taxable': return <span className="whitespace-nowrap tabular-nums text-slate-600">{formatCurrency(invoice.taxable)}</span>
      case 'gst': return <span className="whitespace-nowrap tabular-nums text-slate-600">{formatCurrency(invoice.gst)}</span>
      case 'total': return <span className="whitespace-nowrap font-semibold tabular-nums text-slate-800">{formatCurrency(invoice.total)}</span>
      case 'status': return <StatusPill status={invoice.status} />
      case 'confidence': return <ConfidencePill value={invoice.confidence} />
      case 'issues': return invoice.issueCount ? <span className={`inline-flex min-w-6 justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${invoice.severity === 'High' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{invoice.issueCount}</span> : <span className="text-xs text-slate-300">—</span>
    }
  }

  const rowActions = (invoice: Invoice) => (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`Preview ${invoice.number}`} onClick={(event) => { event.stopPropagation(); setPeek(invoice) }} className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"><Eye className="size-4" /></button>
      <details className="relative" onClick={(event) => event.stopPropagation()}>
        <summary aria-label={`More actions for ${invoice.number}`} className="list-none rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden"><MoreHorizontal className="size-4" /></summary>
        <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <button type="button" onClick={() => setPeek(invoice)} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">Quick preview</button>
          <button type="button" onClick={() => markReviewed([invoice.id])} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">Mark reviewed</button>
          <button type="button" onClick={() => showNotice(`Reminder prepared for ${invoice.vendor}`)} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">Prepare reminder</button>
        </div>
      </details>
    </div>
  )

  const renderCard = (invoice: Invoice, index: number) => (
    <article key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><label className="flex min-w-0 items-start gap-3"><input aria-label={`Select ${invoice.number}`} type="checkbox" checked={selected.includes(invoice.id)} onChange={() => toggleSelected(invoice.id)} className="mt-1 size-4 accent-teal-800" /><InvoiceThumbnail index={index} /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{invoice.number}</span><span className="mt-1 block truncate text-xs text-slate-500">{invoice.vendor}</span></span></label><button type="button" aria-label={`Preview ${invoice.number}`} onClick={() => setPeek(invoice)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Eye className="size-4" /></button></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><StatusPill status={invoice.status} /><span className="text-xs text-slate-500">{formatDate(invoice.date)}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3"><div><span className="text-[10px] uppercase tracking-wide text-slate-400">Total</span><strong className="mt-1 block text-sm text-slate-900">{formatCurrency(invoice.total)}</strong></div><div className="text-right"><span className="text-[10px] uppercase tracking-wide text-slate-400">Confidence</span><span className="mt-1 block"><ConfidencePill value={invoice.confidence} /></span></div></div>
    </article>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/15 bg-[#474c80] px-4 text-[#f8f7e2] shadow-[0_8px_28px_rgba(38,40,73,0.18)] sm:px-7">
        <div className="flex items-center gap-3"><a href="/" aria-label="Folio home" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#f8f7e2] text-[#474c80]"><FileText className="size-5" /></span><span className="text-2xl font-bold tracking-[-0.06em] text-[#f8f7e2]">folio<span className="text-[#c7c8e5]">.</span></span></a><span className="hidden h-5 w-px bg-white/25 sm:block" /><span className="hidden text-sm text-[#f8f7e2]/75 sm:block">GST workspace</span></div>
        <div className="flex items-center gap-2 sm:gap-4"><span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 md:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" />All systems operational</span><a href="/app/settings?section=notifications" aria-label="Notification preferences" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell className="size-4" /></a><span aria-label="Account: Aditi Mehta" className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-900">AM</span></div>
      </header>
      <div className="mx-auto flex min-h-[calc(100vh-66px)] max-w-[1600px]">
        <aside className="hidden w-[240px] shrink-0 border-r border-[#393d68] bg-[#474c80] px-3 py-7 text-[#f8f7e2] lg:block">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <nav aria-label="Workspace" className="mt-3 flex flex-col gap-1">
            {[['Overview', '⌂', '/app'], ['Invoices', '▤', '/app/invoices'], ['ITC reconciliation', '◫', '/app/itc'], ['Vendors', '◇', '/app/vendors'], ['Reports', '◷', '/app/reports']].map(([label, icon, href]) => <a key={label} href={href} aria-current={label === 'Invoices' ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${label === 'Invoices' ? 'bg-[#f8f7e2] text-[#393d68]' : 'text-[#f8f7e2]/80 hover:bg-white/10 hover:text-white'}`}><span aria-hidden="true" className="w-4 text-center text-base">{icon}</span>{label}{label === 'Invoices' && <span className="ml-auto rounded-md bg-white px-1.5 py-0.5 text-[10px] text-teal-800">{rows.length}</span>}</a>)}
          </nav>
          <div className="mt-8 border-t border-slate-100 pt-5"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Manage</p><nav aria-label="Manage workspace" className="mt-3 flex flex-col gap-1"><a href="/app/settings" className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">GST settings</a><a href="/app/settings?section=team" className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Team members</a></nav></div>
          <div className="mt-8 rounded-xl border border-teal-100 bg-teal-50/60 p-3.5"><span className="flex size-8 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm"><CheckCircle2 className="size-4" /></span><p className="mt-3 text-xs font-semibold text-slate-800">Your books are in good shape</p><p className="mt-1 text-[11px] leading-4 text-slate-500">37 of 48 invoices are ready to reconcile.</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><span className="block h-full w-[77%] rounded-full bg-teal-700" /></div></div>
        </aside>
        <div className="min-w-0 flex-1"><MobileWorkspaceNav active="Invoices" />
        <main className="min-w-0 px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
          <div className="relative mb-7 flex flex-col justify-between gap-5 overflow-hidden rounded-[1.75rem] bg-[#474c80] px-6 py-7 text-[#f8f7e2] shadow-[0_18px_45px_rgba(45,49,91,0.18)] sm:flex-row sm:items-end sm:px-8 sm:py-8">
            <div className="relative"><div className="mb-3 flex items-center gap-2 text-sm text-[#d7d8ef]"><span>Workspace</span><span className="text-white/45">/</span><span className="font-semibold text-[#f8f7e2]">Invoices</span></div><h1 className="text-4xl font-bold tracking-[-0.055em] text-[#f8f7e2] sm:text-5xl">Invoices</h1><p className="mt-2 text-base text-[#f8f7e2]/75">Review, validate, and organize your GST invoices.</p></div>
            <div className="flex items-center gap-2"><button type="button" onClick={exportRows} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"><Download className="size-3.5" />Export</button><a href="/app/upload" className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-900"><Plus className="size-4" />Upload invoices</a></div>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Total invoices', '48', 'Across all vendors'], ['Ready to reconcile', '37', 'Clean or fixed'], ['Need attention', '11', 'Issues or review'], ['Taxable value', 'INR 8.42L', 'This month']].map(([label, value, detail], index) => <div key={label} className="rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)]"><p className="text-sm font-semibold text-[#686b86]">{label}</p><div className="mt-2 flex items-baseline justify-between gap-2"><strong className="text-2xl font-bold tracking-tight text-[#393d68]">{value}</strong><span className={`hidden text-[10px] sm:inline ${index === 2 ? 'text-amber-700' : 'text-slate-400'}`}>{detail}</span></div></div>)}
          </div>
          <section aria-label="Invoice filters" className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end xl:flex-nowrap">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 xl:max-w-[260px]">Search invoices<span className="relative"><Search aria-hidden="true" className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Invoice no., vendor, GSTIN..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10" /></span></label>
              <SelectFilter label="Status" value={statusFilter} onChange={(value) => setFilter(setStatusFilter, value)} options={['All', 'Clean', 'Issues', 'Needs review', 'Fixed']} />
              <SelectFilter label="Severity" value={severity} onChange={(value) => setFilter(setSeverity, value)} options={['All', 'Low', 'Medium', 'High']} />
              <SelectFilter label="Vendor" value={vendor} onChange={(value) => setFilter(setVendor, value)} options={['All', ...vendors.map((item) => item.name)]} />
              <SelectFilter label="Invoice type" value={invoiceType} onChange={(value) => setFilter(setInvoiceType, value)} options={['All', 'Purchase', 'Sales', 'Credit note']} />
            </div>
            <details className="group mt-3 border-t border-slate-100 pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 [&::-webkit-details-marker]:hidden"><Filter className="size-3.5" />More filters<span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 group-open:hidden">Date & amount<ChevronDown className="size-3" /></span><ChevronDown aria-hidden="true" className="ml-auto hidden size-3.5 group-open:block" /></summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">From date<input type="date" value={startDate} onChange={(event) => setFilter(setStartDate, event.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-normal text-slate-700 outline-none focus:border-teal-700" /></label>
                <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">To date<input type="date" value={endDate} onChange={(event) => setFilter(setEndDate, event.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-normal text-slate-700 outline-none focus:border-teal-700" /></label>
                <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Minimum amount<input type="number" min="0" step="1" inputMode="numeric" value={minAmount} onChange={(event) => setFilter(setMinAmount, event.target.value)} placeholder="INR 0" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-700" /></label>
                <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Maximum amount<input type="number" min="0" step="1" inputMode="numeric" value={maxAmount} onChange={(event) => setFilter(setMaxAmount, event.target.value)} placeholder="No limit" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-700" /></label>
              </div>
            </details>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {activeFilters.length > 0 ? <>{activeFilters.map((item) => <button type="button" key={item.label} onClick={item.clear} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-2.5 text-[11px] font-medium text-teal-900">{item.label}<X className="size-3" /></button>)}<button type="button" onClick={clearFilters} className="px-1.5 text-[11px] font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800">Clear all</button></> : <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Filter className="size-3" />No filters applied</span>}
              <button type="button" onClick={() => { setSavedView(true); showNotice('View saved as “My invoices”') }} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">{savedView ? <Check className="size-3.5 text-emerald-700" /> : <Plus className="size-3.5" />}{savedView ? 'View saved' : 'Save view'}</button>
            </div>
          </section>
          {selected.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3"><span className="mr-1 text-xs font-semibold text-teal-950">{selected.length} selected</span><span className="hidden h-5 w-px bg-teal-200 sm:block" /><button type="button" onClick={exportRows} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"><Download className="size-3.5" />Export CSV / Excel</button><button type="button" onClick={() => showNotice(`Reminders queued for ${selected.length} vendors`)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"><Bell className="size-3.5" />Send reminders</button><button type="button" onClick={() => markReviewed(selected)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"><CheckCircle2 className="size-3.5" />Mark reviewed</button><button type="button" onClick={removeSelected} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-[11px] font-medium text-rose-700 shadow-sm hover:bg-rose-50"><X className="size-3.5" />Delete</button><button type="button" onClick={() => setSelected([])} className="ml-auto rounded-md p-1.5 text-teal-800 hover:bg-teal-100" aria-label="Clear selection"><X className="size-4" /></button></div>}
          <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]" aria-label="Invoices">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div><h2 className="text-sm font-semibold text-slate-900">All invoices <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{filtered.length}</span></h2><p className="mt-0.5 text-[11px] text-slate-400">Last synced just now</p></div>
              <div className="flex items-center gap-2">
                <details className="relative">
                  <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"><Columns3 className="size-3.5" /><span className="hidden sm:inline">Columns</span><ChevronDown className="size-3" /></summary>
                  <div className="absolute right-0 top-10 z-20 flex w-44 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">{columns.map((column) => <label key={column.key} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} className="size-3.5 accent-teal-800" />{column.label}</label>)}</div>
                </details>
                <div className="flex h-8 items-center rounded-lg border border-slate-200 p-0.5" aria-label="View options">
                  <button type="button" aria-label="Table view" aria-pressed={view === 'table'} onClick={() => setView('table')} className={`flex size-7 items-center justify-center rounded-md ${view === 'table' ? 'bg-teal-50 text-teal-800' : 'text-slate-400 hover:text-slate-700'}`}><List className="size-4" /></button>
                  <button type="button" aria-label="Card view" aria-pressed={view === 'cards'} onClick={() => setView('cards')} className={`flex size-7 items-center justify-center rounded-md ${view === 'cards' ? 'bg-teal-50 text-teal-800' : 'text-slate-400 hover:text-slate-700'}`}><LayoutGrid className="size-4" /></button>
                </div>
              </div>
            </div>
            {filtered.length === 0 ? <div className="flex min-h-[250px] flex-col items-center justify-center px-5 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FileImage className="size-5" /></span><h3 className="mt-4 text-sm font-semibold text-slate-800">No invoices match filters</h3><p className="mt-1 text-xs text-slate-500">Try adjusting your search or clearing some filters.</p><button type="button" onClick={clearFilters} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Clear filters</button></div> : view === 'cards' ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{paginated.map(renderCard)}</div> : <><div className="grid gap-3 p-4 sm:grid-cols-2 md:hidden">{paginated.map(renderCard)}</div><div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1020px] border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50/95"><tr className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400"><th className="w-11 border-b border-slate-200 px-4 py-3"><input aria-label="Select all invoices on this page" type="checkbox" checked={allPageSelected} onChange={() => setSelected((current) => allPageSelected ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])])} className="size-3.5 accent-teal-800" /></th><th className="w-12 border-b border-slate-200 px-2 py-3"><span className="sr-only">Preview</span></th>{columns.filter((column) => visibleColumns.includes(column.key)).map((column) => <th key={column.key} className="whitespace-nowrap border-b border-slate-200 px-3 py-3"><button type="button" onClick={() => toggleSort(sortableColumns[column.key])} className="inline-flex items-center gap-1.5 hover:text-slate-700">{column.label}{sort.key === sortableColumns[column.key] ? sort.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowDownUp className="size-3 opacity-40" />}</button></th>)}<th className="w-16 border-b border-slate-200 px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{paginated.map((invoice, index) => <tr key={invoice.id} onClick={() => setPeek(invoice)} className="group cursor-pointer transition-colors hover:bg-teal-50/30 focus-within:bg-teal-50/30"><td className="border-b border-slate-100 px-4 py-3.5" onClick={(event) => event.stopPropagation()}><input aria-label={`Select ${invoice.number}`} type="checkbox" checked={selected.includes(invoice.id)} onChange={() => toggleSelected(invoice.id)} className="size-3.5 accent-teal-800" /></td><td className="border-b border-slate-100 px-2 py-3"><InvoiceThumbnail index={index} /></td>{columns.filter((column) => visibleColumns.includes(column.key)).map((column) => <td key={column.key} className="border-b border-slate-100 px-3 py-3.5">{renderValue(invoice, column.key)}</td>)}<td className="border-b border-slate-100 px-3 py-3" onClick={(event) => event.stopPropagation()}>{rowActions(invoice)}</td></tr>)}</tbody>
              </table>
            </div></>}
            {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5"><p className="text-[11px] text-slate-500">Showing <span className="font-medium text-slate-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium text-slate-700">{filtered.length}</span> invoices</p><div className="flex items-center gap-3"><label className="hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex">Rows per page<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><div className="flex items-center gap-1"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-4" /></button><span className="min-w-14 text-center text-[11px] text-slate-600">Page {page} of {pageCount}</span><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div></div>}
          </section>
          <p className="mt-4 text-center text-[10px] text-slate-400">Showing sample workspace data · GST calculations are for preview only</p>
        </main>
        </div>
      </div>
      {peek && <QuickPeek invoice={peek} onClose={() => setPeek(null)} />}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">{notice}</div>}
    </div>
  )
}

export default InvoiceLibrary

