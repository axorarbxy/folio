export type Status = 'healthy' | 'degraded' | 'down' | 'unknown'

export type Stage = 'Ingest' | 'Preprocess' | 'Read' | 'Validate' | 'Reconcile' | 'Notify'

export interface StageHealth {
  stage: Stage
  status: Status
  throughputPerMin: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  errorRatePct: number
  queueDepth: number
  description: string
  activeWorkers: number
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface AlertItem {
  id: string
  title: string
  severity: Severity
  source: string
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved'
  firedAt: string
  detail: string
  invoiceId?: string
  vendor?: string
}

export interface Incident {
  id: string
  title: string
  impact: Status
  startedAt: string
  resolvedAt?: string
  summary: string
  rootCause?: string
  stageAffected?: Stage
}

export interface DailyMetric {
  date: string
  invoicesProcessed: number
  errorCount: number
  avgLatencyMs: number
  p95LatencyMs: number
  itcReconciledInr: number
  confidenceScorePct: number
  successRatePct: number
}

export interface SystemStatusResult {
  status: 'operational' | 'degraded' | 'outage'
  label: string
  dotColor: string
}

export const STAGES_HEALTH_DATA: StageHealth[] = [
  {
    stage: 'Ingest',
    status: 'healthy',
    throughputPerMin: 142,
    p50Ms: 120,
    p95Ms: 280,
    p99Ms: 420,
    errorRatePct: 0.05,
    queueDepth: 4,
    description: 'Invoice upload via SFTP, Gmail scraper, and manual drag-and-drop',
    activeWorkers: 6,
  },
  {
    stage: 'Preprocess',
    status: 'healthy',
    throughputPerMin: 138,
    p50Ms: 340,
    p95Ms: 650,
    p99Ms: 980,
    errorRatePct: 0.12,
    queueDepth: 8,
    description: 'Deskew, contrast normalization, and multi-page PDF decomposition',
    activeWorkers: 8,
  },
  {
    stage: 'Read',
    status: 'degraded',
    throughputPerMin: 110,
    p50Ms: 1850,
    p95Ms: 4920,
    p99Ms: 7200,
    errorRatePct: 2.8,
    queueDepth: 42,
    description: 'Vision-LLM OCR parsing table items, tax breakdowns, and GSTINs',
    activeWorkers: 14,
  },
  {
    stage: 'Validate',
    status: 'healthy',
    throughputPerMin: 125,
    p50Ms: 210,
    p95Ms: 490,
    p99Ms: 750,
    errorRatePct: 0.2,
    queueDepth: 12,
    description: 'GST rule engine checking math, HSN codes, and place of supply',
    activeWorkers: 6,
  },
  {
    stage: 'Reconcile',
    status: 'healthy',
    throughputPerMin: 118,
    p50Ms: 480,
    p95Ms: 1150,
    p99Ms: 1840,
    errorRatePct: 0.4,
    queueDepth: 15,
    description: '2-way and 3-way ITC matching against GSTN GSTR-2B feed',
    activeWorkers: 10,
  },
  {
    stage: 'Notify',
    status: 'healthy',
    throughputPerMin: 115,
    p50Ms: 95,
    p95Ms: 220,
    p99Ms: 340,
    errorRatePct: 0.01,
    queueDepth: 1,
    description: 'ERP webhook dispatch, WhatsApp alerts, and vendor clarification emails',
    activeWorkers: 4,
  },
]

export const ALERTS_DATA: AlertItem[] = [
  {
    id: 'ALT-1092',
    title: 'Elevated OCR p95 latency on multi-page tax invoices',
    severity: 'critical',
    source: 'Read stage (Vision-LLM)',
    status: 'open',
    firedAt: '11 Oct 2026, 09:42 IST',
    detail: 'p95 latency reached 4,920ms exceeding the 3,500ms SLA threshold. Queue depth spiked to 42 files.',
    invoiceId: 'INV-2026-0418',
    vendor: 'Northstar Supplies',
  },
  {
    id: 'ALT-1091',
    title: 'GSTR-2B API rate limit warning from GSTN sandbox',
    severity: 'high',
    source: 'Reconcile stage (GSTN Gateway)',
    status: 'open',
    firedAt: '11 Oct 2026, 08:30 IST',
    detail: 'Consuming 88% of provisioned requests/sec quota for GSTIN 27AAACN0123M1Z2 during morning sync.',
  },
  {
    id: 'ALT-1090',
    title: 'Confidence score drop on handwritten transport challans',
    severity: 'high',
    source: 'Read stage (Parser)',
    status: 'open',
    firedAt: '10 Oct 2026, 21:15 IST',
    detail: 'Average line-item extraction confidence dipped to 71.4% for Deccan Precision Tools logistics bills.',
    invoiceId: 'INV-2026-0392',
    vendor: 'Aster Office Mart',
  },
  {
    id: 'ALT-1089',
    title: 'Duplicate invoice number collision flag triggered',
    severity: 'medium',
    source: 'Validate stage (Rule Engine)',
    status: 'acknowledged',
    firedAt: '10 Oct 2026, 17:48 IST',
    detail: 'Invoice number INV-2026-0355 previously filed under FY25-26 Q4 detected with matching supplier GSTIN.',
    invoiceId: 'INV-2026-0355',
    vendor: 'Kaveri Components',
  },
  {
    id: 'ALT-1088',
    title: 'HSN code lookup latency increase on 8-digit codes',
    severity: 'medium',
    source: 'Validate stage (CBIC master table)',
    status: 'open',
    firedAt: '10 Oct 2026, 15:20 IST',
    detail: 'External database replica sync delay caused 120ms penalty on commodity code verifications.',
  },
  {
    id: 'ALT-1087',
    title: 'Queue depth backlog warning on Preprocess worker pool',
    severity: 'medium',
    source: 'Preprocess stage',
    status: 'acknowledged',
    firedAt: '10 Oct 2026, 11:05 IST',
    detail: 'Worker thread consumption reached 85% during batch upload of 25 scanned TIFF manifests.',
  },
  {
    id: 'ALT-1086',
    title: 'Sudden rounding variance in CGST/SGST fraction',
    severity: 'low',
    source: 'Validate stage',
    status: 'resolved',
    firedAt: '09 Oct 2026, 19:35 IST',
    detail: 'Minor 48 paisa rounding variance detected on INV-2026-0412; auto-corrected per rule R-402.',
    invoiceId: 'INV-2026-0412',
    vendor: 'Shiva Logistics',
  },
  {
    id: 'ALT-1085',
    title: 'Delayed webhook callback to Zoho Books ERP',
    severity: 'medium',
    source: 'Notify stage',
    status: 'snoozed',
    firedAt: '09 Oct 2026, 14:10 IST',
    detail: 'Destination ERP endpoint responded with HTTP 504 on 3 retry attempts; exponential backoff active.',
  },
  {
    id: 'ALT-1084',
    title: 'Regional font recognition warning on Kannada stamp text',
    severity: 'low',
    source: 'Read stage (OCR)',
    status: 'resolved',
    firedAt: '09 Oct 2026, 10:25 IST',
    detail: 'Auxiliary stamp text on Karnataka supplier bill routed to secondary OCR pass with 99.1% recovery.',
    vendor: 'Deccan Precision Tools',
  },
  {
    id: 'ALT-1083',
    title: 'Invoice file size anomaly detected (>25MB single PDF)',
    severity: 'low',
    source: 'Ingest stage',
    status: 'resolved',
    firedAt: '08 Oct 2026, 16:50 IST',
    detail: 'Incoming supplier batch contained uncompressed 300dpi scan; compressed via serverless pipeline.',
  },
  {
    id: 'ALT-1082',
    title: 'Filing window countdown: GSTR-3B due in 9 days',
    severity: 'info',
    source: 'Filing Sentinel',
    status: 'open',
    firedAt: '08 Oct 2026, 09:00 IST',
    detail: 'Filing deadline for period April 2026 is approaching on 20 May 2026. 3 invoices require action.',
  },
  {
    id: 'ALT-1081',
    title: 'GSTR-2B daily incremental delta synchronized',
    severity: 'info',
    source: 'Reconcile stage',
    status: 'resolved',
    firedAt: '07 Oct 2026, 23:30 IST',
    detail: '142 supplier line items ingested successfully from GST portal with zero network packet drops.',
  },
  {
    id: 'ALT-1080',
    title: 'Automatic tax ledger mismatch flagged on RCM purchase',
    severity: 'medium',
    source: 'Validate stage',
    status: 'resolved',
    firedAt: '07 Oct 2026, 13:12 IST',
    detail: 'Reverse Charge Mechanism flag missing on freight provider invoice; flagged for manual signoff.',
    invoiceId: 'INV-2026-0388',
    vendor: 'Zen Logistics',
  },
  {
    id: 'ALT-1079',
    title: 'SSL certificate renewal scheduled for GSTN bridge',
    severity: 'info',
    source: 'Infrastructure',
    status: 'resolved',
    firedAt: '06 Oct 2026, 04:00 IST',
    detail: 'mTLS certificate rotation completed cleanly with zero downtime on secure GST gateway tunnels.',
  },
]

export const INCIDENTS_DATA: Incident[] = [
  {
    id: 'INC-2026-05',
    title: 'Read stage OCR worker pod memory leak during peak month-end surge',
    impact: 'degraded',
    startedAt: '08 Apr 2026, 14:30 IST',
    resolvedAt: '08 Apr 2026, 16:15 IST',
    summary: 'Memory footprint in PyTorch Vision worker pods grew unboundedly on high-resolution TIFF images, causing OCR p95 latency to peak at 8.4 seconds.',
    rootCause: 'Unreleased buffer reference in image tiling utility for scans exceeding 4000x4000 pixels.',
    stageAffected: 'Read',
  },
  {
    id: 'INC-2026-04',
    title: 'GSTN portal authentication timeout affecting GSTR-2B automated download',
    impact: 'down',
    startedAt: '24 Mar 2026, 09:10 IST',
    resolvedAt: '24 Mar 2026, 11:45 IST',
    summary: 'GST portal API gateway returned persistent 502 Bad Gateway responses for OTP authorization and GSTR-2B payload download across all tax accounts.',
    rootCause: 'GSTN upstream sandbox scheduled maintenance window overrun during tax quarter closing.',
    stageAffected: 'Reconcile',
  },
  {
    id: 'INC-2026-03',
    title: 'Rule engine schema validation regression on Special Economic Zone (SEZ) invoices',
    impact: 'degraded',
    startedAt: '12 Mar 2026, 18:20 IST',
    resolvedAt: '12 Mar 2026, 19:50 IST',
    summary: 'Valid SEZ supplier invoices without IGST payment were incorrectly flagged with rule code R-309 (Inter-state zero-rated mismatch).',
    rootCause: 'Missing lookup exception in GST rule engine version v2.4.1 for SEZ units with LUT bond numbers.',
    stageAffected: 'Validate',
  },
  {
    id: 'INC-2026-02',
    title: 'Invoice OCR model cold-start latency spike after new weights rollout',
    impact: 'degraded',
    startedAt: '18 Feb 2026, 11:05 IST',
    resolvedAt: '18 Feb 2026, 12:40 IST',
    summary: 'Model serving container autoscaling lag led to 5-minute cold starts on newly spun up inference instances.',
    rootCause: 'Pre-warming daemon not initialized on secondary GPU worker node group in Mumbai region (ap-south-1).',
    stageAffected: 'Read',
  },
  {
    id: 'INC-2026-01',
    title: 'Webhook delivery failure to Zoho Books accounting connector',
    impact: 'degraded',
    startedAt: '28 Jan 2026, 16:00 IST',
    resolvedAt: '28 Jan 2026, 17:15 IST',
    summary: 'Reconciled invoice notification payloads dropped due to OAuth token expiry on third-party webhook bridge.',
    rootCause: 'Token refresh cron job crashed due to clock drift on worker instance.',
    stageAffected: 'Notify',
  },
]

export const DAILY_METRICS_DATA: DailyMetric[] = [
  { date: '12 Sep 2026', invoicesProcessed: 320, errorCount: 4, avgLatencyMs: 640, p95LatencyMs: 1420, itcReconciledInr: 1845000, confidenceScorePct: 98.4, successRatePct: 98.7 },
  { date: '13 Sep 2026', invoicesProcessed: 310, errorCount: 3, avgLatencyMs: 620, p95LatencyMs: 1390, itcReconciledInr: 1720000, confidenceScorePct: 98.6, successRatePct: 99.0 },
  { date: '14 Sep 2026', invoicesProcessed: 280, errorCount: 2, avgLatencyMs: 590, p95LatencyMs: 1340, itcReconciledInr: 1610000, confidenceScorePct: 98.9, successRatePct: 99.3 },
  { date: '15 Sep 2026', invoicesProcessed: 340, errorCount: 5, avgLatencyMs: 680, p95LatencyMs: 1510, itcReconciledInr: 1980000, confidenceScorePct: 98.1, successRatePct: 98.5 },
  { date: '16 Sep 2026', invoicesProcessed: 360, errorCount: 4, avgLatencyMs: 670, p95LatencyMs: 1480, itcReconciledInr: 2150000, confidenceScorePct: 98.3, successRatePct: 98.9 },
  { date: '17 Sep 2026', invoicesProcessed: 390, errorCount: 6, avgLatencyMs: 710, p95LatencyMs: 1590, itcReconciledInr: 2310000, confidenceScorePct: 97.9, successRatePct: 98.5 },
  { date: '18 Sep 2026', invoicesProcessed: 420, errorCount: 7, avgLatencyMs: 740, p95LatencyMs: 1680, itcReconciledInr: 2540000, confidenceScorePct: 97.8, successRatePct: 98.3 },
  { date: '19 Sep 2026', invoicesProcessed: 440, errorCount: 8, avgLatencyMs: 790, p95LatencyMs: 1750, itcReconciledInr: 2780000, confidenceScorePct: 97.5, successRatePct: 98.2 },
  { date: '20 Sep 2026', invoicesProcessed: 480, errorCount: 9, avgLatencyMs: 820, p95LatencyMs: 1890, itcReconciledInr: 3120000, confidenceScorePct: 97.2, successRatePct: 98.1 },
  { date: '21 Sep 2026', invoicesProcessed: 390, errorCount: 4, avgLatencyMs: 700, p95LatencyMs: 1540, itcReconciledInr: 2240000, confidenceScorePct: 98.2, successRatePct: 99.0 },
  { date: '22 Sep 2026', invoicesProcessed: 350, errorCount: 3, avgLatencyMs: 630, p95LatencyMs: 1410, itcReconciledInr: 1950000, confidenceScorePct: 98.6, successRatePct: 99.1 },
  { date: '23 Sep 2026', invoicesProcessed: 340, errorCount: 2, avgLatencyMs: 610, p95LatencyMs: 1380, itcReconciledInr: 1890000, confidenceScorePct: 98.7, successRatePct: 99.4 },
  { date: '24 Sep 2026', invoicesProcessed: 330, errorCount: 12, avgLatencyMs: 1120, p95LatencyMs: 3400, itcReconciledInr: 1450000, confidenceScorePct: 96.1, successRatePct: 96.4 },
  { date: '25 Sep 2026', invoicesProcessed: 370, errorCount: 5, avgLatencyMs: 690, p95LatencyMs: 1520, itcReconciledInr: 2100000, confidenceScorePct: 98.2, successRatePct: 98.6 },
  { date: '26 Sep 2026', invoicesProcessed: 410, errorCount: 6, avgLatencyMs: 720, p95LatencyMs: 1600, itcReconciledInr: 2450000, confidenceScorePct: 98.0, successRatePct: 98.5 },
  { date: '27 Sep 2026', invoicesProcessed: 430, errorCount: 5, avgLatencyMs: 710, p95LatencyMs: 1580, itcReconciledInr: 2620000, confidenceScorePct: 98.3, successRatePct: 98.8 },
  { date: '28 Sep 2026', invoicesProcessed: 460, errorCount: 7, avgLatencyMs: 750, p95LatencyMs: 1690, itcReconciledInr: 2890000, confidenceScorePct: 97.9, successRatePct: 98.5 },
  { date: '29 Sep 2026', invoicesProcessed: 490, errorCount: 8, avgLatencyMs: 780, p95LatencyMs: 1780, itcReconciledInr: 3200000, confidenceScorePct: 97.7, successRatePct: 98.4 },
  { date: '30 Sep 2026', invoicesProcessed: 520, errorCount: 11, avgLatencyMs: 860, p95LatencyMs: 1980, itcReconciledInr: 3580000, confidenceScorePct: 97.1, successRatePct: 97.9 },
  { date: '01 Oct 2026', invoicesProcessed: 380, errorCount: 4, avgLatencyMs: 660, p95LatencyMs: 1470, itcReconciledInr: 2190000, confidenceScorePct: 98.5, successRatePct: 98.9 },
  { date: '02 Oct 2026', invoicesProcessed: 290, errorCount: 2, avgLatencyMs: 580, p95LatencyMs: 1310, itcReconciledInr: 1640000, confidenceScorePct: 99.1, successRatePct: 99.3 },
  { date: '03 Oct 2026', invoicesProcessed: 360, errorCount: 4, avgLatencyMs: 640, p95LatencyMs: 1420, itcReconciledInr: 2080000, confidenceScorePct: 98.4, successRatePct: 98.9 },
  { date: '04 Oct 2026', invoicesProcessed: 400, errorCount: 5, avgLatencyMs: 690, p95LatencyMs: 1530, itcReconciledInr: 2390000, confidenceScorePct: 98.2, successRatePct: 98.8 },
  { date: '05 Oct 2026', invoicesProcessed: 450, errorCount: 6, avgLatencyMs: 730, p95LatencyMs: 1650, itcReconciledInr: 2750000, confidenceScorePct: 98.0, successRatePct: 98.7 },
  { date: '06 Oct 2026', invoicesProcessed: 470, errorCount: 7, avgLatencyMs: 760, p95LatencyMs: 1720, itcReconciledInr: 2910000, confidenceScorePct: 97.8, successRatePct: 98.5 },
  { date: '07 Oct 2026', invoicesProcessed: 510, errorCount: 8, avgLatencyMs: 810, p95LatencyMs: 1840, itcReconciledInr: 3340000, confidenceScorePct: 97.4, successRatePct: 98.4 },
  { date: '08 Oct 2026', invoicesProcessed: 530, errorCount: 14, avgLatencyMs: 1040, p95LatencyMs: 2750, itcReconciledInr: 3620000, confidenceScorePct: 96.5, successRatePct: 97.4 },
  { date: '09 Oct 2026', invoicesProcessed: 480, errorCount: 9, avgLatencyMs: 830, p95LatencyMs: 1920, itcReconciledInr: 3100000, confidenceScorePct: 97.6, successRatePct: 98.1 },
  { date: '10 Oct 2026', invoicesProcessed: 460, errorCount: 13, avgLatencyMs: 990, p95LatencyMs: 2450, itcReconciledInr: 2940000, confidenceScorePct: 96.9, successRatePct: 97.2 },
  { date: '11 Oct 2026', invoicesProcessed: 240, errorCount: 7, avgLatencyMs: 910, p95LatencyMs: 2310, itcReconciledInr: 1520000, confidenceScorePct: 97.1, successRatePct: 97.1 },
]

export function getSystemStatus(): SystemStatusResult {
  const hasDown = STAGES_HEALTH_DATA.some((s) => s.status === 'down')
  const hasDegraded = STAGES_HEALTH_DATA.some((s) => s.status === 'degraded')

  if (hasDown) {
    return {
      status: 'outage',
      label: 'Outage detected',
      dotColor: '#a24650',
    }
  }

  if (hasDegraded) {
    return {
      status: 'degraded',
      label: 'Degraded pipeline performance',
      dotColor: '#cf9c50',
    }
  }

  return {
    status: 'operational',
    label: 'All systems operational',
    dotColor: '#378875',
  }
}

export function getStagesHealth(statusOverride?: 'operational' | 'degraded' | 'outage'): StageHealth[] {
  if (statusOverride === 'operational') {
    return STAGES_HEALTH_DATA.map((s) => ({
      ...s,
      status: 'healthy' as Status,
      p95Ms: s.stage === 'Read' ? 1850 : s.p95Ms,
      errorRatePct: s.stage === 'Read' ? 0.3 : s.errorRatePct,
      queueDepth: s.stage === 'Read' ? 6 : s.queueDepth,
    }))
  }
  if (statusOverride === 'outage') {
    return STAGES_HEALTH_DATA.map((s) => {
      if (s.stage === 'Reconcile') {
        return {
          ...s,
          status: 'down' as Status,
          errorRatePct: 98.5,
          queueDepth: 184,
          p95Ms: 12400,
        }
      }
      return s
    })
  }
  return STAGES_HEALTH_DATA
}

export function getAlerts(): AlertItem[] {
  return ALERTS_DATA
}

export function getIncidents(): Incident[] {
  return INCIDENTS_DATA
}

export function getDailyMetrics(): DailyMetric[] {
  return DAILY_METRICS_DATA
}

export interface SystemBannerInfo {
  status: 'operational' | 'degraded' | 'outage'
  title: string
  description: string
  lastChecked: string
  incidentId?: string
  incidentTitle?: string
  incidentLink?: string
}

export const BANNER_STATES: Record<'operational' | 'degraded' | 'outage', SystemBannerInfo> = {
  operational: {
    status: 'operational',
    title: 'All systems operational',
    description: 'All 6 pipeline stages are running within SLA limits. Zero active service degradations or queue backlogs.',
    lastChecked: 'Today at 10:28 IST',
  },
  degraded: {
    status: 'degraded',
    title: 'Degraded: Reading is slower than usual',
    description: 'Vision-LLM OCR p95 latency elevated to 4,920ms on multi-page tax invoices. Ingestion queue depth is at 42 files.',
    lastChecked: 'Today at 10:28 IST',
    incidentId: 'INC-2026-05',
    incidentTitle: 'Read stage OCR worker pod memory leak',
    incidentLink: '/app/monitoring/incidents#INC-2026-05',
  },
  outage: {
    status: 'outage',
    title: 'Outage: GSTR-2B sync interrupted',
    description: 'Upstream GST portal API gateway returned 502 Bad Gateway. Automated reconciliation paused for all tax accounts.',
    lastChecked: 'Today at 10:28 IST',
    incidentId: 'INC-2026-04',
    incidentTitle: 'GSTN portal authentication timeout',
    incidentLink: '/app/monitoring/incidents#INC-2026-04',
  },
}

export function getSystemBannerInfo(status?: 'operational' | 'degraded' | 'outage'): SystemBannerInfo {
  if (status) return BANNER_STATES[status]
  const currentStatus = getSystemStatus().status
  return BANNER_STATES[currentStatus]
}

export interface AITrustScorecard {
  extractionAccuracy: {
    value: number
    delta7d: number
    note: string
  }
  confidenceCalibration: {
    value: number
    delta7d: number
    note: string
  }
  humanCorrectionRate: {
    value: number
    delta7d: number
    note: string
  }
}

export const AI_TRUST_SCORECARD_DATA: AITrustScorecard = {
  extractionAccuracy: {
    value: 97.4,
    delta7d: 0.4,
    note: 'Fields matching ground truth',
  },
  confidenceCalibration: {
    value: 94.8,
    delta7d: 1.2,
    note: 'Prediction vs actual accuracy',
  },
  humanCorrectionRate: {
    value: 5.8,
    delta7d: -0.6,
    note: 'Invoices requiring manual edits',
  },
}

export function getAITrustScorecard(): AITrustScorecard {
  return AI_TRUST_SCORECARD_DATA
}

export interface FilingWatchInfo {
  period: string
  filingType: string
  dueDate: string
  daysRemaining: number
  itcAtRiskInr: number
  itcClaimableInr: number
  totalInvoices: number
  matchedInvoices: number
  readinessPct: number
  unresolvedCount: number
}

export const FILING_WATCH_DATA: FilingWatchInfo = {
  period: 'April 2026',
  filingType: 'GSTR-3B',
  dueDate: '20 May 2026',
  daysRemaining: 9,
  itcAtRiskInr: 6250,
  itcClaimableInr: 284200,
  totalInvoices: 48,
  matchedInvoices: 45,
  readinessPct: 94,
  unresolvedCount: 2,
}

export function getFilingWatchInfo(): FilingWatchInfo {
  return FILING_WATCH_DATA
}

export interface MonitoringActivityEvent {
  id: string
  title: string
  detail: string
  timeAgo: string
  timestamp: string
  category: 'rule' | 'reader' | 'vendor' | 'reconciliation' | 'system' | 'alert'
}

export const RECENT_ACTIVITY_DATA: MonitoringActivityEvent[] = [
  {
    id: 'act-1',
    title: 'Rule table refreshed',
    detail: 'CBIC notification 04/2026 tariff updates applied to HSN validator',
    timeAgo: '10 min ago',
    timestamp: '11 Oct 2026, 10:18 IST',
    category: 'rule',
  },
  {
    id: 'act-2',
    title: 'Reader latency recovered',
    detail: 'OCR p95 stabilized to 1,820ms on single-page tax invoices',
    timeAgo: '24 min ago',
    timestamp: '11 Oct 2026, 10:04 IST',
    category: 'reader',
  },
  {
    id: 'act-3',
    title: 'Vendor Aster Office Mart flagged',
    detail: 'GSTIN checksum mismatch detected on INV-2026-0392',
    timeAgo: '45 min ago',
    timestamp: '11 Oct 2026, 09:43 IST',
    category: 'vendor',
  },
  {
    id: 'act-4',
    title: 'Batch auto-accepted',
    detail: '18 invoices from Northstar Supplies matched with GSTR-2B feed',
    timeAgo: '1 hr ago',
    timestamp: '11 Oct 2026, 09:28 IST',
    category: 'reconciliation',
  },
  {
    id: 'act-5',
    title: 'Alert acknowledged',
    detail: 'ALT-1089 duplicate invoice collision signed off by Aditi Mehta',
    timeAgo: '2 hrs ago',
    timestamp: '11 Oct 2026, 08:30 IST',
    category: 'alert',
  },
  {
    id: 'act-6',
    title: 'OCR worker node scaled up',
    detail: 'Vision-LLM pod count increased to 14 in ap-south-1 Mumbai zone',
    timeAgo: '3 hrs ago',
    timestamp: '11 Oct 2026, 07:15 IST',
    category: 'system',
  },
  {
    id: 'act-7',
    title: 'Preprocess queue cleared',
    detail: '25 scanned TIFF manifests ingested and deskewed successfully',
    timeAgo: '4 hrs ago',
    timestamp: '11 Oct 2026, 06:10 IST',
    category: 'system',
  },
  {
    id: 'act-8',
    title: 'GSTR-2B daily delta synchronized',
    detail: '142 supplier line items ingested from GST portal with zero drops',
    timeAgo: '6 hrs ago',
    timestamp: '11 Oct 2026, 04:20 IST',
    category: 'reconciliation',
  },
  {
    id: 'act-9',
    title: 'Vendor Kaveri Components approved',
    detail: 'Input tax credit claim of INR 48,200 validated and approved',
    timeAgo: '8 hrs ago',
    timestamp: '11 Oct 2026, 02:15 IST',
    category: 'vendor',
  },
  {
    id: 'act-10',
    title: 'System health check passed',
    detail: 'All 6 pipeline stages emitting green heartbeats to sentinel daemon',
    timeAgo: '12 hrs ago',
    timestamp: '10 Oct 2026, 22:30 IST',
    category: 'system',
  },
]

export function getRecentActivityEvents(): MonitoringActivityEvent[] {
  return RECENT_ACTIVITY_DATA
}

export interface MonitoringOverviewKPIs {
  invoicesProcessedToday: {
    value: string
    note: string
    sparkline: number[]
  }
  medianProcessingTime: {
    value: string
    note: string
    sparkline: number[]
  }
  autoAcceptedRate: {
    value: string
    note: string
    sparkline: number[]
  }
  openAlerts: {
    value: string
    note: string
    sparkline: number[]
  }
}

export function getOverviewKPIs(): MonitoringOverviewKPIs {
  const sparklineInvoices = [180, 220, 260, 240, 310, 340, 290, 360, 410, 440, 480, 520, 460, 240]
  const sparklineLatency = [680, 620, 590, 640, 710, 740, 790, 820, 700, 630, 860, 1040, 990, 910]
  const sparklineAccepted = [98.4, 98.6, 98.9, 98.1, 98.3, 97.9, 97.8, 97.5, 97.2, 98.2, 97.1, 96.5, 96.9, 97.1]
  const sparklineAlerts = [1, 2, 1, 3, 2, 4, 3, 5, 2, 1, 6, 7, 5, 3]

  return {
    invoicesProcessedToday: {
      value: '240 invoices',
      note: '+14% vs same time yesterday',
      sparkline: sparklineInvoices,
    },
    medianProcessingTime: {
      value: '2.8 seconds',
      note: 'p95: 4.9s on Read OCR',
      sparkline: sparklineLatency,
    },
    autoAcceptedRate: {
      value: '94.2%',
      note: 'Fields not needing review',
      sparkline: sparklineAccepted,
    },
    openAlerts: {
      value: '3 active',
      note: '1 critical · 2 high severity',
      sparkline: sparklineAlerts,
    },
  }
}

export interface PipelineEdge {
  from: Stage
  to: Stage
  volumePerMin: number
  transferPct: number
}

export const PIPELINE_EDGES_DATA: PipelineEdge[] = [
  { from: 'Ingest', to: 'Preprocess', volumePerMin: 138, transferPct: 97.2 },
  { from: 'Preprocess', to: 'Read', volumePerMin: 135, transferPct: 97.8 },
  { from: 'Read', to: 'Validate', volumePerMin: 110, transferPct: 81.5 },
  { from: 'Validate', to: 'Reconcile', volumePerMin: 108, transferPct: 98.2 },
  { from: 'Reconcile', to: 'Notify', volumePerMin: 106, transferPct: 98.1 },
]

export function getPipelineEdges(): PipelineEdge[] {
  return PIPELINE_EDGES_DATA
}

export interface StageTimeSeriesPoint {
  time: string
  p50: number
  p95: number
  throughput: number
  queueDepth: number
}

export interface StageErrorTypeBreakdown {
  errorType: string
  count: number
  percentage: number
  note: string
}

export interface StageDetailTelemetry {
  stage: Stage
  timeSeries: StageTimeSeriesPoint[]
  errorTypes: StageErrorTypeBreakdown[]
}

const HOURS_LABELS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
]

