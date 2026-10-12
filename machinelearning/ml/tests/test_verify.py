"""Tests for independent verification, tamper heuristics, duplicates, and anomaly detection."""

import random
from decimal import Decimal

from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.datagen.injectors import (
    inject_duplicate_invoice,
    inject_math_error_line,
    inject_tampered_amount_after_render,
)
from folio_ml.prep.contracts import QrInvoicePayload
from folio_ml.verify.anomaly import AnomalyDetector
from folio_ml.verify.duplicates import DuplicateDetector
from folio_ml.verify.judge import FakeJudge
from folio_ml.verify.scanner import DocumentScanner
from folio_ml.verify.tamper import TamperDetector
from folio_ml.verify.verifier import IndependentVerifier

client = TestClient(app)


def test_independent_verifier_detects_math_errors() -> None:
    """Independent verifier recomputes arithmetic and flags line math and grand total errors."""
    clean = generate_clean_invoice(seed=101)
    verifier = IndependentVerifier()

    # Clean invoice produces 0 critical/high flags
    clean_flags = verifier.verify(clean)
    assert not any(f.severity in {"critical", "high"} for f in clean_flags)

    # Injected line math error
    corrupted, _ = inject_math_error_line(clean, random.Random(42))
    err_flags = verifier.verify(corrupted)
    assert any("items[1].taxable" in f.field or "totals.taxable_amount" in f.field for f in err_flags)


def test_independent_verifier_detects_state_mismatch() -> None:
    """Flags when supplier state code disagrees with supplier GSTIN state prefix."""
    clean = generate_clean_invoice(seed=102)
    verifier = IndependentVerifier()
    clean.supplier_state.value = "29"  # Karnataka state code on Maharashtra GSTIN (27...)

    flags = verifier.verify(clean)
    assert any(f.field == "supplier_state" for f in flags)


def test_duplicate_detector_matches_historical_invoices() -> None:
    """DuplicateDetector identifies exact, normalized, and synthetic duplicate markers."""
    clean1 = generate_clean_invoice(seed=201)
    clean1.id = "INV-ORIG-001"
    clean1.number.value = "INV/2024/001"

    detector = DuplicateDetector(historical_invoices=[clean1])

    # 1. Direct duplicate marker
    dup_inv, _ = inject_duplicate_invoice(clean1, random.Random(42))
    sig = detector.check_duplicate(dup_inv)
    assert sig is not None
    assert sig.signal_type == "duplicate_invoice"
    assert sig.confidence == 1.0

    # 2. Resubmitted identical invoice with different format slashes
    clean2 = clean1.model_copy(deep=True)
    clean2.id = "INV-SUBMIT-002"
    clean2.number.value = "INV-2024-001"
    sig2 = detector.check_duplicate(clean2)
    assert sig2 is not None
    assert sig2.signal_type == "duplicate_invoice"
    assert sig2.confidence >= 0.95

    # 3. Truly distinct invoice
    distinct = generate_clean_invoice(seed=305)
    distinct.id = "INV-DISTINCT-999"
    distinct.number.value = "INV-999"
    sig_distinct = detector.check_duplicate(distinct)
    assert sig_distinct is None


def test_tamper_detector_catches_post_render_and_qr_discrepancies() -> None:
    """TamperDetector detects post-render hash mutations, suspicious PDF producers, and QR discrepancies."""
    clean = generate_clean_invoice(seed=401)
    detector = TamperDetector()

    # 1. Injected post-render tamper
    tampered, _ = inject_tampered_amount_after_render(clean, random.Random(42))
    sigs = detector.check_tamper(tampered)
    assert any(s.signal_type == "tampered_document" for s in sigs)

    # 2. Suspicious PDF metadata producer
    meta_sigs = detector.check_tamper(
        clean,
        pdf_metadata={"Producer": "Adobe Photoshop 2024 (Windows)", "CreationDate": "D:20240401"},
    )
    assert any(s.signal_type == "tampered_document" and "photoshop" in s.description.lower() for s in meta_sigs)

    # 3. QR code discrepancy
    qr_payload = QrInvoicePayload(
        raw_text="mock_qr_raw_string",
        supplier_gstin="27AABCS9999Z1Z5",  # Different GSTIN
        buyer_gstin="27AAACW1234A1ZY",
        invoice_number="INV-401",
        invoice_date="2024-04-10",
        total_amount=Decimal("99999.00"),  # Different total
    )
    qr_sigs = detector.check_tamper(clean, qr_payload=qr_payload)
    assert any(s.signal_type == "qr_mismatch" for s in qr_sigs)


def test_anomaly_detector_new_vendor_and_outlier() -> None:
    """AnomalyDetector catches new vendor high exposure and robust z-score outliers."""
    detector = AnomalyDetector(high_value_new_vendor_threshold=Decimal("500000.00"))

    # 1. New vendor with ₹8,00,000 invoice (no prior history)
    high_inv = generate_clean_invoice(seed=501)
    high_inv.totals.total_amount.value = Decimal("800000.00")
    sigs_new = detector.check_anomalies(high_inv, supplier_history=[])
    assert any(s.signal_type == "new_vendor_high_value" for s in sigs_new)

    # 2. Routine vendor with normal historical distribution
    history: list[any] = []
    for s in range(10):
        inv = generate_clean_invoice(seed=600 + s)
        inv.totals.total_amount.value = Decimal("10000.00") + Decimal(f"{s * 500}.00")
        history.append(inv)

    # Normal amount: ₹12,000
    normal_inv = generate_clean_invoice(seed=701)
    normal_inv.totals.total_amount.value = Decimal("12000.00")
    sigs_norm = detector.check_anomalies(normal_inv, supplier_history=history)
    assert len(sigs_norm) == 0

    # Extreme outlier: ₹150,000
    outlier_inv = generate_clean_invoice(seed=702)
    outlier_inv.totals.total_amount.value = Decimal("150000.00")
    sigs_outlier = detector.check_anomalies(outlier_inv, supplier_history=history)
    assert any(s.signal_type == "sequence_anomaly" for s in sigs_outlier)


def test_fake_judge_arbitration() -> None:
    """FakeJudge arbitrates ambiguous verifier flags deterministically."""
    judge = FakeJudge()
    clean = generate_clean_invoice(seed=801)
    verifier = IndependentVerifier()

    clean.totals.total_amount.value += Decimal("500.00")
    flags = verifier.verify(clean)
    crit_flag = [f for f in flags if f.severity == "critical"][0]

    arb = judge.arbitrate(clean, crit_flag)
    assert arb["upheld"] is True
    assert arb["confidence"] >= 0.90
    assert arb["recommended_action"] == "FLAG_FOR_AUDIT"


def test_scanner_and_signals_api() -> None:
    """Tests master DocumentScanner and FastAPI /v1/signals routes."""
    clean = generate_clean_invoice(seed=901)
    scanner = DocumentScanner()

    # Clean invoice scan
    res = scanner.scan(clean)
    assert res.clean is True
    assert len(res.signals) == 0

    # API scan endpoint with fake invoice
    resp = client.post("/v1/signals/scan", json={"invoice_id": "INV-API-SCAN-01"})
    assert resp.status_code == 200
    scan_data = resp.json()
    assert "signals" in scan_data
    assert "flags" in scan_data

    # Query signals list endpoint
    resp2 = client.get("/v1/signals")
    assert resp2.status_code == 200
    sigs_list = resp2.json()
    assert isinstance(sigs_list, list)

    resp3 = client.get("/v1/signals?status=open")
    assert resp3.status_code == 200
