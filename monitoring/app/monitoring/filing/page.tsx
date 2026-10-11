import type { Metadata } from 'next'
import MonitoringFilingWorkspace from '@/components/monitoring-filing-workspace'

export const metadata: Metadata = {
  title: 'Filing sentinel | Folio GST workspace',
  description: 'GSTR-1, GSTR-3B, and GSTR-2B compliance countdown, ITC reconciliation status, and deadline risk monitor.',
}

export default function FilingPage() {
  return <MonitoringFilingWorkspace />
}
