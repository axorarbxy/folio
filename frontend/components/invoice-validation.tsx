'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Info,
  Mail,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'

type CheckStatus = 'passed' | 'failed'
type ValidationCheck = {
  id: string
  name: string
  status: CheckStatus
  source: 'Deterministic rule' | 'AI-assisted'
  severity?: 'Critical' | 'High' | 'Medium'
  summary: string
  shown: string
  expected: string
  why: string
  rule: string
  fixes: string[]
}

type DialogKind = 'vendor' | 'accept' | null

const checks: ValidationCheck[] = [
  {
    id: 'gstin',
    name: 'GSTIN format + checksum · Supplier & buyer',
    status: 'failed',
    source: 'Deterministic rule',
    severity: 'Critical',
    summary: 'Supplier GSTIN passes; buyer GSTIN checksum cannot be verified.',
    shown: 'Supplier 27AAKCS8421M1Z5 · Buyer 27AABCF1234L1Z8',
    expected: 'Both GSTINs must use the 15-character format and pass checksum validation.',
    why: 'The buyer GSTIN identifies the registration claiming input tax credit. An invalid GSTIN can cause the return match to fail and ITC may be denied.',
    rule: 'For each GSTIN: 15-character format + valid checksum',
    fixes: ['Confirm the GSTIN with your finance team', 'Ask the vendor for a corrected invoice', 'Update the buyer GSTIN and re-run validation'],
  },
  {
    id: 'place-of-supply',
    name: 'CGST + SGST vs IGST · Place of supply',
    status: 'passed',
    source: 'Deterministic rule',
    summary: 'Supplier, buyer, and place of supply are all in Maharashtra; split tax is expected.',
    shown: 'CGST 9% + SGST 9% · Maharashtra',
    expected: 'CGST + SGST for an intra-state supply',
    why: 'The tax type must follow whether a supply crosses state borders.',
    rule: 'Supplier state = place of supply → CGST + SGST',
    fixes: ['No action needed'],
  },
  {
    id: 'hsn-rate',
    name: 'HSN/SAC code to GST rate match',
    status: 'failed',
    source: 'AI-assisted',
    severity: 'High',
    summary: 'The detected paper HSN code may use a lower rate than the 18% charged.',
    shown: 'HSN 480256 · charged at 18%',
    expected: 'Rate may be 12% · verify classification and current tariff',
    why: 'A rate mismatch can lead to excess tax being charged or a credit mismatch. Confirm the product classification before filing.',
    rule: 'HSN/SAC classification ↔ applicable GST rate (human confirmation recommended)',
    fixes: ['Confirm the HSN with the vendor', 'Check the applicable rate for the invoice date', 'Correct the rate and re-run validation'],
  },
  {
    id: 'line-math',
    name: 'Line-item math · Quantity × rate',
    status: 'passed',
    source: 'Deterministic rule',
    summary: 'Both line-item taxable values match the quantity multiplied by the unit rate.',
    shown: '12 × INR 310 = INR 3,720 · 8 × INR 185 = INR 1,480',
    expected: 'Taxable total INR 5,200.00',
    why: 'Incorrect line totals can flow into the tax calculation and the amount payable.',
    rule: 'Σ(quantity × unit rate − discount) = taxable value',
    fixes: ['No action needed'],
  },
  {
    id: 'tax-rounding',
    name: 'Tax computation and rounding',
    status: 'passed',
    source: 'Deterministic rule',
    summary: 'The tax split and invoice total reconcile to the extracted line values.',
    shown: 'CGST INR 468 + SGST INR 468 · total INR 6,136',
    expected: 'Tax INR 936.00 · invoice total INR 6,136.00',
    why: 'Tax calculations must reconcile with the invoice before it is recorded or filed.',
    rule: 'Taxable value × tax rate = tax amount · round at invoice total',
    fixes: ['No action needed'],
  },
  {
    id: 'duplicate-number',
    name: 'Invoice number · Format + duplicate check',
    status: 'failed',
    source: 'Deterministic rule',
    severity: 'Medium',
    summary: 'This invoice number matches a document already in the workspace.',
    shown: 'SOS/25-26/0842 · existing invoice dated 18 Mar 2026',
    expected: 'A unique invoice number for this supplier and financial year',
    why: 'Duplicate invoices can result in the same tax credit or expense being recorded twice.',
    rule: 'unique(supplier GSTIN, normalized invoice number, financial year)',
    fixes: ['Compare the existing invoice before recording', 'Confirm whether this is a revised invoice or duplicate', 'Keep one copy and mark the other as duplicate'],
  },
  {
    id: 'date',
    name: 'Date validity · Financial year',
    status: 'passed',
    source: 'Deterministic rule',
    summary: 'Invoice date is valid and falls within FY 2025–26.',
    shown: '18 Mar 2026',
    expected: 'A valid date from 1 Apr 2025 through 31 Mar 2026',
    why: 'The invoice date determines the reporting period and credit eligibility window.',
    rule: '1 Apr 2025 ≤ invoice date ≤ 31 Mar 2026',
    fixes: ['No action needed'],
  },
  {
    id: 'irn',
    name: 'E-invoice IRN presence · Threshold check',
    status: 'passed',
    source: 'Deterministic rule',
    summary: 'IRN is not required because this invoice is below the applicable threshold.',
    shown: 'Invoice total INR 6,136 · no IRN detected',
    expected: 'IRN required only when the applicable e-invoice threshold is met',
    why: 'Where e-invoicing applies, a missing IRN can make the invoice invalid for GST purposes.',
    rule: 'Invoice value below applicable threshold → IRN not required',
    fixes: ['No action needed'],
  },
]

