import type { Metadata } from 'next'
import InvoiceValidation from '@/components/invoice-validation'

export const metadata: Metadata = {
  title: 'Validation results | Folio',
  description: 'Review deterministic GST invoice checks and resolve validation findings in Folio.',
}

export default async function InvoiceValidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InvoiceValidation invoiceId={id} />
}