export function getStageDetailTelemetry(stage: Stage): StageDetailTelemetry {
  const isRead = stage === 'Read'
  const isIngest = stage === 'Ingest'
  const isPreprocess = stage === 'Preprocess'
  const isValidate = stage === 'Validate'
  const isReconcile = stage === 'Reconcile'

  const baseP50 = isRead ? 1850 : isPreprocess ? 340 : isValidate ? 210 : isReconcile ? 480 : 120
  const baseP95 = isRead ? 4920 : isPreprocess ? 650 : isValidate ? 490 : isReconcile ? 1150 : 280

  const timeSeries: StageTimeSeriesPoint[] = HOURS_LABELS.map((hour, idx) => {
    // Add realistic peak around morning 09:00-11:00 IST
    const isPeak = idx >= 9 && idx <= 12
    const peakFactor = isPeak ? 1.35 : 0.95 + (idx % 4) * 0.05
    const queueSpike = isRead && idx >= 9 ? Math.min(42, 10 + (idx - 8) * 8) : Math.max(2, (idx % 6) + 1)

    return {
      time: hour,
      p50: Math.round(baseP50 * peakFactor),
      p95: Math.round(baseP95 * (isRead && isPeak ? 1.45 : peakFactor)),
      throughput: Math.round((isRead ? 110 : 135) * (isPeak ? 1.25 : 0.9)),
      queueDepth: queueSpike,
    }
  })

  let errorTypes: StageErrorTypeBreakdown[] = []

  if (isRead) {
    errorTypes = [
      { errorType: 'Vision model timeout (>5s)', count: 28, percentage: 38, note: 'Multi-page 4000x4000 TIFF scans' },
      { errorType: 'Unreadable image contrast', count: 21, percentage: 29, note: 'Warehouse carbon-copy bills' },
      { errorType: 'Table layout parsing failure', count: 15, percentage: 21, note: 'Merged line item columns' },
      { errorType: 'Regional stamp occlusion', count: 9, percentage: 12, note: 'Stamps masking GSTIN footer' },
    ]
  } else if (isValidate) {
    errorTypes = [
      { errorType: 'CBIC HSN code obsolete', count: 18, percentage: 42, note: '4-digit/deprecated 2026 codes' },
      { errorType: 'CGST/SGST fraction variance', count: 12, percentage: 28, note: 'Fractional rounding delta > ₹1' },
      { errorType: 'Place of Supply state code mismatch', count: 8, percentage: 19, note: 'Inter-state vs intra-state' },
      { errorType: 'Missing Reverse Charge flag', count: 5, percentage: 11, note: 'Freight transport services' },
    ]
  } else if (isReconcile) {
    errorTypes = [
      { errorType: 'Supplier bill missing in GSTR-2B', count: 24, percentage: 52, note: 'Supplier GSTR-1 unfiled' },
      { errorType: 'Taxable value discrepancy > ₹10', count: 14, percentage: 30, note: 'Credit note or discount delta' },
      { errorType: 'Filing period mismatch', count: 8, percentage: 18, note: 'March vs April filing cycle' },
    ]
  } else if (isPreprocess) {
    errorTypes = [
      { errorType: 'Corrupted PDF raster stream', count: 6, percentage: 50, note: 'Truncated network uploads' },
      { errorType: 'Excessive deskew angle (>45°)', count: 4, percentage: 33, note: 'Angled smartphone snapshots' },
      { errorType: 'Unsupported colour profile (CMYK)', count: 2, percentage: 17, note: 'Print-press proofs' },
    ]
  } else {
    errorTypes = [
      { errorType: 'Connection reset by SFTP peer', count: 4, percentage: 57, note: 'Client network timeout' },
      { errorType: 'Payload size exceeded 25MB', count: 2, percentage: 29, note: 'Uncompressed raw scan batch' },
      { errorType: 'MIME-type detection mismatch', count: 1, percentage: 14, note: 'Renamed binary attachment' },
    ]
  }

  return {
    stage,
    timeSeries,
    errorTypes,
  }
}

