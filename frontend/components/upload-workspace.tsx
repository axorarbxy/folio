'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CloudUpload,
  Copy,
  File as FileIcon,
  FileImage,
  FileJson,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Mail,
  Minus,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Tab = 'files' | 'camera' | 'forward'
type Outcome = 'pending' | 'clean' | 'issues' | 'review' | 'failed'
type Stage = -1 | 0 | 1 | 2 | 3

type InvoiceFile = {
  id: string
  file: File
  stage: Stage
  outcome: Outcome
  attempts: number
}

const MAX_FILES = 50
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'xml', 'json']
const STAGES = ['Reading', 'Extracting', 'Validating', 'Done']
const FORWARDING_EMAIL = 'invoices+acme-4821@folio.app'

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function FileTypeIcon({ name }: { name: string }) {
  const extension = extensionOf(name)
  if (['jpg', 'jpeg', 'png'].includes(extension)) return <FileImage aria-hidden="true" />
  if (['xml', 'json'].includes(extension)) return <FileJson aria-hidden="true" />
  return <FileText aria-hidden="true" />
}

function UploadHeader() {
  return (
    <header className="flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-8">
      <a className="flex items-center gap-3" href="/" aria-label="Folio home">
        <span className="flex size-9 items-center justify-center rounded-xl bg-teal-800 text-white shadow-sm">
          <FileText aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="text-[17px] font-semibold tracking-[-0.04em] text-slate-900">folio<span className="text-teal-700">.</span></span>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span className="hidden text-sm text-slate-500 sm:block">GST workspace</span>
      </a>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 sm:inline-flex">
          <span className="size-1.5 rounded-full bg-emerald-500" /> All systems operational
        </span>
        <button type="button" className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900" aria-label="Account: Aditi Mehta">AM</button>
      </div>
    </header>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>Documents</span><span className="text-slate-300">/</span><span className="text-teal-800">{eyebrow}</span>
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[32px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:self-auto">
        <ShieldCheck aria-hidden="true" className="size-4 text-teal-700" />
        <span>Files are encrypted and private</span>
      </div>
    </div>
  )
}

function DropZone({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
}: {
  dragOver: boolean
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onBrowse: () => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex min-h-[258px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors ${dragOver ? 'border-teal-600 bg-teal-50/80' : 'border-slate-300 bg-slate-50/70 hover:border-teal-500 hover:bg-teal-50/40'}`}
    >
      <div className={`mb-4 flex size-14 items-center justify-center rounded-2xl border bg-white shadow-sm transition-transform ${dragOver ? 'scale-105 border-teal-200 text-teal-800' : 'border-slate-200 text-slate-500 group-hover:text-teal-800'}`}>
        <CloudUpload aria-hidden="true" className="size-7" strokeWidth={1.7} />
      </div>
      <p className="text-base font-semibold text-slate-900">Drop your invoices here</p>
      <p className="mt-1.5 max-w-sm text-sm leading-5 text-slate-500">Add up to 50 files at once. We&apos;ll take it from here.</p>
      <Button type="button" variant="outline" className="mt-5 h-9 bg-white px-4" onClick={onBrowse}>
        <Upload data-icon="inline-start" /> Browse files
      </Button>
      <p className="mt-4 text-[11px] font-medium tracking-wide text-slate-400">PDF, JPG, PNG, XML OR JSON <span className="mx-1.5">·</span> UP TO 20 MB EACH</p>
    </div>
  )
}

function CameraPanel({ onCapture }: { onCapture: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3 sm:p-4">
      <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_center,#26384a_0%,#14202d_58%,#0d1722_100%)] px-5 py-8 text-center">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative mb-5 flex size-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80">
          <ScanLine aria-hidden="true" className="size-6" />
        </div>
        <div className="relative mb-6 grid h-[128px] w-[210px] place-items-center rounded-lg border border-white/15 bg-white/[0.035]">
          <span className="absolute left-[-2px] top-[-2px] size-5 rounded-tl border-l-2 border-t-2 border-teal-300" />
          <span className="absolute right-[-2px] top-[-2px] size-5 rounded-tr border-r-2 border-t-2 border-teal-300" />
          <span className="absolute bottom-[-2px] left-[-2px] size-5 rounded-bl border-b-2 border-l-2 border-teal-300" />
          <span className="absolute bottom-[-2px] right-[-2px] size-5 rounded-br border-b-2 border-r-2 border-teal-300" />
          <div className="flex flex-col items-center gap-2 text-white/60">
            <ImageIcon aria-hidden="true" className="size-8" strokeWidth={1.3} />
            <span className="text-[11px]">Position invoice in frame</span>
          </div>
        </div>
        <Button type="button" className="relative h-10 rounded-full bg-white px-5 text-slate-900 hover:bg-slate-100" onClick={onCapture}>
          <span className="mr-2 size-2.5 rounded-full bg-rose-500" /> Capture invoice
        </Button>
        <p className="relative mt-3 text-[11px] text-white/45">Camera preview is simulated for this demo</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-4 text-xs text-slate-300">
        <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-teal-300" /> Good light, flat page</span>
        <span>Keep all four corners in view</span>
      </div>
    </div>
  )
}

function QrPlaceholder() {
  const cells = Array.from({ length: 225 }, (_, index) => {
    const row = Math.floor(index / 15)
    const col = index % 15
    const inFinder = (r: number, c: number) => r < 5 && c < 5 || r < 5 && c > 9 || r > 9 && c < 5
    const finderRow = row < 5 ? row : row > 9 ? row - 10 : -1
    const finderCol = col < 5 ? col : col > 9 ? col - 10 : -1
    const finder = inFinder(row, col) && (finderRow === 0 || finderRow === 4 || finderCol === 0 || finderCol === 4 || finderRow === 2 && finderCol === 2)
    const fill = finder || ((row * 7 + col * 11 + row * col) % 5 < 2)
    return <span key={index} className={fill ? 'bg-slate-800' : 'bg-white'} />
  })
  return <div aria-label="QR code placeholder" className="grid size-[132px] grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] gap-[2px] rounded-lg border border-slate-200 bg-white p-2">{cells}</div>
}

function ForwardPanel({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Smartphone aria-hidden="true" className="size-4 text-teal-700" /> Forward invoices to Folio</div>
        <p className="max-w-md text-sm leading-6 text-slate-500">Send invoices from WhatsApp or email. They&apos;ll be added to your workspace automatically.</p>
        <ol className="mt-5 flex flex-col gap-3">
          {[
            ['01', 'Save the address', 'Copy your unique Folio email below.'],
            ['02', 'Forward your invoice', 'Send a PDF or photo from WhatsApp or email.'],
            ['03', "We'll take it from here", 'Your invoice appears here, ready to review.'],
          ].map(([number, title, detail]) => (
            <li key={number} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-semibold text-teal-800">{number}</span>
              <span><span className="block text-sm font-medium text-slate-800">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span></span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex max-w-md flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3">
          <Mail aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{FORWARDING_EMAIL}</span>
          <Button type="button" size="sm" variant="outline" className="bg-white" onClick={onCopy}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 sm:pr-2">
        <QrPlaceholder />
        <span className="text-[11px] text-slate-400">WhatsApp connection QR</span>
      </div>
    </div>
  )
}

function OptionsPanel({
  invoiceType,
  setInvoiceType,
  language,
  setLanguage,
  handwritten,
  setHandwritten,
  autoValidate,
  setAutoValidate,
}: {
  invoiceType: string
  setInvoiceType: (value: string) => void
  language: string
  setLanguage: (value: string) => void
  handwritten: boolean
  setHandwritten: (value: boolean) => void
  autoValidate: boolean
  setAutoValidate: (value: boolean) => void
}) {
  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Processing options</h2>
        <p className="mt-1 text-xs text-slate-500">Fine-tune how we read your invoices.</p>
      </div>
      <div className="flex flex-col gap-5 p-5">
        <label className="flex flex-col gap-2 text-xs font-medium text-slate-700">
          Invoice type
          <span className="relative">
            <select value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-normal text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15">
              <option>Purchase</option><option>Sales</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
          </span>
        </label>
        <label className="flex flex-col gap-2 text-xs font-medium text-slate-700">
          Language hint
          <span className="relative">
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-normal text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15">
              {['Auto-detect', 'English', 'Hindi', 'Marathi', 'Tamil', 'Gujarati', 'Bengali', 'Kannada', 'Telugu', 'Other'].map((item) => <option key={item}>{item}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
          </span>
        </label>
        <div className="h-px bg-slate-100" />
        <ToggleRow title="Handwritten invoice" detail="Improve reading for handwritten bills" enabled={handwritten} onChange={setHandwritten} />
        <ToggleRow title="Auto-validate after extraction" detail="Check totals and GST details automatically" enabled={autoValidate} onChange={setAutoValidate} />
      </div>
      <div className="flex items-start gap-2.5 bg-teal-50/70 px-5 py-3.5 text-[11px] leading-5 text-teal-900/75">
        <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-teal-700" />
        <span>Folio learns from every correction, so your next batch is even more accurate.</span>
      </div>
    </aside>
  )
}

function ToggleRow({ title, detail, enabled, onChange }: { title: string; detail: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="pr-2">
        <p className="text-xs font-medium text-slate-800">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={title} onClick={() => onChange(!enabled)} className={`relative mt-0.5 h-[22px] w-10 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${enabled ? 'bg-teal-700' : 'bg-slate-300'}`}>
        <span className={`absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
      </button>
    </div>
  )
}

function FileRow({
  item,
  preview,
  disabled,
  onRemove,
  onRetry,
}: {
  item: InvoiceFile
  preview?: string
  disabled: boolean
  onRemove: () => void
  onRetry: () => void
}) {
  const iconClass = 'size-4'
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-slate-500">
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <FileTypeIcon name={item.file.name} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800">{item.file.name}</p>
        <p className="mt-1 text-[11px] text-slate-400">{formatSize(item.file.size)} <span className="px-1">·</span>{extensionOf(item.file.name).toUpperCase()}</p>
        {item.outcome === 'failed' ? (
          <p className="mt-1 text-[11px] font-medium text-rose-700">A temporary issue interrupted processing.</p>
        ) : item.stage >= 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={`Processing stage: ${item.outcome === 'pending' ? STAGES[item.stage] : 'Done'}`}>
            {STAGES.map((step, index) => {
              const complete = item.outcome !== 'pending' || index < item.stage
              const active = item.outcome === 'pending' && index === item.stage
              return (
                <span key={step} className={`inline-flex items-center gap-1 text-[10px] ${complete ? 'font-medium text-teal-800' : active ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
                  {complete ? <CheckCircle2 aria-hidden="true" className={iconClass} /> : active ? <LoaderCircle aria-hidden="true" className={`${iconClass} animate-spin`} /> : <span className="flex size-4 items-center justify-center rounded-full border border-slate-300 text-[9px]">{index + 1}</span>}
                  {step}
                </span>
              )
            })}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.outcome === 'failed' ? <Button type="button" size="sm" variant="outline" className="h-8 bg-white" onClick={onRetry}><RotateCcw data-icon="inline-start" />Retry</Button> : item.outcome !== 'pending' ? <OutcomeBadge outcome={item.outcome} /> : null}
        {item.outcome === 'pending' && item.stage < 0 && <button type="button" aria-label={`Remove ${item.file.name}`} onClick={onRemove} disabled={disabled} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X aria-hidden="true" className="size-4" /></button>}
      </div>
    </li>
  )
}

function OutcomeBadge({ outcome }: { outcome: Exclude<Outcome, 'pending' | 'failed'> }) {
  const labels = { clean: 'Clean', issues: 'Issues', review: 'Review' }
  const classes = { clean: 'border-emerald-200 bg-emerald-50 text-emerald-800', issues: 'border-amber-200 bg-amber-50 text-amber-800', review: 'border-rose-200 bg-rose-50 text-rose-800' }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${classes[outcome]}`}><span className="size-1.5 rounded-full bg-current" />{labels[outcome]}</span>
}

function ProgressSummary({ files, onReview, settingsSummary }: { files: InvoiceFile[]; onReview: () => void; settingsSummary: string }) {
  const counts = {
    clean: files.filter((item) => item.outcome === 'clean').length,
    issues: files.filter((item) => item.outcome === 'issues').length,
    review: files.filter((item) => item.outcome === 'review').length,
    failed: files.filter((item) => item.outcome === 'failed').length,
  }
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{counts.failed ? 'Almost there' : 'Processing complete'}</p>
          <p className="mt-1 text-xs text-slate-500">{counts.failed ? `${counts.failed} file${counts.failed === 1 ? '' : 's'} need a retry before review.` : `${files.length} invoice${files.length === 1 ? '' : 's'} processed. Check the results before adding them.`}</p>
          <p className="mt-1 text-[10px] text-slate-400">Settings applied: {settingsSummary}</p>
        </div>
        <Button type="button" onClick={onReview} disabled={counts.failed > 0} className="h-9 shrink-0 px-4">Review results <ArrowRight data-icon="inline-end" /></Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <SummaryBadge color="green" icon={<CheckCircle2 aria-hidden="true" />} label="Clean" count={counts.clean} />
        <SummaryBadge color="amber" icon={<AlertCircle aria-hidden="true" />} label="Issues" count={counts.issues} />
        <SummaryBadge color="rose" icon={<AlertCircle aria-hidden="true" />} label="Needs review" count={counts.review} />
        {counts.failed > 0 && <SummaryBadge color="slate" icon={<RotateCcw aria-hidden="true" />} label="Retry" count={counts.failed} />}
      </div>
    </div>
  )
}

function SummaryBadge({ color, icon, label, count }: { color: 'green' | 'amber' | 'rose' | 'slate'; icon: React.ReactNode; label: string; count: number }) {
  const colorClasses = { green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', rose: 'bg-rose-50 text-rose-800', slate: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${colorClasses[color]}`}>{icon}<span>{label}</span><span className="tabular-nums opacity-70">{count}</span></span>
}

function ResultsView({ files, onBack, onStartOver }: { files: InvoiceFile[]; onBack: () => void; onStartOver: () => void }) {
  return (
    <div className="mx-auto max-w-[760px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_-30px_rgba(15,23,42,.35)] sm:p-8">
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900"><ArrowLeft aria-hidden="true" className="size-4" /> Back to upload</button>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800"><ClipboardCheck aria-hidden="true" className="size-6" /></div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">Your invoices are ready to review</h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-500">We checked the invoice totals and GST details. Here's a quick look at each file.</p>
      <ul className="mt-6 flex flex-col gap-2">
        {files.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><FileTypeIcon name={item.file.name} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{item.file.name}</span><span className="mt-1 block text-[11px] text-slate-400">{formatSize(item.file.size)}</span></span>
            {item.outcome === 'failed' ? <OutcomeBadge outcome="review" /> : <OutcomeBadge outcome={item.outcome === 'pending' ? 'clean' : item.outcome} />}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-9 bg-white" onClick={onStartOver}>Add more invoices</Button>
        <Button type="button" className="h-9" onClick={onBack}>Done <Check data-icon="inline-end" /></Button>
      </div>
    </div>
  )
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function UploadWorkspace() {
  const [tab, setTab] = useState<Tab>('files')
  const [files, setFiles] = useState<InvoiceFile[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [invoiceType, setInvoiceType] = useState('Purchase')
  const [language, setLanguage] = useState('Auto-detect')
  const [handwritten, setHandwritten] = useState(false)
  const [autoValidate, setAutoValidate] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  useEffect(() => {
    const objectUrls: Record<string, string> = {}
    files.forEach(({ id, file }) => {
      if (file.type.startsWith('image/')) objectUrls[id] = URL.createObjectURL(file)
    })
    setPreviews(objectUrls)
    return () => Object.values(objectUrls).forEach(URL.revokeObjectURL)
  }, [files])

  function addFiles(fileList: FileList | File[]) {
    setError('')
    const selected = Array.from(fileList)
    const valid: InvoiceFile[] = []
    const messages: string[] = []
    for (const file of selected) {
      if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
        messages.push(`${file.name}: unsupported file type.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        messages.push(`${file.name}: file is over the 20 MB limit.`)
        continue
      }
      valid.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, stage: -1, outcome: 'pending', attempts: 0 })
    }
    const remaining = MAX_FILES - files.length
    if (valid.length > remaining) {
      messages.push(`You can add up to ${MAX_FILES} files. ${remaining} ${remaining === 1 ? 'slot is' : 'slots are'} available.`)
    }
    const accepted = valid.slice(0, Math.max(0, remaining))
    if (accepted.length) setFiles((current) => [...current, ...accepted])
    if (messages.length) setError(messages.join(' '))
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id))
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(true)
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
  }

  async function captureDemoInvoice() {
    try {
      const response = await fetch('/images/sample-invoice-scan.png')
      if (!response.ok) throw new Error('Sample scan unavailable')
      const scan = await response.blob()
      const captured = new File([scan], `camera-invoice-${Date.now()}.png`, { type: 'image/png' })
      addFiles([captured])
      setTab('files')
    } catch {
      setError('The sample camera scan could not be loaded. Please choose a file instead.')
      setTab('files')
    }
  }

  async function copyForwardingEmail() {
    try {
      await navigator.clipboard.writeText(FORWARDING_EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy automatically. Select and copy the forwarding address instead.')
    }
  }

  async function runProcessing(ids: string[]) {
    if (processingRef.current) return
    processingRef.current = true
    setProcessing(true)
    setError('')
    const selected = files.filter((item) => ids.includes(item.id))
    setFiles((current) => current.map((item) => ids.includes(item.id) ? { ...item, stage: 0, outcome: 'pending' } : item))
    await Promise.all(selected.map(async (item, index) => {
      for (let stage = 0; stage < STAGES.length; stage += 1) {
        await delay(640 + index * 90)
        setFiles((current) => current.map((file) => file.id === item.id ? { ...file, stage: stage as Stage } : file))
      }
      await delay(280)
      const shouldFailOnce = index === selected.length - 1 && item.attempts === 0
      const requiresReview = !autoValidate || (handwritten && item.file.type.startsWith('image/'))
      const outcome: Outcome = shouldFailOnce ? 'failed' : requiresReview ? 'review' : index % 3 === 1 ? 'issues' : index % 3 === 2 ? 'review' : 'clean'
      setFiles((current) => current.map((file) => file.id === item.id ? { ...file, outcome, attempts: file.attempts + 1 } : file))
    }))
    processingRef.current = false
    setProcessing(false)
  }

  const hasStarted = files.some((item) => item.stage >= 0)
  const hasFinished = files.some((item) => item.outcome !== 'pending')
  const waitingFiles = files.filter((item) => item.stage < 0 && item.outcome === 'pending')
  const failedFiles = files.filter((item) => item.outcome === 'failed')
  const allFinished = files.length > 0 && files.every((item) => item.outcome !== 'pending')

  function startOver() {
    setFiles([])
    setResultsOpen(false)
    setError('')
    setTab('files')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <UploadHeader />
      <main className="mx-auto w-full max-w-[1320px] px-4 pb-12 pt-7 sm:px-8 sm:pt-9">
        <SectionHeading eyebrow={resultsOpen ? 'Review' : 'Add invoices'} title={resultsOpen ? 'Review results' : 'Add invoices'} description={resultsOpen ? 'A quick quality check before these invoices join your records.' : "Bring your invoices together. We'll extract the details and check them for you."} />

        {resultsOpen ? (
          <ResultsView files={files} onBack={() => setResultsOpen(false)} onStartOver={startOver} />
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_35px_-30px_rgba(15,23,42,.35)] sm:p-6">
              <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Choose how to add invoices</h2>
                  <p className="mt-1 text-xs text-slate-500">Your files stay private to your workspace.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck aria-hidden="true" className="size-3.5" /> Secure upload</span>
              </div>
              <div role="tablist" aria-label="Invoice input method" className="mb-5 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                {([
                  ['files', 'Upload files', Upload],
                  ['camera', 'Scan with camera', ScanLine],
                  ['forward', 'WhatsApp / Email', Smartphone],
                ] as const).map(([key, label, Icon]) => (
                  <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setError('') }} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${tab === key ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    <Icon aria-hidden="true" className="size-4 shrink-0" /><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{key === 'files' ? 'Files' : key === 'camera' ? 'Camera' : 'Forward'}</span>
                  </button>
                ))}
              </div>

              {tab === 'files' && !hasStarted && (
                <>
                  <DropZone dragOver={dragOver} onDragOver={onDragOver} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onBrowse={() => fileInputRef.current?.click()} />
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xml,.json" className="sr-only" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = '' }} aria-label="Choose invoice files" />
                </>
              )}
              {tab === 'camera' && !hasStarted && <CameraPanel onCapture={captureDemoInvoice} />}
              {tab === 'forward' && !hasStarted && <ForwardPanel copied={copied} onCopy={copyForwardingEmail} />}

              {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{error}</span><button type="button" onClick={() => setError('')} className="ml-auto shrink-0 rounded p-0.5 hover:bg-rose-100" aria-label="Dismiss message"><X aria-hidden="true" className="size-4" /></button></div>}

              {(files.length > 0 || hasStarted) && (
                <div className={`${tab === 'files' && !hasStarted ? 'mt-5' : 'mt-5'} ${tab !== 'files' && !hasStarted ? 'hidden' : ''}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-800">{hasStarted ? 'Processing queue' : 'Selected files'} <span className="ml-1 font-normal text-slate-400">{files.length}/{MAX_FILES}</span></h3>
                    {!hasStarted && files.length > 0 && <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-800 hover:text-teal-950"><Plus aria-hidden="true" className="size-3.5" /> Add more</button>}
                  </div>
                  {!hasStarted && <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xml,.json" className="sr-only" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = '' }} aria-label="Add more invoice files" />}
                  <ul className="flex flex-col gap-2" aria-live="polite">
                    {files.map((item) => <FileRow key={item.id} item={item} preview={previews[item.id]} disabled={processing} onRemove={() => removeFile(item.id)} onRetry={() => runProcessing([item.id])} />)}
                  </ul>
                </div>
              )}

              {!hasStarted && tab === 'files' && files.length === 0 && (
                <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400"><FileIcon aria-hidden="true" className="size-3.5" /> No invoices selected yet</div>
              )}

              {files.length > 0 && !hasStarted && (
                <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-slate-400">{files.length} file{files.length === 1 ? '' : 's'} ready <span className="px-1">·</span> {files.reduce((sum, item) => sum + item.file.size, 0) < 1024 * 1024 ? `${Math.max(1, Math.round(files.reduce((sum, item) => sum + item.file.size, 0) / 1024))} KB total` : `${(files.reduce((sum, item) => sum + item.file.size, 0) / (1024 * 1024)).toFixed(1)} MB total`}</span>
                  <Button type="button" className="h-10 px-5" onClick={() => runProcessing(files.map((item) => item.id))}><Sparkles data-icon="inline-start" /> Start processing <ArrowRight data-icon="inline-end" /></Button>
                </div>
              )}

              {hasStarted && (
                <>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-2">{processing ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-teal-700" /> : <CheckCircle2 aria-hidden="true" className="size-3.5 text-teal-700" />}{processing ? 'Extracting and checking invoice data…' : failedFiles.length ? 'Some files need another pass.' : 'All files have finished processing.'}</span>
                    <span className="tabular-nums">{files.filter((item) => item.outcome !== 'pending').length} of {files.length} complete</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-teal-700 transition-all duration-500 ${allFinished ? 'w-full' : `${Math.max(4, (files.filter((item) => item.outcome !== 'pending').length / files.length) * 100)}%`}`} /></div>
                  {allFinished && !processing && <ProgressSummary files={files} onReview={() => setResultsOpen(true)} settingsSummary={`${invoiceType} invoices · ${language} · handwritten ${handwritten ? 'on' : 'off'} · auto-validation ${autoValidate ? 'on' : 'off'}`} />}
                  {!processing && waitingFiles.length > 0 && <Button type="button" variant="outline" className="mt-4 bg-white" onClick={() => runProcessing(waitingFiles.map((item) => item.id))}>Process remaining files <ArrowRight data-icon="inline-end" /></Button>}
                </>
              )}
            </section>

            <OptionsPanel invoiceType={invoiceType} setInvoiceType={setInvoiceType} language={language} setLanguage={setLanguage} handwritten={handwritten} setHandwritten={setHandwritten} autoValidate={autoValidate} setAutoValidate={setAutoValidate} />
          </div>
        )}

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-200/80 pt-4 text-[11px] text-slate-400 sm:flex-row">
          <span>© 2025 Folio Technologies</span>
          <span className="flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="size-3.5" /> Your financial data stays yours.</span>
        </footer>
      </main>
    </div>
  )
}

export default UploadWorkspace
