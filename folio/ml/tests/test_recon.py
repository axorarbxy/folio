"""Tests for reconciliation engine, parsers, normalization, matching, simulation, and API."""

from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.recon import (
    Gstr2bDocument,
    Gstr2bRecord,
    PurchaseRegister,
    PurchaseRegisterParser,
    PurchaseRegisterRecord,
    ReconciliationEngine,
    ReconciliationMatcher,
    UniversalGstr2bParser,
    normalize_date,
    normalize_gstin,
    normalize_invoice_number,
)

client = TestClient(app)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "synthetic"
GSTR2B_FILE = DATA_DIR / "gstr2b_2024_04.json"
PR_FILE = DATA_DIR / "purchase_register_2024_04.csv"


def test_normalization_rules() -> None:
    """Verifies invoice number, GSTIN, and date normalization rules."""
    # Invoice numbers: FY prefixes, punctuation, leading zeros
    assert normalize_invoice_number("FY23-24/INV-00104") == "INV104"
    assert normalize_invoice_number("2024-25/00045") == "45"
    assert normalize_invoice_number("INV/2024/1001") == "INV20241001"
    assert normalize_invoice_number("  inv-002  ") == "INV2"
    assert normalize_invoice_number("0000") == "0"
    assert normalize_invoice_number("") == ""

    # GSTIN
    assert normalize_gstin(" 27aabcs1429b1zb ") == "27AABCS1429B1ZB"
    assert normalize_gstin("27 AABCS 1429 B1ZB") == "27AABCS1429B1ZB"

    # Date
    assert normalize_date("10/04/2024") == "2024-04-10"
    assert normalize_date("2024-04-10") == "2024-04-10"


def test_parsers_synthetic_data() -> None:
    """Verifies ingestion of synthetic GSTR-2B JSON and Purchase Register CSV."""
    gstr_parser = UniversalGstr2bParser()
    gstr_doc = gstr_parser.parse(GSTR2B_FILE)
    assert gstr_doc.period == "2024-04"
    assert len(gstr_doc.records) == 3
    assert gstr_doc.records[0].supplier_gstin == "27AABCS1429B1ZB"
    assert isinstance(gstr_doc.records[0].taxable_value, Decimal)

    pr_parser = PurchaseRegisterParser()
    pr_doc = pr_parser.parse_csv(PR_FILE, period="2024-04")
    assert pr_doc.period == "2024-04"
    assert len(pr_doc.records) == 4
    assert pr_doc.records[0].supplier_gstin == "27AABCS1429B1ZB"
    assert isinstance(pr_doc.records[0].taxable_value, Decimal)