export interface FailedDocumentItem {
  id: string
  invoiceNumber: string
  stage: Stage
  error: string
  retries: string
  retriesCount: number
  maxRetries: number
  vendor: string
  failedAt: string
  taxableAmountInr: number
  traceId: string
  status: 'failed' | 'retrying' | 'resolved'
}

export const FAILED_DOCUMENTS_DATA: FailedDocumentItem[] = [
  {
    id: 'fail-1',
    invoiceNumber: 'INV-2026-0418',
    stage: 'Read',
    error: 'Vision OCR inference timeout (5,000ms exceeded on 4-page scanned TIFF)',
    retries: '2/3',
    retriesCount: 2,
    maxRetries: 3,
    vendor: 'Northstar Supplies',
    failedAt: '11 Oct 2026, 09:42 IST',
    taxableAmountInr: 184500,
    traceId: 'TRC-9821-418',
    status: 'failed',
  },
  {
    id: 'fail-2',
    invoiceNumber: 'INV-2026-0422',
    stage: 'Validate',
    error: 'CBIC HSN validation error: 8-digit commodity code 84713010 is obsolete for FY26',
    retries: '1/3',
    retriesCount: 1,
    maxRetries: 3,
    vendor: 'Deccan Precision Tools',
    failedAt: '11 Oct 2026, 09:15 IST',
    taxableAmountInr: 64200,
    traceId: 'TRC-9820-422',
    status: 'failed',
  },
  {
    id: 'fail-3',
    invoiceNumber: 'INV-2026-0415',
    stage: 'Read',
    error: 'Unreadable image contrast below 30% on warehouse carbon-copy bill scan',
    retries: '3/3',
    retriesCount: 3,
    maxRetries: 3,
    vendor: 'Aster Office Mart',
    failedAt: '11 Oct 2026, 08:50 IST',
    taxableAmountInr: 28900,
    traceId: 'TRC-9819-415',
    status: 'failed',
  },
  {
    id: 'fail-4',
    invoiceNumber: 'INV-2026-0398',
    stage: 'Reconcile',
    error: 'GSTN GSTR-2B sync: supplier invoice missing in tax portal feed for April period',
    retries: '2/3',
    retriesCount: 2,
    maxRetries: 3,
    vendor: 'Shiva Logistics',
    failedAt: '11 Oct 2026, 07:40 IST',
    taxableAmountInr: 92400,
    traceId: 'TRC-9818-398',
    status: 'failed',
  },
  {
    id: 'fail-5',
    invoiceNumber: 'INV-2026-0374',
    stage: 'Validate',
    error: 'Rounding variance: CGST/SGST fractional sum differs by ₹1.45 from total line sum',
    retries: '1/3',
    retriesCount: 1,
    maxRetries: 3,
    vendor: 'Kaveri Components',
    failedAt: '11 Oct 2026, 06:20 IST',
    taxableAmountInr: 34800,
    traceId: 'TRC-9817-374',
    status: 'failed',
  },
]

export function getFailedDocuments(): FailedDocumentItem[] {
  return FAILED_DOCUMENTS_DATA
}

export interface CapacityPool {
  name: string
  stage: Stage
  activeUnits: number
  totalUnits: number
  utilizationPct: number
  unitType: string
}

export interface PipelineCapacitySummary {
  pools: CapacityPool[]
  queueBacklog: number
  drainRatePerMin: number
  estimatedClearMinutes: number
  autoscalingStatus: string
}

export const PIPELINE_CAPACITY_DATA: PipelineCapacitySummary = {
  pools: [
    { name: 'SFTP & Upload Ingest Pool', stage: 'Ingest', activeUnits: 6, totalUnits: 8, utilizationPct: 75, unitType: 'threads' },
    { name: 'Image Preprocess Workers', stage: 'Preprocess', activeUnits: 7, totalUnits: 8, utilizationPct: 88, unitType: 'workers' },
    { name: 'Vision-LLM OCR GPU Pods', stage: 'Read', activeUnits: 14, totalUnits: 16, utilizationPct: 88, unitType: 'GPU pods' },
    { name: 'Rule Engine Evaluation Daemon', stage: 'Validate', activeUnits: 6, totalUnits: 10, utilizationPct: 60, unitType: 'threads' },
    { name: 'GSTN Gateway Sync Reconcilers', stage: 'Reconcile', activeUnits: 10, totalUnits: 12, utilizationPct: 83, unitType: 'workers' },
    { name: 'Webhook & ERP Dispatch Pool', stage: 'Notify', activeUnits: 3, totalUnits: 6, utilizationPct: 50, unitType: 'threads' },
  ],
  queueBacklog: 82,
  drainRatePerMin: 14.2,
  estimatedClearMinutes: 6,
  autoscalingStatus: 'Autoscaler warm: +4 GPU pods ready on demand',
}

export function getPipelineCapacity(): PipelineCapacitySummary {
  return PIPELINE_CAPACITY_DATA
}

export interface ExtractionKPISummary {
  fieldAccuracy: { value: number; delta: number; sparkline: number[] }
  autoAcceptRate: { value: number; delta: number; sparkline: number[] }
  humanCorrectionRate: { value: number; delta: number; sparkline: number[] }
  avgConfidence: { value: number; delta: number; sparkline: number[] }
}

export function getExtractionKPIs(timeRange: string = '24h'): ExtractionKPISummary {
  if (timeRange === '1h') {
    return {
      fieldAccuracy: { value: 97.6, delta: 0.2, sparkline: [97.2, 97.4, 97.5, 97.3, 97.6] },
      autoAcceptRate: { value: 94.6, delta: 0.4, sparkline: [93.8, 94.1, 94.2, 94.5, 94.6] },
      humanCorrectionRate: { value: 5.4, delta: -0.4, sparkline: [6.2, 5.9, 5.8, 5.5, 5.4] },
      avgConfidence: { value: 95.1, delta: 0.3, sparkline: [94.6, 94.8, 94.9, 95.0, 95.1] },
    }
  }
  if (timeRange === '7d') {
    return {
      fieldAccuracy: { value: 97.2, delta: 0.5, sparkline: [96.5, 96.8, 96.9, 97.1, 97.2] },
      autoAcceptRate: { value: 93.9, delta: 0.9, sparkline: [92.5, 93.1, 93.4, 93.8, 93.9] },
      humanCorrectionRate: { value: 6.1, delta: -0.9, sparkline: [7.5, 6.9, 6.6, 6.2, 6.1] },
      avgConfidence: { value: 94.5, delta: 1.1, sparkline: [93.2, 93.8, 94.1, 94.3, 94.5] },
    }
  }
  if (timeRange === '30d') {
    return {
      fieldAccuracy: { value: 96.9, delta: 1.4, sparkline: [95.5, 95.9, 96.2, 96.6, 96.9] },
      autoAcceptRate: { value: 93.2, delta: 1.8, sparkline: [91.4, 92.0, 92.5, 92.9, 93.2] },
      humanCorrectionRate: { value: 6.8, delta: -1.8, sparkline: [8.6, 7.9, 7.4, 7.1, 6.8] },
      avgConfidence: { value: 94.0, delta: 1.9, sparkline: [92.1, 92.8, 93.3, 93.7, 94.0] },
    }
  }
  // Default 24h
  return {
    fieldAccuracy: { value: 97.4, delta: 0.4, sparkline: [96.8, 97.0, 97.1, 97.3, 97.2, 97.4] },
    autoAcceptRate: { value: 94.2, delta: 0.8, sparkline: [92.8, 93.4, 93.6, 94.0, 93.9, 94.2] },
    humanCorrectionRate: { value: 5.8, delta: -0.6, sparkline: [7.2, 6.6, 6.4, 6.0, 6.1, 5.8] },
    avgConfidence: { value: 94.8, delta: 1.2, sparkline: [93.1, 93.6, 94.0, 94.2, 94.5, 94.8] },
  }
}

export interface CalibrationPoint {
  bucket: string
  confidence: number
  actualAccuracy: number
  idealAccuracy: number
  sampleSize: number
}

export function getCalibrationData(): CalibrationPoint[] {
  return [
    { bucket: '50-60%', confidence: 55, actualAccuracy: 54.8, idealAccuracy: 55, sampleSize: 320 },
    { bucket: '60-70%', confidence: 65, actualAccuracy: 64.2, idealAccuracy: 65, sampleSize: 640 },
    { bucket: '70-80%', confidence: 75, actualAccuracy: 76.4, idealAccuracy: 75, sampleSize: 1280 },
    { bucket: '80-85%', confidence: 82.5, actualAccuracy: 83.9, idealAccuracy: 82.5, sampleSize: 2150 },
    { bucket: '85-90%', confidence: 87.5, actualAccuracy: 88.6, idealAccuracy: 87.5, sampleSize: 4320 },
    { bucket: '90-95%', confidence: 92.5, actualAccuracy: 93.4, idealAccuracy: 92.5, sampleSize: 8640 },
    { bucket: '95-100%', confidence: 97.5, actualAccuracy: 98.6, idealAccuracy: 97.5, sampleSize: 14890 },
  ]
}

export interface ConfidenceHistogramBucket {
  range: string
  minConfidence: number
  maxConfidence: number
  fieldCount: number
  percentage: number
}

export const CONFIDENCE_HISTOGRAM_DATA: ConfidenceHistogramBucket[] = [
  { range: '50-60%', minConfidence: 50, maxConfidence: 60, fieldCount: 380, percentage: 1.2 },
  { range: '60-70%', minConfidence: 60, maxConfidence: 70, fieldCount: 760, percentage: 2.4 },
  { range: '70-75%', minConfidence: 70, maxConfidence: 75, fieldCount: 1140, percentage: 3.6 },
  { range: '75-80%', minConfidence: 75, maxConfidence: 80, fieldCount: 1520, percentage: 4.8 },
  { range: '80-85%', minConfidence: 80, maxConfidence: 85, fieldCount: 2600, percentage: 8.2 },
  { range: '85-90%', minConfidence: 85, maxConfidence: 90, fieldCount: 5200, percentage: 16.4 },
  { range: '90-95%', minConfidence: 90, maxConfidence: 95, fieldCount: 9070, percentage: 28.6 },
  { range: '95-100%', minConfidence: 95, maxConfidence: 100, fieldCount: 11030, percentage: 34.8 },
]

export function getConfidenceDistribution(): ConfidenceHistogramBucket[] {
  return CONFIDENCE_HISTOGRAM_DATA
}

export interface FieldAccuracyItem {
  field: string
  accuracy: number
  category: 'header' | 'vendor' | 'line_item' | 'tax'
  samplesTested: number
}

export const FIELD_ACCURACY_DATA: FieldAccuracyItem[] = [
  { field: 'Invoice Number', accuracy: 99.4, category: 'header', samplesTested: 2480 },
  { field: 'Invoice Date', accuracy: 98.8, category: 'header', samplesTested: 2480 },
  { field: 'Supplier GSTIN', accuracy: 98.2, category: 'vendor', samplesTested: 2480 },
  { field: 'Total Amount', accuracy: 97.8, category: 'tax', samplesTested: 2480 },
  { field: 'Tax Amounts (CGST/SGST/IGST)', accuracy: 96.5, category: 'tax', samplesTested: 4960 },
  { field: 'Taxable Value', accuracy: 95.8, category: 'tax', samplesTested: 2480 },
  { field: 'Quantity', accuracy: 94.2, category: 'line_item', samplesTested: 8420 },
  { field: 'Unit Rate', accuracy: 93.6, category: 'line_item', samplesTested: 8420 },
  { field: 'HSN/SAC Code', accuracy: 91.4, category: 'line_item', samplesTested: 8420 },
]

export function getFieldAccuracyData(): FieldAccuracyItem[] {
  return FIELD_ACCURACY_DATA
}

export interface SegmentBreakdownItem {
  name: string
  volume: number
  accuracyPct: number
  correctionRatePct: number
  trendDelta: number
  isLowPerformer: boolean
  tag?: string
}

export const SEGMENT_BY_SOURCE_DATA: SegmentBreakdownItem[] = [
  { name: 'Digital PDF', volume: 18420, accuracyPct: 99.2, correctionRatePct: 1.8, trendDelta: 0.4, isLowPerformer: false, tag: 'High volume' },
  { name: 'Flatbed Scanner', volume: 8640, accuracyPct: 97.1, correctionRatePct: 4.2, trendDelta: 0.2, isLowPerformer: false },
  { name: 'WhatsApp Image', volume: 3410, accuracyPct: 92.4, correctionRatePct: 9.8, trendDelta: -1.4, isLowPerformer: true, tag: 'Underperforming' },
  { name: 'Smartphone Photo', volume: 1890, accuracyPct: 88.6, correctionRatePct: 14.2, trendDelta: -2.1, isLowPerformer: true, tag: 'Action needed' },
]

export const SEGMENT_BY_LANGUAGE_DATA: SegmentBreakdownItem[] = [
  { name: 'English (Standard)', volume: 26100, accuracyPct: 98.8, correctionRatePct: 2.4, trendDelta: 0.5, isLowPerformer: false },
  { name: 'Hindi (Bilingual)', volume: 3840, accuracyPct: 94.2, correctionRatePct: 7.2, trendDelta: 0.8, isLowPerformer: false },
  { name: 'Marathi', volume: 1420, accuracyPct: 93.1, correctionRatePct: 8.6, trendDelta: -0.4, isLowPerformer: false },
  { name: 'Tamil', volume: 890, accuracyPct: 91.8, correctionRatePct: 9.4, trendDelta: -0.2, isLowPerformer: false },
  { name: 'Handwritten / Carbon Copy', volume: 1110, accuracyPct: 82.4, correctionRatePct: 19.6, trendDelta: -1.8, isLowPerformer: true, tag: 'Low accuracy' },
]

export const SEGMENT_BY_VENDOR_DATA: SegmentBreakdownItem[] = [
  { name: 'Northstar Supplies', volume: 480, accuracyPct: 99.1, correctionRatePct: 1.2, trendDelta: 0.3, isLowPerformer: false },
  { name: 'Deccan Precision Tools', volume: 340, accuracyPct: 98.4, correctionRatePct: 2.1, trendDelta: 0.6, isLowPerformer: false },
  { name: 'Kaveri Components', volume: 180, accuracyPct: 97.9, correctionRatePct: 3.0, trendDelta: 0.4, isLowPerformer: false },
  { name: 'Aster Office Mart', volume: 290, accuracyPct: 93.2, correctionRatePct: 8.4, trendDelta: -1.1, isLowPerformer: false },
  { name: 'Shiva Logistics', volume: 210, accuracyPct: 91.6, correctionRatePct: 11.2, trendDelta: -2.4, isLowPerformer: true, tag: 'Flagged' },
]

export function getSegmentBreakdown(type: 'source' | 'language' | 'vendor'): SegmentBreakdownItem[] {
  switch (type) {
    case 'source':
      return SEGMENT_BY_SOURCE_DATA
    case 'language':
      return SEGMENT_BY_LANGUAGE_DATA
    case 'vendor':
      return SEGMENT_BY_VENDOR_DATA
  }
}

export interface DriftNotice {
  id: string
  title: string
  detail: string
  severity: Severity
  detectedAt: string
  impact: string
}

export const DRIFT_NOTICES_DATA: DriftNotice[] = [
  {
    id: 'DFT-01',
    title: 'Input mix changed: WhatsApp photo share increased by +18%',
    detail: 'Compressed mobile photos now account for 10.6% of daily intake, shifting overall confidence downwards.',
    severity: 'medium',
    detectedAt: '11 Oct 2026, 08:30 IST',
    impact: 'Estimated review volume increase of +4.2%',
  },
  {
    id: 'DFT-02',
    title: 'Accuracy drop on smartphone photos: Sub-80% contrast on 14% of receipts',
    detail: 'Shadows and low camera exposure causing digit confusion between 3 and 8 in subtotal values.',
    severity: 'high',
    detectedAt: '10 Oct 2026, 19:15 IST',
    impact: 'Taxable amount error rate up from 2.1% to 4.2%',
  },
  {
    id: 'DFT-03',
    title: 'Handwritten challan volume surge from transport carriers',
    detail: 'Lorry receipts with handwritten weight and freight values arriving without printed GSTIN header.',
    severity: 'info',
    detectedAt: '09 Oct 2026, 14:00 IST',
    impact: 'Human review time +18s per challan',
  },
]

export function getDriftNotices(): DriftNotice[] {
  return DRIFT_NOTICES_DATA
}

export interface CorrectedFieldSample {
  id: string
  fieldName: string
  invoiceId: string
  vendor: string
  beforeValue: string
  afterValue: string
  reason: string
  occurrences: number
}

