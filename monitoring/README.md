# Folio — Monitoring Module

The **Monitoring** module provides full telemetry, AI extraction quality tracking, and statutory GST filing sentinel capabilities for the Folio GST workspace.

## Module Structure

```
monitoring/
├── app/
│   └── monitoring/
│       ├── page.tsx               # Overview route (/app/monitoring)
│       ├── pipeline/page.tsx      # Pipeline stage flow & throughput
│       ├── extraction/page.tsx    # Vision-LLM extraction & OCR health
│       ├── rules/page.tsx         # GST validation rule engine
│       ├── review/page.tsx        # Human-in-the-loop review queue
│       ├── filing/page.tsx        # Filing deadline sentinel (GSTR-1, 3B, 2B)
│       ├── alerts/page.tsx        # Anomaly and rate limit alerts
│       ├── traces/page.tsx        # Distributed invoice trace waterfalls
│       └── incidents/page.tsx     # Incident history & postmortems
├── components/
│   ├── monitoring-kit.tsx         # Shared UI kit (sub-nav, badges, sparklines, panels)
│   ├── monitoring-overview-workspace.tsx
│   ├── monitoring-pipeline-workspace.tsx
│   ├── monitoring-extraction-workspace.tsx
│   ├── monitoring-rules-workspace.tsx
│   ├── monitoring-review-workspace.tsx
│   ├── monitoring-filing-workspace.tsx
│   ├── monitoring-alerts-workspace.tsx
│   ├── monitoring-traces-workspace.tsx
│   └── monitoring-incidents-workspace.tsx
└── lib/
    └── monitoring-data.ts         # Seeded Indian GST telemetry and mock data
```

## Integration with Frontend

The Next.js application runs from the `frontend/` directory where these components and routes are served via Next.js App Router at `/app/monitoring`.
