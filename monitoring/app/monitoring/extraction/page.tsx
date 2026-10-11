import type { Metadata } from 'next'
import MonitoringExtractionWorkspace from '@/components/monitoring-extraction-workspace'

export const metadata: Metadata = {
  title: 'Extraction & OCR health | Folio GST workspace',
  description: 'Vision-LLM inference latency, line item precision, and character recognition across GST invoice layouts.',
}

export default function ExtractionPage() {
  return <MonitoringExtractionWorkspace />
}
