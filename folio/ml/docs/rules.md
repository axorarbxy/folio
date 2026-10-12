# Deterministic GST Rule Engine Documentation

Principle: **The AI reads, rules decide, humans confirm.**
No machine learning or probabilistic models are used in this module. All checks are pure Python, deterministic, and execute with strict Decimal arithmetic.

---

## Master Check Table (Checks 1 to 11)

| # | Check ID | Name | Severity | Formula / Condition | Why It Matters | Fix Codes |
|---|----------|------|----------|---------------------|----------------|-----------|
| 1 | `gstin_format_checksum` | GSTIN Format & Checksum | Critical | ISO/IEC 7064 Mod 36,36 algorithm | Invalid GSTIN invalidates tax invoice and blocks buyer's ITC under Section 16(2). | `VERIFY_GSTIN_ON_PORTAL`, `REQUEST_CORRECTED_INVOICE` |
| 2 | `gstin_state_matches_address` | GSTIN State Prefix Match | High | `gstin[:2] == state_code` | State mismatch causes territorial jurisdiction and return filing reconciliation failures. | `CONFIRM_PLACE_OF_SUPPLY`, `VERIFY_GSTIN_ON_PORTAL` |
| 3 | `tax_type_vs_place_of_supply` | Tax Type vs Place of Supply | Critical | `supp_state == pos ? (CGST + SGST) : IGST` | Charging IGST on intra-state supply or CGST+SGST on inter-state disallows tax credit. | `REQUEST_CORRECTED_INVOICE`, `CONFIRM_PLACE_OF_SUPPLY` |
| 4 | `hsn_rate_match` | HSN Schedule Rate Match | High | Longest prefix match in verified rate schedule | Prevents tax short-payment demands under Section 73 or excessive credit disallowance. | `CONFIRM_RATE_WITH_CA`, `REQUEST_CORRECTED_INVOICE` |
| 5 | `line_math` | Line Item Arithmetic | Critical | `qty * rate == taxable` within tolerance | Arithmetic discrepancies on line items invalidate invoice valuation under Section 15. | `REQUEST_CORRECTED_INVOICE` |
| 6 | `tax_math` | Tax & Grand Total Math | Critical | `taxable + cgst + sgst + igst + cess == total` | Grand total must equal component sum within ₹1.00 rounding tolerance (Section 170). | `REQUEST_CORRECTED_INVOICE`, `REQUEST_CREDIT_NOTE` |
| 7 | `invoice_number_format` | Invoice Number Format | Medium | `^[A-Za-z0-9\-\/]{1,16}$` | Rule 46(b) restricts invoice numbers to max 16 alphanumeric, hyphen, and slash characters. | `REQUEST_CORRECTED_INVOICE` |
| 8 | `duplicate_detection` | Duplicate Detection | Critical | `unique(supp_gstin, norm_num, FY)` | Duplicate invoices lead to double taxation demands or fraudulent multiple credit claims. | `CHECK_DUPLICATE`, `REQUEST_CREDIT_NOTE` |
| 9 | `date_validity` | Date Validity | Critical | `invoice_date <= current_date` & valid FY | Invoices cannot legally pre-date supply or exist in future dates. | `REQUEST_CORRECTED_INVOICE` |
| 10 | `irn_presence` | e-Invoice IRN Presence | Critical | `turnover >= 5 Cr -> len(irn) == 64` | Invoices issued without mandatory IRN are void under Rule 48(5); buyer cannot claim ITC. | `ADD_IRN`, `REQUEST_CORRECTED_INVOICE` |
| 11 | `reverse_charge_consistency` | Reverse Charge Consistency | High | `reverse_charge -> supplier_total == taxable` | Under RCM recipient pays tax directly; supplier must not collect tax on invoice. | `REQUEST_CORRECTED_INVOICE` |

---

## Verdict Determination

1. **`safe`**: Granted **ONLY** if every single required rule produces `pass`.
2. **`itc_blocked`**: Triggered when a legal compliance rule (`gstin_format_checksum`, `tax_type_vs_place_of_supply`, `irn_presence`, `reverse_charge_consistency`, `duplicate_detection`) fails. `rupee_at_risk` = total tax amount.
3. **`fix_first`**: Triggered when arithmetic checks (`line_math`, `tax_math`) fail.
4. **`needs_review`**: Triggered when any required check produces `inconclusive` (e.g. unverified legal rate schedule, unknown HSN code, SEZ location, or defensive rule exception).

## Action Codes
Structured remediation actions:
- `REQUEST_CREDIT_NOTE`
- `REQUEST_CORRECTED_INVOICE`
- `VERIFY_GSTIN_ON_PORTAL`
- `CONFIRM_PLACE_OF_SUPPLY`
- `CONFIRM_RATE_WITH_CA`
- `CHECK_DUPLICATE`
- `ADD_IRN`
