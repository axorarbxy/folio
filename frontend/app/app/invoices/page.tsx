import type { Metadata } from 'next'
import InvoiceLibrary from '@/components/invoice-library'

export const metadata: Metadata = {
  title: 'Invoices | Folio GST workspace',
  description: 'Review, validate, and organize your GST invoices in Folio.',
}

export default function InvoicesPage() {
  return <InvoiceLibrary />
}
