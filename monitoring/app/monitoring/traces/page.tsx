import type { Metadata } from 'next'
import MonitoringTracesWorkspace from '@/components/monitoring-traces-workspace'

export const metadata: Metadata = {
  title: 'Distributed invoice traces | Folio GST workspace',
  description: 'Execution waterfalls and asynchronous span tracking for individual invoice processing runs in Folio.',
}

export default function TracesPage() {
  return <MonitoringTracesWorkspace />
}
