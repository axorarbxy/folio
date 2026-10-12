"""Tests for Folio ML FastAPI skeleton and endpoints."""

from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.providers.fake import create_fake_invoice

client = TestClient(app)


def test_docs_and_openapi() -> None:
    res = client.get("/docs")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]

    res_openapi = client.get("/openapi.json")
    assert res_openapi.status_code == 200
    assert res_openapi.json()["info"]["title"] == "Folio ML Engine"


def test_health() -> None:
    res = client.get("/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["mode"] in {"fake", "replay", "live"}
    assert "X-Request-ID" in res.headers


def test_invoices_extract() -> None:
    res = client.post("/v1/invoices/extract")
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert "supplier_gstin" in data
    assert "totals" in data


def test_invoices_validate() -> None:
    inv = create_fake_invoice()
    res = client.post("/v1/invoices/validate", json=inv.model_dump(mode="json"))
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "safe"
    assert "rupee_at_risk" in data
    assert len(data["checks"]) >= 2


def test_review_route() -> None:
    inv = create_fake_invoice()
    res = client.post("/v1/review/route", json=inv.model_dump(mode="json"))
    assert res.status_code == 200
    data = res.json()
    assert data["invoice_id"] == inv.id
    assert "auto_accept" in data
    assert "priority" in data


def test_reconcile() -> None:
    payload = {"period": "2024-04", "register_data": [], "gstr2b_data": []}
    res = client.post("/v1/reconcile", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["period"] == "2024-04"
    assert "matches" in data


def test_vendor_risk() -> None:
    res = client.get("/v1/vendors/27AABCS1429B1ZB/risk")
    assert res.status_code == 200
    data = res.json()
    assert data["gstin"] == "27AABCS1429B1ZB"
    assert "score" in data
    assert "contributions" in data


def test_explain() -> None:
    inv = create_fake_invoice()
    payload = {
        "checks": [],
        "verdict": {
            "status": "safe",
            "reasons": ["passed"],
            "rupee_at_risk": "0.00",
            "checks": [],
        },
        "invoice": inv.model_dump(mode="json"),
    }
    res = client.post("/v1/explain", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "explanations" in data
    assert "drafts" in data
    assert "whatsapp" in data["drafts"]


def test_guardrails_screen() -> None:
    payload = {"text": "Please verify this invoice"}
    res = client.post("/v1/guardrails/screen", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["risk"] in {"low", "medium", "high", "critical"}
    assert data["action"] in {"allow", "strip", "block", "review"}


def test_metrics() -> None:
    for metric_type in ["calibration", "quality", "drift", "latency"]:
        res = client.get(f"/v1/metrics/{metric_type}")
        assert res.status_code == 200
        assert isinstance(res.json(), dict)


def test_error_envelope_and_request_id() -> None:
    custom_req_id = "req-test-12345"
    res = client.get("/v1/metrics/nonexistent_metric", headers={"X-Request-ID": custom_req_id})
    assert res.status_code == 404
    data = res.json()
    assert data["code"] == "HTTP_404"
    assert "message" in data
    assert data["request_id"] == custom_req_id
    assert res.headers["X-Request-ID"] == custom_req_id
