import type { Metadata } from 'next'
import SecurityAuditWorkspace from '@/components/security-audit-workspace'

export const metadata: Metadata = {
  title: 'Audit Log Explorer | Security & Governance | Folio',
  description: 'Tamper-evident, cryptographically chained audit trail of all workspace actions, GST edits, and access events.',
}

export default function SecurityAuditPage() {
  return <SecurityAuditWorkspace />
}
