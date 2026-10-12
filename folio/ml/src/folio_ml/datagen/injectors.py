"""Pluggable error injectors for GST compliance validation and mutation testing.

Each injector takes an Invoice model and returns:
  (corrupted_invoice, expected_failing_check_ids)
"""

import random
from decimal import Decimal

from folio_ml.contracts.invoice import Invoice


def inject_wrong_rate(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Alters tax rate percentage on a line item without altering HSN."""
    corrupted = inv.model_copy(deep=True)
    if corrupted.items:
        item = corrupted.items[0]
        # Flip rate to an invalid rate for that HSN (e.g., 23.5% or 3.0%)
        if item.cgst_pct.value and item.cgst_pct.value > 0:
            item.cgst_pct.value = Decimal("14.00")  # 28% total instead of 18%
            item.sgst_pct.value = Decimal("14.00")
        elif item.igst_pct.value and item.igst_pct.value > 0:
            item.igst_pct.value = Decimal("28.00")
    return corrupted, ["hsn_rate_match"]


def inject_invalid_gstin(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Corrupts check character of supplier GSTIN."""
    corrupted = inv.model_copy(deep=True)
    gstin = corrupted.supplier_gstin.value or "27AABCS1429B1ZB"
    orig_chk = gstin[14]
    alt_chk = "X" if orig_chk != "X" else "Y"
    corrupted.supplier_gstin.value = gstin[:14] + alt_chk
    return corrupted, ["gstin_format_checksum"]


def inject_math_error_line(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Corrupts line taxable amount so qty * rate != taxable."""
    corrupted = inv.model_copy(deep=True)
    if corrupted.items:
        corrupted.items[0].taxable.value += Decimal("500.00")
    return corrupted, ["line_math"]


def inject_math_error_total(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Corrupts grand total so sum of taxable + taxes != total."""
    corrupted = inv.model_copy(deep=True)
    corrupted.totals.total_amount.value += Decimal("1250.00")
    return corrupted, ["tax_math"]


def inject_wrong_tax_type(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Swaps intra-state (CGST+SGST) for inter-state (IGST) or vice versa."""
    corrupted = inv.model_copy(deep=True)
    if corrupted.supplier_state.value == corrupted.buyer_state.value:
        # Same state: should be CGST+SGST, but inject IGST
        tax = corrupted.totals.cgst_amount.value + corrupted.totals.sgst_amount.value
        corrupted.totals.cgst_amount.value = Decimal("0.00")
        corrupted.totals.sgst_amount.value = Decimal("0.00")
        corrupted.totals.igst_amount.value = tax
    else:
        # Inter-state: should be IGST, but inject CGST+SGST
        tax = corrupted.totals.igst_amount.value
        corrupted.totals.igst_amount.value = Decimal("0.00")
        corrupted.totals.cgst_amount.value = tax / Decimal("2")
        corrupted.totals.sgst_amount.value = tax / Decimal("2")
    return corrupted, ["tax_type_vs_place_of_supply"]


def inject_duplicate_invoice(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Marks invoice as duplicate of a previously recorded document."""
    corrupted = inv.model_copy(deep=True)
    # Using a designated duplicate invoice number recognized by duplicate detection
    corrupted.number.value = "DUP-INV-2024-9999"
    corrupted.id = "DUP-INV-2024-9999"
    return corrupted, ["duplicate_detection"]


def inject_bad_date(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Sets invoice date to a future date."""
    corrupted = inv.model_copy(deep=True)
    corrupted.date.value = "2029-12-31"
    return corrupted, ["date_validity"]


def inject_missing_irn(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Clears IRN when supplier has high turnover requiring e-invoicing."""
    corrupted = inv.model_copy(deep=True)
    corrupted.irn.value = None
    # Ensure supplier is a high-turnover entity mandating e-invoicing
    from folio_ml.datagen.profiles import PROFILES

    high_turnover = [p for p in PROFILES if p["annual_turnover_cr"] >= 5.0]
    supp_state = (corrupted.supplier_gstin.value or "")[:2]
    matching = [p for p in high_turnover if p["state_code"] == supp_state]
    chosen = matching[0] if matching else high_turnover[0]
    corrupted.supplier_gstin.value = chosen["gstin"]
    corrupted.supplier_name.value = chosen["name"]
    return corrupted, ["irn_presence"]


def inject_rounding_abuse(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Introduces rounding discrepancies beyond ₹1.00 tolerance."""
    corrupted = inv.model_copy(deep=True)
    corrupted.totals.total_amount.value += Decimal("5.75")
    return corrupted, ["tax_math"]


def inject_reverse_charge_mismatch(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Enables reverse charge flag while still adding tax to total invoice amount."""
    corrupted = inv.model_copy(deep=True)
    corrupted.reverse_charge.value = True
    # Under reverse charge, recipient pays tax, so invoice total charged by supplier shouldn't include tax
    return corrupted, ["reverse_charge_consistency"]


def inject_tampered_amount_after_render(inv: Invoice, rng: random.Random) -> tuple[Invoice, list[str]]:
    """Simulates post-render tampering between extracted payload and visual data."""
    corrupted = inv.model_copy(deep=True)
    # Marks a tamper flag in source file hash or items for detection
    corrupted.source_file_hash = "TAMPERED_" + corrupted.source_file_hash
    return corrupted, ["tamper_detection"]


INJECTORS = {
    "wrong_rate": inject_wrong_rate,
    "invalid_gstin": inject_invalid_gstin,
    "math_error_line": inject_math_error_line,
    "math_error_total": inject_math_error_total,
    "wrong_tax_type": inject_wrong_tax_type,
    "duplicate_invoice": inject_duplicate_invoice,
    "bad_date": inject_bad_date,
    "missing_irn": inject_missing_irn,
    "rounding_abuse": inject_rounding_abuse,
    "reverse_charge_mismatch": inject_reverse_charge_mismatch,
    "tampered_amount_after_render": inject_tampered_amount_after_render,
}

ALL_INJECTORS = list(INJECTORS.values())
