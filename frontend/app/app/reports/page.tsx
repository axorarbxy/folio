import type { Metadata } from 'next'
import ReportsWorkspace from '@/components/reports-workspace'

export const metadata: Metadata = {
  title: 'Reports & audit trail | Folio GST workspace',
  description: 'Generate GST reports and review a searchable audit trail of invoice changes in Folio.',
}

export default function ReportsPage() {
  return <ReportsWorkspace />
}
