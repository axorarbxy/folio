# Folio Reconciliation & ITC-at-Risk Documentation

The Folio Reconciliation Engine aligns internal accounts payable (Purchase Register) against the government GSTR-2B statement and e-invoice data to protect businesses from statutory Input Tax Credit (ITC) disallowances under Section 16(2)(aa) of the CGST Act.

---

## 1. Statutory Context & Legal Grounding

Under the Indian Goods and Services Tax (GST) framework:
- **Section 16(2)(aa)**: A registered recipient can claim ITC on inward supplies **only if** the supplier has furnished details of the invoice in GSTR-1 / IFF and the details are communicated to the recipient in GSTR-2B.
- **Section 17(5)**: Specifies blocked credits (motor vehicles, food/catering, health services, employee gifts, lost/written-off goods) where ITC is statutorily ineligible regardless of supplier filing.
- **Rule 36(4)**: Restricts provisional ITC claims on unfiled or mismatched invoices.

---

## 2. Reconciliation Buckets Explained

Every line item evaluated by the reconciliation engine is partitioned into one of eight distinct buckets:

| Bucket Name | Plain Language Definition | Statutory / Commercial Impact | Default System Action |
|---|---|---|---|
| `matched` | The invoice exists in both purchase books and GSTR-2B, amounts agree within tolerance (₹1.00), and ITC is marked eligible (`itc_available = "Y"`). | 100% safe to claim. No interest or penalty exposure. | Auto-approved for filing. |
| `value_mismatch` | Invoice numbers and supplier GSTIN match, but the taxable value, tax rates, or total amount differ between books and GSTR-2B. | Availing the higher book amount risks tax demand plus 18% p.a. interest under Section 50(1). | Flagged for review; difference highlighted per field. |
| `missing_in_2b` | The invoice is recorded in internal purchase books, but is absent from GSTR-2B (even though the supplier has filed other invoices in the period). | ITC cannot be availed in the current tax return. | Hold payment or send automated chase alert to supplier. |
| `vendor_not_filed` | Books record invoices from a supplier, but that supplier has filed **zero** invoices in GSTR-2B for the entire period. | Complete ITC disallowance across all purchases from that vendor. | High risk vendor alert; trigger vendor escalation workflow. |
| `missing_in_books` | The invoice appears in GSTR-2B, but no corresponding entry exists in the internal purchase register. | Indicates unrecorded inward supplies, missing purchase bills, or possible fraud/misplaced GSTIN. | Accounts payable notification to verify physical invoice. |
| `ineligible` | The invoice appears in GSTR-2B, but is flagged as ineligible under Section 17(5) or POS rules (`itc_available = "N"`). | Availing credit creates statutory violation and mandatory clawback with penalty. | Ineligible ITC reversed or segregated to expense account. |
| `duplicate` | Multiple entries for the same supplier and invoice number exist within books or within GSTR-2B. | Availing credit more than once triggers Section 73/74 proceedings. | Deduplicated; only primary entry retained. |
| `timing_difference` | The invoice appears in books, but its issuance date or filing period belongs to an adjacent tax period (+/- 1 month). | Credit deferrable to next month's return. | Auto-deferred to appropriate tax period. |

---

## 3. Matching Architecture

1. **Canonical Normalization**:
   - Financial-year prefixes (`FY23-24/`, `2024-25/`) stripped.
   - Punctuation separators (`/`, `-`, `_`, `#`, spaces) removed.
   - Leading zeros stripped (`00104` -> `104`).
   - Alphanumerics upper-cased.
2. **Multi-tier Matching Cascade**:
   - **Tier 1 (Exact Match)**: Matches normalized supplier GSTIN and normalized invoice number.
   - **Tier 2 (Fuzzy Match & Bipartite Hungarian Assignment)**:
     - Uses `rapidfuzz.fuzz.ratio` for typo tolerance.
     - Constrains matching to date proximity window (+/- 30 days) and amount proximity.
     - For ambiguous supplier invoice groups, solves optimal 1-to-1 matching via `scipy.optimize.linear_sum_assignment` minimizing composite cost:
       $$\text{Cost} = (100 - \text{FuzzRatio}) \times 2.0 + \min(\Delta_{\text{days}}, 30) \times 1.5 + \min(\Delta_{\text{amount}}, 100) \times 0.5$$
3. **ITC-at-Risk Calculation**:
   - Total rupee amount at risk is computed deterministically across `vendor_not_filed`, `missing_in_2b`, `value_mismatch`, `ineligible`, and `duplicate` entries.
   - Simulation endpoint allows real-time slider updates: `simulate(report, vendors_not_filing)`.
   - Resolution endpoint logs immutable audit trails for dispute tracking (`contact_vendor`, `defer`, `reverse_itc`, `accept_difference`).

---

## 4. Synthetic Fixture Evaluation & Confusion Matrix

Evaluated against the synthetic test period fixtures (`gstr2b_2024_04.json` and `purchase_register_2024_04.csv`):

### Metric Summary
- **Overall Match Precision**: 100.0%
- **Overall Match Recall**: 100.0%
- **F1 Score**: 1.00

### Bucket Confusion Table

| Ground Truth Bucket | Predicted: `matched` | Predicted: `value_mismatch` | Predicted: `vendor_not_filed` | Predicted: `ineligible` | Total | Recall |
|---|---|---|---|---|---|---|
| `matched` | 1 | 0 | 0 | 0 | 1 | 100.0% |
| `value_mismatch` | 0 | 1 | 0 | 0 | 1 | 100.0% |
| `vendor_not_filed` | 0 | 0 | 1 | 0 | 1 | 100.0% |
| `ineligible` | 0 | 0 | 0 | 1 | 1 | 100.0% |
| **Total** | 1 | 1 | 1 | 1 | 4 | |
| **Precision** | 100.0% | 100.0% | 100.0% | 100.0% | | **100.0%** |

