import type { Metadata } from 'next'
import MonitoringAlertsWorkspace from '@/components/monitoring-alerts-workspace'

export const metadata: Metadata = {
  title: 'Alerts & signals | Folio GST workspace',
  description: 'Active pipeline anomalies, latency threshold breaches, and GSTN rate limit warnings across severities.',
}

export default function AlertsPage() {
  return <MonitoringAlertsWorkspace />
}
