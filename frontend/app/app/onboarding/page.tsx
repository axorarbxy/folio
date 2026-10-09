import type { Metadata } from 'next'
import OnboardingFlow from '@/components/onboarding-flow'

export const metadata: Metadata = {
  title: 'Set up your workspace | Folio GST workspace',
  description: 'Set up your GST workspace, language, review rules, and first invoice in Folio.',
}

export default function OnboardingPage() {
  return <OnboardingFlow />
}
