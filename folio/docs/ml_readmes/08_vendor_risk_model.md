# README 08 — Vendor Risk Model (`ml/src/folio_ml/vendor/`)

A supplier score that is explainable and honest about limited history.

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

## 1. Event store
Record per supplier and per month: invoices received, errors found (by rule), mismatches against 2B, filed on time (yes, late, not filed), message sent, response time, GSTIN status checks. SQLite in development, behind a `VendorStore` Protocol. `record_event()` appends; nothing is overwritten.

## 2. Features
Recency-weighted (exponential decay) late-filing rate, mismatch rate, rate-error rate, math-error rate, unresolved-issue count, average response time, tenure, invoice volume, trend (last 3 months versus the prior 3). **Never use** location, name-derived, religion, or company-size proxies as risk features; write a short fairness note in the docs explaining that.

## 3. Scoring
- **Phase 1 (default):** transparent weighted score with Bayesian smoothing (Beta priors) so a supplier with 2 invoices is not rated like one with 200. Output the score (0..100), a credible interval, and `limited_history: true` when the interval is wide.
- **Phase 2 (optional):** logistic regression on generated vendor histories with the outcome "caused ITC loss next period". Generate the histories with a documented simulator in `datagen/`. **State clearly in the model card that labels are synthetic and the model must be retrained on real outcomes before any real use.**
- Calibrate the probability; map to tags `Reliable`, `Watch`, `High risk` with configurable cut-offs.

## 4. Explainability
Return `contributions: [{feature, weight, value, effect_points}]` that sum to the score minus the baseline, so the UI can draw "Why this score?" bars. Also return the 12-month filing history for the heatmap and error-type counts over time.

## 5. API and persistence
`GET /v1/vendors/{gstin}/risk`, `POST /v1/vendors/score-batch`, `POST /v1/vendors/events`, `GET /v1/vendors/{gstin}/history`.

## 6. Tests and acceptance
- A supplier with no history returns a neutral score with `limited_history: true`.
- Monotonicity tests: more late filings never lowers the score; more history narrows the interval.
- Contributions add up exactly (within rounding).
- On the synthetic holdout report AUC and calibration, **labeled synthetic** in the output.
