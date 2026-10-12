# Folio Vendor Risk Model — Fairness & Responsible AI Principles

## 1. Statutory Grounding
Under the Indian GST framework, Input Tax Credit (ITC) eligibility is determined by the supplier's actual compliance with statutory obligations (filing GSTR-1, reporting accurate invoices, matching GSTR-2B, and paying tax to the government under Section 16(2)(c) of the CGST Act).

The Folio Vendor Risk Model evaluates suppliers **strictly on observed compliance telemetry**:
- On-time vs late vs non-filing of statutory tax returns.
- Reconciliation discrepancy rates against GSTR-2B.
- Mathematical precision and HSN rate correctness on issued tax invoices.
- Responsiveness to reconciliation discrepancy notices.

## 2. Prohibited Features (Anti-Bias Guarantee)
The Folio ML Engine strictly prohibits the following attributes as features, proxies, or weights:
1. **Geographic Location / State / Pincode**: A vendor in any state or union territory is evaluated solely on compliance behavior, never on location or tier-2/tier-3 geography.
2. **Name-Derived / Linguistic / Cultural Identifiers**: Vendor names, director names, or phonetic proxies are never used.
3. **Firm Size / Balance Sheet Proxies**: Micro, Small, and Medium Enterprises (MSMEs) are not penalized for being small. Low invoice counts trigger the transparent `limited_history: true` badge rather than a punitive high-risk penalty.
4. **Ownership Type / Religion / Community**: Any demographic or socio-economic proxies are strictly excluded.

## 3. Bayesian Smoothing for New / Small Vendors
Suppliers with limited transaction history (e.g. fewer than 5 invoices) are given an uninformative, neutral Beta prior ($\alpha_0=1.5, \beta_0=4.5$) with wide credible intervals and an explicit `limited_history: true` flag. This prevents arbitrary high-risk labeling of newly established businesses.
