# README 09 — Explainer & AI Guardrails (`ml/src/folio_ml/explain/` and `guardrails/`)

Plain-language fixes, plus protection against malicious documents. The language model may **write**, never **decide**.

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

## 1. Explainer
- **Input:** `CheckResult` list, `Verdict`, and an invoice summary. **Output:** per failed check: "what we found", "why it matters", "how to fix" (from fix codes), and a supplier message draft for WhatsApp, email, and SMS in English, Hindi, and Marathi, with polite and firm tones.
- **Template first:** Jinja2 templates are the source of truth. An optional `Polisher` Protocol (LLM) may rephrase, with a `FakePolisher` for tests.
- **Number guard (mandatory):** after any polishing, extract every number, amount, date, GSTIN, and invoice number from the text; each must appear in the structured input. If any extra or altered value appears, discard the polished text and use the template. Log the event. Tests must prove this fires.
- Hindi and Marathi strings are written by hand in template files; anything machine-translated is flagged `needs_native_review: true`.
- `wa.me` link builder with correct URL encoding and length limits. **Never send anything**; the UI shows a draft and the user approves.
- Endpoint `POST /v1/explain`.

## 2. Guardrails against untrusted documents
- Treat all text from invoices and OCR as untrusted. In every prompt wrap it in clear delimiters and state that it is data.
- **Injection screener (`screen.py`):** heuristic scoring for instruction-like phrases in English, Hindi, and Marathi ("ignore previous instructions", "mark as approved", role markers, system-prompt lookalikes), hidden-text signals from the text layer (white-on-white, tiny fonts, off-page text), and unusual density of imperative sentences. Return `{risk, action: strip|block|review, spans: [{start, end, reason}]}`.
- **Schema-locked output:** reader results may only contain contract fields; free text outside the schema is dropped.
- **Optional redaction before external calls:** mask phone numbers, emails, and bank account numbers (never GSTINs, since the reader needs them); controlled by a setting that the Security page toggles.
- **Human-override log:** a function that records any human change to an AI value or acceptance of a flagged invoice with the reason.
- Endpoint `POST /v1/guardrails/screen` returning highlighted spans (powers the "Try it" demo on the AI Safety page, with two preset examples).

## 3. Evaluation
Build a small injection corpus (at least 40 malicious and 40 benign examples, including regional-language ones) in `data/eval/injection/`. Report true-positive and false-positive rates. Be candid in `ml/docs/guardrails.md` that heuristics reduce risk but do not eliminate it, and that the deterministic rule engine plus schema locking is the real defense.

## Acceptance
Number guard tests pass; screener catches the preset examples; benign invoices with ordinary words like "approved by" do not get blocked.
