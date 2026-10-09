'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Globe2,
  Plus,
  RotateCw,
  Save,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

type FieldKey = 'supplier' | 'supplierGstin' | 'supplierAddress' | 'buyer' | 'buyerGstin' | 'buyerAddress' | 'invoiceNumber' | 'invoiceDate' | 'placeOfSupply'
type InvoiceFields = Record<FieldKey, string>
type InvoiceLine = { id: string; description: string; hsn: string; quantity: string; unit: string; rate: string; cgst: string; sgst: string; igst: string }

const initialFields: InvoiceFields = {
  supplier: 'Sahyadri Office Supplies',
  supplierGstin: '27AAKCS8421M1Z5',
  supplierAddress: 'Office 402, Baner Road, Pune, Maharashtra 411045',
  buyer: 'Folio Studio Private Limited',
  buyerGstin: '27AABCF1234L1Z8',
  buyerAddress: '12A, Lower Parel, Mumbai, Maharashtra 400013',
  invoiceNumber: 'SOS/25-26/0842',
  invoiceDate: '2026-03-18',
  placeOfSupply: 'Maharashtra',
}
const fieldConfidence: Record<FieldKey, number> = {
  supplier: 97,
  supplierGstin: 93,
  supplierAddress: 89,
  buyer: 94,
  buyerGstin: 58,
  buyerAddress: 86,
  invoiceNumber: 95,
  invoiceDate: 64,
  placeOfSupply: 66,
}
const originalFields: InvoiceFields = {
  ...initialFields,
  buyerGstin: '27AABCFI234L1Z8',
  invoiceDate: '18/03/2026',
  placeOfSupply: 'Mahārāṣṭra',
}
const lowConfidenceKeys: FieldKey[] = ['buyerGstin', 'invoiceDate', 'placeOfSupply']
const fieldLabels: Record<FieldKey, string> = {
  supplier: 'Supplier name',
  supplierGstin: 'Supplier GSTIN',
  supplierAddress: 'Supplier address',
  buyer: 'Buyer name',
  buyerGstin: 'Buyer GSTIN',
  buyerAddress: 'Buyer address',
  invoiceNumber: 'Invoice number',
  invoiceDate: 'Invoice date',
  placeOfSupply: 'Place of supply',
}
const fieldBoxes: { key: FieldKey; left: number; top: number; width: number; height: number }[] = [
  { key: 'supplier', left: 23, top: 22, width: 57, height: 2.2 },
  { key: 'supplierGstin', left: 37, top: 25.5, width: 35, height: 1.7 },
  { key: 'buyerGstin', left: 10, top: 39.2, width: 44, height: 1.6 },
  { key: 'invoiceNumber', left: 62, top: 29.2, width: 30, height: 1.2 },
  { key: 'invoiceDate', left: 73, top: 30.8, width: 19, height: 1.2 },
  { key: 'placeOfSupply', left: 60, top: 32.4, width: 32, height: 1.2 },
]
const lineSeed: InvoiceLine[] = [
  { id: 'line-1', description: 'Premium A4 copier paper, 75 GSM', hsn: '480256', quantity: '12', unit: 'Ream', rate: '310', cgst: '9', sgst: '9', igst: '0' },
  { id: 'line-2', description: 'Document folders — assorted', hsn: '482030', quantity: '8', unit: 'Pack', rate: '185', cgst: '9', sgst: '9', igst: '0' },
]
const states = ['Maharashtra', 'Karnataka', 'Delhi', 'Gujarat', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal']
const money = (value: number) => `INR ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
const numeric = (value: string) => Number(value) || 0

function ConfidencePill({ value }: { value: number }) {
  const style = value >= 85 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : value >= 70 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${style}`}>{value}%</span>
}

