import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import MonitoringTracesWorkspace from '@/components/monitoring-traces-workspace'

export const metadata: Metadata = {
  title: 'Distributed invoice traces | Folio GST workspace',
  description: 'Execution waterfalls and asynchronous span tracking for individual invoice processing runs in Folio.',
}

export default function TracesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#686b86]">Loading trace explorer...</div>}>
      <MonitoringTracesWorkspace />
    </Suspense>
  )
}
