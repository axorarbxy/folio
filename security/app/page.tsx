import type { Metadata } from 'next'
import SecurityOverviewWorkspace from '@/components/security-overview-workspace'

export const metadata: Metadata = {
  title: 'Security & Governance | Folio GST workspace',
  description: 'Enterprise data protection, role-based access control, cryptographic audit logs, and DPDP compliance monitoring.',
}

export default function SecurityOverviewPage() {
  return <SecurityOverviewWorkspace />
}
