import type { Metadata } from 'next'
import ExtractionReview from '@/components/extraction-review'

export const metadata: Metadata = {
  title: 'Review extraction | Folio',
  description: 'Review extracted invoice details and validate GST fields in Folio.',
}

export default async function InvoiceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExtractionReview invoiceId={id} />
}
