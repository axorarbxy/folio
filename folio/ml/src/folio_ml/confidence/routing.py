"""Review routing engine with hard forced-review rules and threshold selection."""

from typing import Literal

import numpy as np

from folio_ml.confidence.calibrator import ConfidenceCalibrator
from folio_ml.confidence.features import build_field_features
from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.review import ReviewDecision, ReviewFieldDetail
from folio_ml.prep.contracts import PreparedDocument
from folio_ml.reader.contracts import TwoPassResult

ROUTED_FIELDS = [
    "number",
    "date",
    "supplier_gstin",
    "buyer_gstin",
    "place_of_supply",
    "taxable_amount",
    "cgst_amount",
    "sgst_amount",
    "igst_amount",
    "total_amount",
]


def choose_threshold(
    y_true: list[bool] | list[int] | np.ndarray,
    y_prob: list[float] | np.ndarray,
    target_precision: float = 0.98,
) -> tuple[float, float]:
    """Finds lowest confidence threshold reaching target precision on validation split.

    Returns:
        (optimal_threshold, coverage_fraction) where coverage represents human effort saved.
    """
    y_t = np.array(y_true, dtype=bool)
    y_p = np.array(y_prob, dtype=np.float32)

    if len(y_t) == 0:
        return 0.85, 0.0

    # Search candidates from 0.50 to 0.99
    candidates = np.linspace(0.50, 0.99, 50)
    for thresh in candidates:
        mask = y_p >= thresh
        if np.sum(mask) == 0:
            continue
        prec = float(np.mean(y_t[mask]))
        if prec >= target_precision:
            coverage = float(np.mean(mask))
            return round(float(thresh), 2), round(coverage, 3)

    return 0.95, float(np.mean(y_p >= 0.95))


def route_invoice(
    invoice: Invoice,
    doc: PreparedDocument | None = None,
    two_pass: TwoPassResult | None = None,
    calibrator: ConfidenceCalibrator | None = None,
    threshold: float = 0.85,
) -> ReviewDecision:
    """Evaluates invoice fields against confidence thresholds and forced-review statutory rules."""
    cal = calibrator or ConfidenceCalibrator()

    auto_accept: list[str] = []
    needs_review: list[ReviewFieldDetail] = []
    global_reasons: list[str] = []

    has_critical_issue = False
    has_amount_issue = False

    for field_name in ROUTED_FIELDS:
        feat = build_field_features(invoice, field_name, doc, two_pass)
        conf = cal.predict_field_confidence(feat)

        # =========================================================================
        # HARD STATUTORY FORCED-REVIEW RULES (Cannot be bypassed by high model score)
        # =========================================================================
        forced_reason: str | None = None

        # 1. Failed GSTIN checksum
        if feat.field_type == "gstin" and feat.gstin_checksum_valid is False:
            forced_reason = "GSTIN checksum failed (statutory Mod 36,36 error)"
            has_critical_issue = True

        # 2. Amount field disagreement between reader passes
        elif feat.agreement_kind == "disagree" and feat.field_type in {"amount", "gstin"}:
            forced_reason = f"Two readings disagree on {field_name}"
            if feat.field_type == "amount":
                has_amount_issue = True

        # 3. Mathematical discrepancy in totals
        elif feat.field_type == "amount" and feat.cross_field_math_consistent is False:
            forced_reason = "Totals cannot be mathematically reproduced from line items and tax components"
            has_critical_issue = True

        # 4. QR payload mismatch
        elif feat.qr_agrees is False:
            forced_reason = f"Signed e-invoice QR code discrepancy on {field_name}"
            has_critical_issue = True

        # 5. Invalid field format
        elif not feat.format_valid:
            forced_reason = f"Invalid statutory format for {field_name}"

        # Evaluation
        if forced_reason:
            needs_review.append(
                ReviewFieldDetail(
                    field_name=field_name,
                    reason=forced_reason,
                    confidence=conf,
                    current_value=feat.field_value,
                )
            )
            global_reasons.append(forced_reason)
        elif conf < threshold:
            reason_msg = f"Confidence ({conf:.2f}) below auto-accept threshold ({threshold:.2f})"
            needs_review.append(
                ReviewFieldDetail(
                    field_name=field_name,
                    reason=reason_msg,
                    confidence=conf,
                    current_value=feat.field_value,
                )
            )
            global_reasons.append(reason_msg)
        else:
            auto_accept.append(field_name)

    # Determine priority
    priority: Literal["low", "medium", "high", "critical"] = "low"
    if has_critical_issue:
        priority = "critical"
    elif has_amount_issue:
        priority = "high"
    elif len(needs_review) > 0:
        priority = "medium"

    return ReviewDecision(
        invoice_id=invoice.id,
        priority=priority,
        auto_accept=auto_accept,
        needs_review=needs_review,
        reasons=list(dict.fromkeys(global_reasons)),  # Deduplicate preserving order
    )