def test_parsers_portal_layout() -> None:
    """Verifies ingestion of standard government portal b2b JSON hierarchy."""
    portal_json = {
        "data": {
            "fp": "2024-04",
            "b2b": [
                {
                    "ctin": "27AABCS1429B1ZB",
                    "cname": "Apex Precision Tools",
                    "inv": [
                        {
                            "inum": "INV-1001",
                            "idt": "10-04-2024",
                            "val": 11800.0,
                            "itcavl": "Y",
                            "rsn": "",
                            "items": [
                                {
                                    "itm_det": {
                                        "txval": 10000.0,
                                        "iamt": 0.0,
                                        "camt": 900.0,
                                        "samt": 900.0,
                                        "csamt": 0.0,
                                    }
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    }
    parser = UniversalGstr2bParser()
    doc = parser.parse(portal_json)
    assert doc.period == "2024-04"
    assert len(doc.records) == 1
    rec = doc.records[0]
    assert rec.supplier_gstin == "27AABCS1429B1ZB"
    assert rec.taxable_value == Decimal("10000.00")
    assert rec.cgst == Decimal("900.00")
    assert rec.total == Decimal("11800.00")


def test_planted_mismatches_acceptance() -> None:
    """Acceptance test verifying exact reconstruction of planted synthetic period mismatches."""
    gstr_parser = UniversalGstr2bParser()
    pr_parser = PurchaseRegisterParser()

    gstr_doc = gstr_parser.parse(GSTR2B_FILE)
    pr_doc = pr_parser.parse_csv(PR_FILE, period="2024-04")

    engine = ReconciliationEngine()
    report = engine.reconcile("2024-04", pr_doc, gstr_doc)

    assert report.total_invoices_books == 4
    assert report.total_invoices_2b == 3

    # Check bucket distribution
    # 1. Apex Precision: INV-2024-1001 -> exact match
    # 2. Gujarat Polymer: INV-2024-1002 -> value mismatch (books 22k vs 2B 20k)
    # 3. Silicon City: INV-2024-1003 -> vendor_not_filed (Silicon City filed nothing in 2B)
    # 4. Coromandel Auto: INV-2024-1004 -> ineligible (Section 17(5) Blocked Credit)
    counts = report.bucket_counts
    assert counts.get("matched", 0) == 1
    assert counts.get("value_mismatch", 0) == 1
    assert counts.get("vendor_not_filed", 0) == 1
    assert counts.get("ineligible", 0) == 1

    # Check rupee at risk
    assert report.rupee_at_risk > Decimal("0.00")

    # Verify ranked supplier exposure
    exposures = engine.calculate_supplier_exposures(report)
    assert len(exposures) >= 3
    # Silicon City has the highest unfiled invoice (₹59,000.00)
    assert exposures[0].supplier_gstin == "29AABCS1429B1ZB"
    assert exposures[0].rupee_at_risk == Decimal("59000.00")


def test_fuzzy_and_hungarian_matching() -> None:
    """Verifies that fuzzy invoice numbers with identical amounts match via Hungarian algorithm."""
    books_records = [
        PurchaseRegisterRecord(
            supplier_gstin="27AABCS1429B1ZB",
            supplier_name="Apex Precision Tools",
            invoice_number="INV-2024-8899",  # typo vs 2B
            invoice_date="2024-04-10",
            taxable_value=Decimal("5000.00"),
            cgst=Decimal("450.00"),
            sgst=Decimal("450.00"),
            total=Decimal("5900.00"),
        )
    ]
    gstr2b_records = [
        Gstr2bRecord(
            supplier_gstin="27AABCS1429B1ZB",
            supplier_name="Apex Precision Tools",
            invoice_number="INV-2024-8898",  # 1 char difference
            invoice_date="2024-04-10",
            taxable_value=Decimal("5000.00"),
            cgst=Decimal("450.00"),
            sgst=Decimal("450.00"),
            total=Decimal("5900.00"),
            itc_available="Y",
        )
    ]

    pr = PurchaseRegister(period="2024-04", records=books_records)
    gstr = Gstr2bDocument(period="2024-04", records=gstr2b_records)

    engine = ReconciliationEngine(ReconciliationMatcher(fuzzy_threshold=70.0))
    report = engine.reconcile("2024-04", pr, gstr)

    assert report.matched_count == 1
    match = report.matches[0]
    assert match.bucket == "matched"
    assert match.score < 1.0  # reflects fuzzy ratio
    assert "Fuzzy invoice match" in match.reasons[0]


def test_duplicate_invoices_flagged() -> None:
    """Verifies that duplicate invoice entries in books or 2B are flagged."""
    dup_records = [
        PurchaseRegisterRecord(
            supplier_gstin="27AABCS1429B1ZB",
            supplier_name="Apex",
            invoice_number="INV-100",
            invoice_date="2024-04-10",
            taxable_value=Decimal("1000.00"),
            total=Decimal("1180.00"),
        ),
        PurchaseRegisterRecord(
            supplier_gstin="27AABCS1429B1ZB",
            supplier_name="Apex",
            invoice_number="INV-100",  # Duplicate!
            invoice_date="2024-04-10",
            taxable_value=Decimal("1000.00"),
            total=Decimal("1180.00"),
        ),
    ]
    pr = PurchaseRegister(period="2024-04", records=dup_records)
    gstr = Gstr2bDocument(period="2024-04", records=[])

    engine = ReconciliationEngine()
    report = engine.reconcile("2024-04", pr, gstr)

    assert report.bucket_counts.get("duplicate", 0) == 1


def test_simulation_and_resolution_flow() -> None:
    """Verifies what-if simulation and user resolution audit trails."""
    gstr_parser = UniversalGstr2bParser()
    pr_parser = PurchaseRegisterParser()
    gstr_doc = gstr_parser.parse(GSTR2B_FILE)
    pr_doc = pr_parser.parse_csv(PR_FILE, period="2024-04")

    engine = ReconciliationEngine()
    report = engine.reconcile("2024-04", pr_doc, gstr_doc)

    # 1. Simulate: what if Apex Precision (currently matched) fails to file?
    sim = engine.simulate(report, {"27AABCS1429B1ZB"})
    assert sim.affected_invoices_count == 1
    assert sim.additional_risk == Decimal("11800.00")
    assert sim.simulated_rupee_at_risk == report.rupee_at_risk + Decimal("11800.00")

    # 2. Resolve a mismatch
    mismatch = [m for m in report.matches if m.bucket == "value_mismatch"][0]
    updated, event = engine.resolve(mismatch, "contact_vendor", note="Emailed CFO for revised bill")

    assert updated.resolution == "contact_vendor"
    assert event.action == "contact_vendor"
    assert len(engine.audit_log) == 1

    # Invalid action
    with pytest.raises(ValueError, match="Invalid resolution action"):
        engine.resolve(mismatch, "invalid_action")


def test_recon_api_endpoints() -> None:
    """Verifies /v1/reconcile, /v1/reconcile/simulate, and /v1/reconcile/resolve endpoints."""
    # Test /v1/reconcile
    payload = {
        "period": "2024-04",
        "register_data": [
            {
                "supplier_gstin": "27AABCS1429B1ZB",
                "supplier_name": "Apex Precision",
                "invoice_number": "INV-1001",
                "invoice_date": "2024-04-10",
                "taxable_value": 10000.0,
                "cgst": 900.0,
                "sgst": 900.0,
                "total": 11800.0,
            }
        ],
        "gstr2b_data": {
            "period": "2024-04",
            "records": [
                {
                    "supplier_gstin": "27AABCS1429B1ZB",
                    "supplier_name": "Apex Precision",
                    "invoice_number": "INV-1001",
                    "invoice_date": "2024-04-10",
                    "taxable_value": 10000.0,
                    "cgst": 900.0,
                    "sgst": 900.0,
                    "total": 11800.0,
                    "itc_available": "Y",
                }
            ],
        },
    }
    resp = client.post("/v1/reconcile", json=payload)
    assert resp.status_code == 200
    report_data = resp.json()
    assert report_data["period"] == "2024-04"
    assert report_data["matched_count"] == 1

    # Test /v1/reconcile/simulate
    sim_payload = {
        "report": report_data,
        "vendors_not_filing": ["27AABCS1429B1ZB"],
    }
    sim_resp = client.post("/v1/reconcile/simulate", json=sim_payload)
    assert sim_resp.status_code == 200
    assert sim_resp.json()["affected_invoices_count"] == 1

    # Test /v1/reconcile/resolve
    match_item = report_data["matches"][0]
    res_payload = {
        "match": match_item,
        "action": "defer",
        "note": "Defer to May return",
    }
    res_resp = client.post("/v1/reconcile/resolve", json=res_payload)
    assert res_resp.status_code == 200
    assert res_resp.json()["match"]["resolution"] == "defer"
