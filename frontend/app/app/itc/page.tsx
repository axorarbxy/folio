import type { Metadata } from 'next'
import ItcReconciliation from '@/components/itc-reconciliation'

export const metadata: Metadata = {
  title: 'ITC reconciliation | Folio GST workspace',
  description: 'Compare purchase books with GSTR-2B and source documents to review input tax credit risk.',
}

export default function ItcPage() {
  return <ItcReconciliation />
}
