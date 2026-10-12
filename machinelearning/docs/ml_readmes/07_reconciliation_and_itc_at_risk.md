# README 07 — Reconciliation & ITC-at-Risk (`ml/src/folio_ml/recon/`)

Compare purchase books, GSTR-2B, and e-invoice data, then compute what is at risk before filing.

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

## 1. Inputs and parsers
- `Gstr2bDocument` internal model plus an adapter that parses a GSTR-2B JSON file into it. **Do not hardcode field names from memory.** Look at the synthetic samples from README 02 and any real sample a team member drops in `data/samples/`; write the adapter so a second layout needs one new adapter class, not a rewrite. Capture supplier GSTIN and name, invoice number, date, taxable value, IGST, CGST, SGST, cess, ITC-availability flag with reason, and period.
- `PurchaseRegister` model plus CSV and Excel importers with a column-mapping step.
- Optional e-invoice and e-way bill records as extra evidence sources.

## 2. Normalization
Invoice numbers (case, separators, leading zeros, financial-year prefixes), dates, GSTIN, amounts as Decimal. Keep the original string next to the normalized one for display.

## 3. Matching
1. Exact match on normalized key (supplier GSTIN plus invoice number).
2. Fuzzy match inside the same supplier: rapidfuzz on invoice number, date window (configurable), amount tolerance (configurable).
3. For ambiguous groups, solve an assignment with `scipy.optimize.linear_sum_assignment` using a cost built from those scores.
4. Every match stores a score and the reasons it matched.

## 4. Buckets
`matched`, `value_mismatch` (with per-field differences), `missing_in_2b`, `missing_in_books`, `vendor_not_filed` (books have invoices but 2B has nothing for that supplier in the period), `ineligible` (2B reason code), `duplicate`, `timing_difference` (invoice appears in a neighboring period; treat separately from missing).

## 5. ITC at risk and what-if
- `ReconReport` with per-bucket totals (CGST, SGST, IGST, cess), rupee at risk, and a ranked list of suppliers by exposure.
- `simulate(report, vendors_not_filing: set[str]) -> Impact` returns projected ITC loss; deterministic and instant (feeds the slider in the UI).
- `resolve(match_id, action)` records an outcome (contact vendor, defer, reverse ITC, accept difference) with an audit event.

## 6. Performance and tests
Handle 10,000 invoices in a few seconds (vectorize, index by supplier). Property tests that matching is order-independent and symmetric where expected. Fixtures from README 02 with injected noise (typos in invoice numbers, small amount differences, missing suppliers) must reach a documented match precision and recall.

## 7. API
`POST /v1/reconcile` (period, register, 2B), `POST /v1/reconcile/simulate`, `POST /v1/reconcile/resolve`.

## Acceptance
The synthetic period with known planted mismatches is reconstructed exactly; report match precision, recall, and a confusion table per bucket; `ml/docs/recon.md` explains each bucket in plain language.
