import type { Metadata } from 'next'
import VendorWorkspace from '@/components/vendor-workspace'

export const metadata: Metadata = {
  title: 'Vendors | Folio GST workspace',
  description: 'Review vendor filing reliability, GST invoice errors, and input tax credit exposure.',
}

export default function VendorsPage() {
  return <VendorWorkspace />
}
