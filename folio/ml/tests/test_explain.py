"""Tests for explainer service, multilingual drafts, wa.me links, and mandatory NumberGuard."""

from decimal import Decimal

from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.explain import (
    ExplainerService,
    MockHallucinatingPolisher,
    NumberGuard,
    build_whatsapp_link,
)
from folio_ml.providers.fake import create_fake_invoice

client = TestClient(app)


def test_whatsapp_link_builder() -> None:
    """Verifies wa.me URL encoding, phone number formatting, and length limits."""
    link = build_whatsapp_link("Hello World & Special ₹100", phone="9876543210")
    assert link.startswith("https://wa.me/919876543210?text=")
    assert "%20" in link
    assert "%E2%82%B9100" in link or "%24" in link or "100" in link

    # Max length boundary
    huge_text = "A" * 3000
    huge_link = build_whatsapp_link(huge_text)
    assert len(huge_link) <= 2048
    assert huge_link.endswith("...") or "%2E%2E%2E" in huge_link or "..." in huge_link


def test_number_guard_accepts_valid_figures() -> None:
    """Verifies that legitimate numbers present in structured input pass cleanly."""
    inv = create_fake_invoice(invoice_id="INV-2024-101", total_taxable="10000.00", rate_pct="18.00")
    verdict = Verdict(status="needs_review", rupee_at_risk=Decimal("1800.00"), reasons=["Check fail"])
    checks = [
        CheckResult(
            check_id="check_05",
            name="Tax Math",
            status="fail",
            severity="medium",
            kind="deterministic",
            found="1800.00",
            expected="1800.00",
            formula="taxable*rate",
            why_it_matters="Math mismatch",
            fixes=["RECHECK_TAX_CALCULATION"],
            rule_table_version="v1",
        )
    ]

    guard = NumberGuard()
    allowed = guard.extract_allowed_entities(invoice=inv, verdict=verdict, checks=checks)

    # Permitted candidate text with legitimate numbers
    valid_text = (
        "Hello Vendor, invoice INV-2024-101 has total ₹11800.00 with ₹1800.00 tax under Section 16(2)(aa)."
    )
    is_valid, violations = guard.verify_text(valid_text, allowed)
    assert is_valid
    assert len(violations) == 0


def test_number_guard_catches_and_rejects_hallucinations() -> None:
    """Acceptance test: NumberGuard MUST fire and reject unauthorized or altered numbers."""
    inv = create_fake_invoice(invoice_id="INV-2024-101", total_taxable="10000.00", rate_pct="18.00")
    verdict = Verdict(status="fix_first", rupee_at_risk=Decimal("1800.00"), reasons=["Check fail"])

    guard = NumberGuard()
    allowed = guard.extract_allowed_entities(invoice=inv, verdict=verdict, checks=[])

    # Candidate text with hallucinated amount ₹15,000 and unauthorized tax rate 12%
    hallucinated_text = (
        "Invoice INV-2024-101 requires an extra penalty payment of ₹15,000.00 at 12% interest."
    )
    is_valid, violations = guard.verify_text(hallucinated_text, allowed)
    assert not is_valid
    assert len(violations) >= 1
    assert any("15000" in v for v in violations)


def test_explainer_fallback_on_hallucinating_polisher() -> None:
    """Verifies that ExplainerService reverts to deterministic Jinja2 template if AI hallucinates."""
    inv = create_fake_invoice(invoice_id="INV-2024-500", total_taxable="5000.00", rate_pct="18.00")
    verdict = Verdict(status="fix_first", rupee_at_risk=Decimal("900.00"), reasons=["Math fail"])
    checks = [
        CheckResult(
            check_id="check_01",
            name="GSTIN Format",
            status="fail",
            severity="critical",
            kind="deterministic",
            found="Invalid Checksum",
            expected="Valid Checksum",
            formula="regex",
            why_it_matters="Invalid format",
            fixes=["VERIFY_GSTIN_ON_PORTAL"],
            rule_table_version="v1",
        )
    ]

    # Service equipped with hallucinating polisher
    bad_polisher = MockHallucinatingPolisher(hallucinated_number="₹99,999.00")
    service = ExplainerService(polisher=bad_polisher)

    result = service.explain(invoice=inv, verdict=verdict, checks=checks)

    # Explanations generated
    assert len(result.explanations) == 1
    assert "Supplier GSTIN format" in result.explanations[0].what_we_found
    assert len(result.explanations[0].how_to_fix) >= 1
    assert "services.gst.gov.in" in result.explanations[0].how_to_fix[0]

    # Messages generated across channels, languages, tones
    assert len(result.messages) == 18  # 3 channels * 3 languages * 2 tones

    # Every message must show that the Number Guard triggered and preserved template text
    for msg in result.messages:
        assert msg.number_guard_triggered is True
        assert msg.polished_by_ai is False
        assert "99,999" not in msg.content  # Hallucinated text was discarded!


def test_explainer_multilingual_handwritten_support() -> None:
    """Verifies hand-crafted Hindi and Marathi messages exist and contain correct local terms."""
    inv = create_fake_invoice(invoice_id="INV-99", total_taxable="1000.00", rate_pct="18.00")
    verdict = Verdict(status="needs_review", rupee_at_risk=Decimal("180.00"), reasons=["Warning"])

    service = ExplainerService()
    result = service.explain(invoice=inv, verdict=verdict, checks=[])

    hindi_wa = [m for m in result.messages if m.language == "hi" and m.channel == "whatsapp" and m.tone == "polite"][0]
    marathi_wa = [m for m in result.messages if m.language == "mr" and m.channel == "whatsapp" and m.tone == "polite"][0]

    assert "नमस्ते" in hindi_wa.content
    assert "नमस्कार" in marathi_wa.content
    assert hindi_wa.wa_link is not None
    assert marathi_wa.wa_link is not None


def test_explain_api_endpoint() -> None:
    """Verifies POST /v1/explain returns full payload with explanations and communication drafts."""
    inv = create_fake_invoice()
    payload = {
        "checks": [
            {
                "check_id": "check_01",
                "name": "GSTIN Checksum",
                "status": "fail",
                "severity": "critical",
                "kind": "deterministic",
                "found": "Bad Checksum",
                "expected": "Valid",
                "formula": "mod36",
                "why_it_matters": "Invalid GSTIN",
                "fixes": ["VERIFY_GSTIN_ON_PORTAL"],
                "rule_table_version": "v1",
            }
        ],
        "verdict": {
            "status": "fix_first",
            "reasons": ["Checksum failure"],
            "rupee_at_risk": "1800.00",
            "checks": [],
        },
        "invoice": inv.model_dump(mode="json"),
    }

    res = client.post("/v1/explain", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "explanations" in data
    assert len(data["explanations"]) == 1
    assert "drafts" in data
    assert "whatsapp" in data["drafts"]
    assert "wa_link" in data["drafts"]
    assert len(data["messages"]) == 18
