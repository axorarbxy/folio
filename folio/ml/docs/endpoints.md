# Folio ML Engine — Frontend Endpoint Integration Map

This document provides the authoritative mapping between Folio ML FastAPI endpoints and the Next.js frontend pages. UI engineers can replace mock imports page-by-page using the contracts below.

---

## Endpoint Mapping Table

| HTTP Method | API Path | Request Body | Response Contract | Target Frontend Page | Purpose |
|---|---|---|---|---|---|
| `GET` | `/v1/health` | None | `{"status": "ok", "mode": "..."}` | `app/dashboard/page.tsx` | System health and execution mode banner |
| `POST` | `/v1/invoices/extract` | Multipart file or `{"file_path": "..."}` | `Invoice` | `app/invoices/upload/page.tsx` | OCR/VLM extraction of line items & totals |
| `POST` | `/v1/invoices/validate` | `Invoice` | `ValidationResponse` (`Verdict`) | `app/invoices/[id]/page.tsx` | Deterministic 11-rule compliance verdict & fix codes |
| `GET` | `/v1/invoices/{id}` | None | `Invoice` | `app/invoices/[id]/page.tsx` | View structured invoice payload and bounding boxes |
| `GET` | `/v1/rules` | None | `list[dict]` (Rule metadata) | `app/monitoring/rules/page.tsx` | Rulebook catalog, formulas, and legal references |
| `POST` | `/v1/review/decision` | `ReviewDecision` | `ReviewDecision` | `app/review/page.tsx` | Record human approval/override in compliance audit log |
| `POST` | `/v1/recon/match` | Multipart GSTR-2B + PR CSV | `ReconReport` | `app/reconciliation/page.tsx` | Multi-tier reconciliation, 8 buckets, and ₹ at risk |
| `POST` | `/v1/recon/simulate` | `{"action": "...", ...}` | `SimulateResponse` | `app/reconciliation/page.tsx` | What-if simulation on ITC recovery from supplier filings |
| `POST` | `/v1/recon/resolve` | `{"match_id": "...", "resolution": "..."}` | `ResolveResponse` | `app/reconciliation/page.tsx` | Resolve reconciliation mismatch with accounting action |
| `GET` | `/v1/vendors/{gstin}/risk` | None | `VendorRisk` | `app/vendors/[gstin]/page.tsx` | Explainable vendor risk score (0-100), Beta interval, tag |
| `POST` | `/v1/vendors/score-batch` | `BatchScoreRequest` (`{"gstins": [...]}`) | `list[VendorRisk]` | `app/vendors/page.tsx` | Vendor master directory table risk column |
| `POST` | `/v1/vendors/events` | `VendorEvent` | `VendorEvent` | `app/vendors/[gstin]/page.tsx` | Record on-time/late return filing or mismatch event |
| `GET` | `/v1/vendors/{gstin}/history` | None | `VendorHistoryResponse` | `app/vendors/[gstin]/page.tsx` | 12-month filing compliance heatmap & audit timeline |
| `POST` | `/v1/explain` | `ExplainRequest` (`{"invoice": ..., "language": "en\|hi\|mr"}`) | `ExplainResponse` | `app/invoices/[id]/dispute/page.tsx` | Number-guarded WhatsApp, Email, & SMS vendor notices |
| `POST` | `/v1/guardrails/screen` | `{"text": "..."}` | `ScreenResult` | `app/invoices/upload/page.tsx` | Screen document text for prompt injections and mask PII |
| `POST` | `/v1/signals/scan` | `ScanRequest` (`{"invoice": ...}`) | `ScanResponse` | `app/invoices/[id]/security/page.tsx` | Tamper heuristics, near-duplicate check, robust z-score |
| `GET` | `/v1/signals` | Query: `?status=open` | `list[ThreatSignal]` | `app/monitoring/threats/page.tsx` | Security & anomaly queue for finance risk team |
| `GET` | `/v1/metrics/{type}` | Path: `quality\|calibration\|drift\|latency` | `dict` | `app/monitoring/page.tsx` | Real-time ML observability and population drift metrics |

---

## Incremental Migration Guide for Frontend

1. **Step 1 — Invoices & Upload**:
   - Replace mock data in `app/invoices/upload/page.tsx` with calls to `POST /v1/invoices/extract`.
   - Pass returned `Invoice` JSON directly to `POST /v1/invoices/validate`. Display `verdict.status` (`safe`, `fix_first`, `itc_blocked`, `needs_review`) and `verdict.rupee_at_risk`.

2. **Step 2 — Human Review & Confirmation**:
   - On `app/review/page.tsx`, when reviewer clicks "Approve", post payload to `POST /v1/review/decision`.

3. **Step 3 — Reconciliation Dashboard**:
   - Replace sample arrays in `app/reconciliation/page.tsx` by uploading GSTR-2B JSON and Purchase Register CSV to `POST /v1/recon/match`.
   - Bind `report.bucket_counts` to dashboard metric cards.

4. **Step 4 — Vendor Directory & Communication**:
   - In `app/vendors/page.tsx`, call `POST /v1/vendors/score-batch` to populate risk badges (`Reliable`, `Watch`, `High risk`).
   - In `app/invoices/[id]/dispute/page.tsx`, call `POST /v1/explain` to display WhatsApp one-click click-to-chat links (`wa_link`).
