import type { Metadata } from 'next'
import MonitoringIncidentsWorkspace from '@/components/monitoring-incidents-workspace'

export const metadata: Metadata = {
  title: 'Incident log & postmortems | Folio GST workspace',
  description: 'Historical log of pipeline degradation events, root causes, time-to-resolve, and preventive actions in Folio.',
}

export default function IncidentsPage() {
  return <MonitoringIncidentsWorkspace />
}
