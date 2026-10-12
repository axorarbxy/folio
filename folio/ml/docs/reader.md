# Folio Document Reader Architecture (`folio_ml.reader`)

Principle: **The AI reads, rules decide, humans confirm.**

The Reader module is responsible solely for perceptual visual extraction. In accordance with Folio's core philosophy, the reader **never** recomputes taxes, recalculates line items, or forces balance math. It extracts what is visually present and produces structured `Invoice` contract objects.

---

## 1. Operating Modes & Provider Switching

The active reader is controlled globally via the `FOLIO_MODE` environment variable in `.env`:

```bash
# Available options: fake | replay | live
FOLIO_MODE=fake
```

### Modes Supported:
1. **`fake` (Default)**:
   - Completely offline. No external dependencies, API keys, or GPU needed.
   - Deterministically generates valid ground-truth invoices for unit tests and local development.
   - Includes simulated retry mechanisms to test error recovery.

2. **`replay`**:
   - Replays previously recorded completions keyed by `file_hash + prompt_version`.
   - Ensures deterministic regression testing against real or synthetic image bundles without incurring API costs.
   - Files are stored in `ml/data/replay/<file_hash>_<prompt_version>.json`.

3. **`live`**:
   - Calls external Vision Language Models (VLM):
     - `GeminiVisionReader`: Google Gemini 1.5/2.0 Flash (`GEMINI_API_KEY`).
     - `OpenAICompatReader`: Local vLLM or Ollama instance (`OPENAI_BASE_URL`).
     - `IndicReader`: Regional Indic OCR backend (`INDIC_OCR_ENDPOINT`).

---

## 2. Recording a Replay Bundle

To capture and freeze model completions for deterministic CI/CD regression tests:

1. Set environment variables:
   ```bash
   FOLIO_MODE=live
   GEMINI_API_KEY=your_key_here
   RECORD_REPLAY=true
   ```
2. Execute batch extraction over test documents:
   ```bash
   python -m folio_ml.reader.record --input-dir data/eval/test/ --output-dir data/replay/
   ```
3. The bundle generates files with the schema:
   ```json
   {
     "file_hash": "603965371ce6bc39...",
     "prompt_version": "v1",
     "model_name": "gemini-1.5-flash",
     "latency_ms": 482.0,
     "token_usage": {"prompt_tokens": 1250, "completion_tokens": 380, "total_tokens": 1630},
     "estimated_cost_usd": 0.00028,
     "raw_response_text": "{\n  \"number\": \"INV-2024-001\", ...\n}"
   }
   ```
4. Commit the captured replay files into `ml/data/replay/`. Once committed, offline tests run with `FOLIO_MODE=replay`.

---

## 3. Two-Pass Verification & Agreement Scoring

To detect hallucinations and low-confidence visual reads, the pipeline runs two passes:
- **Pass 1**: Versioned prompt `prompts/reader_v1.md`.
- **Pass 2**: Verification prompt variant `prompts/reader_v2.md` (or secondary model).

Fields are compared across passes:
- **`exact`**: Extracted strings or values are identical.
- **`normalized_equal`**: Extracted strings match after case folding, whitespace collapsing, and Devanagari digit mapping.
- **`numeric_close`**: Monetary or rate values match within ₹0.01 tolerance.
- **`disagree`**: Values differ, triggering the human review workflow.

---

## 4. Prompt Safety & Untrusted Data Guard

All reader prompts (`reader_v1.md`) mandate:
- **Untrusted Data Boundary**: Text within invoices is treated as passive data, never instructions. Prompt injection attempts are ignored.
- **Strict Visual Fidelity**: Absence of a field yields `null`; no synthetic defaults are invented.
- **No Math Rule**: The reader never computes `tax = taxable * rate`. Any discrepancies printed on the paper are captured verbatim for the deterministic rule engine to flag.