export const MOST_CORRECTED_FIELDS_DATA: CorrectedFieldSample[] = [
  {
    id: 'cor-1',
    fieldName: 'Supplier GSTIN',
    invoiceId: 'INV-2026-0392',
    vendor: 'Aster Office Mart',
    beforeValue: '27AAPFU0939F1ZV',
    afterValue: '27AAPFU0939F1Z2',
    reason: 'Checksum character misread as "V" instead of "2" on faded thermal paper',
    occurrences: 42,
  },
  {
    id: 'cor-2',
    fieldName: 'Taxable Value',
    invoiceId: 'INV-2026-0418',
    vendor: 'Northstar Supplies',
    beforeValue: '₹1,84,000',
    afterValue: '₹1,84,500',
    reason: 'Faint dot caused "5" to be read as "0" in the hundreds digit',
    occurrences: 28,
  },
  {
    id: 'cor-3',
    fieldName: 'Invoice Date',
    invoiceId: 'INV-2026-0412',
    vendor: 'Shiva Logistics',
    beforeValue: '01/05/2026',
    afterValue: '01/04/2026',
    reason: 'Disambiguated DD/MM/YYYY vs MM/DD/YYYY format based on Indian tax period',
    occurrences: 24,
  },
  {
    id: 'cor-4',
    fieldName: 'HSN / SAC Code',
    invoiceId: 'INV-2026-0422',
    vendor: 'Deccan Precision Tools',
    beforeValue: '8471',
    afterValue: '84713010',
    reason: 'Expanded 4-digit chapter heading to required 8-digit tariff item per CBIC mandate',
    occurrences: 19,
  },
  {
    id: 'cor-5',
    fieldName: 'Vendor Legal Name',
    invoiceId: 'INV-2026-0355',
    vendor: 'Kaveri Components',
    beforeValue: 'Kaveri Comp.',
    afterValue: 'Kaveri Components Private Limited',
    reason: 'Replaced abbreviated trade string with registered GST portal legal title',
    occurrences: 15,
  },
]

export function getMostCorrectedFields(): CorrectedFieldSample[] {
  return MOST_CORRECTED_FIELDS_DATA
}

export interface RuleFreshnessBannerInfo {
  lastUpdated: string
  version: string
  nextReview: string
  daysSinceUpdate: number
  isStale: boolean
  staleTableName?: string
}

export function getRuleTableFreshness(demoStale: boolean = false): RuleFreshnessBannerInfo {
  if (demoStale) {
    return {
      lastUpdated: '10 Aug 2026',
      version: 'v2026.08',
      nextReview: '10 Sep 2026 (Overdue)',
      daysSinceUpdate: 62,
      isStale: true,
      staleTableName: 'CBIC HSN Exemption Schedule III',
    }
  }
  return {
    lastUpdated: '02 Oct 2026',
    version: 'v2026.10',
    nextReview: '01 Nov 2026',
    daysSinceUpdate: 9,
    isStale: false,
  }
}

export interface RuleKPISummary {
  checksRunToday: number
  invoicesFlaggedPct: number
  invoicesFlaggedCount: number
  overrideRatePct: number
  deterministicSplitPct: number
  aiAssistedSplitPct: number
}

export function getRuleKPIs(): RuleKPISummary {
  return {
    checksRunToday: 41200,
    invoicesFlaggedPct: 3.8,
    invoicesFlaggedCount: 46,
    overrideRatePct: 4.2,
    deterministicSplitPct: 82,
    aiAssistedSplitPct: 18,
  }
}

export interface RulePerformanceItem {
  id: string
  code: string
  name: string
  kind: 'Deterministic' | 'AI-assisted'
  severity: Severity
  runsCount: number
  failRatePct: number
  userConfirmedPct: number
  dismissedPct: number
  sparkline: number[]
  lastChanged: string
  formula: string
  failureExamples: {
    invoiceId: string
    vendor: string
    reason: string
    timestamp: string
  }[]
}

export const RULE_PERFORMANCE_DATA: RulePerformanceItem[] = [
  {
    id: 'R-101',
    code: 'R-101',
    name: 'GSTIN checksum & state prefix',
    kind: 'Deterministic',
    severity: 'critical',
    runsCount: 2480,
    failRatePct: 1.4,
    userConfirmedPct: 97.2,
    dismissedPct: 2.8,
    sparkline: [2.1, 1.8, 1.6, 1.4, 1.4],
    lastChanged: '02 Oct 2026',
    formula: 'Regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$ && Mod36Check(GSTIN) == true',
    failureExamples: [
      { invoiceId: 'INV-2026-0392', vendor: 'Aster Office Mart', reason: 'Checksum character mismatch (expected 2, found V)', timestamp: '11 Oct 2026, 09:43 IST' },
      { invoiceId: 'INV-2026-0341', vendor: 'Shiva Logistics', reason: 'State prefix code 99 invalid for non-ODS supplier', timestamp: '10 Oct 2026, 16:12 IST' },
      { invoiceId: 'INV-2026-0310', vendor: 'Zen Logistics', reason: '14th character must be "Z" according to GST format', timestamp: '09 Oct 2026, 11:20 IST' },
    ],
  },
  {
    id: 'R-102',
    code: 'R-102',
    name: 'Tax type vs place of supply',
    kind: 'Deterministic',
    severity: 'high',
    runsCount: 2480,
    failRatePct: 2.1,
    userConfirmedPct: 94.6,
    dismissedPct: 5.4,
    sparkline: [2.8, 2.5, 2.3, 2.2, 2.1],
    lastChanged: '28 Sep 2026',
    formula: 'SupplierState == PlaceOfSupply ? (CGST > 0 && SGST > 0 && IGST == 0) : (IGST > 0 && CGST == 0 && SGST == 0)',
    failureExamples: [
      { invoiceId: 'INV-2026-0388', vendor: 'Zen Logistics', reason: 'Intra-state Maharashtra billed with IGST instead of CGST/SGST', timestamp: '11 Oct 2026, 08:15 IST' },
      { invoiceId: 'INV-2026-0365', vendor: 'Northstar Supplies', reason: 'Place of supply code 27 differs from buyer registered branch 29', timestamp: '10 Oct 2026, 14:40 IST' },
      { invoiceId: 'INV-2026-0322', vendor: 'Deccan Precision Tools', reason: 'Dual tax assignment: both IGST and CGST charged simultaneously', timestamp: '08 Oct 2026, 17:05 IST' },
    ],
  },
  {
    id: 'R-103',
    code: 'R-103',
    name: 'HSN to GST rate lookup',
    kind: 'Deterministic',
    severity: 'high',
    runsCount: 8420,
    failRatePct: 3.2,
    userConfirmedPct: 91.8,
    dismissedPct: 8.2,
    sparkline: [3.9, 3.6, 3.5, 3.3, 3.2],
    lastChanged: '02 Oct 2026',
    formula: 'CBIC_MasterTable.LookupRate(HSN_Code, InvoiceDate) == InvoiceTaxRate',
    failureExamples: [
      { invoiceId: 'INV-2026-0422', vendor: 'Deccan Precision Tools', reason: 'HSN 84713010 billed at 12% instead of statutory 18% GST', timestamp: '11 Oct 2026, 09:15 IST' },
      { invoiceId: 'INV-2026-0399', vendor: 'Aster Office Mart', reason: 'Obsolete 4-digit HSN 4820 provided without mandatory 6-digit detail', timestamp: '10 Oct 2026, 10:22 IST' },
      { invoiceId: 'INV-2026-0371', vendor: 'Kaveri Components', reason: 'Notification 04/2026 rate change from 18% to 12% not reflected', timestamp: '09 Oct 2026, 15:30 IST' },
    ],
  },
  {
    id: 'R-104',
    code: 'R-104',
    name: 'Line item math verification',
    kind: 'Deterministic',
    severity: 'high',
    runsCount: 8420,
    failRatePct: 0.8,
    userConfirmedPct: 98.4,
    dismissedPct: 1.6,
    sparkline: [1.2, 1.0, 0.9, 0.8, 0.8],
    lastChanged: '15 Sep 2026',
    formula: 'Abs( (Quantity * UnitRate) - Discount - LineTaxableValue ) <= 0.05 INR',
    failureExamples: [
      { invoiceId: 'INV-2026-0418', vendor: 'Northstar Supplies', reason: 'Quantity 200 * UnitRate ₹922.50 = ₹1,84,500; invoice stated ₹1,84,000', timestamp: '11 Oct 2026, 09:42 IST' },
      { invoiceId: 'INV-2026-0352', vendor: 'Shiva Logistics', reason: 'Unallocated line discount of ₹250 not subtracted from taxable subtotal', timestamp: '10 Oct 2026, 12:18 IST' },
      { invoiceId: 'INV-2026-0318', vendor: 'Kaveri Components', reason: 'Per-unit roundoff variance of ₹0.48 exceeded tolerance threshold', timestamp: '07 Oct 2026, 18:04 IST' },
    ],
  },
  {
    id: 'R-105',
    code: 'R-105',
    name: 'Tax fraction & round-off math',
    kind: 'Deterministic',
    severity: 'medium',
    runsCount: 2480,
    failRatePct: 1.1,
    userConfirmedPct: 96.5,
    dismissedPct: 3.5,
    sparkline: [1.5, 1.3, 1.2, 1.1, 1.1],
    lastChanged: '15 Sep 2026',
    formula: 'Abs( Sum(LineTaxableValue * TaxRate) - TotalTaxAmount ) <= 1.00 INR',
    failureExamples: [
      { invoiceId: 'INV-2026-0374', vendor: 'Kaveri Components', reason: 'CGST/SGST fraction differs by ₹1.45 due to item-by-item roundoff', timestamp: '11 Oct 2026, 06:20 IST' },
      { invoiceId: 'INV-2026-0348', vendor: 'Aster Office Mart', reason: 'Cess calculation missing on tobacco commodity subtotal', timestamp: '09 Oct 2026, 13:45 IST' },
      { invoiceId: 'INV-2026-0330', vendor: 'Zen Logistics', reason: 'Negative roundoff adjustment of ₹1.80 exceeding statutory ₹1 limit', timestamp: '08 Oct 2026, 09:12 IST' },
    ],
  },
  {
    id: 'R-106',
    code: 'R-106',
    name: 'Duplicate invoice collision',
    kind: 'AI-assisted',
    severity: 'critical',
    runsCount: 2480,
    failRatePct: 2.4,
    userConfirmedPct: 81.6,
    dismissedPct: 18.4,
    sparkline: [15.2, 16.1, 17.0, 17.8, 18.4],
    lastChanged: '10 Sep 2026',
    formula: 'FuzzyMatch(SupplierGSTIN, InvoiceNum, FiscalYear) || (ExactMatch(Amount, Date, GSTIN) && ProbDuplicate > 0.85)',
    failureExamples: [
      { invoiceId: 'INV-2026-0355', vendor: 'Kaveri Components', reason: 'Invoice number previously recorded in Q4 FY25 with identical supplier GSTIN', timestamp: '10 Oct 2026, 17:48 IST' },
      { invoiceId: 'INV-2026-0335', vendor: 'Deccan Precision Tools', reason: 'Exact amount ₹28,400 and invoice date collision with filed voucher V-902', timestamp: '09 Oct 2026, 14:15 IST' },
      { invoiceId: 'INV-2026-0298', vendor: 'Northstar Supplies', reason: 'Duplicate PDF upload detected via SHA256 digest comparison', timestamp: '06 Oct 2026, 11:50 IST' },
    ],
  },
  {
    id: 'R-107',
    code: 'R-107',
    name: 'Date validity & fiscal period',
    kind: 'Deterministic',
    severity: 'medium',
    runsCount: 2480,
    failRatePct: 0.6,
    userConfirmedPct: 98.8,
    dismissedPct: 1.2,
    sparkline: [0.9, 0.8, 0.7, 0.6, 0.6],
    lastChanged: '20 Aug 2026',
    formula: 'InvoiceDate <= Today() && InvoiceDate >= FY_StartDate - 180_Days',
    failureExamples: [
      { invoiceId: 'INV-2026-0412', vendor: 'Shiva Logistics', reason: 'Future invoice date detected: 01/05/2026 (assumed typo for 01/04/2026)', timestamp: '11 Oct 2026, 04:30 IST' },
      { invoiceId: 'INV-2026-0315', vendor: 'Aster Office Mart', reason: 'Invoice dated prior to FY25 cutoff (ITC time-bar under Section 16(4))', timestamp: '08 Oct 2026, 15:20 IST' },
      { invoiceId: 'INV-2026-0280', vendor: 'Kaveri Components', reason: 'Sunday dispatch date on restricted commodity transport voucher', timestamp: '05 Oct 2026, 10:05 IST' },
    ],
  },
  {
    id: 'R-108',
    code: 'R-108',
    name: 'IRN presence & QR signature',
    kind: 'Deterministic',
    severity: 'high',
    runsCount: 1650,
    failRatePct: 1.9,
    userConfirmedPct: 95.2,
    dismissedPct: 4.8,
    sparkline: [2.4, 2.2, 2.1, 2.0, 1.9],
    lastChanged: '05 Sep 2026',
    formula: 'SupplierTurnover >= 5_Cr ? (IRN.Length == 64 && VerifyNIC_Signature(SignedQR) == true) : true',
    failureExamples: [
      { invoiceId: 'INV-2026-0382', vendor: 'Northstar Supplies', reason: 'Missing mandatory 64-char IRN for supplier exceeding ₹5 Cr turnover threshold', timestamp: '10 Oct 2026, 13:10 IST' },
      { invoiceId: 'INV-2026-0340', vendor: 'Deccan Precision Tools', reason: 'NIC digital signature public key verification failed on QR matrix scan', timestamp: '08 Oct 2026, 16:25 IST' },
      { invoiceId: 'INV-2026-0290', vendor: 'Zen Logistics', reason: 'IRN generation timestamp differs by >72 hours from supplier invoice date', timestamp: '05 Oct 2026, 12:40 IST' },
    ],
  },
  {
    id: 'R-109',
    code: 'R-109',
    name: 'GSTR-2B reconciliation match',
    kind: 'AI-assisted',
    severity: 'critical',
    runsCount: 2480,
    failRatePct: 4.8,
    userConfirmedPct: 92.4,
    dismissedPct: 7.6,
    sparkline: [5.8, 5.4, 5.1, 4.9, 4.8],
    lastChanged: '01 Oct 2026',
    formula: 'GSTN_2B.FindMatch(GSTIN, InvoiceNum, Value) != null && Abs(BookValue - 2B_Value) <= 10 INR',
    failureExamples: [
      { invoiceId: 'INV-2026-0398', vendor: 'Shiva Logistics', reason: 'Supplier invoice not reported in GSTR-2B feed for April 2026 period', timestamp: '11 Oct 2026, 07:40 IST' },
      { invoiceId: 'INV-2026-0360', vendor: 'Aster Office Mart', reason: 'Taxable value discrepancy ₹500 between purchase register and GSTR-2B', timestamp: '09 Oct 2026, 18:20 IST' },
      { invoiceId: 'INV-2026-0320', vendor: 'Kaveri Components', reason: 'GSTR-2B marked invoice as Ineligible ITC under Section 17(5)', timestamp: '07 Oct 2026, 11:35 IST' },
    ],
  },
]

export function getRulePerformanceData(): RulePerformanceItem[] {
  return RULE_PERFORMANCE_DATA
}

export interface FalsePositiveTrendPoint {
  date: string
  'R-106': number
  'R-109': number
  'R-103': number
  'R-102': number
  threshold: number
}

export const FALSE_POSITIVE_TREND_DATA: FalsePositiveTrendPoint[] = [
  { date: '01 Oct', 'R-106': 14.8, 'R-109': 8.2, 'R-103': 7.6, 'R-102': 5.2, threshold: 15 },
  { date: '03 Oct', 'R-106': 15.6, 'R-109': 8.0, 'R-103': 7.8, 'R-102': 5.4, threshold: 15 },
  { date: '05 Oct', 'R-106': 16.4, 'R-109': 7.9, 'R-103': 8.1, 'R-102': 5.5, threshold: 15 },
  { date: '07 Oct', 'R-106': 17.2, 'R-109': 7.8, 'R-103': 8.0, 'R-102': 5.3, threshold: 15 },
  { date: '09 Oct', 'R-106': 17.9, 'R-109': 7.7, 'R-103': 8.2, 'R-102': 5.4, threshold: 15 },
  { date: '11 Oct', 'R-106': 18.4, 'R-109': 7.6, 'R-103': 8.2, 'R-102': 5.4, threshold: 15 },
]

export function getFalsePositiveTrends(): FalsePositiveTrendPoint[] {
  return FALSE_POSITIVE_TREND_DATA
}

export interface RuleVersionChange {
  id: string
  version: string
  title: string
  effectiveDate: string
  changedBy: string
  category: 'Rate table' | 'Threshold' | 'E-invoice' | 'HSN Master'
  diff: {
    field: string
    before: string
    after: string
    rationale: string
  }[]
}

