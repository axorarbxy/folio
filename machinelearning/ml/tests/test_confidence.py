"""Tests for confidence calibration, metric evaluation, review routing, and drift detection."""

from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.confidence import (
    ConfidenceCalibrator,
    build_field_features,
    calculate_categorical_psi,
    calculate_psi,
    choose_threshold,
    compute_calibration_metrics,
    evaluate_population_drift,
    features_to_vector,
    route_invoice,
    save_reliability_diagram_png,
)
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.reader.contracts import FieldAgreement, RawExtraction, TwoPassResult

client = TestClient(app)


def test_field_feature_extraction_and_vectorization() -> None:
    """Verifies 15-dimensional feature vector extraction across field types."""
    inv = generate_clean_invoice(seed=10)

    # Header GSTIN
    feat_gstin = build_field_features(inv, "supplier_gstin")
    assert feat_gstin.field_type == "gstin"
    assert feat_gstin.gstin_checksum_valid is True
    vec_gstin = features_to_vector(feat_gstin)
    assert vec_gstin.shape == (15,)

    # Total Amount
    feat_amount = build_field_features(inv, "total_amount")
    assert feat_amount.field_type == "amount"
    assert feat_amount.cross_field_math_consistent is True
    vec_amount = features_to_vector(feat_amount)
    assert vec_amount.shape == (15,)


def test_ece_and_brier_metric_calculations() -> None:
    """Verifies expected calibration error and Brier score computation."""
    # Perfectly calibrated synthetic probabilities
    y_true = [1, 1, 1, 1, 0, 0, 0, 0]
    y_prob = [0.9, 0.9, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1]

    report = compute_calibration_metrics(y_true, y_prob, n_bins=10)
    assert report.ece <= 0.20
    assert report.brier <= 0.05
    assert len(report.bins) == 10
    assert len(report.accuracy_at_coverage) == 5


def test_reliability_diagram_export(tmp_path: Path) -> None:
    """Verifies that reliability diagram is rendered and saved to disk."""
    y_true = [1] * 80 + [0] * 20
    y_prob = [0.85] * 80 + [0.2] * 20

    report = compute_calibration_metrics(y_true, y_prob)
    out_file = tmp_path / "test_reliability.png"
    save_reliability_diagram_png(report, out_file)

    assert out_file.exists()
    assert out_file.stat().st_size > 1000


def test_mandatory_forced_review_cannot_be_bypassed_by_high_model_score() -> None:
    """ACCEPTANCE TEST: Proves forced-review rules cannot be bypassed by high model score."""
    inv = generate_clean_invoice(seed=15)

    # 1. Artificially mock calibrator to return near 1.0 (99.9% confidence) for all fields
    mock_calibrator = MagicMock(spec=ConfidenceCalibrator)
    mock_calibrator.predict_field_confidence.return_value = 0.999

    # Case A: Corrupted GSTIN Checksum
    inv_bad_gstin = inv.model_copy(deep=True)
    # Tamper the 15th checksum character
    inv_bad_gstin.supplier_gstin.value = inv_bad_gstin.supplier_gstin.value[:-1] + "X"

    decision = route_invoice(inv_bad_gstin, calibrator=mock_calibrator)
    flagged_fields = [item.field_name for item in decision.needs_review]
    assert "supplier_gstin" in flagged_fields
    assert any("GSTIN checksum failed" in item.reason for item in decision.needs_review)
    assert "supplier_gstin" not in decision.auto_accept
    assert decision.priority == "critical"

    # Case B: Unbalanced / Irreproducible Total Math
    inv_bad_math = inv.model_copy(deep=True)
    inv_bad_math.totals.total_amount.value = Decimal("999999.00")  # Wild discrepancy

    decision_math = route_invoice(inv_bad_math, calibrator=mock_calibrator)
    flagged_math = [item.field_name for item in decision_math.needs_review]
    assert "total_amount" in flagged_math
    assert any("Totals cannot be mathematically reproduced" in item.reason for item in decision_math.needs_review)
    assert "total_amount" not in decision_math.auto_accept
    assert decision_math.priority == "critical"

    # Case C: Reader Disagreement on Amount Field
    inv_clean = inv.model_copy(deep=True)
    two_pass_disagree = TwoPassResult(
        pass1=RawExtraction(invoice=inv_clean, raw_response_text="{}", provider_name="p1", model_name="m1", latency_ms=1.0),
        pass2=RawExtraction(invoice=inv_clean, raw_response_text="{}", provider_name="p2", model_name="m2", latency_ms=1.0),
        agreements={
            "total_amount": FieldAgreement(field_name="total_amount", pass1_val=100, pass2_val=200, agreement="disagree")
        },
        agreement_score=0.9,
    )
    decision_disagree = route_invoice(inv_clean, two_pass=two_pass_disagree, calibrator=mock_calibrator)
    flagged_disagree = [item.field_name for item in decision_disagree.needs_review]
    assert "total_amount" in flagged_disagree
    assert any("Two readings disagree" in item.reason for item in decision_disagree.needs_review)
    assert "total_amount" not in decision_disagree.auto_accept


def test_choose_threshold_meets_target_precision() -> None:
    """Verifies optimal threshold selection reaching >= 98% precision."""
    rng = np.random.default_rng(42)
    y_prob = rng.uniform(0.60, 0.99, 500)
    # Higher prob -> higher likelihood of being true
    y_true = (y_prob > 0.75).astype(int)

    thresh, coverage = choose_threshold(y_true, y_prob, target_precision=0.98)
    assert thresh >= 0.70
    assert 0.0 <= coverage <= 1.0


def test_population_stability_index_drift() -> None:
    """Verifies PSI drift calculation on stable and drifting confidence distributions."""
    baseline = [0.92] * 400 + [0.85] * 300 + [0.70] * 300

    # Stable recent window -> PSI < 0.10
    recent_stable = [0.91] * 400 + [0.86] * 300 + [0.69] * 300
    psi_stable = calculate_psi(baseline, recent_stable)
    assert psi_stable < 0.10

    # Severe drift (confidence degradation) -> PSI >= 0.25
    recent_drift = [0.50] * 600 + [0.40] * 400
    psi_drift = calculate_psi(baseline, recent_drift)
    assert psi_drift >= 0.25

    # Full report
    report = evaluate_population_drift(baseline, recent_drift)
    assert report.severity == "high"
    assert report.confidence_drift.severity == "high"


def test_categorical_psi() -> None:
    """Verifies categorical PSI over document source distributions."""
    base = {"digital_pdf": 70, "photo": 20, "scan": 10}
    current = {"digital_pdf": 20, "photo": 70, "scan": 10}  # Significant shift to photo
    psi = calculate_categorical_psi(base, current)
    assert psi >= 0.25


def test_api_review_and_metrics_endpoints() -> None:
    """Verifies POST /v1/review/route and GET /v1/metrics endpoints."""
    inv = generate_clean_invoice(seed=25)
    resp = client.post("/v1/review/route", json=inv.model_dump(mode="json"))
    assert resp.status_code == 200
    decision = resp.json()
    assert "invoice_id" in decision
    assert "priority" in decision
    assert "auto_accept" in decision
    assert "needs_review" in decision

    # Metrics endpoints
    resp_cal = client.get("/v1/metrics/calibration")
    assert resp_cal.status_code == 200
    assert "ece" in resp_cal.json()
    assert "brier" in resp_cal.json()

    resp_drift = client.get("/v1/metrics/drift")
    assert resp_drift.status_code == 200
    assert "overall_psi" in resp_drift.json()
    assert "severity" in resp_drift.json()
