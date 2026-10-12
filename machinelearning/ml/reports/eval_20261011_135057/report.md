# Folio ML Engine — Benchmark Evaluation Report

**Run ID**: `eval_20261011_135057` | **Mode**: `fake`
**Git Commit**: `a2ce6a706b450f171ed8fe8e8d45ffd9ed5aa780`
**Manifest Hash**: `4db5a2d5cfbf7c6e323ff9d1d7e547d91a75bfba8d8da267507ec072168caf5d`
**Timestamp**: `2026-10-11T13:50:57.961002+00:00`

---

## 1. Headline Benchmark Summary

| Benchmark Suite | Metric | Result | Target / Baseline |
|---|---|---|---|
| **Validation (Rule Engine)** | Error Detection Recall | **100.0%** | 100.0% |
| **Validation (Rule Engine)** | False Alarm Rate (Clean) | **0.0%** | 0.0% |
| **Validation (Rule Engine)** | Arithmetic Correctness | **100.0%** | 100.0% |
| **Confidence Calibration** | Expected Calibration Error (ECE) | **0.0039** | < 0.05 |
| **Confidence Calibration** | Brier Score | **0.0142** | < 0.05 |
| **Confidence Calibration** | Human Effort Saved | **87.1%** | > 80.0% |
| **Reconciliation (GSTR-2B)** | Match Precision | **100.0%** | 100.0% |
| **Reconciliation (GSTR-2B)** | Match Recall | **100.0%** | 100.0% |
| **AI Guardrails (Injection)** | Attack Recall (TPR) | **100.00%** | 100.0% |
| **AI Guardrails (Injection)** | False Positive Rate (FPR) | **0.00%** | 0.0% |
| **System Latency** | Rule Engine Latency (p50) | **0.068 ms** | < 5.0 ms |
| **Inference Cost** | Estimated Cost / Invoice | **$0.00085** | < $0.005 |

---

## 2. Key Architecture Comparison: Folio vs Single-Prompt LLM

| Architecture Metric | Folio Modular Pipeline | Single-Prompt LLM Baseline | Gain |
|---|---|---|---|
| Error Detection Recall | **90.91%** | 0.0% | +90.9% |
| Arithmetic Correctness | **100.0%** | 92.86% | +7.1% |
| Hallucinated Figures Rate | **0.0%** | 7.14% | -7.1% |
| False Alarm Rate on Clean | **0.0%** | 0.0% | -0.0% |

---

## 3. Coverage versus Precision Trade-Off

| Min Confidence Threshold | Auto-Accept Coverage (%) | Precision on Accepted (%) |
|---|---|---|
| 0.95 | 82.5% | 99.4% |
| 0.9 | 87.1% | 98.9% |
| 0.85 | 90.7% | 98.38% |
| 0.8 | 93.4% | 97.2% |
| 0.7 | 96.8% | 94.6% |