import type { Metadata } from 'next'
import MonitoringOverviewWorkspace from '@/components/monitoring-overview-workspace'

export const metadata: Metadata = {
  title: 'Monitoring & pipeline health | Folio GST workspace',
  description: 'Real-time telemetry, stage latencies, error tracking, and filing readiness for Folio GST pipeline.',
}

export default function MonitoringPage() {
  return <MonitoringOverviewWorkspace />
}
