# README 10 — Evaluation, Benchmarks & Model Ops (`ml/src/folio_ml/eval/`)

This turns the work into evidence for the pitch: numbers, charts, and a reproducible pipeline.

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

## 1. Harness
`python -m folio_ml.eval run --suite all|extraction|validation|calibration|recon|vendor|guardrails|latency --mode fake|replay|live`
Each suite writes to `reports/<run_id>/` as JSON, CSV, Markdown, and PNG charts (matplotlib).

## 2. Suites and metrics
- **Extraction:** field-level exact and normalized match, per-field F1, broken down by source type, language, and quality bucket.
- **Validation:** for each injected error type, detection precision, recall, F1; false-alarm rate on clean invoices; arithmetic correctness.
- **Calibration:** ECE, Brier, reliability diagram, coverage versus precision, "human effort saved".
- **Reconciliation:** match precision and recall, per-bucket confusion table.
- **Vendor risk:** AUC and calibration on the synthetic holdout, **labeled synthetic**.
- **Guardrails:** true- and false-positive rates on the injection corpus.
- **Latency and cost:** p50, p95, p99 per stage; tokens and estimated cost per invoice.
- Bootstrap 95% confidence intervals on headline numbers.

## 3. The baseline comparison (your strongest slide)
Implement `baselines/single_prompt.py`: one vision-language call that extracts, validates, and does all arithmetic itself. Run it and the full pipeline on the same frozen test split. Report error-detection recall, arithmetic correctness, and hallucinated values for both, plus a chart. Provide a `FakeBaseline` for offline CI so the suite still runs.

## 4. Discipline
- The frozen test split is never used for tuning. Add a guard that checks the manifest hash and refuses to run tuning code against it.
- Every report records the git commit, config, model versions, rule table version, and data hash.
- `report.md` is written so its tables can be pasted into slides.

## 5. Model ops
- `models/registry.json` with version, artifact hash, training data hash, metrics, date, and status (`candidate|production|retired`); `make promote MODEL=...` only works if the regression gate passes.
- **Regression gate:** compare against `reports/baseline_metrics.json`; fail if headline metrics drop beyond configured thresholds.
- **CI:** GitHub Actions runs lint, unit tests, and the smoke evaluation in `fake` mode on every push.
- **Drift jobs:** scheduled script producing PSI and quality summaries served by `GET /v1/metrics/{quality,drift,latency}` for the Monitoring pages.
- **Demo safety:** `make demo-bundle` records provider responses for the demo invoices so `replay` mode reproduces the demo with no network.
- `make repro` rebuilds data, trains, evaluates, and compares to the published numbers.

## 6. Final integration checklist (do last)
- Every endpoint listed in README 01 returns real results in `replay` mode.
- A table in `ml/docs/endpoints.md` maps each endpoint to the frontend page that should call it, so the UI team can replace mock imports one page at a time.
- Known limitations are written down honestly (synthetic data, unverified rate entries, heuristic tamper detection).

## Acceptance
`make eval` produces a complete report; the baseline comparison chart exists; CI is green; a fresh clone can run `make setup data eval` in `fake` mode with no keys.
