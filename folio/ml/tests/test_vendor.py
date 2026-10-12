"""Unit tests for vendor risk model, event stores, explainability, and API endpoints."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.vendor.contracts import VendorEvent
from folio_ml.vendor.features import FeatureExtractor
from folio_ml.vendor.scorer import VendorRiskScorer
from folio_ml.vendor.store import InMemoryVendorStore, SQLiteVendorStore

client = TestClient(app)


def test_empty_history_returns_neutral_score_and_limited_history() -> None:
    """Supplier with zero history must return neutral score and limited_history: true."""
    scorer = VendorRiskScorer(store=InMemoryVendorStore())
    res = scorer.evaluate_vendor("27AABCS1429B1ZB")

    assert res.limited_history is True
    # Neutral baseline prior score is ~22.5
    assert 20.0 <= res.score <= 30.0
    # Wide credible interval
    low, high = res.credible_interval
    assert high - low > 25.0
    assert res.tag == "Reliable" or res.tag == "Watch"


def test_monotonicity_more_late_filings_never_lowers_score() -> None:
    """Adding late-filing events must never lower the risk score."""
    store = InMemoryVendorStore()
    scorer = VendorRiskScorer(store=store)
    gstin = "27AABCS1429B1ZB"

    # Clean vendor with 10 on-time filings
    for i in range(1, 11):
        month = f"2024-{i:02d}"
        store.record_event(
            VendorEvent(
                gstin=gstin,
                period=month,
                event_type="filing_status",
                details={"status": "filed_on_time"},
            )
        )
        store.record_event(
            VendorEvent(
                gstin=gstin,
                period=month,
                event_type="invoice_received",
                details={"errors": []},
            )
        )

    clean_res = scorer.evaluate_vendor(gstin)

    # Now add late filings
    for i in range(11, 13):
        month = f"2024-{i:02d}"
        store.record_event(
            VendorEvent(
                gstin=gstin,
                period=month,
                event_type="filing_status",
                details={"status": "filed_late"},
            )
        )

    degraded_res = scorer.evaluate_vendor(gstin)
    assert degraded_res.score >= clean_res.score


def test_more_history_narrows_credible_interval() -> None:
    """More observations must narrow the Bayesian credible interval."""
    store = InMemoryVendorStore()
    scorer = VendorRiskScorer(store=store)
    gstin = "27AABCS1429B1ZB"

    # 1. Vendor with 1 invoice
    store.record_event(
        VendorEvent(
            gstin=gstin,
            period="2024-01",
            event_type="invoice_received",
            details={"errors": []},
        )
    )
    res_1 = scorer.evaluate_vendor(gstin)
    width_1 = res_1.credible_interval[1] - res_1.credible_interval[0]

    # 2. Add 20 invoices
    for i in range(2, 22):
        month = f"2024-{(i % 12) + 1:02d}"
        store.record_event(
            VendorEvent(
                gstin=gstin,
                period=month,
                event_type="invoice_received",
                details={"errors": []},
            )
        )
        store.record_event(
            VendorEvent(
                gstin=gstin,
                period=month,
                event_type="filing_status",
                details={"status": "filed_on_time"},
            )
        )

    res_20 = scorer.evaluate_vendor(gstin)
    width_20 = res_20.credible_interval[1] - res_20.credible_interval[0]

    assert width_20 < width_1


def test_contributions_add_up_exactly_to_score_minus_baseline() -> None:
    """Explainability contributions sum exactly to score minus baseline (within 0.05 rounding)."""
    store = InMemoryVendorStore()
    scorer = VendorRiskScorer(store=store)
    gstin = "27AABCS1429B1ZB"

    store.record_event(
        VendorEvent(
            gstin=gstin,
            period="2024-04",
            event_type="filing_status",
            details={"status": "filed_late"},
        )
    )
    store.record_event(
        VendorEvent(
            gstin=gstin,
            period="2024-04",
            event_type="recon_mismatch",
            details={"mismatch_count": 2},
        )
    )

    res = scorer.evaluate_vendor(gstin)
    sum_effects = sum(c.effect_points for c in res.contributions)
    expected_diff = res.score - scorer.baseline_score

    assert pytest.approx(sum_effects, abs=0.05) == expected_diff


def test_sqlite_vendor_store_persistence(tmp_path: Path) -> None:
    """Confirms SQLite store records append-only events and reloads accurately."""
    db_file = tmp_path / "vendor_events.db"
    store = SQLiteVendorStore(db_path=db_file)

    ev = VendorEvent(
        gstin="27AABCS1429B1ZB",
        period="2024-05",
        event_type="filing_status",
        details={"status": "filed_on_time"},
    )
    store.record_event(ev)

    # Re-open database from disk
    store2 = SQLiteVendorStore(db_path=db_file)
    events = store2.get_events("27AABCS1429B1ZB")
    assert len(events) == 1
    assert events[0].period == "2024-05"
    assert events[0].details["status"] == "filed_on_time"
    assert store2.get_all_gstins() == ["27AABCS1429B1ZB"]


def test_recency_decay_weighting() -> None:
    """Recent defects contribute more heavily than older defects due to half-life decay."""
    extractor = FeatureExtractor(half_life_months=6.0)

    # Vendor A has defect 12 months ago
    events_old = [
        VendorEvent(
            gstin="27A",
            period="2023-04",
            event_type="filing_status",
            details={"status": "filed_late"},
        ),
        VendorEvent(
            gstin="27A",
            period="2024-04",
            event_type="filing_status",
            details={"status": "filed_on_time"},
        ),
    ]
    feat_old = extractor.extract_features("27A", events_old, current_period="2024-04")

    # Vendor B has defect this month
    events_new = [
        VendorEvent(
            gstin="27B",
            period="2023-04",
            event_type="filing_status",
            details={"status": "filed_on_time"},
        ),
        VendorEvent(
            gstin="27B",
            period="2024-04",
            event_type="filing_status",
            details={"status": "filed_late"},
        ),
    ]
    feat_new = extractor.extract_features("27B", events_new, current_period="2024-04")

    assert feat_new.late_filing_rate > feat_old.late_filing_rate


def test_vendor_api_endpoints() -> None:
    """Verifies all vendor API routes end-to-end."""
    gstin = "27AABCS1429B1ZZ"

    # 1. Post event
    ev_payload = {
        "gstin": gstin,
        "period": "2024-04",
        "event_type": "filing_status",
        "details": {"status": "filed_on_time"},
    }
    resp = client.post("/v1/vendors/events", json=ev_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["gstin"] == gstin

    # 2. Get risk
    resp2 = client.get(f"/v1/vendors/{gstin}/risk")
    assert resp2.status_code == 200
    risk = resp2.json()
    assert "score" in risk
    assert "tag" in risk
    assert "contributions" in risk

    # 3. Get history
    resp3 = client.get(f"/v1/vendors/{gstin}/history")
    assert resp3.status_code == 200
    hist = resp3.json()
    assert len(hist["events"]) >= 1

    # 4. Batch score
    resp4 = client.post("/v1/vendors/score-batch", json={"gstins": [gstin, "27AAACW1234A1ZY"]})
    assert resp4.status_code == 200
    batch = resp4.json()
    assert len(batch) == 2
