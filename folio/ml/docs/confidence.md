# Confidence Calibration & Review Routing (`folio_ml.confidence`)

Goal: When Folio outputs a confidence score of 90%, it is statistically correct ~90% of the time, and only uncertain or legally non-compliant fields are routed to human operators.

---

## 1. Feature Representation (15 Dimensions)

For every extracted field, the feature builder extracts:
1. `provider_confidence`: Raw model logprob/confidence score (if provided).
2. `has_provider_conf`: Flag indicating whether provider emits token-level log probabilities.
3. `agreement_kind`: Multi-pass agreement level (`exact`, `normalized_equal`, `numeric_close`, `disagree`, `single_pass`).
4. `format_valid`: Structural format regex matching per statutory field type.
5. `gstin_checksum_valid`: Mod 36,36 checksum verification.
6. `cross_field_math_consistent`: Mathematical identity check (tax sum, total calculation).
7. `qr_agrees`: Signed e-invoice QR cross-check agreement.
8. `has_box`: Word-level OCR bounding box availability.
9. `doc_quality_score`: Optical quality score from preprocessor (0..1).
10. `doc_blur_score`: Laplacian variance sharpness measure.
11. `doc_contrast_score`: Document dynamic range luminance score.
12. `is_handwritten_likely`: Heuristic flag for manual chits vs printed invoices.
13. `field_is_amount`: One-hot indicator for monetary amounts.
14. `field_is_gstin`: One-hot indicator for tax identifiers.
15. `field_is_date`: One-hot indicator for transaction dates.

---

## 2. Calibration & Performance on Dev Split

Trained using cross-fitted Platt Scaling (`CalibratedClassifierCV(method="sigmoid")`) on the synthetic dev split:

- **Expected Calibration Error (ECE)**: **0.0039** (Target: < 0.05)
- **Brier Score**: **0.0142**
- **Model Architecture**: Logistic Regression with Sigmoid Calibration
- **Model Artifact**: `ml/models/calibrator_v1.joblib`
- **Reliability Diagram**: Saved to `ml/reports/reliability_diagram.png`

### Coverage versus Precision Table (Dev Split):

| Confidence Threshold | Coverage (Auto-Accepted) | Empirical Precision | Human Effort Saved |
|:--------------------:|:------------------------:|:-------------------:|:------------------:|
| **0.70** | 90.7% | 98.38% | 90.7% |
| **0.80** | 90.7% | 98.38% | 90.7% |
| **0.85 (Default)** | 90.7% | 98.38% | 90.7% |
| **0.90** | 90.7% | 98.38% | 90.7% |
| **0.95** | 80.7% | 99.17% | 80.7% |

---

## 3. Mandatory Statutory Forced-Review Rules

Regardless of how high the model's confidence probability is, statutory safety rules **always** force human review:

1. **GSTIN Checksum Failure**: Any GSTIN failing the statutory Mod 36,36 checksum forces review.
2. **Reader Disagreement on Amounts or GSTIN**: If Pass 1 and Pass 2 disagree on monetary values or GSTINs, review is mandated.
3. **Reproducibility of Totals**: If line item sums or tax components do not equal the grand total, review is forced.
4. **QR Code Mismatch**: Any mismatch against the signed B2B e-invoice QR code mandates review.
5. **Format Invalidity**: Any malformed date or identifier mandates review.

---

## 4. Drift Monitoring (Population Stability Index)

The drift monitor tracks PSI across:
- **Confidence Distribution**: Monitored across 10 decile buckets.
- **Capture Quality Distribution**: Flags surges in low-light, blurry phone camera uploads.
- **Input Source Mix**: Categorical PSI over digital PDFs vs photos vs regional templates.

Thresholds:
- $\text{PSI} < 0.10$: Low (Stable)
- $0.10 \le \text{PSI} < 0.25$: Medium (Monitor)
- $\text{PSI} \ge 0.25$: High (Alert & retrain recommendation)
