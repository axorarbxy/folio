import type { Metadata } from 'next'
import SecurityDataWorkspace from '@/components/security-data-workspace'

export const metadata: Metadata = {
  title: 'Data Protection & Privacy | Security & Governance | Folio',
  description: 'Data encryption lifecycle, PII masking, retention policies, DPDP data principal requests, and India data residency.',
}

export default function SecurityDataPage() {
  return <SecurityDataWorkspace />
}
