# README 01 — ML Foundation & Contracts (send this FIRST)

**Product:** Folio reads GST invoices with AI, validates them with a deterministic rule engine, reconciles ITC against GSTR-2B, and scores supplier risk. Principle: **the AI reads, rules decide, humans confirm.** This module builds the engine behind the existing UI.

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

## 1. Repository layout to create
```
ml/
  pyproject.toml  .env.example  Makefile  README.md
  src/folio_ml/
    config.py  logging.py
    contracts/      invoice.py  checks.py  recon.py  vendor.py  signals.py  review.py
    providers/      base.py  fake.py          # Protocols + fakes, filled by later READMEs
    api/            main.py  routes_*.py
    utils/          money.py  dates.py  text.py
  data/             rules/  synthetic/  eval/  samples/
  models/           registry.json
  reports/
  tests/
```

## 2. Contracts (Pydantic v2, in `contracts/`)
Mirror the frontend types. Required models:
- `Box` (page, x0, y0, x1, y1 as 0..1 floats). `Field[T]` with `value: T | None`, `confidence: float` (0..1), `box: Box | None`, `source: Literal['reader','human','rule']`, `edited: bool`.
- `LineItem` (description, hsn, qty, unit, rate, taxable, cgst_pct, sgst_pct, igst_pct, cess_pct as `Field`s with Decimal values).
- `Invoice` (id, source_file_hash, supplier/buyer name+gstin+state, number, date, place_of_supply, reverse_charge, irn, items, totals, status).
- `CheckResult` (check_id, name, status `pass|fail|inconclusive|skipped`, severity `critical|high|medium|low`, kind `deterministic|ai`, expected, found, formula, why_it_matters, fixes: list of action codes, rule_table_version).
- `Verdict` (`safe|fix_first|itc_blocked|needs_review`, reasons, rupee_at_risk).
- `ReconMatch`, `ReconReport`, `VendorRisk`, `ThreatSignal`, `ReviewDecision` as described in later READMEs (create stubs now with docstrings).
- A script `make schema` exports JSON Schema for all contracts to `ml/contracts_schema/*.json` so the frontend can generate TypeScript types.

## 3. API skeleton (FastAPI, versioned under `/v1`)
Stubs that return fixtures for now: `POST /v1/invoices/extract`, `POST /v1/invoices/validate`, `POST /v1/review/route`, `POST /v1/reconcile`, `GET /v1/vendors/{gstin}/risk`, `POST /v1/explain`, `POST /v1/guardrails/screen`, `GET /v1/metrics/{quality,calibration,drift,latency}`, `GET /v1/health`.
- CORS for `http://localhost:3000`. Request-id middleware. Consistent error body `{code, message, request_id}`.
- Env `FOLIO_MODE=live|replay|fake`. In `fake` the whole API works offline from fixtures; this is the demo safety net.

## 4. Tooling
`make setup | test | lint | schema | run | data | eval`. A GitHub Actions workflow that runs `make lint test` on push (no secrets needed).

## 5. Acceptance
- `make run` serves docs at `/docs`; every endpoint returns schema-valid fixtures.
- A contract round-trip test per model (dump then parse equals original).
- Money fields reject floats with a clear error.