const money = (amount: number) => `INR ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`

function SourceBadge({ source }: { source: ValidationCheck['source'] }) {
  const deterministic = source === 'Deterministic rule'
  return (
    <span tabIndex={0} className={`group relative inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${deterministic ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-violet-200 bg-violet-50 text-violet-700'}`} title={deterministic ? 'Reproducible checks based on explicit rules and invoice values.' : 'AI suggests a possible issue based on invoice context; confirm before acting.'}>
      {deterministic ? <ShieldCheck className="size-3" /> : <Info className="size-3" />}
      {source}
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-56 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-[10px] font-normal leading-4 text-slate-600 shadow-lg group-hover:block group-focus-within:block">
        {deterministic ? 'Reproducible checks based on explicit rules and invoice values.' : 'AI highlights a likely mismatch. Verify the classification and source document before acting.'}
      </span>
    </span>
  )
}

function CheckDetails({ check, onFix }: { check: ValidationCheck; onFix: (fix: string) => void }) {
  const passed = check.status === 'passed'
  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
      <p className={`mb-3 text-xs font-medium ${passed ? 'text-emerald-800' : 'text-slate-700'}`}>{check.summary}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-lg border p-3 ${passed ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">What we found · shown</p>
          <p className={`text-[11px] font-medium leading-5 ${passed ? 'text-emerald-900' : 'text-rose-800'}`}>{check.shown}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Expected</p>
          <p className="text-[11px] font-medium leading-5 text-slate-700">{check.expected}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Why it matters</p>
          <p className="text-[11px] leading-5 text-slate-600">{check.why}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-slate-100">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Rule applied</p>
          <code className="block break-words font-mono text-[10px] leading-5 text-slate-100">{check.rule}</code>
        </div>
      </div>
      {!passed && (
        <div className="mt-4">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">How to fix</p>
          <div className="flex flex-wrap gap-2">
            {check.fixes.map((fix) => (
              <button key={fix} type="button" onClick={() => onFix(fix)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900">
                {fix}<ArrowRight className="size-3" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionDialog({ kind, onClose, onAccept }: { kind: Exclude<DialogKind, null>; onClose: () => void; onAccept: (note: string) => void }) {
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const vendorMessage = 'Hello, we are reviewing invoice SOS/25-26/0842. Could you please confirm the buyer GSTIN and the GST rate applied to HSN 480256, and let us know whether this invoice is a duplicate or a revised copy? Thank you.'
  const isVendor = kind === 'vendor'

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(isVendor ? vendorMessage : note)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="validation-dialog-title" className="w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-teal-800">{isVendor ? 'Vendor follow-up' : 'Review decision'}</p>
            <h2 id="validation-dialog-title" className="mt-1 text-base font-semibold tracking-tight text-slate-950">{isVendor ? 'Generate vendor message' : 'Accept validation results'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{isVendor ? 'Review and copy a message covering the items that need confirmation.' : 'Add a note explaining why you are accepting these results.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
        </div>
        {isVendor ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700">{vendorMessage}</div>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium text-slate-600">Acceptance note</span>
            <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Add a reason for accepting these validation results…" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10" />
          </label>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {isVendor ? (
            <>
              <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Close</button>
              <button type="button" onClick={copyMessage} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3.5 text-xs font-semibold text-white hover:bg-teal-900"><Copy className="size-3.5" />{copied ? 'Copied' : 'Copy message'}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={!note.trim()} onClick={() => onAccept(note.trim())} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"><Check className="size-3.5" />Accept with note</button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export function InvoiceValidation({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [openCheck, setOpenCheck] = useState('gstin')
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [acceptedNote, setAcceptedNote] = useState('')
  const [notice, setNotice] = useState('')
  const [runCount, setRunCount] = useState(1)
  const [lastRun, setLastRun] = useState('10:42 AM')
  const failed = checks.filter((check) => check.status === 'failed')
  const passedCount = checks.length - failed.length
  const totalAtRisk = 1159.2

  const rerun = () => {
    const time = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
    setRunCount((value) => value + 1)
    setLastRun(time)
    setAcceptedNote('')
    setNotice('Validation re-run complete · 3 findings remain')
    window.setTimeout(() => setNotice(''), 3000)
  }

  const acceptResults = (note: string) => {
    setAcceptedNote(note)
    setDialog(null)
    setNotice('Results accepted with note')
    window.setTimeout(() => setNotice(''), 3000)
  }

  const handleFix = (fix: string) => {
    if (fix.toLowerCase().includes('vendor')) {
      setDialog('vendor')
      return
    }
    router.push(`/app/invoices/${invoiceId}/review`)
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/app/invoices/${invoiceId}/review`} aria-label="Back to extraction review" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"><ArrowLeft className="size-4" /></Link>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white"><FileText className="size-4" /></span>
          <span className="hidden text-base font-semibold tracking-[-0.04em] sm:inline">folio<span className="text-teal-700">.</span></span>
          <span className="hidden h-5 w-px bg-slate-200 sm:block" />
          <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">SOS/25-26/0842</p><p className="text-[10px] text-slate-400">Validation results <span className="text-slate-300">·</span> {invoiceId.toUpperCase()}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/invoices/${invoiceId}/review`} className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex">Extraction review<ChevronRight className="size-3" /></Link>
          <button type="button" onClick={() => window.print()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50"><Download className="size-3.5" /><span className="hidden sm:inline">Export report PDF</span><span className="sm:hidden">Export</span></button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-slate-400"><Link href="/app/invoices" className="hover:text-teal-800">Invoices</Link><ChevronRight className="size-3" /><Link href={`/app/invoices/${invoiceId}/review`} className="hover:text-teal-800">Review extraction</Link><ChevronRight className="size-3" /><span className="text-teal-800">Validation</span></div>
            <h1 className="text-[22px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[26px]">Validation results</h1>
            <p className="mt-1 text-xs text-slate-500">Invoice checks for SOS/25-26/0842 · deterministic rules with human review where needed</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDialog('vendor')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"><Mail className="size-3.5" />Generate vendor message</button>
            <button type="button" onClick={() => setDialog('accept')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3 text-[10px] font-semibold text-white transition hover:bg-teal-900"><BadgeCheck className="size-3.5" />{acceptedNote ? 'Accepted' : 'Mark as accepted with note'}</button>
          </div>
        </div>

        {acceptedNote && <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><p><span className="font-semibold">Accepted with note:</span> {acceptedNote}</p></div>}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <section className="mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="flex gap-4 p-4 sm:p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><ShieldAlert className="size-5" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold tracking-tight text-slate-950">ITC blocked</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-800">Fix before filing</span></div>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">Resolve the buyer GSTIN issue before claiming input tax credit. Review the other findings before recording this invoice.</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-600" />{passedCount} passed</span><span className="inline-flex items-center gap-1.5"><XCircle className="size-3.5 text-rose-600" />{failed.length} need attention</span><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-slate-400" />Run {runCount} · {lastRun}</span></div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-amber-100 bg-amber-50/60 px-4 py-4 lg:flex-col lg:items-start lg:justify-center lg:border-l lg:border-t-0 lg:px-5">
                  <div><p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">Estimated ITC at risk</p><p className="mt-1 text-[25px] font-semibold tracking-[-0.04em] tabular-nums text-slate-950">{money(totalAtRisk)}</p></div>
                  <p className="max-w-40 text-[10px] leading-4 text-slate-500 lg:max-w-none">Includes invoice tax exposure; confirm the final amount with your tax advisor.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[9px] font-semibold text-rose-800"><span className="size-1.5 rounded-full bg-rose-500" />1 critical</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[9px] font-semibold text-orange-800"><span className="size-1.5 rounded-full bg-orange-500" />1 high</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-semibold text-amber-800"><span className="size-1.5 rounded-full bg-amber-500" />1 medium</span>
              </div>
            </section>

            <section aria-labelledby="checks-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div><h2 id="checks-title" className="text-sm font-semibold text-slate-950">Validation checks</h2><p className="mt-0.5 text-[10px] text-slate-500">Expand a check to see what was compared and how to resolve it.</p></div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-600">{checks.length} checks</span>
              </div>
              <div className="divide-y divide-slate-100">
                {checks.map((check) => {
                  const isOpen = openCheck === check.id
                  const isPassed = check.status === 'passed'
                  return (
                    <div key={check.id}>
                      <button type="button" aria-expanded={isOpen} aria-controls={`details-${check.id}`} onClick={() => setOpenCheck(isOpen ? '' : check.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/70 sm:px-5">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{isPassed ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}</span>
                        <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-slate-800">{check.name}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{check.summary}</span></span>
                        <span className="hidden shrink-0 sm:inline-flex"><SourceBadge source={check.source} /></span>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold ${isPassed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{isPassed ? 'Passed' : `Failed · ${check.severity}`}</span>
                        <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div className="px-4 pb-3 sm:hidden"><SourceBadge source={check.source} /></div>
                      <div id={`details-${check.id}`} hidden={!isOpen}>{isOpen && <CheckDetails check={check} onFix={handleFix} />}</div>
                    </div>
                  )
                })}
              </div>
            </section>
            <p className="mt-3 flex items-center gap-1.5 px-1 text-[9px] leading-4 text-slate-400"><CircleHelp className="size-3 shrink-0" />Validation output is a preview and does not replace professional tax advice.</p>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="text-xs font-semibold text-slate-900">Invoice preview</h2><p className="mt-0.5 text-[9px] text-slate-400">Original scan · 2 pages</p></div><Link href={`/app/invoices/${invoiceId}/review`} aria-label="Open extraction review" className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-teal-800"><ArrowRight className="size-3.5" /></Link></div>
              <Link href={`/app/invoices/${invoiceId}/review`} className="group block bg-[#eef2f0] p-4">
                <div className="mx-auto max-w-[190px] overflow-hidden rounded-sm shadow-[0_8px_24px_rgba(24,45,38,0.18)] transition group-hover:scale-[1.015]"><Image src="/images/sample-invoice-scan.png" alt="Scanned invoice SOS/25-26/0842" width={768} height={1366} className="block h-auto w-full" /></div>
                <p className="mt-3 text-center text-[9px] font-medium text-teal-800">Open extraction review <ArrowRight className="ml-1 inline size-3" /></p>
              </Link>
              <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
                <div className="p-3"><p className="text-[9px] text-slate-400">Supplier</p><p className="mt-1 truncate text-[10px] font-medium text-slate-700">Sahyadri Office Supplies</p></div>
                <div className="p-3"><p className="text-[9px] text-slate-400">Invoice total</p><p className="mt-1 text-[10px] font-medium tabular-nums text-slate-700">INR 6,136.00</p></div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xs font-semibold text-slate-900">Validation timeline</h2><p className="mt-0.5 text-[9px] text-slate-400">Latest run · {lastRun}</p></div><FileCheck2 className="size-4 text-teal-700" /></div>
              <ol className="flex flex-col">
                <li className="relative flex gap-3 pb-4 before:absolute before:bottom-0 before:left-[11px] before:top-6 before:w-px before:bg-slate-200"><span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="size-3.5" /></span><div className="pt-0.5"><p className="text-[10px] font-semibold text-slate-700">Invoice extracted</p><p className="mt-0.5 text-[9px] text-slate-400">Fields and line items captured</p></div></li>
                <li className="relative flex gap-3 pb-4 before:absolute before:bottom-0 before:left-[11px] before:top-6 before:w-px before:bg-slate-200"><span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="size-3.5" /></span><div className="pt-0.5"><p className="text-[10px] font-semibold text-slate-700">Rule checks completed</p><p className="mt-0.5 text-[9px] text-slate-400">{checks.length} checks evaluated</p></div></li>
                <li className="flex gap-3"><span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle className="size-3.5" /></span><div className="pt-0.5"><p className="text-[10px] font-semibold text-slate-700">{acceptedNote ? 'Accepted with note' : 'Human review needed'}</p><p className="mt-0.5 text-[9px] leading-4 text-slate-400">{acceptedNote ? 'Decision recorded for this preview' : `${failed.length} findings · ${runCount > 1 ? 'Re-run ' + runCount : 'Awaiting your review'}`}</p></div></li>
              </ol>
              <button type="button" onClick={rerun} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"><RotateCw className="size-3.5" />Re-run validation</button>
            </section>

            <section className="rounded-xl border border-teal-100 bg-teal-50/70 p-3.5">
              <div className="flex gap-2.5"><Info className="mt-0.5 size-4 shrink-0 text-teal-800" /><div><p className="text-[10px] font-semibold text-teal-950">Rules first, AI as a guide</p><p className="mt-1 text-[9px] leading-4 text-teal-900/75">Deterministic checks are repeatable. AI-assisted findings are prompts to verify, not final tax determinations.</p></div></div>
            </section>
          </aside>
        </div>
      </main>
      {dialog && <ActionDialog kind={dialog} onClose={() => setDialog(null)} onAccept={acceptResults} />}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">{notice}</div>}
    </div>
  )
}

export default InvoiceValidation
