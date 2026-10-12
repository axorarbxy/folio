"""Tests for Pydantic v2 contracts and strict Decimal money handling."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from folio_ml.contracts.base import Box, Field
from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice, LineItem
from folio_ml.contracts.recon import ReconMatch, ReconReport
from folio_ml.contracts.review import ReviewDecision, ReviewFieldDetail
from folio_ml.contracts.signals import ThreatSignal
from folio_ml.contracts.vendor import RiskContribution, VendorRisk
from folio_ml.providers.fake import create_fake_invoice
from folio_ml.utils.money import validate_strict_decimal


def test_money_rejects_float() -> None:
    """Verifies that float values for money are strictly rejected."""
    with pytest.raises(ValueError, match="Float is not permitted"):
        validate_strict_decimal(123.45)

    with pytest.raises(ValidationError):
        LineItem(
            description=Field(value="Test"),
            taxable=Field(value=100.50),  # float must trigger error
        )


def test_money_accepts_valid_types() -> None:
    """Verifies Decimal, string, and integer inputs work cleanly."""
    assert validate_strict_decimal(Decimal("100.50")) == Decimal("100.50")
    assert validate_strict_decimal("100.50") == Decimal("100.50")
    assert validate_strict_decimal(100) == Decimal("100")
    assert validate_strict_decimal(None) is None


def test_box_roundtrip() -> None:
    box = Box(page=1, x0=0.1, y0=0.2, x1=0.8, y1=0.9)
    dumped = box.model_dump()
    parsed = Box.model_validate(dumped)
    assert parsed == box


def test_invoice_roundtrip() -> None:
    inv = create_fake_invoice()
    dumped = inv.model_dump()
    parsed = Invoice.model_validate(dumped)
    assert parsed == inv


def test_check_result_and_verdict_roundtrip() -> None:
    check = CheckResult(
        check_id="check_01",
        name="GSTIN Format",
        status="pass",
        severity="critical",
        kind="deterministic",
        expected="Valid",
        found="Valid",
        formula="regex",
        why_it_matters="Mandatory format",
        fixes=["VERIFY_GSTIN_ON_PORTAL"],
        rule_table_version="v1",
    )
    verdict = Verdict(
        status="safe",
        reasons=["All rules pass"],
        rupee_at_risk=Decimal("0.00"),
        checks=[check],
    )
    dumped = verdict.model_dump()
    parsed = Verdict.model_validate(dumped)
    assert parsed == verdict


def test_recon_roundtrip() -> None:
    match = ReconMatch(
        match_id="M1",
        bucket="matched",
        supplier_gstin="27AABCS1429B1ZB",
        invoice_number="INV-101",
        book_amount=Decimal("500.00"),
        gstr2b_amount=Decimal("500.00"),
        difference=Decimal("0.00"),
        score=1.0,
        reasons=["Exact match"],
    )
    report = ReconReport(
        period="2024-04",
        total_invoices_books=1,
        total_invoices_2b=1,
        matched_count=1,
        mismatched_count=0,
        missing_in_2b_count=0,
        rupee_at_risk=Decimal("0.00"),
        bucket_counts={"matched": 1},
        matches=[match],
    )
    dumped = report.model_dump()
    parsed = ReconReport.model_validate(dumped)
    assert parsed == report


def test_vendor_risk_roundtrip() -> None:
    vr = VendorRisk(
        gstin="27AABCS1429B1ZB",
        vendor_name="Apex Fasteners",
        score=85.0,
        credible_interval=(80.0, 90.0),
        limited_history=False,
        tag="Watch",
        contributions=[
            RiskContribution(
                feature="late_filing",
                weight=0.5,
                value=0.2,
                effect_points=10.0,
            )
        ],
    )
    dumped = vr.model_dump()
    parsed = VendorRisk.model_validate(dumped)
    assert parsed == vr


def test_threat_signal_roundtrip() -> None:
    ts = ThreatSignal(
        signal_id="SIG-01",
        signal_type="prompt_injection",
        severity="high",
        confidence=0.92,
        description="Instruction-like phrasing detected",
        spans=[{"start": 10, "end": 45, "reason": "ignore instructions"}],
    )
    dumped = ts.model_dump()
    parsed = ThreatSignal.model_validate(dumped)
    assert parsed == ts


def test_review_decision_roundtrip() -> None:
    rd = ReviewDecision(
        invoice_id="INV-001",
        priority="high",
        auto_accept=["supplier_name"],
        needs_review=[
            ReviewFieldDetail(
                field_name="total_amount",
                reason="Low confidence OCR",
                confidence=0.65,
                current_value="1000.00",
            )
        ],
        reasons=["Triage flagged low confidence field"],
    )
    dumped = rd.model_dump()
    parsed = ReviewDecision.model_validate(dumped)
    assert parsed == rd
