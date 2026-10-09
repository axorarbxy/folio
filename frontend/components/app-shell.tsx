import { Activity, FileCheck2, FileText, LayoutDashboard, Settings2, Users, type LucideIcon } from 'lucide-react'

const workspaceLinks: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Overview', href: '/app', icon: LayoutDashboard },
  { label: 'Invoices', href: '/app/invoices', icon: FileText },
  { label: 'ITC reconciliation', href: '/app/itc', icon: FileCheck2 },
  { label: 'Vendors', href: '/app/vendors', icon: Users },
  { label: 'Reports', href: '/app/reports', icon: Activity },
]

export function MobileWorkspaceNav({ active, tourTarget }: { active: string; tourTarget?: string }) {
  return <nav aria-label="Mobile workspace" className={`relative flex gap-2 overflow-x-auto border-b border-[#393d68] bg-[#474c80] px-3 py-3 lg:hidden ${tourTarget === 'sidebar' ? 'z-[61] ring-4 ring-[#c7c8e5] ring-offset-2 ring-offset-background' : ''}`}>{workspaceLinks.map((item) => <a key={item.label} href={item.href} aria-current={active === item.label ? 'page' : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active === item.label ? 'bg-[#f8f7e2] text-[#393d68] shadow-sm' : 'text-[#f8f7e2]/80 hover:bg-white/10 hover:text-white'}`}>{item.label}</a>)}</nav>
}

export function AppShell({ children, active, tourTarget }: { children: React.ReactNode; active: string; tourTarget?: string }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/15 bg-[#474c80] px-4 text-[#f8f7e2] shadow-[0_8px_28px_rgba(38,40,73,0.18)] sm:px-7">
      <a href="/app" aria-label="Folio workspace home" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#f8f7e2] text-[#474c80] shadow-sm"><FileText className="size-5" /></span><span className="text-2xl font-bold tracking-[-0.06em] text-[#f8f7e2]">folio<span className="text-[#c7c8e5]">.</span></span><span className="ml-1 hidden border-l border-white/25 pl-4 text-sm font-medium text-[#f8f7e2]/75 sm:inline">GST workspace</span></a>
      <div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#f8f7e2] md:inline-flex"><span className="size-2 rounded-full bg-[#78d0a3] shadow-[0_0_12px_rgba(120,208,163,0.9)]" />All systems operational</span><a href="/app/settings" aria-label="Settings" className="rounded-xl p-2.5 text-[#f8f7e2]/85 transition hover:bg-white/10 hover:text-white"><Settings2 className="size-5" /></a><span className="flex size-10 items-center justify-center rounded-full border-2 border-[#d9d9ef] bg-[#f8f7e2] text-sm font-bold text-[#474c80]" aria-label="Account: Aditi Mehta">AM</span></div>
    </header>
    <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1680px]">
      <aside className={`relative hidden w-[264px] shrink-0 border-r border-[#393d68] bg-[#474c80] px-4 py-7 text-[#f8f7e2] lg:block ${tourTarget === 'sidebar' ? 'z-[61] ring-4 ring-[#c7c8e5] ring-offset-4 ring-offset-background' : ''}`}><p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c7c8e5]">Workspace</p><nav aria-label="Workspace" className="mt-4 flex flex-col gap-1.5">{workspaceLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} aria-current={active === label ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-[15px] font-semibold transition ${active === label ? 'bg-[#f8f7e2] text-[#393d68] shadow-[0_6px_20px_rgba(30,31,55,0.16)]' : 'text-[#f8f7e2]/80 hover:bg-white/10 hover:text-white'}`}><Icon aria-hidden="true" className="size-[18px]" />{label}</a>)}</nav><div className="mt-9 border-t border-white/15 pt-6"><p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c7c8e5]">Manage</p><nav aria-label="Manage workspace" className="mt-3 flex flex-col gap-1"><a href="/app/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-[#f8f7e2]/80 hover:bg-white/10"><Settings2 className="size-[18px]" />Business settings</a><a href="/app/settings?section=team" className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-[#f8f7e2]/80 hover:bg-white/10"><Users className="size-[18px]" />Team members</a></nav></div><div className="mt-9 rounded-2xl border border-white/15 bg-[#393d68]/70 p-4"><span className="flex size-10 items-center justify-center rounded-xl bg-[#f8f7e2] text-[#474c80]"><FileCheck2 className="size-5" /></span><p className="mt-4 text-sm font-bold text-[#f8f7e2]">Your books are in good shape</p><p className="mt-1.5 text-xs leading-5 text-[#f8f7e2]/70">37 of 48 invoices are ready to reconcile.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[77%] rounded-full bg-[#a6d8b9]" /></div><p className="mt-2 text-[11px] font-semibold text-[#d7ebdc]">77% filing-ready</p></div></aside>
      <div className="min-w-0 flex-1"><MobileWorkspaceNav active={active} tourTarget={tourTarget} /><main className="min-w-0 px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><div className="mx-auto max-w-[1360px]">{children}</div></main></div>
    </div>
  </div>
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="relative mb-8 flex flex-col justify-between gap-5 overflow-hidden rounded-[1.75rem] bg-[#474c80] px-6 py-7 text-[#f8f7e2] shadow-[0_18px_45px_rgba(45,49,91,0.18)] sm:flex-row sm:items-end sm:px-8 sm:py-8"><div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-28 size-72 rounded-full border border-white/10" /><div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-20 size-56 rounded-full border border-white/10" /><div className="relative"><div className="mb-3 flex items-center gap-2 text-sm text-[#d7d8ef]"><a href="/app" className="hover:text-white">Workspace</a><span className="text-white/45">/</span><span className="font-semibold text-[#f8f7e2]">{eyebrow}</span></div><h1 className="text-4xl font-bold tracking-[-0.055em] text-[#f8f7e2] sm:text-5xl">{title}</h1><p className="mt-2 max-w-2xl text-base leading-7 text-[#f8f7e2]/75">{description}</p></div><div className="relative">{action}</div></div>
}

export function SectionCard({ title, description, children, className = '' }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] shadow-[0_10px_30px_rgba(59,62,98,0.07)] ${className}`}><div className="border-b border-[#e6e5d4] bg-[#f1f0df]/70 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold tracking-[-0.02em] text-[#393d68]">{title}</h2>{description && <p className="mt-1 text-sm leading-5 text-[#686b86]">{description}</p>}</div><div className="p-5 sm:p-6">{children}</div></section>
}

export function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: LucideIcon }) {
  return <div className="group relative overflow-hidden rounded-2xl border border-[#dedecb] bg-[#fffef4] px-5 py-5 shadow-[0_10px_28px_rgba(59,62,98,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,62,98,0.12)]"><div aria-hidden="true" className="absolute -right-7 -top-7 size-24 rounded-full bg-[#e6e5f1] transition group-hover:scale-125" /><div className="relative flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[#686b86]">{label}</p><span className="flex size-10 items-center justify-center rounded-xl bg-[#e7e6f2] text-[#474c80]"><Icon aria-hidden="true" className="size-5" /></span></div><strong className="relative mt-3 block truncate text-3xl font-bold tracking-tight text-[#393d68]">{value}</strong><p className="relative mt-1 text-sm font-medium text-[#686b86]">{note}</p></div>
}

export function formatRupees(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

export function ToggleControl({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#474c80]' : 'bg-[#d2d1be]'}`}><span className={`absolute top-0.5 size-5 rounded-full bg-[#fffef4] shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} /></button>
}
