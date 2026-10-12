import type { Metadata } from 'next'
import SecurityThreatsWorkspace from '@/components/security-threats-workspace'

export const metadata: Metadata = {
  title: 'Threat & Anomaly Detection | Security & Governance | Folio',
  description: 'Real-time heuristic fraud detection, impossible travel alerts, invoice tamper verification, and adaptive rate limits.',
}

export default function SecurityThreatsPage() {
  return <SecurityThreatsWorkspace />
}