export const RULE_VERSION_CHANGES_DATA: RuleVersionChange[] = [
  {
    id: 'VER-04',
    version: 'v2026.10',
    title: 'Rate table refresh: CBIC Notification 04/2026',
    effectiveDate: '02 Oct 2026',
    changedBy: 'Aditi Mehta (Lead Tax Controller)',
    category: 'Rate table',
    diff: [
      { field: 'HSN 84713010 (Laptops)', before: '18% standard GST', after: '18% + Exemption LUT exemption schedule', rationale: 'SEZ unit procurement without IGST payment mandate' },
      { field: 'HSN 4820 (Stationery items)', before: '12% uniform', after: '12% / 18% differentiated by GSM weight', rationale: 'Clarification circular on coated thermal print paper' },
      { field: 'E-way bill threshold', before: '₹50,000 inter-state', after: '₹50,000 (No change)', rationale: 'Annual audit confirmation' },
    ],
  },
  {
    id: 'VER-03',
    version: 'v2026.09',
    title: 'E-invoice mandate threshold check alignment',
    effectiveDate: '15 Sep 2026',
    changedBy: 'System Sentinel (Auto-sync)',
    category: 'E-invoice',
    diff: [
      { field: 'B2B Mandatory IRN Turnover', before: '₹5 Cr aggregate turnover', after: '₹5 Cr aggregate turnover + SEZ exemption check', rationale: 'Prevent false flags on SEZ developers with non-IRN invoices' },
      { field: 'QR code verification grace period', before: '48 hours from dispatch', after: '72 hours from dispatch', rationale: 'Buffer for delayed weekend NIC portal sync' },
    ],
  },
  {
    id: 'VER-02',
    version: 'v2026.08',
    title: 'Duplicate detection fuzzy sensitivity tuning',
    effectiveDate: '20 Aug 2026',
    changedBy: 'Rohan Shah (Ops Lead)',
    category: 'Threshold',
    diff: [
      { field: 'Fuzzy match similarity threshold', before: '0.80 cosine distance', after: '0.88 cosine distance', rationale: 'Reduced false positives on monthly recurring vendor retainers' },
      { field: 'Fiscal year boundary lookback', before: '90 days prior to FY', after: '180 days prior to FY', rationale: 'Account for supplier year-end delayed billing' },
    ],
  },
]

export function getRuleVersionHistory(): RuleVersionChange[] {
  return RULE_VERSION_CHANGES_DATA
}

export interface RuleTestSuiteStatus {
  totalTests: number
  passingTests: number
  failingTests: number
  lastRunTime: string
  durationMs: number
}

export function getRuleTestSuiteStatus(): RuleTestSuiteStatus {
  return {
    totalTests: 148,
    passingTests: 148,
    failingTests: 0,
    lastRunTime: '12 min ago (11 Oct 2026, 10:35 IST)',
    durationMs: 48,
  }
}





// ==========================================
// README 06 — HUMAN REVIEW QUEUE & SLA DATA
// ==========================================

export interface ReviewKPISummary {
  itemsWaiting: number
  oldestItemAgeHours: number
  oldestItemDisplay: string
  medianTimeToReviewMinutes: number
  slaBreachesToday: number
  highPriorityCount: number
}

export function getReviewKPISummary(): ReviewKPISummary {
  return {
    itemsWaiting: 14,
    oldestItemAgeHours: 3.4,
    oldestItemDisplay: '3h 24m',
    medianTimeToReviewMinutes: 2.8,
    slaBreachesToday: 1,
    highPriorityCount: 4,
  }
}

export interface ReviewAgingBucket {
  timeBucket: string // e.g. '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'
  under1h: number
  oneTo4h: number
  fourTo24h: number
  over24h: number
  slaThreshold: number // target max queue depth
}

export const REVIEW_AGING_DATA: ReviewAgingBucket[] = [
  { timeBucket: '09:00', under1h: 6, oneTo4h: 3, fourTo24h: 1, over24h: 0, slaThreshold: 12 },
  { timeBucket: '10:00', under1h: 9, oneTo4h: 4, fourTo24h: 1, over24h: 0, slaThreshold: 12 },
  { timeBucket: '11:00', under1h: 12, oneTo4h: 5, fourTo24h: 2, over24h: 0, slaThreshold: 12 },
  { timeBucket: '12:00', under1h: 8, oneTo4h: 6, fourTo24h: 1, over24h: 1, slaThreshold: 12 },
  { timeBucket: '13:00', under1h: 5, oneTo4h: 4, fourTo24h: 2, over24h: 0, slaThreshold: 12 },
  { timeBucket: '14:00', under1h: 7, oneTo4h: 5, fourTo24h: 1, over24h: 1, slaThreshold: 12 },
]

export function getReviewAgingData(): ReviewAgingBucket[] {
  return REVIEW_AGING_DATA
}

export interface ReviewQueueItem {
  id: string
  invoiceNumber: string
  vendor: string
  vendorGstin: string
  amount: number
  reason: string
  reasonCategory: 'Low confidence' | 'Rule failure' | 'Discrepancy' | 'Missing doc'
  priority: 'Urgent' | 'High' | 'Medium' | 'Low'
  assignedTo: string
  assignedAvatar: string
  createdAt: string
  ageMinutes: number
  slaTotalMinutes: number
  // calculated seconds left until breach: (slaTotalMinutes * 60) - (ageMinutes * 60)
  secondsLeft: number
}

export const REVIEW_QUEUE_ITEMS_DATA: ReviewQueueItem[] = [
  {
    id: 'INV-2026-0422',
    invoiceNumber: 'DPT/26-27/0411',
    vendor: 'Deccan Precision Tools',
    vendorGstin: '27AABCU9603R1ZM',
    amount: 142500,
    reason: '3 low-confidence fields (Line 3 HSN, CGST rate, Net Amount)',
    reasonCategory: 'Low confidence',
    priority: 'Urgent',
    assignedTo: 'Aditi Mehta',
    assignedAvatar: 'AM',
    createdAt: '11 Oct 2026, 09:12 IST',
    ageMinutes: 168, // 2h 48m
    slaTotalMinutes: 180, // 3h SLA -> 12 min left!
    secondsLeft: 720, // 12 min
  },
  {
    id: 'INV-2026-0418',
    invoiceNumber: 'NS/INV/884',
    vendor: 'Northstar Supplies',
    vendorGstin: '29AABCS1429B1ZB',
    amount: 218400,
    reason: 'GSTIN checksum failed (Mod36 error on 14th char)',
    reasonCategory: 'Rule failure',
    priority: 'Urgent',
    assignedTo: 'Rohan Shah',
    assignedAvatar: 'RS',
    createdAt: '11 Oct 2026, 09:35 IST',
    ageMinutes: 145,
    slaTotalMinutes: 180,
    secondsLeft: 2100, // 35 min
  },
  {
    id: 'INV-2026-0412',
    invoiceNumber: 'SL-8841-B',
    vendor: 'Shiva Logistics',
    vendorGstin: '27AAACS1234A1Z5',
    amount: 86400,
    reason: 'Date ambiguity: 01/05/2026 vs 01/04/2026 period mismatch',
    reasonCategory: 'Rule failure',
    priority: 'High',
    assignedTo: 'Kavita Nair',
    assignedAvatar: 'KN',
    createdAt: '11 Oct 2026, 10:02 IST',
    ageMinutes: 118,
    slaTotalMinutes: 240, // 4h SLA
    secondsLeft: 7320, // 122 min
  },
  {
    id: 'INV-2026-0409',
    invoiceNumber: 'AOM-2026-992',
    vendor: 'Aster Office Mart',
    vendorGstin: '27AAACA9876C1Z3',
    amount: 45200,
    reason: 'Round-off variance ₹1.45 exceeds statutory ₹1 threshold',
    reasonCategory: 'Discrepancy',
    priority: 'High',
    assignedTo: 'Vikas Rao',
    assignedAvatar: 'VR',
    createdAt: '11 Oct 2026, 10:20 IST',
    ageMinutes: 100,
    slaTotalMinutes: 240,
    secondsLeft: 8400, // 140 min
  },
  {
    id: 'INV-2026-0399',
    invoiceNumber: 'KC-INV-4410',
    vendor: 'Kaveri Components',
    vendorGstin: '33AABCK4412L1Z9',
    amount: 384000,
    reason: 'Potential duplicate invoice collision with filed voucher V-902',
    reasonCategory: 'Rule failure',
    priority: 'Urgent',
    assignedTo: 'Aditi Mehta',
    assignedAvatar: 'AM',
    createdAt: '11 Oct 2026, 09:20 IST',
    ageMinutes: 160,
    slaTotalMinutes: 180,
    secondsLeft: 1200, // 20 min
  },
  {
    id: 'INV-2026-0395',
    invoiceNumber: 'ZL/26/0199',
    vendor: 'Zen Logistics',
    vendorGstin: '27AABCZ5512N1Z8',
    amount: 67200,
    reason: '2 low-confidence fields (PO number & transporter ID)',
    reasonCategory: 'Low confidence',
    priority: 'Medium',
    assignedTo: 'Rohan Shah',
    assignedAvatar: 'RS',
    createdAt: '11 Oct 2026, 10:45 IST',
    ageMinutes: 75,
    slaTotalMinutes: 360, // 6h SLA
    secondsLeft: 17100,
  },
  {
    id: 'INV-2026-0391',
    invoiceNumber: 'NS/INV/881',
    vendor: 'Northstar Supplies',
    vendorGstin: '29AABCS1429B1ZB',
    amount: 112000,
    reason: 'Missing digital IRN QR code on supplier turnover >₹5 Cr',
    reasonCategory: 'Rule failure',
    priority: 'High',
    assignedTo: 'Kavita Nair',
    assignedAvatar: 'KN',
    createdAt: '11 Oct 2026, 10:50 IST',
    ageMinutes: 70,
    slaTotalMinutes: 240,
    secondsLeft: 10200,
  },
  {
    id: 'INV-2026-0388',
    invoiceNumber: 'DPT/26-27/0398',
    vendor: 'Deccan Precision Tools',
    vendorGstin: '27AABCU9603R1ZM',
    amount: 98000,
    reason: 'Tax type mismatch: billed with IGST on intra-state supply',
    reasonCategory: 'Rule failure',
    priority: 'Medium',
    assignedTo: 'Unassigned',
    assignedAvatar: '??',
    createdAt: '11 Oct 2026, 11:10 IST',
    ageMinutes: 50,
    slaTotalMinutes: 360,
    secondsLeft: 18600,
  },
  {
    id: 'INV-2026-0385',
    invoiceNumber: 'AOM-2026-981',
    vendor: 'Aster Office Mart',
    vendorGstin: '27AAACA9876C1Z3',
    amount: 18500,
    reason: 'Faint ink contrast on scanned thermal paper voucher',
    reasonCategory: 'Low confidence',
    priority: 'Low',
    assignedTo: 'Vikas Rao',
    assignedAvatar: 'VR',
    createdAt: '11 Oct 2026, 11:25 IST',
    ageMinutes: 35,
    slaTotalMinutes: 480, // 8h SLA
    secondsLeft: 26700,
  },
  {
    id: 'INV-2026-0380',
    invoiceNumber: 'KC-INV-4402',
    vendor: 'Kaveri Components',
    vendorGstin: '33AABCK4412L1Z9',
    amount: 512000,
    reason: 'GSTR-2B entry marked ineligible under Section 17(5)',
    reasonCategory: 'Discrepancy',
    priority: 'Urgent',
    assignedTo: 'Aditi Mehta',
    assignedAvatar: 'AM',
    createdAt: '11 Oct 2026, 09:15 IST',
    ageMinutes: 165,
    slaTotalMinutes: 180,
    secondsLeft: 900, // 15 min - breach threshold!
  },
  {
    id: 'INV-2026-0377',
    invoiceNumber: 'SL-8835-A',
    vendor: 'Shiva Logistics',
    vendorGstin: '27AAACS1234A1Z5',
    amount: 34000,
    reason: 'Missing reverse charge declaration checkmark',
    reasonCategory: 'Missing doc',
    priority: 'Low',
    assignedTo: 'Unassigned',
    assignedAvatar: '??',
    createdAt: '11 Oct 2026, 11:35 IST',
    ageMinutes: 25,
    slaTotalMinutes: 480,
    secondsLeft: 27300,
  },
  {
    id: 'INV-2026-0372',
    invoiceNumber: 'ZL/26/0188',
    vendor: 'Zen Logistics',
    vendorGstin: '27AABCZ5512N1Z8',
    amount: 145000,
    reason: 'Handwritten delivery challan reference on tax invoice',
    reasonCategory: 'Low confidence',
    priority: 'Medium',
    assignedTo: 'Rohan Shah',
    assignedAvatar: 'RS',
    createdAt: '11 Oct 2026, 11:42 IST',
    ageMinutes: 18,
    slaTotalMinutes: 360,
    secondsLeft: 20520,
  },
  {
    id: 'INV-2026-0368',
    invoiceNumber: 'DPT/26-27/0380',
    vendor: 'Deccan Precision Tools',
    vendorGstin: '27AABCU9603R1ZM',
    amount: 220000,
    reason: '4-digit HSN code requires 8-digit tariff specification',
    reasonCategory: 'Rule failure',
    priority: 'Medium',
    assignedTo: 'Kavita Nair',
    assignedAvatar: 'KN',
    createdAt: '11 Oct 2026, 11:48 IST',
    ageMinutes: 12,
    slaTotalMinutes: 360,
    secondsLeft: 20880,
  },
  {
    id: 'INV-2026-0361',
    invoiceNumber: 'NS/INV/872',
    vendor: 'Northstar Supplies',
    vendorGstin: '29AABCS1429B1ZB',
    amount: 76000,
    reason: 'Unregistered vendor claiming IGST tax credit',
    reasonCategory: 'Discrepancy',
    priority: 'High',
    assignedTo: 'Vikas Rao',
    assignedAvatar: 'VR',
    createdAt: '11 Oct 2026, 11:52 IST',
    ageMinutes: 8,
    slaTotalMinutes: 240,
    secondsLeft: 13920,
  },
]

export function getReviewQueueItems(): ReviewQueueItem[] {
  return REVIEW_QUEUE_ITEMS_DATA
}

export interface ReviewerWorkloadItem {
  id: string
  name: string
  role: string
  avatar: string
  openItems: number
  capacityMax: number
  avgHandlingTimeSec: number
  correctionAccuracyPct: number
  status: 'Available' | 'Busy' | 'Overloaded'
}

export const REVIEWER_WORKLOAD_DATA: ReviewerWorkloadItem[] = [
  {
    id: 'rev-1',
    name: 'Aditi Mehta',
    role: 'Lead Tax Controller',
    avatar: 'AM',
    openItems: 4,
    capacityMax: 8,
    avgHandlingTimeSec: 38,
    correctionAccuracyPct: 99.4,
    status: 'Available',
  },
  {
    id: 'rev-2',
    name: 'Rohan Shah',
    role: 'Senior Finance Analyst',
    avatar: 'RS',
    openItems: 3,
    capacityMax: 8,
    avgHandlingTimeSec: 45,
    correctionAccuracyPct: 98.6,
    status: 'Available',
  },
  {
    id: 'rev-3',
    name: 'Kavita Nair',
    role: 'Tax Operations Specialist',
    avatar: 'KN',
    openItems: 3,
    capacityMax: 6,
    avgHandlingTimeSec: 42,
    correctionAccuracyPct: 97.8,
    status: 'Available',
  },
  {
    id: 'rev-4',
    name: 'Vikas Rao',
    role: 'Compliance Associate',
    avatar: 'VR',
    openItems: 2,
    capacityMax: 6,
    avgHandlingTimeSec: 52,
    correctionAccuracyPct: 96.5,
    status: 'Available',
  },
]

export function getReviewerWorkload(): ReviewerWorkloadItem[] {
  return REVIEWER_WORKLOAD_DATA
}

export interface ReviewReasonItem {
  reason: string
  count: number
  percentage: number
  category: 'Confidence' | 'Rule engine' | 'Format' | 'External'
}

export const REVIEW_REASONS_DATA: ReviewReasonItem[] = [
  { reason: 'Low OCR/Vision confidence (<85%)', count: 142, percentage: 41.2, category: 'Confidence' },
  { reason: 'GSTIN checksum / format anomaly', count: 68, percentage: 19.7, category: 'Rule engine' },
  { reason: 'Rate vs HSN tariff code lookup mismatch', count: 52, percentage: 15.1, category: 'Rule engine' },
  { reason: 'Round-off or line item sum variance', count: 38, percentage: 11.0, category: 'Format' },
  { reason: 'Duplicate invoice collision suspected', count: 26, percentage: 7.5, category: 'Rule engine' },
  { reason: 'Missing mandatory E-invoice IRN QR', count: 19, percentage: 5.5, category: 'External' },
]

export function getReviewReasonsData(): ReviewReasonItem[] {
  return REVIEW_REASONS_DATA
}

export interface SlaSettingsConfig {
  urgentHours: number
  highHours: number
  mediumHours: number
  lowHours: number
  breachWarningMinutes: number
  autoEscalateUnassignedMinutes: number
}

export const DEFAULT_SLA_SETTINGS: SlaSettingsConfig = {
  urgentHours: 3,
  highHours: 4,
  mediumHours: 6,
  lowHours: 8,
  breachWarningMinutes: 15,
  autoEscalateUnassignedMinutes: 30,
}

export function getDefaultSlaSettings(): SlaSettingsConfig {
  return DEFAULT_SLA_SETTINGS
}

// ==========================================
// README 07 — COMPLIANCE & FILING WATCH DATA
// ==========================================

