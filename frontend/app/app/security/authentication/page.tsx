import type { Metadata } from 'next'
import SecurityAuthenticationWorkspace from '@/components/security-authentication-workspace'

export const metadata: Metadata = {
  title: 'Authentication & Sessions | Security & Governance | Folio',
  description: 'Enterprise MFA methods, TOTP recovery codes, password policies, active sessions, and IP allowlists in Folio.',
}

export default function SecurityAuthenticationPage() {
  return <SecurityAuthenticationWorkspace />
}
