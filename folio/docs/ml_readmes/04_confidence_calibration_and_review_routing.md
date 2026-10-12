# README 04 — Confidence Calibration & Review Routing (`ml/src/folio_ml/confidence/`)

Goal: when Folio says it is 90% sure, it is right about 90% of the time, and only uncertain fields reach a human.

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

## 1. Feature builder (per field)
`FieldFeatures` with:
- provider confidence or token log-probability if available (else missing flag)
- reader agreement class (exact, normalized-equal, numeric-close, disagree, single-pass)
- format validity (regex per field type), GSTIN checksum validity
- cross-field consistency: line sum equals taxable, tax equals rate times taxable within tolerance, total equals parts, QR payload agrees with extracted value
- OCR box alignment score (or missing flag)
- document quality score, language or handwriting flag, field type
Keep it a plain, testable function with a docstring per feature.

## 2. Model
- Labels: for each field in the dev set, `correct = normalized_equal(extracted, ground_truth)`.
- Train a logistic regression (or small gradient-boosted model if justified), then calibrate with isotonic regression or Platt scaling using cross-fitting. Never calibrate on the data you trained on and never touch the frozen test split.
- Fallback heuristic scorer when no trained artifact exists (so the app always works).
- Save a versioned artifact (`joblib`), a `model_card.json` (data hash, date, metrics, intended use, limits), and register it in `models/registry.json`.

## 3. Metrics (`metrics.py`)
Expected Calibration Error, Brier score, reliability bins (10 bins with counts), accuracy at coverage, and breakdowns by field type, source type (digital, photo, scan), language, and quality bucket. Export JSON in the shape the monitoring UI needs: `{bins: [{pred_mid, actual, n}], ece, brier, by_field, by_source, by_language}`.

## 4. Threshold selection and routing
- `choose_threshold(target_precision=0.98)` finds the lowest confidence at which auto-accepted fields reach the target precision on dev; report the percentage of fields auto-accepted ("human effort saved").
- `route(invoice) -> ReviewDecision` with `auto_accept: list[field]`, `needs_review: list[{field, reason, confidence}]`, `priority`, and plain-language reasons ("GSTIN checksum failed", "Two readings disagree").
- Rules: any failed GSTIN checksum, any total that cannot be reproduced, or any disagreement on an amount field forces review regardless of score. Anything uncertain defaults to review, never to auto-accept.

## 5. Drift
Population Stability Index on the confidence distribution and on input mix (source type, language, quality) comparing a baseline window to a recent window; return severity and a plain message ("Accuracy dropped on phone photos").

## 6. API
`POST /v1/review/route`, `GET /v1/metrics/calibration`, `GET /v1/metrics/drift`.

## Acceptance
- On the dev set after calibration, ECE below 0.05 (report the real number even if worse), and a reliability diagram PNG saved to `reports/`.
- A test proves the forced-review rules cannot be bypassed by a high model score.
- A table in `ml/docs/confidence.md` shows coverage versus precision at five thresholds.
