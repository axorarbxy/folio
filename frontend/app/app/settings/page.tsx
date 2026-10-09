import type { Metadata } from 'next'
import SettingsWorkspace, { type SettingsSection } from '@/components/settings-workspace'

export const metadata: Metadata = {
  title: 'Settings | Folio GST workspace',
  description: 'Manage business details, team access, invoice validation, and privacy settings in Folio.',
}

type SettingsPageProps = {
  searchParams: Promise<{ section?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams
  const sectionMap: Record<string, SettingsSection> = {
    team: 'Team & roles',
    validation: 'Validation rules',
    notifications: 'Notifications',
    integrations: 'Integrations',
    display: 'Language & display',
    privacy: 'Data & privacy',
  }
  const initialSection = sectionMap[params.section ?? ''] ?? 'Business profile'
  return <SettingsWorkspace initialSection={initialSection} />
}
