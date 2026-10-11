import type { Metadata } from 'next'
import MonitoringRulesWorkspace from '@/components/monitoring-rules-workspace'

export const metadata: Metadata = {
  title: 'GST rule engine telemetry | Folio GST workspace',
  description: 'Execution latencies, rule hit rates, and tax validation compliance across Indian GST rules.',
}

export default function RulesPage() {
  return <MonitoringRulesWorkspace />
}