function SectionHeading({ eyebrow, title, icon: Icon, trailing }: { eyebrow: string; title: string; icon: typeof FileText; trailing?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-800"><Icon className="size-4" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">{eyebrow}</p><h2 className="text-[13px] font-semibold text-slate-900">{title}</h2></div></div>{trailing}</div>
}

export function ExtractionReview({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [fields, setFields] = useState(initialFields)
  const [edited, setEdited] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [acknowledged, setAcknowledged] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [lines, setLines] = useState(lineSeed)
  const [reverseCharge, setReverseCharge] = useState(false)
  const [rawText, setRawText] = useState(false)
  const [activeField, setActiveField] = useState<FieldKey | null>(null)
  const [hoveredField, setHoveredField] = useState<FieldKey | null>(null)
  const [split, setSplit] = useState(48)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>>>({})
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const unresolved = lowConfidenceKeys.filter((key) => !edited[key] && !acknowledged[key])
  const totals = useMemo(() => lines.reduce((sum, line) => {
    const taxable = numeric(line.quantity) * numeric(line.rate)
    const cgst = taxable * numeric(line.cgst) / 100
    const sgst = taxable * numeric(line.sgst) / 100
    const igst = taxable * numeric(line.igst) / 100
    return { taxable: sum.taxable + taxable, cgst: sum.cgst + cgst, sgst: sum.sgst + sgst, igst: sum.igst + igst }
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0 }), [lines])
  const grandTotal = totals.taxable + totals.cgst + totals.sgst + totals.igst
  const roundOff = Math.round(grandTotal) - grandTotal
  const finalTotal = grandTotal + roundOff
  const activeBox = hoveredField || activeField

  const announce = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }, [])
  const saveDraft = useCallback(() => {
    const time = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
    setSavedAt(time)
    announce('Draft saved in this preview')
  }, [announce])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveDraft()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [saveDraft])

  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent) => {
      if (!dragOrigin.current) return
      setPan({ x: dragOrigin.current.panX + event.clientX - dragOrigin.current.x, y: dragOrigin.current.panY + event.clientY - dragOrigin.current.y })
    }
    const end = () => { setDragging(false); dragOrigin.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
  }, [dragging])

  const setValue = (key: FieldKey, value: string) => {
    setFields((current) => ({ ...current, [key]: value }))
    setEdited((current) => ({ ...current, [key]: value !== initialFields[key] }))
    setConfirmed(false)
  }
  const restoreValue = (key: FieldKey) => {
    setFields((current) => ({ ...current, [key]: initialFields[key] }))
    setEdited((current) => ({ ...current, [key]: false }))
    setAcknowledged((current) => ({ ...current, [key]: false }))
    setConfirmed(false)
  }
  const handleTab = (event: React.KeyboardEvent, key: FieldKey) => {
    if (event.key !== 'Tab' || event.shiftKey || !lowConfidenceKeys.includes(key)) return
    const index = lowConfidenceKeys.indexOf(key)
    const next = [...lowConfidenceKeys.slice(index + 1), ...lowConfidenceKeys.slice(0, index)].find((candidate) => unresolved.includes(candidate))
    if (next) {
      event.preventDefault()
      inputRefs.current[next]?.focus()
    }
  }
  const updateLine = (id: string, key: keyof InvoiceLine, value: string) => setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line))
  const resizeSplit = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setSplit((value) => Math.max(36, value - 3)) }
    if (event.key === 'ArrowRight') { event.preventDefault(); setSplit((value) => Math.min(60, value + 3)) }
  }
  const focusField = (key: FieldKey) => {
    setActiveField(key)
    inputRefs.current[key]?.focus()
  }

  const field = (key: FieldKey, label: string, options: { type?: string; wide?: boolean; multiline?: boolean } = {}) => {
    const confidence = fieldConfidence[key]
    const isLow = confidence < 70
    const isGstin = key === 'supplierGstin' || key === 'buyerGstin'
    const gstinIsValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(fields[key])
    const controlClass = `h-9 w-full rounded-lg border bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10 ${isLow ? 'border-amber-300 bg-amber-50/20' : edited[key] ? 'border-teal-300' : 'border-slate-200'}`
    const common = {
      id: `field-${key}`,
      value: fields[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue(key, event.target.value),
      onFocus: () => setActiveField(key),
      onMouseEnter: () => setHoveredField(key),
      onMouseLeave: () => setHoveredField(null),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => handleTab(event, key),
      'aria-invalid': isLow && !edited[key] && !acknowledged[key] ? true : undefined,
      ref: (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => { inputRefs.current[key] = element ?? undefined },
    }
    return <div key={key} className={options.wide ? 'md:col-span-2' : ''} onMouseEnter={() => setHoveredField(key)} onMouseLeave={() => setHoveredField(null)}>
      <div className="mb-1.5 flex min-h-4 items-center justify-between gap-1.5"><label htmlFor={`field-${key}`} className="text-[10px] font-medium text-slate-600">{label}</label><div className="flex items-center gap-1">{edited[key] && <span className="inline-flex items-center gap-1 text-[9px] font-medium text-teal-800"><span className="size-1.5 rounded-full bg-teal-600" />Edited</span>}{isGstin && <span title={gstinIsValid ? 'GSTIN format is valid' : 'Check GSTIN format'} className={`flex size-4 items-center justify-center rounded-full ${gstinIsValid ? 'text-emerald-700' : 'text-rose-600'}`}>{gstinIsValid ? <CheckCircle2 className="size-3.5" /> : <X className="size-3" />}</span>}<ConfidencePill value={confidence} />{edited[key] && <button type="button" onClick={() => restoreValue(key)} aria-label={`Revert ${label}`} title="Revert to extracted value" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Undo2 className="size-3" /></button>}</div></div>
      {options.multiline ? <textarea {...common} rows={2} className={`${controlClass} h-auto min-h-10 resize-y py-2`} /> : <input {...common} type={options.type || 'text'} className={controlClass} />}
      {isLow && <div className="mt-1.5 flex items-center justify-between gap-2"><span className="text-[9px] font-medium text-amber-700">Check this · {confidence}% confidence</span><label className="flex cursor-pointer items-center gap-1.5 text-[9px] text-slate-500"><input type="checkbox" checked={Boolean(acknowledged[key])} onChange={(event) => { setAcknowledged((current) => ({ ...current, [key]: event.target.checked })); setConfirmed(false) }} className="size-3 accent-teal-700" />Looks correct</label></div>}
      {rawText && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-[9px] leading-4 text-slate-500"><span className="font-semibold text-slate-400">OCR text:</span> {originalFields[key]}</p>}
    </div>
  }

  const currentInvoiceNumber = fields.invoiceNumber || 'Untitled invoice'

  return <div ref={rootRef} className="flex h-[100dvh] min-h-[520px] flex-col overflow-hidden bg-[#f7f9f8] text-slate-900">
    <header className="z-20 flex h-[60px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><a href="/app/invoices" aria-label="Back to invoices" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"><ArrowLeft className="size-4" /></a><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white"><FileText className="size-4" /></span><span className="hidden text-[16px] font-semibold tracking-[-0.04em] sm:inline">folio<span className="text-teal-700">.</span></span><span className="hidden h-5 w-px bg-slate-200 sm:block" /><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{currentInvoiceNumber}</p><p className="text-[10px] text-slate-400">Extraction review <span className="text-slate-300">·</span> {invoiceId.toUpperCase()}</p></div></div>
      <div className="flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 sm:inline-flex"><Globe2 className="size-3.5 text-teal-700" />Detected: Marathi + English</span><button type="button" onClick={() => setRawText((value) => !value)} aria-pressed={rawText} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-medium transition ${rawText ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><ScanLine className="size-3.5" /><span className="hidden sm:inline">Original text</span><span className="sm:hidden">OCR</span></button><button type="button" aria-label="Help with extraction review" onClick={() => announce('Review the highlighted fields, then confirm to validate.')} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><CircleHelp className="size-4" /></button></div>
    </header>

    <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[var(--split)_18px_minmax(0,1fr)] md:overflow-hidden" style={{ '--split': `${split}%` } as React.CSSProperties}>
      <section aria-label="Invoice document viewer" className="min-h-[470px] overflow-y-auto border-b border-slate-200 bg-[#eef2f0] md:min-h-0 md:border-b-0 md:border-r md:border-slate-200">
        <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-slate-200/80 bg-[#f4f6f5]/95 px-4 backdrop-blur sm:px-5"><div><p className="text-[11px] font-semibold text-slate-700">Source document</p><p className="text-[9px] text-slate-400">Page {page} of 2 · Original scan</p></div><div className="flex items-center gap-1"><button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.75, value - 0.15))} className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-white"><ZoomOut className="size-3.5" /></button><span className="min-w-10 text-center text-[10px] tabular-nums text-slate-500">{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.65, value + 0.15))} className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-white"><ZoomIn className="size-3.5" /></button><span className="mx-1 h-4 w-px bg-slate-200" /><button type="button" aria-label="Rotate document" onClick={() => setRotation((value) => (value + 90) % 360)} className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-white"><RotateCw className="size-3.5" /></button></div></div>
        <div className="flex min-h-[390px] justify-center overflow-hidden px-3 py-5 sm:px-6 md:min-h-[calc(100%-104px)]" onPointerDown={(event) => { if (zoom > 1) { dragOrigin.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; setDragging(true) } }} style={{ cursor: zoom > 1 ? dragging ? 'grabbing' : 'grab' : 'default' }}>
          <div className="relative h-fit w-[min(100%,420px)] shrink-0 origin-center transition-transform duration-200 ease-out" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)` }}>
            <Image src={page === 1 ? '/images/sample-invoice-scan.png' : '/images/sample-invoice-page-2.png'} alt={page === 1 ? 'Scanned GST invoice with highlighted extracted fields' : 'Scanned second page with tax summary and invoice terms'} width={768} height={1366} priority draggable={false} className="block h-auto w-full rounded-sm shadow-[0_12px_40px_rgba(24,45,38,0.16)]" />
            {page === 1 && fieldBoxes.map((box) => {
              const confidence = fieldConfidence[box.key]
              const selected = activeBox === box.key
              const color = confidence >= 85 ? 'border-emerald-500 bg-emerald-400/10' : confidence >= 70 ? 'border-amber-500 bg-amber-400/10' : 'border-rose-500 bg-rose-400/10'
              return <button key={box.key} type="button" aria-label={`Highlight ${fieldLabels[box.key]} in document`} onClick={() => focusField(box.key)} onMouseEnter={() => setHoveredField(box.key)} onMouseLeave={() => setHoveredField(null)} className={`absolute rounded-[3px] border-2 text-left transition ${selected ? 'z-10 border-teal-700 bg-teal-300/20 shadow-[0_0_0_2px_rgba(13,148,136,0.2)]' : color}`} style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}><span className={`absolute -top-[19px] left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-semibold text-white shadow-sm transition-opacity ${selected ? 'opacity-100' : 'opacity-0'} ${selected ? 'bg-teal-800' : confidence >= 85 ? 'bg-emerald-700' : confidence >= 70 ? 'bg-amber-600' : 'bg-rose-600'}`}>{fieldLabels[box.key]} · {confidence}%</span></button>
            })}
          </div>
        </div>
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-slate-200/80 bg-[#f4f6f5]/95 px-4 py-2.5 backdrop-blur sm:px-5"><div className="flex items-center gap-3"><span className="text-[9px] font-medium text-slate-500">Field confidence</span><span className="flex items-center gap-1 text-[9px] text-slate-500"><span className="size-2 rounded-full bg-emerald-500" />High</span><span className="flex items-center gap-1 text-[9px] text-slate-500"><span className="size-2 rounded-full bg-amber-500" />Medium</span><span className="flex items-center gap-1 text-[9px] text-slate-500"><span className="size-2 rounded-full bg-rose-500" />Low</span></div><span className="hidden text-[9px] text-slate-400 sm:inline">Select a box to jump to its field</span></div>
        <div className="flex items-center gap-2 px-4 py-3 sm:px-5"><div className="flex items-center gap-2">{[1, 2].map((thumbnailPage) => <button key={thumbnailPage} type="button" onClick={() => setPage(thumbnailPage)} aria-label={`Show page ${thumbnailPage}`} aria-pressed={page === thumbnailPage} className={`relative flex h-[58px] w-10 items-center justify-center overflow-hidden rounded-md border bg-white transition ${page === thumbnailPage ? 'border-teal-700 ring-2 ring-teal-700/10' : 'border-slate-200 opacity-70 hover:opacity-100'}`}><Image src={thumbnailPage === 1 ? '/images/sample-invoice-scan.png' : '/images/sample-invoice-page-2.png'} alt="" width={40} height={58} className="h-full w-full object-cover" /><span className="absolute bottom-0.5 right-0.5 rounded bg-slate-900/70 px-1 text-[8px] text-white">{thumbnailPage}</span></button>)}</div><div className="ml-1"><p className="text-[10px] font-medium text-slate-600">2 pages detected</p><p className="text-[9px] text-slate-400">PDF · 1.8 MB</p></div><button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(1)} className="ml-auto flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white disabled:opacity-30"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next page" disabled={page === 2} onClick={() => setPage(2)} className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white disabled:opacity-30"><ChevronRight className="size-4" /></button></div>
      </section>

      <div role="separator" aria-label="Resize document and form panels" aria-orientation="vertical" aria-valuemin={36} aria-valuemax={60} aria-valuenow={split} tabIndex={0} onKeyDown={resizeSplit} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const startX = event.clientX; const start = split; const parentWidth = event.currentTarget.parentElement?.getBoundingClientRect().width || 1; const move = (moveEvent: PointerEvent) => setSplit(Math.max(36, Math.min(60, start + ((moveEvent.clientX - startX) / parentWidth) * 100))); const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cleanup) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', cleanup, { once: true }) }} className="group relative hidden cursor-col-resize items-center justify-center outline-none md:flex"><span className="h-12 w-1 rounded-full bg-slate-300 transition group-hover:bg-teal-600 group-focus:bg-teal-600" /><span className="absolute flex size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus:opacity-100"><span className="text-[9px]">⋮</span></span></div>

      <section aria-label="Extracted invoice details" className="min-w-0 bg-[#fbfcfb] md:min-h-0 md:overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
          <div className="mb-5 flex items-start justify-between gap-3"><div><div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-slate-400"><span>Invoices</span><ChevronRight className="size-3" /><span className="text-teal-800">Review extraction</span></div><h1 className="text-[20px] font-semibold tracking-[-0.035em] text-slate-950">Review extracted details</h1><p className="mt-1 text-[11px] text-slate-500">Check the fields we found in this invoice before validating.</p></div><span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[9px] font-medium text-teal-800"><Sparkles className="size-3" />AI extracted</span></div>

          <section className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5"><SectionHeading eyebrow="01 · Parties" title="Supplier & buyer" icon={FileText} /><div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{field('supplier', 'Supplier name')}{field('supplierGstin', 'Supplier GSTIN')}{field('supplierAddress', 'Supplier address', { wide: true, multiline: true })}<div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3"><p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Billed to</p><div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{field('buyer', 'Buyer name')}{field('buyerGstin', 'Buyer GSTIN')}{field('buyerAddress', 'Buyer address', { wide: true, multiline: true })}</div></div></div></section>

          <section className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5"><SectionHeading eyebrow="02 · Document" title="Invoice details" icon={ScanLine} /><div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{field('invoiceNumber', 'Invoice number')}{field('invoiceDate', 'Invoice date', { type: 'date' })}<div onMouseEnter={() => setHoveredField('placeOfSupply')} onMouseLeave={() => setHoveredField(null)}><div className="mb-1.5 flex min-h-4 items-center justify-between"><label htmlFor="field-placeOfSupply" className="text-[10px] font-medium text-slate-600">Place of supply</label><div className="flex items-center gap-1">{edited.placeOfSupply && <span className="inline-flex items-center gap-1 text-[9px] font-medium text-teal-800"><span className="size-1.5 rounded-full bg-teal-600" />Edited</span>}<ConfidencePill value={fieldConfidence.placeOfSupply} />{edited.placeOfSupply && <button type="button" onClick={() => restoreValue('placeOfSupply')} aria-label="Revert place of supply" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><Undo2 className="size-3" /></button>}</div></div><div className="relative"><select ref={(element) => { inputRefs.current.placeOfSupply = element ?? undefined }} id="field-placeOfSupply" value={fields.placeOfSupply} onChange={(event) => setValue('placeOfSupply', event.target.value)} onFocus={() => setActiveField('placeOfSupply')} onKeyDown={(event) => handleTab(event, 'placeOfSupply')} aria-invalid={!edited.placeOfSupply && !acknowledged.placeOfSupply} className={`h-9 w-full appearance-none rounded-lg border bg-white px-3 pr-8 text-xs text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10 ${edited.placeOfSupply ? 'border-teal-300' : 'border-amber-300'}`}>{states.map((state) => <option key={state}>{state}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-3 text-slate-400" /></div><div className="mt-1.5 flex items-center justify-between"><span className="text-[9px] font-medium text-amber-700">Check this · 66% confidence</span><label className="flex cursor-pointer items-center gap-1.5 text-[9px] text-slate-500"><input type="checkbox" checked={Boolean(acknowledged.placeOfSupply)} onChange={(event) => { setAcknowledged((current) => ({ ...current, placeOfSupply: event.target.checked })); setConfirmed(false) }} className="size-3 accent-teal-700" />Looks correct</label></div>{rawText && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-[9px] text-slate-500">OCR text: {originalFields.placeOfSupply}</p>}</div><label className="flex items-center gap-2 self-end rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"><input type="checkbox" checked={reverseCharge} onChange={(event) => setReverseCharge(event.target.checked)} className="size-3.5 accent-teal-700" /><span><span className="block text-[10px] font-medium text-slate-700">Reverse charge</span><span className="block text-[9px] text-slate-400">Supplier does not collect GST</span></span></label></div></section>

          <section className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><SectionHeading eyebrow="03 · Items" title="Line items" icon={FileText} trailing={<span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-500">{lines.length} items</span>} /></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left"><thead><tr className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">{['Description', 'HSN / SAC', 'Qty', 'Unit', 'Rate', 'CGST %', 'SGST %', 'IGST %', 'CGST Amt', 'SGST Amt', 'IGST Amt', 'Taxable'].map((head) => <th key={head} className="border-b border-slate-100 px-1.5 py-2">{head}</th>)}<th className="w-8 border-b border-slate-100" /></tr></thead><tbody>{lines.map((line) => { const taxable = numeric(line.quantity) * numeric(line.rate); return <tr key={line.id} className="group"><td className="border-b border-slate-100 py-2 pr-1"><input aria-label="Item description" value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} className="h-8 w-[170px] rounded-md border border-transparent px-2 text-[10px] text-slate-700 outline-none hover:border-slate-200 focus:border-teal-600" /></td><td className="border-b border-slate-100 px-1 py-2"><input aria-label="HSN or SAC code" value={line.hsn} onChange={(event) => updateLine(line.id, 'hsn', event.target.value)} className="h-8 w-[76px] rounded-md border border-transparent px-2 font-mono text-[10px] text-slate-600 outline-none hover:border-slate-200 focus:border-teal-600" /></td>{(['quantity', 'unit', 'rate', 'cgst', 'sgst', 'igst'] as const).map((key) => <td key={key} className="border-b border-slate-100 px-1 py-2"><input aria-label={key === 'quantity' ? 'Quantity' : key === 'unit' ? 'Unit' : key === 'rate' ? 'Rate' : `${key.toUpperCase()} rate`} value={line[key]} onChange={(event) => updateLine(line.id, key, event.target.value)} className={`h-8 rounded-md border border-transparent px-1.5 text-[10px] text-slate-600 outline-none hover:border-slate-200 focus:border-teal-600 ${key === 'unit' ? 'w-[60px]' : 'w-[54px]'}`} /></td>)}{(['cgst', 'sgst', 'igst'] as const).map((taxKey) => <td key={`${taxKey}-amount`} className="whitespace-nowrap border-b border-slate-100 px-1.5 py-2 text-[10px] tabular-nums text-slate-600">{money(taxable * numeric(line[taxKey]) / 100)}</td>)}<td className="whitespace-nowrap border-b border-slate-100 px-1.5 py-2 text-[10px] font-medium tabular-nums text-slate-700">{money(taxable)}</td><td className="border-b border-slate-100 py-2 pl-1"><button type="button" aria-label="Remove line item" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="flex size-7 items-center justify-center rounded-md text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"><X className="size-3.5" /></button></td></tr> })}</tbody></table></div><button type="button" onClick={() => setLines((current) => [...current, { id: `line-${Date.now()}`, description: '', hsn: '', quantity: '1', unit: 'Nos', rate: '0', cgst: '9', sgst: '9', igst: '0' }])} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-[10px] font-medium text-slate-600 hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-800"><Plus className="size-3.5" />Add line item</button></section>

          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5"><SectionHeading eyebrow="04 · Calculation" title="Invoice totals" icon={ShieldCheck} /><div className="ml-auto flex max-w-[320px] flex-col gap-2.5 text-[11px]"><div className="flex justify-between text-slate-500"><span>Taxable value</span><span className="font-medium tabular-nums text-slate-800">{money(totals.taxable)}</span></div><div className="flex justify-between text-slate-500"><span>CGST</span><span className="tabular-nums text-slate-700">{money(totals.cgst)}</span></div><div className="flex justify-between text-slate-500"><span>SGST</span><span className="tabular-nums text-slate-700">{money(totals.sgst)}</span></div><div className="flex justify-between text-slate-500"><span>IGST</span><span className="tabular-nums text-slate-700">{money(totals.igst)}</span></div><div className="flex justify-between text-slate-500"><span>Round-off</span><span className="tabular-nums text-slate-700">{money(roundOff)}</span></div><div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900"><span>Grand total</span><span className="tabular-nums">{money(finalTotal)}</span></div></div></section>
          <div className="mb-2 flex items-center gap-1.5 text-[9px] text-slate-400"><CheckCircle2 className="size-3 text-emerald-600" />Tax values recalculate as you edit line items <span className="text-slate-300">·</span> Preview only</div>
        </div>
      </section>
    </main>

    <footer className="z-20 flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-6px_18px_rgba(15,23,42,0.03)] sm:px-6"><div className="flex items-center gap-2.5"><span className={`flex size-8 items-center justify-center rounded-full ${unresolved.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{unresolved.length ? <CircleHelp className="size-4" /> : <CheckCircle2 className="size-4" />}</span><div><p className="text-[11px] font-semibold text-slate-800">{unresolved.length ? `Low-confidence fields: ${unresolved.length} remaining` : confirmed ? 'Invoice confirmed' : 'All flagged fields reviewed'}</p><p className="text-[9px] text-slate-400">{savedAt ? `Draft saved at ${savedAt}` : 'Tab moves between flagged fields · ⌘S to save draft'}</p></div></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={saveDraft} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50"><Save className="size-3.5" />Save draft</button><button type="button" disabled={unresolved.length > 0 || confirmed} onClick={() => { setConfirmed(true); router.push(`/app/invoices/${invoiceId}/validation`) }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-800 px-3.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"><Check className="size-3.5" />{confirmed ? 'Confirmed' : 'Confirm & validate'}</button></div></footer>
    {notice && <div role="status" className="fixed bottom-[82px] left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">{notice}</div>}
  </div>
}

export default ExtractionReview
