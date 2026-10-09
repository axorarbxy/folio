import type { Metadata } from 'next'
import VendorWorkspace from '@/components/vendor-workspace'

export const metadata: Metadata = {
  title: 'Vendor details | Folio GST workspace',
  description: 'Review vendor risk factors, invoice history, filing patterns, and communications.',
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VendorWorkspace key={id} vendorId={id} />
}