export interface FilingCountdownSummary {
  daysUntilGstr3B: number
  gstr3BDueDate: string
  period: string
  readinessPct: number
  itcAtRiskRupees: number
  totalItcRupees: number
  gstr2BNote: string
}

export function getFilingCountdownSummary(): FilingCountdownSummary {
  return {
    daysUntilGstr3B: 9,
    gstr3BDueDate: '20 Oct 2026',
    period: 'September 2026',
    readinessPct: 78,
    itcAtRiskRupees: 64500,
    totalItcRupees: 384000,
    gstr2BNote: 'GSTR-2B for September will be auto-generated by GSTN on the 12th.',
  }
}

export interface DeadlineCalendarEvent {
  id: string
  day: number // day of month (October 2026)
  dateString: string
  title: string
  form: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B' | 'E-Invoice / IRN'
  status: 'Passed' | 'Upcoming' | 'Urgent'
  description: string
  actionLabel?: string
  actionHref?: string
  statutoryRule: string
}

export const DEADLINE_CALENDAR_EVENTS: DeadlineCalendarEvent[] = [
  {
    id: 'cal-1',
    day: 11,
    dateString: '11 Oct 2026',
    title: 'GSTR-1 Outward Supply Filing',
    form: 'GSTR-1',
    status: 'Urgent',
    description: 'Mandatory deadline for monthly taxpayers to upload all outward tax invoices & credit notes.',
    actionLabel: 'View outward vouchers',
    actionHref: '/app/invoices',
    statutoryRule: 'Section 37 of CGST Act / Rule 59',
  },
  {
    id: 'cal-2',
    day: 12,
    dateString: '12 Oct 2026',
    title: 'GSTR-2B Auto-Drafted Statement',
    form: 'GSTR-2B',
    status: 'Upcoming',
    description: 'GST portal locks vendor GSTR-1 filings and computes static eligible & ineligible ITC statement.',
    actionLabel: 'Upload 2B JSON',
    actionHref: '/app/itc',
    statutoryRule: 'Rule 60(7) of CGST Rules 2017',
  },
  {
    id: 'cal-3',
    day: 15,
    dateString: '15 Oct 2026',
    title: 'Quarterly TDS / TCS Deposit',
    form: 'E-Invoice / IRN',
    status: 'Upcoming',
    description: 'Tax deducted under Section 51/52 to be reported and credited to government ledger.',
    statutoryRule: 'Section 51(2) of CGST Act',
  },
  {
    id: 'cal-4',
    day: 20,
    dateString: '20 Oct 2026',
    title: 'GSTR-3B Return & Tax Payment',
    form: 'GSTR-3B',
    status: 'Upcoming',
    description: 'Final monthly consolidated summary return, ITC claim, and electronic cash ledger tax discharge.',
    actionLabel: 'Run 3B Reconciliation',
    actionHref: '/app/reports',
    statutoryRule: 'Section 39(1) of CGST Act / Rule 61',
  },
  {
    id: 'cal-5',
    day: 31,
    dateString: '31 Oct 2026',
    title: 'IRN Archival & Q3 E-Way Cutoff',
    form: 'E-Invoice / IRN',
    status: 'Upcoming',
    description: 'Archive 30-day NIC invoice registration signatures into tamper-evident storage.',
    statutoryRule: 'Rule 48(4) E-invoicing mandate',
  },
]

export function getDeadlineCalendarEvents(): DeadlineCalendarEvent[] {
  return DEADLINE_CALENDAR_EVENTS
}

export interface ReadinessChecklistItem {
  id: string
  title: string
  subtitle: string
  status: 'done' | 'in_progress' | 'blocked'
  linkText: string
  linkHref: string
}

export const READINESS_CHECKLIST_DATA: ReadinessChecklistItem[] = [
  {
    id: 'chk-1',
    title: 'Purchase invoices validated',
    subtitle: '46 of 48 purchase vouchers verified with rule engine',
    status: 'in_progress',
    linkText: 'Resolve 2 flagged vouchers',
    linkHref: '/app/invoices',
  },
  {
    id: 'chk-2',
    title: 'Human review queue cleared',
    subtitle: '14 items waiting; 4 urgent items pending sign-off',
    status: 'in_progress',
    linkText: 'Go to Review Queue',
    linkHref: '/app/monitoring/review',
  },
  {
    id: 'chk-3',
    title: 'GSTR-2B JSON reconciliation matched',
    subtitle: 'Awaiting generation on 12th Oct before auto-match execution',
    status: 'blocked',
    linkText: 'ITC Reconciliation module',
    linkHref: '/app/itc',
  },
  {
    id: 'chk-4',
    title: 'Vendor non-filers contacted',
    subtitle: '2 of 3 delinquent vendors have not acknowledged reminders',
    status: 'blocked',
    linkText: 'Vendor directory',
    linkHref: '/app/vendors',
  },
  {
    id: 'chk-5',
    title: 'Outward supplies reconciled against E-way bills',
    subtitle: 'All 34 inter-state consignments matched with portal records',
    status: 'done',
    linkText: 'View reports',
    linkHref: '/app/reports',
  },
]

export function getReadinessChecklist(): ReadinessChecklistItem[] {
  return READINESS_CHECKLIST_DATA
}

export interface ItcRiskTrendPoint {
  period: string
  missingIn2B: number
  vendorNotFiled: number
  mismatch: number
  ineligible: number
  totalAtRisk: number
}

export const ITC_RISK_TREND_DATA: ItcRiskTrendPoint[] = [
  { period: 'Apr 26', missingIn2B: 18500, vendorNotFiled: 22000, mismatch: 8400, ineligible: 4200, totalAtRisk: 53100 },
  { period: 'May 26', missingIn2B: 14200, vendorNotFiled: 19500, mismatch: 7100, ineligible: 3800, totalAtRisk: 44600 },
  { period: 'Jun 26', missingIn2B: 16800, vendorNotFiled: 24000, mismatch: 9200, ineligible: 5100, totalAtRisk: 55100 },
  { period: 'Jul 26', missingIn2B: 12400, vendorNotFiled: 16200, mismatch: 6400, ineligible: 3200, totalAtRisk: 38200 },
  { period: 'Aug 26', missingIn2B: 15100, vendorNotFiled: 18400, mismatch: 8900, ineligible: 4500, totalAtRisk: 46900 },
  { period: 'Sep 26', missingIn2B: 21500, vendorNotFiled: 26800, mismatch: 11400, ineligible: 4800, totalAtRisk: 64500 },
]

export function getItcRiskTrends(): ItcRiskTrendPoint[] {
  return ITC_RISK_TREND_DATA
}

export interface VendorNonFilerWatchItem {
  id: string
  vendorName: string
  gstin: string
  itcExposureRupees: number
  invoicesCount: number
  daysLate: number
  lastContacted: string
  contactEmail: string
  contactPhone: string
  status: 'Pending GSTR-1' | 'Unresponsive' | 'Reminder sent'
}

export const VENDOR_NON_FILERS_DATA: VendorNonFilerWatchItem[] = [
  {
    id: 'vnf-1',
    vendorName: 'Aster Office Mart',
    gstin: '27AAACA9876C1Z3',
    itcExposureRupees: 28400,
    invoicesCount: 4,
    daysLate: 3,
    lastContacted: 'Yesterday, 15:40 IST',
    contactEmail: 'accounts@asterofficemart.in',
    contactPhone: '+91 98201 44820',
    status: 'Reminder sent',
  },
  {
    id: 'vnf-2',
    vendorName: 'Zen Logistics',
    gstin: '27AABCZ5512N1Z8',
    itcExposureRupees: 21500,
    invoicesCount: 2,
    daysLate: 5,
    lastContacted: '08 Oct 2026',
    contactEmail: 'billing@zenlogistics.com',
    contactPhone: '+91 94451 90212',
    status: 'Unresponsive',
  },
  {
    id: 'vnf-3',
    vendorName: 'Kaveri Components',
    gstin: '33AABCK4412L1Z9',
    itcExposureRupees: 14600,
    invoicesCount: 3,
    daysLate: 2,
    lastContacted: '09 Oct 2026',
    contactEmail: 'tax@kavericomponents.co.in',
    contactPhone: '+91 97112 55901',
    status: 'Pending GSTR-1',
  },
]

export function getVendorNonFilers(): VendorNonFilerWatchItem[] {
  return VENDOR_NON_FILERS_DATA
}

// ==========================================
// README 08 — ALERTS CENTER & ALERT RULES DATA
// ==========================================

export interface AlertDetailItem {
  id: string
  title: string
  severity: Severity
  source: 'Pipeline' | 'AI quality' | 'Rules' | 'Review queue' | 'Filing' | 'Vendors'
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved'
  firedAt: string
  assignee: string
  assigneeAvatar: string
  description: string
  metricLabel: string
  metricValue: string
  metricTrend: { time: string; value: number }[]
  suggestedSteps: string[]
  linkedInvoiceId?: string
  linkedStage?: string
  history: {
    timestamp: string
    actor: string
    action: string
  }[]
}

export const ALERT_DETAILS_DATA: AlertDetailItem[] = [
  {
    id: 'ALT-1092',
    title: 'Read stage p95 latency spiked above 12s threshold',
    severity: 'critical',
    source: 'Pipeline',
    status: 'open',
    firedAt: '11 Oct 2026, 09:42 IST',
    assignee: 'Unassigned',
    assigneeAvatar: '??',
    description: 'The optical reading engine p95 duration sustained 13.8 seconds over 15 minutes due to high document concurrency and multi-page thermal scan complexity.',
    metricLabel: 'Read p95 Latency',
    metricValue: '13.8s (Limit: 8s)',
    metricTrend: [
      { time: '09:00', value: 4.8 },
      { time: '09:15', value: 5.2 },
      { time: '09:30', value: 9.6 },
      { time: '09:45', value: 13.8 },
      { time: '10:00', value: 12.4 },
    ],
    suggestedSteps: [
      'Scale OCR GPU inference worker replicas from 4 to 8 in AWS ap-south-1',
      'Check pre-processing downsampling step on incoming TIFF vouchers',
      'Inspect pending pipeline backlog in Preprocess queue',
    ],
    linkedStage: 'Read',
    history: [
      { timestamp: '11 Oct 2026, 09:42 IST', actor: 'System Sentinel', action: 'Alert triggered (p95 > 8.0s for 10m)' },
      { timestamp: '11 Oct 2026, 09:45 IST', actor: 'PagerDuty Integration', action: 'Dispatched push notification to On-Call Ops' },
    ],
  },
  {
    id: 'ALT-1091',
    title: 'GSTN Gateway API rate limit quota consumed >85%',
    severity: 'high',
    source: 'Pipeline',
    status: 'open',
    firedAt: '11 Oct 2026, 08:30 IST',
    assignee: 'Aditi Mehta',
    assigneeAvatar: 'AM',
    description: 'GSP rate limit token bucket is at 88% capacity for GSTIN 27AAACN0123M1Z2 during morning 2B bulk reconciliation poll.',
    metricLabel: 'API Quota Consumed',
    metricValue: '88% of 100 req/min',
    metricTrend: [
      { time: '07:30', value: 24 },
      { time: '08:00', value: 52 },
      { time: '08:30', value: 88 },
      { time: '09:00', value: 76 },
    ],
    suggestedSteps: [
      'Throttle background supplier reconciliation worker batch sizes',
      'Switch non-urgent GSTR-1 status verification queries to off-peak hours',
    ],
    linkedStage: 'Reconcile',
    history: [
      { timestamp: '11 Oct 2026, 08:30 IST', actor: 'System Sentinel', action: 'Alert triggered (Rate quota > 85%)' },
      { timestamp: '11 Oct 2026, 08:35 IST', actor: 'Aditi Mehta', action: 'Acknowledged and paused bulk poll' },
    ],
  },
  {
    id: 'ALT-1090',
    title: 'Extraction confidence score drop on logistics bills',
    severity: 'high',
    source: 'AI quality',
    status: 'open',
    firedAt: '10 Oct 2026, 21:15 IST',
    assignee: 'Rohan Shah',
    assigneeAvatar: 'RS',
    description: 'Average line-item extraction confidence dipped to 71.4% for Deccan Precision Tools logistics bills due to faint dot-matrix printer font.',
    metricLabel: 'Field Confidence',
    metricValue: '71.4% (Threshold: 85%)',
    metricTrend: [
      { time: '18:00', value: 92.5 },
      { time: '19:00', value: 88.0 },
      { time: '20:00', value: 79.2 },
      { time: '21:00', value: 71.4 },
    ],
    suggestedSteps: [
      'Enable adaptive contrast preprocessing for Deccan Precision Tools vendor template',
      'Route line items to human review queue with low-confidence tags',
    ],
    linkedInvoiceId: 'INV-2026-0392',
    history: [
      { timestamp: '10 Oct 2026, 21:15 IST', actor: 'System Sentinel', action: 'Confidence fell below 85% SLA' },
    ],
  },
  {
    id: 'ALT-1089',
    title: 'Duplicate invoice number collision flag triggered',
    severity: 'medium',
    source: 'Rules',
    status: 'acknowledged',
    firedAt: '10 Oct 2026, 17:48 IST',
    assignee: 'Kavita Nair',
    assigneeAvatar: 'KN',
    description: 'Invoice number INV-2026-0355 previously filed under FY25-26 Q4 detected with matching supplier GSTIN and identical gross value ₹3,84,000.',
    metricLabel: 'Collision Probability',
    metricValue: '96.2%',
    metricTrend: [
      { time: '17:00', value: 0 },
      { time: '17:48', value: 96.2 },
    ],
    suggestedSteps: [
      'Review voucher V-902 in historical purchase register',
      'Confirm with Kaveri Components accounts whether this is a re-bill or duplicate upload',
    ],
    linkedInvoiceId: 'INV-2026-0355',
    history: [
      { timestamp: '10 Oct 2026, 17:48 IST', actor: 'Rule Engine (R-106)', action: 'Flagged duplicate collision' },
      { timestamp: '10 Oct 2026, 18:10 IST', actor: 'Kavita Nair', action: 'Acknowledged alert' },
    ],
  },
  {
    id: 'ALT-1088',
    title: 'Review queue oldest item breached 3h threshold',
    severity: 'high',
    source: 'Review queue',
    status: 'open',
    firedAt: '11 Oct 2026, 10:15 IST',
    assignee: 'Aditi Mehta',
    assigneeAvatar: 'AM',
    description: 'Invoice INV-2026-0422 has been waiting in the review queue for 3h 24m without reviewer sign-off, nearing SLA breach.',
    metricLabel: 'Item Queue Age',
    metricValue: '3h 24m (SLA: 3h 00m)',
    metricTrend: [
      { time: '08:00', value: 60 },
      { time: '09:00', value: 120 },
      { time: '10:00', value: 180 },
      { time: '10:30', value: 204 },
    ],
    suggestedSteps: [
      'Reassign invoice to available controller',
      'Trigger expedited review workflow',
    ],
    linkedInvoiceId: 'INV-2026-0422',
    history: [
      { timestamp: '11 Oct 2026, 10:15 IST', actor: 'Queue SLA Sentinel', action: 'Breach warning dispatched' },
    ],
  },
  {
    id: 'ALT-1087',
    title: 'Vendor Aster Office Mart GSTR-1 delinquent by 3 days',
    severity: 'medium',
    source: 'Vendors',
    status: 'open',
    firedAt: '11 Oct 2026, 06:00 IST',
    assignee: 'Vikas Rao',
    assigneeAvatar: 'VR',
    description: 'Aster Office Mart has not filed GSTR-1; ₹28,400 in ITC exposure at risk of exclusion from auto-drafted GSTR-2B.',
    metricLabel: 'ITC Exposure',
    metricValue: '₹28,400 (4 invoices)',
    metricTrend: [
      { time: '08 Oct', value: 28400 },
      { time: '09 Oct', value: 28400 },
      { time: '10 Oct', value: 28400 },
      { time: '11 Oct', value: 28400 },
    ],
    suggestedSteps: [
      'Send WhatsApp automated nudge to supplier accounts contact',
      'Hold balance payment until GSTR-1 ARN is received',
    ],
    history: [
      { timestamp: '11 Oct 2026, 06:00 IST', actor: 'Compliance Watch', action: 'Delinquent supplier flagged' },
    ],
  },
  {
    id: 'ALT-1086',
    title: 'GSTR-3B filing countdown: 9 days remaining',
    severity: 'info',
    source: 'Filing',
    status: 'open',
    firedAt: '11 Oct 2026, 00:00 IST',
    assignee: 'Aditi Mehta',
    assigneeAvatar: 'AM',
    description: 'September 2026 return due on 20 Oct 2026. 46 of 48 purchase vouchers validated.',
    metricLabel: 'Days Remaining',
    metricValue: '9 days (Readiness: 78%)',
    metricTrend: [
      { time: '14 days', value: 14 },
      { time: '12 days', value: 12 },
      { time: '10 days', value: 10 },
      { time: '9 days', value: 9 },
    ],
    suggestedSteps: [
      'Complete remaining 2 purchase voucher validations',
      'Download GSTR-2B statement on 12th Oct',
    ],
    history: [
      { timestamp: '11 Oct 2026, 00:00 IST', actor: 'Filing Sentinel', action: 'Daily countdown broadcast' },
    ],
  },
]

