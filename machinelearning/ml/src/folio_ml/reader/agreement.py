"""Two-pass consistency and field-level agreement evaluator."""

from decimal import Decimal
from typing import Any

from folio_ml.reader.contracts import AgreementKind, FieldAgreement, RawExtraction, TwoPassResult
from folio_ml.reader.normalize import normalize_string


def compare_field_values(val1: Any, val2: Any) -> AgreementKind:
    """Classifies agreement between two extracted field values."""
    if val1 is None and val2 is None:
        return "exact"
    if val1 is None or val2 is None:
        return "disagree"

    # Exact equality
    if val1 == val2:
        return "exact"

    # Numeric comparisons
    if isinstance(val1, (Decimal, int)) or isinstance(val2, (Decimal, int)):
        try:
            d1 = Decimal(str(val1))
            d2 = Decimal(str(val2))
            if abs(d1 - d2) <= Decimal("0.01"):
                return "numeric_close"
        except Exception:
            pass

    # String normalization comparisons
    if isinstance(val1, str) and isinstance(val2, str):
        if normalize_string(val1).lower() == normalize_string(val2).lower():
            return "normalized_equal"

    return "disagree"


def evaluate_two_pass_agreement(
    pass1: RawExtraction,
    pass2: RawExtraction,
) -> TwoPassResult:
    """Evaluates field-level agreement between two extraction passes."""
    inv1 = pass1.invoice
    inv2 = pass2.invoice

    agreements: dict[str, FieldAgreement] = {}

    # 1. Header fields
    header_fields = [
        ("number", inv1.number.value, inv2.number.value),
        ("date", inv1.date.value, inv2.date.value),
        ("supplier_gstin", inv1.supplier_gstin.value, inv2.supplier_gstin.value),
        ("buyer_gstin", inv1.buyer_gstin.value, inv2.buyer_gstin.value),
        ("place_of_supply", inv1.place_of_supply.value, inv2.place_of_supply.value),
        ("irn", inv1.irn.value, inv2.irn.value),
    ]

    for name, v1, v2 in header_fields:
        kind = compare_field_values(v1, v2)
        agreements[name] = FieldAgreement(field_name=name, pass1_val=v1, pass2_val=v2, agreement=kind)

    # 2. Totals fields
    totals_fields = [
        ("taxable_amount", inv1.totals.taxable_amount.value, inv2.totals.taxable_amount.value),
        ("cgst_amount", inv1.totals.cgst_amount.value, inv2.totals.cgst_amount.value),
        ("sgst_amount", inv1.totals.sgst_amount.value, inv2.totals.sgst_amount.value),
        ("igst_amount", inv1.totals.igst_amount.value, inv2.totals.igst_amount.value),
        ("total_amount", inv1.totals.total_amount.value, inv2.totals.total_amount.value),
    ]

    for name, v1, v2 in totals_fields:
        kind = compare_field_values(v1, v2)
        agreements[name] = FieldAgreement(field_name=name, pass1_val=v1, pass2_val=v2, agreement=kind)

    # 3. Line item count
    item_count_kind = "exact" if len(inv1.items) == len(inv2.items) else "disagree"
    agreements["line_items_count"] = FieldAgreement(
        field_name="line_items_count",
        pass1_val=len(inv1.items),
        pass2_val=len(inv2.items),
        agreement=item_count_kind,
    )

    # Calculate overall agreement score (fraction of non-disagreeing fields)
    agreed_count = sum(1 for a in agreements.values() if a.agreement != "disagree")
    total_fields = len(agreements)
    score = round(agreed_count / total_fields, 3) if total_fields > 0 else 1.0

    return TwoPassResult(
        pass1=pass1,
        pass2=pass2,
        agreements=agreements,
        agreement_score=score,
    )
