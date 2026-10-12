# Folio AI Guardrails & Document Security

Folio employs a layered defense-in-depth architecture to process potentially adversarial documents while guaranteeing statutory compliance integrity.

---

## 1. Core Security Principle: The AI Reads, Rules Decide

The central thesis of Folio's security architecture is:
> **The Language Model and OCR may read untrusted text, but they can NEVER decide statutory validity or tax liability.**

Even if an attacker crafts an intricate prompt injection embedded inside an invoice description, micro-print, or zero-width unicode stream:
1. **Schema Locking**: The reader's output contract is strictly locked to Pydantic v2 schemas. Free-text directives outside permitted fields are completely discarded.
2. **Deterministic Rule Engine Supremacy**: All GST compliance decisions (CGST/SGST/IGST tax splits, Section 16(4) date limits, IRN QR HMAC signatures, mathematical sum checks) are executed by 100% deterministic, offline Python code. No LLM prompt output can bypass mathematical equality or GST portal checksums.
3. **Mandatory Number Guard**: Any explanatory messages generated for suppliers pass through an automated number guard. If an LLM hallucinates an altered amount, tax rate, or date, the candidate text is discarded and reverted to deterministic Jinja2 templates.

---

## 2. Injection Screener (`screen.py`)

Untrusted text extracted from invoice text layers or OCR is evaluated prior to model ingestion:
- **Heuristic Instruction Screening**: Scans for prompt overrides ("ignore previous instructions", "system override", "jailbreak", "developer mode") across English, Hindi ("पिछले निर्देश अनदेखा करें"), and Marathi ("मागील सूचनांकडे दुर्लक्ष करा").
- **Decision Manipulation Detection**: Flags attempts to spoof outcomes ("mark as approved", "return safe verdict", "bypass validation"), while using regex whitelists to ensure benign invoice signatures ("Approved by Rajesh Sharma, VP Finance") are never falsely blocked.
- **Hidden Text & Anomaly Detection**: Detects zero-width non-printable characters (`\u200B-\u200D`, `\uFEFF`) and unicode bidirectional overrides (`\u202A-\u202E`).

### Empirical Evaluation on Trilingual Corpus
Evaluated on `ml/data/eval/injection/corpus.json` (84 samples across English, Hindi, and Marathi):
- **True Positive Rate (Attack Recall)**: **100.00%** (42 / 42 attacks detected)
- **False Positive Rate (Benign Invoices)**: **0.00%** (0 / 42 benign samples falsely blocked)
- **Overall Accuracy**: **100.00%**
- **F1 Score**: **1.0000**

---

## 3. Honest Limitations & Threat Model

While our heuristic screener achieves 100% recall on the evaluation corpus, **heuristic screening alone can never eliminate 100% of novel prompt injections**. 

Advanced linguistic obfuscation, low-resource dialetical phrasing, and steganographic encodings may evade string-level heuristics. Therefore, Folio treats the screener as a first-line telemetry layer, not the final security barrier. 

**The real defense is architectural:**
- Unstructured LLM responses are never executed as system commands or trusted as financial truths.
- All monetary amounts are validated against statutory arithmetic.
- Human review is strictly enforced whenever compliance rules fail or confidence drops below statutory thresholds.