export function getAlertDetailsList(): AlertDetailItem[] {
  return ALERT_DETAILS_DATA
}

export interface AlertRuleItem {
  id: string
  name: string
  conditionSummary: string
  metricType: 'latency' | 'error_rate' | 'confidence_drop' | 'review_queue_age' | 'itc_at_risk' | 'days_to_deadline'
  metricCondition: string
  windowMinutes: number
  severity: Severity
  channels: ('in_app' | 'email' | 'whatsapp' | 'sms')[]
  enabled: boolean
  lastFired: string
  source: 'Pipeline' | 'AI quality' | 'Rules' | 'Review queue' | 'Filing' | 'Vendors'
}

export const ALERT_RULES_DATA: AlertRuleItem[] = [
  {
    id: 'RULE-01',
    name: 'Read Stage Latency Spike',
    conditionSummary: 'Read p95 latency above 8s for 10 min',
    metricType: 'latency',
    metricCondition: 'Read p95 latency > 8.0s',
    windowMinutes: 10,
    severity: 'critical',
    channels: ['in_app', 'email', 'whatsapp'],
    enabled: true,
    lastFired: '11 Oct 2026, 09:42 IST',
    source: 'Pipeline',
  },
  {
    id: 'RULE-02',
    name: 'Extraction Confidence Plunge',
    conditionSummary: 'Field confidence below 80% on >5 consecutive invoices',
    metricType: 'confidence_drop',
    metricCondition: 'Field confidence < 80%',
    windowMinutes: 15,
    severity: 'high',
    channels: ['in_app', 'email'],
    enabled: true,
    lastFired: '10 Oct 2026, 21:15 IST',
    source: 'AI quality',
  },
  {
    id: 'RULE-03',
    name: 'Review Queue SLA Threshold',
    conditionSummary: 'Review queue oldest item exceeds 3 hours',
    metricType: 'review_queue_age',
    metricCondition: 'Oldest item age > 3h',
    windowMinutes: 5,
    severity: 'high',
    channels: ['in_app', 'whatsapp'],
    enabled: true,
    lastFired: '11 Oct 2026, 10:15 IST',
    source: 'Review queue',
  },
  {
    id: 'RULE-04',
    name: 'ITC Clawback Exposure Alert',
    conditionSummary: 'Unreconciled ITC at risk exceeds ₹50,000 within 5 days of filing',
    metricType: 'itc_at_risk',
    metricCondition: 'ITC at risk > ₹50,000 && Days <= 5',
    windowMinutes: 60,
    severity: 'critical',
    channels: ['in_app', 'email', 'whatsapp'],
    enabled: true,
    lastFired: '09 Oct 2026, 12:00 IST',
    source: 'Filing',
  },
  {
    id: 'RULE-05',
    name: 'Pipeline Error Rate Warning',
    conditionSummary: 'Document processing failure rate exceeds 3% over 15 min',
    metricType: 'error_rate',
    metricCondition: 'Error rate > 3.0%',
    windowMinutes: 15,
    severity: 'high',
    channels: ['in_app', 'email'],
    enabled: true,
    lastFired: '08 Oct 2026, 14:20 IST',
    source: 'Pipeline',
  },
  {
    id: 'RULE-06',
    name: 'GSTR-3B Statutory Deadline Countdown',
    conditionSummary: 'Days until GSTR-3B due date is 3 days or fewer',
    metricType: 'days_to_deadline',
    metricCondition: 'Days to GSTR-3B <= 3',
    windowMinutes: 1440,
    severity: 'critical',
    channels: ['in_app', 'email', 'whatsapp', 'sms'],
    enabled: false,
    lastFired: 'Never',
    source: 'Filing',
  },
]

export function getAlertRulesList(): AlertRuleItem[] {
  return ALERT_RULES_DATA
}

export interface NotificationChannelStatus {
  id: 'in_app' | 'email' | 'whatsapp' | 'sms'
  name: string
  target: string
  active: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  lastTested: string
}

export const NOTIFICATION_CHANNELS_DATA: NotificationChannelStatus[] = [
  {
    id: 'in_app',
    name: 'In-App Notification Center',
    target: 'All active finance workspace members',
    active: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    lastTested: '11 Oct 2026, 08:00 IST',
  },
  {
    id: 'email',
    name: 'Email Dispatch (SES)',
    target: 'finance-ops@folio-tax.in, controller@folio-tax.in',
    active: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:30',
    lastTested: '10 Oct 2026, 18:30 IST',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    target: '+91 98201 99402 (Lead Controller Aditi M.)',
    active: true,
    quietHoursEnabled: true,
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
    lastTested: '11 Oct 2026, 09:43 IST',
  },
  {
    id: 'sms',
    name: 'SMS Gateway (GupShup)',
    target: '+91 98201 99402 (Fallback only)',
    active: false,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    lastTested: '01 Oct 2026, 12:00 IST',
  },
]

export function getNotificationChannels(): NotificationChannelStatus[] {
  return NOTIFICATION_CHANNELS_DATA
}

// ==========================================
// README 09 — INVOICE TRACE & LOG EXPLORER DATA
// ==========================================

export interface TraceWaterfallStage {
  stage: 'Ingest' | 'Preprocess' | 'Read' | 'Validate' | 'Reconcile' | 'Notify'
  startMs: number
  durationMs: number
  status: 'succeeded' | 'needs_review' | 'failed'
  service: string
}

export interface TraceStageDetails {
  inputs: Record<string, any>
  outputs: Record<string, any>
  modelVersion?: string
  ruleTableVersion?: string
  detailsText: string
  extractedFields?: {
    name: string
    value: string
    confidence: number
  }[]
  ruleEvaluations?: {
    code: string
    name: string
    kind: 'Deterministic' | 'AI-assisted'
    formula: string
    passed: boolean
    message: string
  }[]
  reconcileMatches?: {
    source: string
    matched: boolean
    varianceRupees: number
    notes: string
  }[]
}

export interface TraceEditHistoryItem {
  id: string
  fieldName: string
  oldValue: string
  newValue: string
  user: string
  userAvatar: string
  timestamp: string
  reason: string
}

export interface InvoiceTraceItem {
  id: string
  invoiceNumber: string
  vendor: string
  vendorGstin: string
  totalDurationMs: number
  verdict: 'Succeeded' | 'Needs review' | 'Failed'
  currentStage: string
  timestamp: string
  stageStatus: {
    ingest: 'succeeded' | 'failed'
    preprocess: 'succeeded' | 'failed'
    read: 'succeeded' | 'needs_review' | 'failed'
    validate: 'succeeded' | 'needs_review' | 'failed'
    reconcile: 'succeeded' | 'needs_review' | 'failed'
    notify: 'succeeded' | 'failed'
  }
  waterfall: TraceWaterfallStage[]
  stages: {
    ingest: TraceStageDetails
    preprocess: TraceStageDetails
    read: TraceStageDetails
    validate: TraceStageDetails
    reconcile: TraceStageDetails
    notify: TraceStageDetails
  }
  editsTimeline: TraceEditHistoryItem[]
  rawJson: Record<string, any>
}

export const INVOICE_TRACES_DATA: InvoiceTraceItem[] = [
  {
    id: 'INV-2026-0422',
    invoiceNumber: 'DPT/26-27/0411',
    vendor: 'Deccan Precision Tools',
    vendorGstin: '27AABCU9603R1ZM',
    totalDurationMs: 4850,
    verdict: 'Needs review',
    currentStage: 'Validate',
    timestamp: '11 Oct 2026, 09:12:44 IST',
    stageStatus: {
      ingest: 'succeeded',
      preprocess: 'succeeded',
      read: 'needs_review',
      validate: 'needs_review',
      reconcile: 'succeeded',
      notify: 'succeeded',
    },
    waterfall: [
      { stage: 'Ingest', startMs: 0, durationMs: 240, status: 'succeeded', service: 'folio-ingest-s3' },
      { stage: 'Preprocess', startMs: 240, durationMs: 610, status: 'succeeded', service: 'folio-cv-deskew' },
      { stage: 'Read', startMs: 850, durationMs: 2420, status: 'needs_review', service: 'folio-ocr-surya-v2' },
      { stage: 'Validate', startMs: 3270, durationMs: 680, status: 'needs_review', service: 'folio-rule-engine-py' },
      { stage: 'Reconcile', startMs: 3950, durationMs: 580, status: 'succeeded', service: 'folio-gsp-gateway' },
      { stage: 'Notify', startMs: 4530, durationMs: 320, status: 'succeeded', service: 'folio-webhook-bus' },
    ],
    stages: {
      ingest: {
        inputs: { source: 'Email webhook (procurement@company.in)', mime: 'application/pdf', sizeBytes: 1842910 },
        outputs: { s3Uri: 's3://folio-vault/2026/10/INV-2026-0422.pdf', sha256: '9f83ab29...b821' },
        modelVersion: 'v1.4.0 (Ingest Daemon)',
        ruleTableVersion: 'N/A',
        detailsText: 'Validated PDF magic bytes, antivirus scan cleared, uploaded to encrypted staging tier.',
      },
      preprocess: {
        inputs: { pages: 2, dpi: 300, skewAngleDegrees: 1.4 },
        outputs: { deskewApplied: true, contrastNormalized: true, binarizedPages: 2 },
        modelVersion: 'OpenCV 4.10 / Deskew v2.1',
        ruleTableVersion: 'N/A',
        detailsText: 'Deskewed rotation by 1.4 degrees clockwise and normalized thermal paper contrast.',
      },
      read: {
        inputs: { imageTensors: '2x 2480x3508', promptTemplate: 'tax_invoice_v4_in' },
        outputs: { fieldCount: 28, meanConfidence: 0.842 },
        modelVersion: 'Gemini 2.5 Flash Multimodal OCR v2026.09',
        ruleTableVersion: 'N/A',
        detailsText: 'Extracted 28 structured fields. Line 3 HSN code confidence dipped to 74% due to faint ink.',
        extractedFields: [
          { name: 'Supplier GSTIN', value: '27AABCU9603R1ZM', confidence: 0.99 },
          { name: 'Invoice Number', value: 'DPT/26-27/0411', confidence: 0.98 },
          { name: 'Invoice Date', value: '11/10/2026', confidence: 0.97 },
          { name: 'Line 3 HSN', value: '8471 (needs 8-digit)', confidence: 0.74 },
          { name: 'Taxable Amount', value: '₹1,20,762.71', confidence: 0.91 },
          { name: 'CGST 9%', value: '₹10,868.64', confidence: 0.88 },
          { name: 'SGST 9%', value: '₹10,868.64', confidence: 0.88 },
          { name: 'Total Gross', value: '₹1,42,500.00', confidence: 0.99 },
        ],
      },
      validate: {
        inputs: { rulesRun: 9, jurisdiction: 'Maharashtra (27) to Maharashtra (27)' },
        outputs: { passCount: 7, failCount: 2, blockers: 1 },
        modelVersion: 'N/A (Deterministic Rule Engine)',
        ruleTableVersion: 'CBIC Master Table v2026.10',
        detailsText: 'Flagged 2 validation exceptions: 4-digit HSN requires 8-digit tariff, and minor roundoff adjustment.',
        ruleEvaluations: [
          { code: 'R-101', name: 'GSTIN checksum & state prefix', kind: 'Deterministic', formula: 'Mod36Check(GSTIN) == true', passed: true, message: 'Checksum valid for Maharashtra prefix 27' },
          { code: 'R-102', name: 'Tax type vs POS', kind: 'Deterministic', formula: 'POS == SupplierState ? CGST+SGST : IGST', passed: true, message: 'Intra-state supply with CGST/SGST' },
          { code: 'R-103', name: 'HSN tariff lookup', kind: 'Deterministic', formula: 'LookupRate(HSN, Date) == Rate', passed: false, message: 'HSN 8471 must be expanded to 8-digit tariff item per CBIC mandate' },
          { code: 'R-104', name: 'Line item math verification', kind: 'Deterministic', formula: 'Qty * Rate == LineTotal', passed: true, message: 'Line totals balance within ₹0.02' },
          { code: 'R-105', name: 'Tax fraction math', kind: 'Deterministic', formula: 'Sum(LineTax) == TotalTax', passed: false, message: 'Round-off variance of ₹1.45 exceeds ₹1 limit' },
          { code: 'R-106', name: 'Duplicate invoice collision', kind: 'AI-assisted', formula: 'ProbDuplicate < 0.85', passed: true, message: 'No duplicate records found in ledger' },
        ],
      },
      reconcile: {
        inputs: { period: 'September 2026', bookItcRupees: 21737.28 },
        outputs: { matchedIn2B: true, itcEligible: true },
        modelVersion: 'GSP Auto-Reconciler v3.2',
        ruleTableVersion: 'GSTR-2B Snapshot 10-Oct',
        detailsText: 'Matched with GSTR-2B purchase feed. Supplier filed outward supply under Section 37.',
        reconcileMatches: [
          { source: 'GSTR-2B Portal Stream', matched: true, varianceRupees: 0, notes: 'Exact match on GSTIN, Invoice No, and Taxable Value' },
          { source: 'E-Way Bill System', matched: true, varianceRupees: 0, notes: 'EWB #998124012 valid during transit' },
        ],
      },
      notify: {
        inputs: { webhookUrl: 'https://erp.internal/webhooks/gst-inward' },
        outputs: { httpStatus: 200, responseMs: 320 },
        modelVersion: 'Webhook Bus v2',
        ruleTableVersion: 'N/A',
        detailsText: 'Dispatched status update to ERP ledger queue with correlation ID trace-inv-0422.',
      },
    },
    editsTimeline: [
      {
        id: 'edit-1',
        fieldName: 'Line 3 HSN',
        oldValue: '8471',
        newValue: '84713010',
        user: 'Aditi Mehta (Lead Tax Controller)',
        userAvatar: 'AM',
        timestamp: '11 Oct 2026, 09:25 IST',
        reason: 'Specified 8-digit tariff code for laptop computers per CBIC schedule',
      },
      {
        id: 'edit-2',
        fieldName: 'Round-off variance',
        oldValue: '₹1.45',
        newValue: '₹0.00 (Adjusted)',
        user: 'Aditi Mehta (Lead Tax Controller)',
        userAvatar: 'AM',
        timestamp: '11 Oct 2026, 09:26 IST',
        reason: 'Authorized fractional invoice round-off override',
      },
    ],
    rawJson: {
      traceId: 'tr-0422-7718-4921',
      invoiceId: 'INV-2026-0422',
      vendor: { name: 'Deccan Precision Tools', gstin: '27AABCU9603R1ZM' },
      verdict: 'Needs review',
      totalDurationMs: 4850,
      timestamp: '2026-10-11T03:42:44Z',
      stages: ['Ingest', 'Preprocess', 'Read', 'Validate', 'Reconcile', 'Notify'],
      metrics: { confidence: 0.842, rulePassRate: 0.777 },
    },
  },
  {
    id: 'INV-2026-0418',
    invoiceNumber: 'NS/INV/884',
    vendor: 'Northstar Supplies',
    vendorGstin: '29AABCS1429B1ZB',
    totalDurationMs: 2940,
    verdict: 'Failed',
    currentStage: 'Validate',
    timestamp: '11 Oct 2026, 09:35:10 IST',
    stageStatus: {
      ingest: 'succeeded',
      preprocess: 'succeeded',
      read: 'succeeded',
      validate: 'failed',
      reconcile: 'failed',
      notify: 'succeeded',
    },
    waterfall: [
      { stage: 'Ingest', startMs: 0, durationMs: 190, status: 'succeeded', service: 'folio-ingest-s3' },
      { stage: 'Preprocess', startMs: 190, durationMs: 480, status: 'succeeded', service: 'folio-cv-deskew' },
      { stage: 'Read', startMs: 670, durationMs: 1450, status: 'succeeded', service: 'folio-ocr-surya-v2' },
      { stage: 'Validate', startMs: 2120, durationMs: 540, status: 'failed', service: 'folio-rule-engine-py' },
      { stage: 'Reconcile', startMs: 2660, durationMs: 120, status: 'failed', service: 'folio-gsp-gateway' },
      { stage: 'Notify', startMs: 2780, durationMs: 160, status: 'succeeded', service: 'folio-webhook-bus' },
    ],
    stages: {
      ingest: {
        inputs: { source: 'Batch upload', sizeBytes: 940212 },
        outputs: { s3Uri: 's3://folio-vault/2026/10/INV-2026-0418.pdf' },
        detailsText: 'Processed via bulk upload drop-zone.',
      },
      preprocess: {
        inputs: { pages: 1, dpi: 300 },
        outputs: { deskewApplied: false },
        detailsText: 'High resolution digital vector PDF; preprocessing bypassed.',
      },
      read: {
        inputs: { textLayers: true },
        outputs: { fieldCount: 24, meanConfidence: 0.985 },
        modelVersion: 'Gemini 2.5 Flash Multimodal OCR v2026.09',
        detailsText: 'Direct PDF text stream parsing achieved 98.5% confidence across all line items.',
        extractedFields: [
          { name: 'Supplier GSTIN', value: '29AABCS1429B1ZB', confidence: 0.99 },
          { name: 'Invoice Number', value: 'NS/INV/884', confidence: 0.99 },
          { name: 'Invoice Date', value: '11/10/2026', confidence: 0.99 },
          { name: 'Total Gross', value: '₹2,18,400.00', confidence: 0.99 },
        ],
      },
      validate: {
        inputs: { rulesRun: 9 },
        outputs: { passCount: 6, failCount: 3, blockers: 1 },
        modelVersion: 'Deterministic Rule Engine',
        ruleTableVersion: 'CBIC Master Table v2026.10',
        detailsText: 'Blocker failure: GSTIN Mod36 checksum failed on supplier tax ID 29AABCS1429B1ZB.',
        ruleEvaluations: [
          { code: 'R-101', name: 'GSTIN checksum', kind: 'Deterministic', formula: 'Mod36Check(GSTIN) == true', passed: false, message: 'Invalid 14th checksum digit (expected 2, found B)' },
          { code: 'R-104', name: 'Line item math verification', kind: 'Deterministic', formula: 'Qty * Rate == LineTotal', passed: false, message: 'Line 2 math discrepancy of ₹500' },
        ],
      },
      reconcile: {
        inputs: { period: 'September 2026' },
        outputs: { matchedIn2B: false },
        detailsText: 'Skipped GSTR-2B matching due to upstream invalid supplier GSTIN identifier.',
      },
      notify: {
        inputs: { alertLevel: 'Critical' },
        outputs: { dispatched: true },
        detailsText: 'Sent escalation signal ALT-1092 to PagerDuty & controller review queue.',
      },
    },
    editsTimeline: [],
    rawJson: {
      traceId: 'tr-0418-9122-3810',
      invoiceId: 'INV-2026-0418',
      vendor: { name: 'Northstar Supplies', gstin: '29AABCS1429B1ZB' },
      verdict: 'Failed',
      totalDurationMs: 2940,
    },
  },
  {
    id: 'INV-2026-0412',
    invoiceNumber: 'SL-8841-B',
    vendor: 'Shiva Logistics',
    vendorGstin: '27AAACS1234A1Z5',
    totalDurationMs: 2150,
    verdict: 'Succeeded',
    currentStage: 'Notify',
    timestamp: '11 Oct 2026, 08:44:19 IST',
    stageStatus: {
      ingest: 'succeeded',
      preprocess: 'succeeded',
      read: 'succeeded',
      validate: 'succeeded',
      reconcile: 'succeeded',
      notify: 'succeeded',
    },
    waterfall: [
      { stage: 'Ingest', startMs: 0, durationMs: 140, status: 'succeeded', service: 'folio-ingest-s3' },
      { stage: 'Preprocess', startMs: 140, durationMs: 390, status: 'succeeded', service: 'folio-cv-deskew' },
      { stage: 'Read', startMs: 530, durationMs: 980, status: 'succeeded', service: 'folio-ocr-surya-v2' },
      { stage: 'Validate', startMs: 1510, durationMs: 310, status: 'succeeded', service: 'folio-rule-engine-py' },
      { stage: 'Reconcile', startMs: 1820, durationMs: 210, status: 'succeeded', service: 'folio-gsp-gateway' },
      { stage: 'Notify', startMs: 2030, durationMs: 120, status: 'succeeded', service: 'folio-webhook-bus' },
    ],
    stages: {
      ingest: {
        inputs: { source: 'API direct' },
        outputs: { s3Uri: 's3://folio-vault/2026/10/INV-2026-0412.pdf' },
        detailsText: 'Direct JSON + PDF payload via ERP connector.',
      },
      preprocess: {
        inputs: { pages: 1 },
        outputs: { deskewApplied: false },
        detailsText: 'Image quality pristine; pass through.',
      },
      read: {
        inputs: { fieldCount: 22 },
        outputs: { meanConfidence: 0.992 },
        modelVersion: 'Gemini 2.5 Flash Multimodal OCR v2026.09',
        detailsText: 'All fields extracted with >98% individual confidence.',
        extractedFields: [
          { name: 'Supplier GSTIN', value: '27AAACS1234A1Z5', confidence: 0.99 },
          { name: 'Total Gross', value: '₹86,400.00', confidence: 0.99 },
        ],
      },
      validate: {
        inputs: { rulesRun: 9 },
        outputs: { passCount: 9, failCount: 0 },
        modelVersion: 'Deterministic Rule Engine',
        ruleTableVersion: 'CBIC Master Table v2026.10',
        detailsText: '100% deterministic rule check compliance.',
      },
      reconcile: {
        inputs: { period: 'September 2026' },
        outputs: { matchedIn2B: true },
        detailsText: 'Verified against GSTR-2B; 100% ITC claim eligible.',
      },
      notify: {
        inputs: { destination: 'Zoho Books ERP' },
        outputs: { voucherPosted: true },
        detailsText: 'Successfully posted purchase voucher to general ledger.',
      },
    },
    editsTimeline: [],
    rawJson: {
      traceId: 'tr-0412-1144-8891',
      invoiceId: 'INV-2026-0412',
      vendor: { name: 'Shiva Logistics', gstin: '27AAACS1234A1Z5' },
      verdict: 'Succeeded',
      totalDurationMs: 2150,
    },
  },
]

