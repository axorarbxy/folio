# Folio ML Engine — Known Technical Limitations & Honest Disclosures

Principle: **The AI reads, rules decide, humans confirm.**

This document provides a transparent accounting of technical boundaries, synthetic approximations, and production prerequisites for the Folio ML Engine.

---

## 1. Synthetic Data & Benchmark Validity
- **100% Synthetic Ground Truth**: In compliance with strict data protection guidelines, all invoices, vendor profiles, purchase registers, and GSTR-2B returns in this repository were generated synthetically (`ml/src/folio_ml/datagen/`). No real corporate invoices, proprietary taxpayer filings, or personal identities are included.
- **Holdout Generalization**: All reported metrics (100% error recall, 0% false alarms, 0.0039 ECE) were obtained on deterministic and synthetic degradation holdouts. While layouts reflect standard Indian ERP conventions (Tally, Zoho Books, SAP, Marg, Busy), production deployment requires shadow benchmarking against diverse real-world customer document streams.

---

## 2. Statutory Legal Tables & Rate Verification
- **Unverified Seeds Never Auto-Pass**: In adherence to the Folio Ground Rules, legal data (HSN rates, statutory thresholds, place of supply schedules) is never invented. Sample seed entries in `ml/data/rules/` are marked `verified: false` with TODO citations.
- **Statutory Guard**: Any invoice evaluated against an unverified rate entry is strictly blocked from receiving an automated `"safe"` verdict. It is deterministically routed to Chartered Accountant confirmation (`CONFIRM_RATE_WITH_CA`).
- **Production Prerequisite**: Prior to live deployment, a licensed tax professional must sign off on the active HSN schedule (`ml/data/rules/hsn_rates.yaml`) and update the `verified: true` flag.

---

## 3. Heuristic Nature of Tamper & Anomaly Detection
- **Heuristic Indicators**: The `TamperDetector` inspects PDF metadata headers (producer tags like Photoshop/Canva), timestamp gaps between creation and modification, cryptographic hash alterations, and QR-to-text discrepancies.
- **False Negatives**: Advanced adversaries who re-render tampered vectors through standard printing pipelines (e.g. Ghostscript, headless Chrome) will bypass producer string heuristics.
- **False Positives**: Legitimate finance teams converting invoices between PDF versions or archiving through corporate tools may trigger modification timestamp warnings (`edited_after_approval`). All tamper signals are categorized as advisory alerts rather than definitive criminal fraud verdicts.

---

## 4. Prompt Injection Screener Boundaries
- **Defense in Depth**: The `InjectionScreener` employs robust regexes and unicode normalizers detecting role spoofing, direct overrides, decision manipulation, and zero-width unicode steganography across English, Hindi, and Marathi.
- **Evasion Risks**: Heuristic text screening cannot guarantee 100% immunity against novel obfuscation techniques or multilingual zero-day prompts.
- **Architectural Immunity**: Folio does not rely on LLM prompts to make compliance decisions. The LLM only reads and extracts structured text; all compliance decisions, tax arithmetic, and ITC risk calculations are executed by deterministic Python rules. An attacker who bypasses the screener cannot alter the rule engine's verdict.

---

## 5. E-Invoice QR Public Key Cryptography
- **JWT Extraction vs Verification**: The QR decoder extracts and normalizes the CBIC RS256 JWT payload, verifying that printed supplier GSTIN, invoice number, and grand total match the signed barcode.
- **NIC Public Key Provisioning**: Cryptographic RSA signature verification against the National Informatics Centre (NIC) public certificate authority is marked `# TODO: NIC RSA key verification`. In offline development, payloads are validated syntactically and cross-checked against invoice text. Production deployment requires linking the official NIC/CBIC public key certificate store.
