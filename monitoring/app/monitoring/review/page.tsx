import type { Metadata } from 'next'
import MonitoringReviewWorkspace from '@/components/monitoring-review-workspace'

export const metadata: Metadata = {
  title: 'Review queue telemetry | Folio GST workspace',
  description: 'Human-in-the-loop review speed, queue backlog, reviewer turnaround times, and manual override tracking.',
}

export default function ReviewPage() {
  return <MonitoringReviewWorkspace />
}
