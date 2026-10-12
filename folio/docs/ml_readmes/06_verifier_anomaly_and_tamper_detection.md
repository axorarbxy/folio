# README 06 — Verifier, Anomaly & Tamper Detection (`ml/src/folio_ml/verify/`)

A second line of defense. **The verifier can raise flags; it can never change a value.**

## Ground rules (same in every ML README)
- All code lives in a new top-level folder `ml/` of the monorepo. **Do not touch the Next.js frontend.** Python 3.11, FastAPI, Pydantic v2, pytest, ruff, numpy, pandas, scikit-learn. Pin versions in `pyproject.toml` or `requirements.txt`. Add a new dependency only when the README needs it, and say why in your final report.
- Money is `decimal.Decimal`, never float. Dates are ISO 8601. Times are IST-aware.
- Every model, LLM, OCR, or network call sits behind an interface (`typing.Protocol`) with a `Fake` implementation. **Unit tests must run with no network and no API keys.**
- No secrets in code. Read config from environment with `pydantic-settings`; keep `.env.example` current. Mask personal data (phone, email, bank account) in logs.
- **Legal data is never invented.** Tax rates, state codes, thresholds, and dates go in versioned data files with `source_url`, `effective_from`, and `verified: bool`. Entries with `verified: false` must never produce a "safe" verdict. If you are unsure of a value, leave a clearly marked TODO instead of guessing.
- Deterministic by default: fixed seeds, pinned versions, golden-file tests.
- Output contract = the Pydantic models from README 01. Do not rename fields without updating the contract, the JSON schema export, and the tests.
- Use synthetic data only (README 02). No real invoices or real people's data in the repository.
- Finish with `pytest -q` and `ruff check .` both passing, then report: files created, how to run, what is faked, known gaps.

## 1. Independent verifier (`verifier.py`)
Recompute from the extracted record without trusting the reader's own totals: sums, rounding, date plausibility, supplier state versus GSTIN state code, quantity times rate, tax percentage consistency across lines, currency symbols and units. Emit `VerifierFlag(field, message, severity)`. Add an optional `SmallJudge` Protocol (a compact model or second prompt) with only a `FakeJudge` implemented now.

## 2. Anomaly detection (`anomaly.py`)
Per-supplier statistics, built so they work with little history:
- robust z-score on invoice amounts and quantities (median and MAD)
- `IsolationForest` across suppliers once enough history exists (document the minimum, for example 30 invoices)
- first invoice from a new supplier with an unusually high value
- invoice number sequence gaps or reversals
- unusual timing (weekends are weak evidence only)
- Benford first-digit test only for suppliers with at least 100 invoices, always labeled "weak signal"
Return a score plus a plain-language reason for every flag.

## 3. Near-duplicate detection (`duplicates.py`)
Normalized invoice-number matching, fuzzy supplier match (rapidfuzz), amount and date proximity, and perceptual hash (imagehash) for visually identical scans. Output similarity score and the matched invoice id.

## 4. Tamper heuristics (`tamper.py`)
Be honest: these are heuristics with false positives.
- PDF metadata (producer, creation and modification dates; modified long after creation)
- inconsistent fonts or overlapping text objects in the text layer
- Error Level Analysis on JPEG images, returning suspicious regions as boxes
- mismatch between QR payload and printed values (reuse README 03)
Output regions with confidence and a "how we know" string.

## 5. Output
Everything maps to the `ThreatSignal` contract (kind, severity, status `open`, detail, evidence list with masked values, recommended steps, risk 0..100). Categories: `duplicate_invoice`, `edited_after_approval`, `gstin_name_mismatch`, `bank_detail_change`, `sequence_anomaly`, `tampered_document`, `new_vendor_high_value`.

## 6. Evaluation
On the synthetic set, report precision and recall per signal type, and the false-positive rate on clean invoices. **Tune thresholds on dev only.** Default to conservative thresholds; show "possible" rather than "confirmed" wording.

## 7. API
`POST /v1/signals/scan` (invoice id or payload) and `GET /v1/signals?status=open`.

## Acceptance
Duplicate and tamper injectors from README 02 are detected at a documented rate; clean invoices stay under a documented false-positive rate; every flag carries a reason string.
