import type { Metadata } from 'next'
import UploadWorkspace from '@/components/upload-workspace'

export const metadata: Metadata = {
  title: 'Add invoices | Folio GST workspace',
  description: 'Upload, scan, or forward invoices to your Folio GST workspace.',
}

export default function UploadPage() {
  return <UploadWorkspace />
}
