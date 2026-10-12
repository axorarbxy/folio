# README 02 — Synthetic Data, Error Injection & Frozen Eval Set (`ml/src/folio_ml/datagen/`)

Everything downstream (reader tests, calibration, rule recall, the pitch numbers) depends on a labeled set. Build a generator, not a folder of screenshots.

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

## 1. Shared GSTIN utility (`utils/gstin.py`, used by many modules)
- `is_valid_format`, `compute_check_char`, `is_valid_gstin`, `make_gstin(state_code, pan, entity_no=1, rng)`.
- Algorithm for the 15th character: for each of the first 14 characters take its index in `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ`, multiply by 1 (even positions, from 0) or 2 (odd positions), add `product // 36 + product % 36` to a running sum, then check char = index `(36 - sum % 36) % 36`. Add unit tests that generate valid GSTINs and confirm that flipping any one character breaks validity. **Do not rely on memory of any real GSTIN.**
- Format: 2-digit state code, 10-character PAN pattern, 1 entity digit/letter, `Z`, 1 check character.

## 2. Invoice generator
- Profiles: 40 fictional suppliers and buyers across at least 8 states with valid generated GSTINs, realistic Indian business names, addresses, and bank-detail-free footers.
- Catalog: 60 products and services with HSN/SAC codes and a plausible rate. Mark every rate in the generator catalog as `generator_only` (it feeds ground truth for tests, it is **not** the legal rate table).
- Layouts: at least 5 distinct templates (simple, tabular, thermal-receipt style, two-column, handwritten-style font). Render PDF (reportlab) and PNG (Pillow). Include Hindi and Marathi label variants (Devanagari, using an OFL-licensed font with its license file) and mixed English-Hindi bills.
- Every invoice gets a ground-truth JSON in the `Invoice` contract plus `labels.json` listing injected errors.

## 3. Degradation (phone-photo simulation)
Rotation, perspective warp, blur, motion blur, low light, glare, shadow, JPEG artifacts, partial crop, noise. Each has a severity 0..3 stored in labels. Use OpenCV or albumentations with a seed.

## 4. Error injection engine
Pluggable injectors, each producing the corrupted invoice **and** the expected failing check ids:
`wrong_rate`, `invalid_gstin`, `math_error_line`, `math_error_total`, `wrong_tax_type` (IGST vs CGST+SGST), `duplicate_invoice`, `bad_date` (future or wrong FY), `missing_irn` (above threshold), `rounding_abuse`, `reverse_charge_mismatch`, `tampered_amount_after_render` (pixel edit on the image for README 07).

## 5. Splits and freezing
- `make data` produces: 300 dev invoices, 100 test invoices (never used for tuning), 30 injection-only adversarial cases (prompt-injection text in footers, white-on-white text, lookalike characters).
- Mix: 50% clean, 50% with 1 to 2 injected errors; 40% digital PDF, 40% phone-photo style, 20% regional-language or handwritten-style.
- Write `data/eval/MANIFEST.json` with file hashes. The test split is frozen: a test fails if any manifest hash changes unless `--refreeze` is passed.
- Also generate a synthetic **GSTR-2B JSON** per period and a purchase register CSV for README 07, including deliberate mismatches, missing invoices, and vendors who "did not file".

## 6. Optional real samples
Create `data/eval/real/` with a README explaining how to add 20 consented, redacted real invoices and label them with a simple CSV template. Keep it git-ignored by default.

## 7. Acceptance
- `make data` is deterministic (same seed, same hashes).
- A visual contact sheet `reports/data_preview.png` shows 24 random samples across layouts and degradations.
- Tests prove each injector flips exactly the labeled checks.
