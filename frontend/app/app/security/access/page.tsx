import type { Metadata } from 'next'
import SecurityAccessWorkspace from '@/components/security-access-workspace'

export const metadata: Metadata = {
  title: 'Access Control & RBAC | Security & Governance | Folio',
  description: 'Manage members, least-privilege roles, MFA enforcement, and capability matrices in Folio.',
}

export default function SecurityAccessPage() {
  return <SecurityAccessWorkspace />
}
