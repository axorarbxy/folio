import type { Metadata } from 'next'
import OverviewWorkspace from '@/components/overview-workspace'

export const metadata: Metadata = {
  title: 'Overview | Folio GST workspace',
  description: 'Review filing health, input tax credit, and invoice exceptions in your Folio GST workspace.',
}

type OverviewPageProps = {
  searchParams: Promise<{ tour?: string; tourStep?: string }>
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const params = await searchParams
  const parsedStep = Number(params.tourStep ?? '0')
  const initialTourStep = Number.isInteger(parsedStep) ? parsedStep : 0
  return <OverviewWorkspace showTour={params.tour === '1'} initialTourStep={initialTourStep} />
}
