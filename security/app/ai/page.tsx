import type { Metadata } from 'next'
import SecurityAiWorkspace from '@/components/security-ai-workspace'

export const metadata: Metadata = {
  title: 'AI Safety & Model Security | Security & Governance | Folio',
  description: 'Deterministic guardrails ensuring AI models extract text without deciding business outcomes or executing arithmetic.',
}

export default function SecurityAiPage() {
  return <SecurityAiWorkspace />
}
