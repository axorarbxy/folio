"""Per-field confidence feature extraction engine."""

import re
from decimal import Decimal
from typing import Any

import numpy as np
from pydantic import BaseModel

from folio_ml.contracts.invoice import Invoice
from folio_ml.prep.contracts import PreparedDocument
from folio_ml.reader.contracts import TwoPassResult
from folio_ml.utils.gstin import is_valid_gstin


class FieldFeatures(BaseModel):
    """Structured feature vector representing confidence signals for an extracted field."""

    field_name: str
    field_value: Any
    field_type: str  # 'amount', 'gstin', 'date', 'identifier', 'text'
    provider_confidence: float | None = None
    has_provider_conf: bool = True
    agreement_kind: str = "single_pass"  # exact, normalized_equal, numeric_close, disagree, single_pass
    format_valid: bool = True
    gstin_checksum_valid: bool | None = None
    cross_field_math_consistent: bool | None = None
    qr_agrees: bool | None = None
    has_box: bool = False
    doc_quality_score: float = 0.8
    doc_blur_score: float = 0.8
    doc_contrast_score: float = 0.8
    is_handwritten_likely: bool = False
    language: str = "en"


def _check_format_valid(field_type: str, val: Any) -> bool:
    """Verifies format validity using field-type regexes and rules."""
    if val is None:
        return False
    str_val = str(val).strip()

    if field_type == "gstin":
        return bool(re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", str_val.upper()))
    elif field_type == "date":
        return bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str_val))
    elif field_type == "amount":
        if isinstance(val, (Decimal, int)):
            return True
        return bool(re.match(r"^\d+(?:\.\d{1,2})?$", str_val))
    elif field_type == "identifier":
        return len(str_val) >= 1 and len(str_val) <= 64
    return len(str_val) > 0


def build_field_features(
    invoice: Invoice,
    field_name: str,
    doc: PreparedDocument | None = None,
    two_pass: TwoPassResult | None = None,
) -> FieldFeatures:
    """Extracts confidence features for a specific invoice field."""
    # 1. Resolve field value, confidence, and box
    field_obj: Any = None
    field_type = "text"

    if field_name == "number":
        field_obj = invoice.number
        field_type = "identifier"
    elif field_name == "date":
        field_obj = invoice.date
        field_type = "date"
    elif field_name in {"supplier_gstin", "buyer_gstin"}:
        field_obj = getattr(invoice, field_name)
        field_type = "gstin"
    elif field_name in {"taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "total_amount"}:
        field_obj = getattr(invoice.totals, field_name)
        field_type = "amount"
    elif field_name == "irn":
        field_obj = invoice.irn
        field_type = "identifier"
    elif hasattr(invoice, field_name):
        field_obj = getattr(invoice, field_name)

    val = getattr(field_obj, "value", None) if field_obj else None
    prov_conf = getattr(field_obj, "confidence", None) if field_obj else None
    has_box = getattr(field_obj, "box", None) is not None if field_obj else False

    # 2. Agreement classification
    agreement_kind = "single_pass"
    if two_pass and field_name in two_pass.agreements:
        agreement_kind = two_pass.agreements[field_name].agreement

    # 3. Format validity
    fmt_valid = _check_format_valid(field_type, val)

    # 4. GSTIN checksum validation if applicable
    gstin_checksum_valid = None
    if field_type == "gstin" and val:
        gstin_checksum_valid = is_valid_gstin(str(val))

    # 5. Cross-field math consistency if amount
    math_consistent = None
    if field_type == "amount":
        t = invoice.totals
        tax_sum = (
            (t.cgst_amount.value or Decimal("0.00"))
            + (t.sgst_amount.value or Decimal("0.00"))
            + (t.igst_amount.value or Decimal("0.00"))
            + (t.cess_amount.value or Decimal("0.00"))
        )
        expected_total = (t.taxable_amount.value or Decimal("0.00")) + tax_sum
        diff = abs((t.total_amount.value or Decimal("0.00")) - expected_total)
        math_consistent = diff <= Decimal("1.00")

    # 6. QR payload cross-check
    qr_agrees = None
    if doc and doc.qr_payload and val is not None:
        qr = doc.qr_payload
        if field_name == "number" and qr.invoice_number:
            qr_agrees = str(val).strip().lower() == qr.invoice_number.strip().lower()
        elif field_name == "date" and qr.invoice_date:
            qr_agrees = str(val).strip() == qr.invoice_date.strip()
        elif field_name == "supplier_gstin" and qr.supplier_gstin:
            qr_agrees = str(val).strip().upper() == qr.supplier_gstin.strip().upper()
        elif field_name == "total_amount" and qr.total_amount:
            qr_agrees = abs(Decimal(str(val)) - qr.total_amount) <= Decimal("1.00")
        elif field_name == "irn" and qr.irn:
            qr_agrees = str(val).strip().lower() == qr.irn.strip().lower()

    # 7. Document level signals
    doc_q = doc.quality.score if doc else 0.85
    doc_blur = doc.quality.blur_score if doc else 0.85
    doc_cont = doc.quality.contrast_score if doc else 0.85
    handwritten = doc.is_handwritten_likely if doc else False
    lang = doc.languages[0] if (doc and doc.languages) else "en"

    return FieldFeatures(
        field_name=field_name,
        field_value=val,
        field_type=field_type,
        provider_confidence=prov_conf,
        has_provider_conf=prov_conf is not None,
        agreement_kind=agreement_kind,
        format_valid=fmt_valid,
        gstin_checksum_valid=gstin_checksum_valid,
        cross_field_math_consistent=math_consistent,
        qr_agrees=qr_agrees,
        has_box=has_box,
        doc_quality_score=doc_q,
        doc_blur_score=doc_blur,
        doc_contrast_score=doc_cont,
        is_handwritten_likely=handwritten,
        language=lang,
    )


def features_to_vector(feat: FieldFeatures) -> np.ndarray:
    """Converts structured FieldFeatures into a standardized 15-dimensional numeric vector."""
    agreement_map = {
        "exact": 1.0,
        "normalized_equal": 0.85,
        "numeric_close": 0.80,
        "single_pass": 0.50,
        "disagree": 0.0,
    }

    vec = [
        feat.provider_confidence if feat.provider_confidence is not None else 0.5,
        1.0 if feat.has_provider_conf else 0.0,
        agreement_map.get(feat.agreement_kind, 0.5),
        1.0 if feat.format_valid else 0.0,
        1.0 if feat.gstin_checksum_valid is True else (0.0 if feat.gstin_checksum_valid is False else 0.5),
        1.0 if feat.cross_field_math_consistent is True else (0.0 if feat.cross_field_math_consistent is False else 0.5),
        1.0 if feat.qr_agrees is True else (0.0 if feat.qr_agrees is False else 0.5),
        1.0 if feat.has_box else 0.0,
        feat.doc_quality_score,
        feat.doc_blur_score,
        feat.doc_contrast_score,
        1.0 if feat.is_handwritten_likely else 0.0,
        1.0 if feat.field_type == "amount" else 0.0,
        1.0 if feat.field_type == "gstin" else 0.0,
        1.0 if feat.field_type == "date" else 0.0,
    ]
    return np.array(vec, dtype=np.float32)
