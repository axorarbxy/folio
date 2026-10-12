"""Verdict determination and rupee-at-risk calculation."""

from decimal import Decimal
from typing import Literal

from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice
from folio_ml.rules.base import Rule


def compute_verdict(
    invoice: Invoice,
    checks: list[CheckResult],
    rules: list[Rule],
) -> Verdict:
    """Computes final compliance verdict and financial exposure.

    Principles:
      - 'safe' ONLY if every required rule is 'pass'.
      - Any 'fail' on legal eligibility (GSTIN, Place of Supply, Reverse Charge) yields 'itc_blocked'.
      - Any other 'fail' (line math, tax math) yields 'fix_first'.
      - Any 'inconclusive' on a required rule yields 'needs_review'.
      - 'rupee_at_risk' reflects the total tax amount or math discrepancy at jeopardy.
    """
    rule_map = {r.id: r for r in rules}

    failed_checks = [c for c in checks if c.status == "fail" and rule_map.get(c.check_id, Rule).required]
    inconclusive_checks = [c for c in checks if c.status == "inconclusive" and rule_map.get(c.check_id, Rule).required]

    total_tax = (
        invoice.totals.cgst_amount.value
        + invoice.totals.sgst_amount.value
        + invoice.totals.igst_amount.value
        + invoice.totals.cess_amount.value
    )

    reasons: list[str] = []
    rupee_at_risk = Decimal("0.00")
    status: Literal["safe", "fix_first", "itc_blocked", "needs_review"]

    if failed_checks:
        itc_blocking_ids = {
            "gstin_format_checksum",
            "tax_type_vs_place_of_supply",
            "reverse_charge_consistency",
            "irn_presence",
            "duplicate_detection",
        }
        has_itc_block = any(c.check_id in itc_blocking_ids for c in failed_checks)

        if has_itc_block:
            status = "itc_blocked"
            rupee_at_risk = total_tax
            reasons = [f"ITC Blocked: {c.name} failed ({c.found})" for c in failed_checks]
        else:
            status = "fix_first"
            # Math discrepancy or rate mismatch
            rupee_at_risk = total_tax
            reasons = [f"Correction Required: {c.name} failed ({c.found})" for c in failed_checks]

    elif inconclusive_checks:
        status = "needs_review"
        rupee_at_risk = total_tax
        reasons = [f"Human Review Required: {c.name} is inconclusive ({c.found})" for c in inconclusive_checks]

    else:
        status = "safe"
        rupee_at_risk = Decimal("0.00")
        reasons = ["All required deterministic GST compliance checks passed successfully."]

    return Verdict(
        status=status,
        reasons=reasons,
        rupee_at_risk=rupee_at_risk,
        checks=checks,
    )
