import type { Metadata } from 'next'
import { Suspense } from 'react'
import MonitoringPipelineWorkspace from '@/components/monitoring-pipeline-workspace'
import { SkeletonPanel } from '@/components/monitoring-kit'

export const metadata: Metadata = {
  title: 'Pipeline stages monitoring | Folio GST workspace',
  description: 'Stage-by-stage throughput, queue lag, and latency percentiles for the invoice processing pipeline.',
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<SkeletonPanel rows={6} />}>
      <MonitoringPipelineWorkspace />
    </Suspense>
  )
}