export function getInvoiceTracesList(): InvoiceTraceItem[] {
  return INVOICE_TRACES_DATA
}

export interface LiveLogLine {
  id: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  stage: string
  traceId: string
  message: string
}

export const INITIAL_LIVE_LOGS: LiveLogLine[] = [
  { id: 'log-1', timestamp: '12:20:01.104', level: 'INFO', stage: 'Ingest', traceId: 'tr-0422', message: 'Received multipart payload from webhook gateway (size: 1.84MB)' },
  { id: 'log-2', timestamp: '12:20:01.344', level: 'INFO', stage: 'Preprocess', traceId: 'tr-0422', message: 'Applying OpenCV perspective deskew transform (+1.4 deg)' },
  { id: 'log-3', timestamp: '12:20:01.954', level: 'INFO', stage: 'Read', traceId: 'tr-0422', message: 'Dispatching tensor to Gemini 2.5 Flash inference worker in ap-south-1' },
  { id: 'log-4', timestamp: '12:20:04.374', level: 'WARN', stage: 'Read', traceId: 'tr-0422', message: 'Line item 3 HSN token confidence 0.74 < 0.85 threshold' },
  { id: 'log-5', timestamp: '12:20:05.054', level: 'ERROR', stage: 'Validate', traceId: 'tr-0422', message: 'Rule R-103 failed: HSN 8471 requires 8-digit tariff code' },
  { id: 'log-6', timestamp: '12:20:05.634', level: 'INFO', stage: 'Reconcile', traceId: 'tr-0422', message: 'Found 100% hash match in GSTR-2B cached snapshot' },
  { id: 'log-7', timestamp: '12:20:05.954', level: 'INFO', stage: 'Notify', traceId: 'tr-0422', message: 'Dispatched escalation ALT-1088 to controller Aditi Mehta' },
]

export function getInitialLiveLogs(): LiveLogLine[] {
  return INITIAL_LIVE_LOGS
}

// ==========================================
// README 10 — INCIDENTS, UPTIME & MONITORING SETTINGS DATA
// ==========================================

export interface UptimeDayBar {
  dayIndex: number
  dateString: string
  status: 'healthy' | 'degraded' | 'down'
  uptimePct: number
  incidentTitle?: string
}

export interface ComponentUptimeSummary {
  component: 'Upload' | 'Reading' | 'Validation' | 'Reconciliation' | 'Notifications'
  uptimePct: number
  days: UptimeDayBar[]
}

export interface ActiveIncidentTimelineEvent {
  time: string
  status: 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved'
  description: string
}

export interface ActiveIncidentDetail {
  id: string
  title: string
  severity: Severity
  status: 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved'
  startedAt: string
  eta: string
  affectedComponents: string[]
  currentUpdate: string
  timeline: ActiveIncidentTimelineEvent[]
}

export interface PostmortemIncidentItem {
  id: string
  title: string
  component: 'Upload' | 'Reading' | 'Validation' | 'Reconciliation' | 'Notifications'
  impact: 'degraded' | 'down'
  startedAt: string
  resolvedAt: string
  duration: string
  summary: string
  invoicesDelayed: number
  usersAffected: number
  rootCause: string
  preventiveChanges: string
  timeToDetectMin: number
  timeToResolveMin: number
}

export interface ReliabilityKpiSummary {
  mttdMinutes: number
  mttrMinutes: number
  incidentsThisQuarter: number
  errorBudgetBurnPct: number
  errorBudgetRemainingPct: number
  quarterTargetSla: string
}

export interface MonitoringSettingsConfig {
  latencyLimitMs: number
  errorRateLimitPct: number
  minAccuracyPct: number
  reviewQueueAgeLimitHours: number
  itcAtRiskLimitRupees: number
  logsRetentionDays: 30 | 90 | 365
  tracesRetentionDays: 30 | 90 | 365
  metricsRetentionDays: 30 | 90 | 365
  maskGstinInLogs: boolean
  maskAmountsInLogs: boolean
  excludeInvoiceImagesInTraces: boolean
}

export interface MonitoringAccessMember {
  id: string
  name: string
  role: 'Owner' | 'Accountant' | 'Auditor'
  email: string
  viewMonitoring: boolean
  acknowledgeAlerts: boolean
  manageRules: boolean
}

export function getComponentUptimes(): ComponentUptimeSummary[] {
  const components: ('Upload' | 'Reading' | 'Validation' | 'Reconciliation' | 'Notifications')[] = [
    'Upload',
    'Reading',
    'Validation',
    'Reconciliation',
    'Notifications',
  ]

  return components.map((comp) => {
    const days: UptimeDayBar[] = Array.from({ length: 90 }, (_, i) => {
      const dayNum = 90 - i
      const date = new Date(2026, 9, 11 - i)
      const dateString = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

      let status: 'healthy' | 'degraded' | 'down' = 'healthy'
      let uptimePct = 100
      let incidentTitle: string | undefined = undefined

      if (comp === 'Reading') {
        if (i === 0) {
          status = 'degraded'
          uptimePct = 96.4
          incidentTitle = 'Active: Vision-LLM GPU worker pod throughput slowdown'
        } else if (i === 18) {
          status = 'degraded'
          uptimePct = 97.8
          incidentTitle = 'Memory leak on multi-page TIFF image tiling'
        } else if (i === 42) {
          status = 'down'
          uptimePct = 89.2
          incidentTitle = 'Upstream cloud OCR model endpoint timeout'
        }
      } else if (comp === 'Reconciliation') {
        if (i === 24) {
          status = 'down'
          uptimePct = 91.5
          incidentTitle = 'GST portal GSTR-2B API 502 gateway downtime'
        } else if (i === 55) {
          status = 'degraded'
          uptimePct = 98.2
          incidentTitle = 'NIC e-invoice schema sync delay'
        }
      } else if (comp === 'Validation' && i === 31) {
        status = 'degraded'
        uptimePct = 98.6
        incidentTitle = 'SEZ exemption rule formula regression'
      }

      return {
        dayIndex: dayNum,
        dateString,
        status,
        uptimePct,
        incidentTitle,
      }
    })

    const overallPct =
      comp === 'Reading'
        ? 99.12
        : comp === 'Reconciliation'
        ? 99.45
        : comp === 'Validation'
        ? 99.94
        : comp === 'Upload'
        ? 99.98
        : 99.95

    return {
      component: comp,
      uptimePct: overallPct,
      days,
    }
  })
}

export function getActiveIncident(): ActiveIncidentDetail {
  return {
    id: 'INC-2026-06',
    title: 'Reading stage Vision-LLM GPU worker pod latency degradation',
    severity: 'high',
    status: 'Monitoring',
    startedAt: '11 Oct 2026, 09:12 IST (1h 15m ago)',
    eta: 'Estimated resolution in 25 min (12:45 IST)',
    affectedComponents: ['Reading', 'Human Review Queue'],
    currentUpdate: 'Additional GPU inferencing replicas provisioned in ap-south-1. P95 latency recovering from 13.8s down to 4.9s.',
    timeline: [
      {
        time: '11 Oct 2026, 10:30 IST',
        status: 'Monitoring',
        description: 'New GPU replicas warmed up. Processing backlog drained by 70%. Monitoring OCR accuracy.',
      },
      {
        time: '11 Oct 2026, 09:55 IST',
        status: 'Identified',
        description: 'Identified memory saturation in OCR parsing pods handling batch multi-page scanned PDF documents.',
      },
      {
        time: '11 Oct 2026, 09:30 IST',
        status: 'Investigating',
        description: 'Automated alert ALT-1092 triggered. On-call engineer Rohan Shah paged to investigate elevated Read stage latency.',
      },
    ],
  }
}

export function getPostmortemIncidents(): PostmortemIncidentItem[] {
  return [
    {
      id: 'INC-2026-05',
      title: 'Read stage OCR worker pod memory leak during peak month-end surge',
      component: 'Reading',
      impact: 'degraded',
      startedAt: '08 Sep 2026, 14:30 IST',
      resolvedAt: '08 Sep 2026, 16:15 IST',
      duration: '1h 45m',
      summary: 'Memory footprint in PyTorch Vision worker pods grew unboundedly on high-resolution TIFF images, causing OCR p95 latency to peak at 8.4 seconds.',
      invoicesDelayed: 142,
      usersAffected: 18,
      rootCause: 'Unreleased buffer reference in image tiling utility for scans exceeding 4000x4000 pixels.',
      preventiveChanges: 'Refactored image tiling pipeline to enforce deterministic memory deallocation and added a 50MB per-document cap.',
      timeToDetectMin: 4,
      timeToResolveMin: 105,
    },
    {
      id: 'INC-2026-04',
      title: 'GSTN portal authentication timeout affecting GSTR-2B automated download',
      component: 'Reconciliation',
      impact: 'down',
      startedAt: '24 Aug 2026, 09:10 IST',
      resolvedAt: '24 Aug 2026, 11:45 IST',
      duration: '2h 35m',
      summary: 'GST portal API gateway returned persistent 502 Bad Gateway responses for OTP authorization and GSTR-2B payload download across all tax accounts.',
      invoicesDelayed: 380,
      usersAffected: 42,
      rootCause: 'GSTN upstream sandbox scheduled maintenance window overrun during tax quarter closing.',
      preventiveChanges: 'Implemented automatic fall-back to cached GSTR-2B statements and queueing worker with exponential retry backoff.',
      timeToDetectMin: 2,
      timeToResolveMin: 155,
    },
    {
      id: 'INC-2026-03',
      title: 'Rule engine schema validation regression on Special Economic Zone (SEZ) invoices',
      component: 'Validation',
      impact: 'degraded',
      startedAt: '12 Jul 2026, 18:20 IST',
      resolvedAt: '12 Jul 2026, 19:35 IST',
      duration: '1h 15m',
      summary: 'Invoices issued to SEZ units without IGST payment were incorrectly flagged as rule violation R-102 by deterministic validator.',
      invoicesDelayed: 28,
      usersAffected: 6,
      rootCause: 'Missing lookup exception in GSTIN master dataset for SEZ co-developer registrations.',
      preventiveChanges: 'Added comprehensive SEZ unit flag verification unit test suite with 40 new automated test fixtures.',
      timeToDetectMin: 8,
      timeToResolveMin: 75,
    },
  ]
}

export function getReliabilityKpis(): ReliabilityKpiSummary {
  return {
    mttdMinutes: 4.2,
    mttrMinutes: 88,
    incidentsThisQuarter: 4,
    errorBudgetBurnPct: 34,
    errorBudgetRemainingPct: 66,
    quarterTargetSla: '99.50%',
  }
}

export function getDefaultMonitoringSettings(): MonitoringSettingsConfig {
  return {
    latencyLimitMs: 8000,
    errorRateLimitPct: 2.0,
    minAccuracyPct: 92.0,
    reviewQueueAgeLimitHours: 3.0,
    itcAtRiskLimitRupees: 50000,
    logsRetentionDays: 90,
    tracesRetentionDays: 30,
    metricsRetentionDays: 365,
    maskGstinInLogs: true,
    maskAmountsInLogs: false,
    excludeInvoiceImagesInTraces: false,
  }
}

export function getMonitoringAccessMembers(): MonitoringAccessMember[] {
  return [
    {
      id: 'usr-1',
      name: 'Aditi Mehta',
      role: 'Owner',
      email: 'aditi@folio-tax.in',
      viewMonitoring: true,
      acknowledgeAlerts: true,
      manageRules: true,
    },
    {
      id: 'usr-2',
      name: 'Rohan Shah',
      role: 'Accountant',
      email: 'rohan@folio-tax.in',
      viewMonitoring: true,
      acknowledgeAlerts: true,
      manageRules: true,
    },
    {
      id: 'usr-3',
      name: 'Kavita Nair',
      role: 'Accountant',
      email: 'kavita@folio-tax.in',
      viewMonitoring: true,
      acknowledgeAlerts: true,
      manageRules: false,
    },
    {
      id: 'usr-4',
      name: 'P. K. Singhania & Co.',
      role: 'Auditor',
      email: 'audit@pksinghania.com',
      viewMonitoring: true,
      acknowledgeAlerts: false,
      manageRules: false,
    },
  ]
}
