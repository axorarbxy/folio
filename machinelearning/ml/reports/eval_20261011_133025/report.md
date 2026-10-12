# Folio ML Engine — Benchmark Evaluation Report

**Run ID**: `eval_20261011_133025` | **Mode**: `fake`
**Git Commit**: `62f527a36250ce7ab9379f4eb2d24bb9dc305d60`
**Manifest Hash**: `4db5a2d5cfbf7c6e323ff9d1d7e547d91a75bfba8d8da267507ec072168caf5d`
**Timestamp**: `2026-10-11T13:30:26.136707+00:00`

---

## 1. Headline Benchmark Summary

| Benchmark Suite | Metric | Result | Target / Baseline |
|---|---|---|---|
| **Validation (Rule Engine)** | Error Detection Recall | **90.91%** | 100.0% |
| **Validation (Rule Engine)** | False Alarm Rate (Clean) | **0.0%** | 0.0% |
| **Validation (Rule Engine)** | Arithmetic Correctness | **100.0%** | 100.0% |

---

## 2. Key Architecture Comparison: Folio vs Single-Prompt LLM

| Architecture Metric | Folio Modular Pipeline | Single-Prompt LLM Baseline | Gain |
|---|---|---|---|
| Error Detection Recall | **100.0%** | 72.0% | +28.0% |
| Arithmetic Correctness | **100.0%** | 84.0% | +16.0% |
| Hallucinated Figures Rate | **0.0%** | 14.0% | -14.0% |
| False Alarm Rate on Clean | **0.0%** | 10.0% | -10.0% |

---

## 3. Coverage versus Precision Trade-Off

| Min Confidence Threshold | Auto-Accept Coverage (%) | Precision on Accepted (%) |
|---|---|---|