# README 05 — Deterministic GST Rule Engine (`ml/src/folio_ml/rules/`)

The heart of "rules decide". **No model calls anywhere in this package.** Pure Python, fully unit tested.

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

## 1. Structure
- `Rule` base class with `id`, `name`, `kind = 'deterministic'`, `severity`, `required: bool`, and `run(invoice, ctx) -> CheckResult`.
- `RuleContext`: `as_of` date, `rate_table`, `state_codes`, `thresholds`, `tolerance`, `version`.
- `registry.py` runs rules in a fixed order; a crash in one rule yields an `inconclusive` result plus an alert event, never a silent pass.
- `verdict.py`: **`safe` only if every required rule is `pass`.** Any `fail` produces `fix_first` or `itc_blocked`; any `inconclusive` on a required rule produces `needs_review`. Compute `rupee_at_risk` from the tax amounts involved.

## 2. Versioned data (`data/rules/`, YAML with a loader and schema validation)
- `state_codes.yaml`: GST state and UT codes. Cross-check against an official list and set `verified: false` until a human signs off.
- `hsn_rates.yaml`: rate table with `hsn_prefix`, `description`, `rate_pct`, `effective_from`, `effective_to`, `conditions` (for value-dependent rates), `source_url`, `verified`. **Seed only a small clearly sample set with `verified: false` and TODOs.** The matcher uses longest-prefix match (8, 6, 4, then 2 digits). Unknown code gives `inconclusive`.
- `thresholds.yaml`: e-invoice turnover threshold, rounding tolerance (default ₹1.00), duplicate window, with sources and `verified` flags.
- Every verdict stores the rule table version it used.

## 3. Checks to implement (each with expected, found, formula, why-it-matters, fix codes)
1. `gstin_format_checksum` (supplier and buyer; reuse `utils/gstin.py`)
2. `gstin_state_matches_address`
3. `tax_type_vs_place_of_supply` (same state means CGST+SGST; different state means IGST; SEZ, export, and unregistered cases return `inconclusive` with an explanatory note)
4. `hsn_rate_match` (needs a verified rate entry to pass)
5. `line_math` (quantity times rate minus discount equals taxable)
6. `tax_math` (tax equals taxable times rate; totals equal the sum of parts within tolerance; documented rounding rule)
7. `invoice_number_format`
8. `duplicate_detection` (fingerprint of supplier GSTIN, normalized number, date, total within the financial year)
9. `date_validity` (not in the future; financial-year consistency)
10. `irn_presence` (when the supplier is above the threshold; compare with QR payload if present)
11. `reverse_charge_consistency`
Use `Decimal` with an explicit rounding mode everywhere.

## 4. Fix codes
Structured actions, not prose: `REQUEST_CREDIT_NOTE`, `REQUEST_CORRECTED_INVOICE`, `VERIFY_GSTIN_ON_PORTAL`, `CONFIRM_PLACE_OF_SUPPLY`, `CONFIRM_RATE_WITH_CA`, `CHECK_DUPLICATE`, `ADD_IRN`. The explainer (README 09) turns these into language.

## 5. Testing
- Unit tests for each rule with pass, fail, and edge cases.
- Property-based tests with `hypothesis` for math rules and GSTIN checksum.
- **Mutation test:** run every injector from README 02 and assert the labeled check fails (recall 100% for deterministic error types) and that clean invoices produce no `fail`.
- A test that an unverified rate entry can never yield `pass`.

## 6. API
`POST /v1/invoices/validate` returns the check list, verdict, rupee at risk, and rule table version. Also `GET /v1/rules` listing rules with their kind, last-changed date, and table freshness (feeds the monitoring Rules page).

## Acceptance
`pytest` green, mutation recall reported per error type, and a one-page `ml/docs/rules.md` showing each check's formula.
