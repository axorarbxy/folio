"""Fake provider implementations for offline testing and FOLIO_MODE=fake."""

import hashlib
from decimal import Decimal
from typing import Any

from folio_ml.contracts.base import Box, Field
from folio_ml.contracts.invoice import Invoice, InvoiceTotals, LineItem
from folio_ml.contracts.vendor import RiskContribution, VendorRisk


def create_fake_invoice(
    invoice_id: str = "INV-2024-001",
    supplier_gstin: str = "27AABCS1429B1ZU",
    buyer_gstin: str = "27AAACW1234A1ZY",
    total_taxable: str = "10000.00",
    rate_pct: str = "18.00",
) -> Invoice:
    """Creates a deterministic schema-valid synthetic Invoice fixture."""
    taxable_dec = Decimal(total_taxable)
    rate_dec = Decimal(rate_pct)
    tax_dec = (taxable_dec * rate_dec / Decimal("100")).quantize(Decimal("0.01"))
    half_tax = (tax_dec / Decimal("2")).quantize(Decimal("0.01"))
    total_dec = taxable_dec + tax_dec

    item = LineItem(
        description=Field(
            value="Industrial Steel Fasteners M8x50",
            confidence=0.98,
            box=Box(page=1, x0=0.1, y0=0.4, x1=0.5, y1=0.45),
            source="reader",
        ),
        hsn=Field(value="7318", confidence=0.95),
        qty=Field(value=Decimal("100.00"), confidence=0.99),
        unit=Field(value="NOS", confidence=0.99),
        rate=Field(value=Decimal("100.00"), confidence=0.97),
        taxable=Field(value=taxable_dec, confidence=0.99),
        cgst_pct=Field(value=rate_dec / Decimal("2"), confidence=0.95),
        sgst_pct=Field(value=rate_dec / Decimal("2"), confidence=0.95),
        igst_pct=Field(value=Decimal("0.00"), confidence=0.95),
        cess_pct=Field(value=Decimal("0.00"), confidence=0.95),
    )

    totals = InvoiceTotals(
        taxable_amount=Field(value=taxable_dec, confidence=0.99),
        cgst_amount=Field(value=half_tax, confidence=0.98),
        sgst_amount=Field(value=half_tax, confidence=0.98),
        igst_amount=Field(value=Decimal("0.00"), confidence=0.99),
        cess_amount=Field(value=Decimal("0.00"), confidence=0.99),
        total_amount=Field(value=total_dec, confidence=0.99),
    )

    doc_hash = hashlib.sha256(invoice_id.encode()).hexdigest()

    return Invoice(
        id=invoice_id,
        source_file_hash=doc_hash,
        supplier_name=Field(value="Apex Fasteners Pvt Ltd", confidence=0.97),
        supplier_gstin=Field(value=supplier_gstin, confidence=0.99),
        supplier_state=Field(value="27", confidence=0.99),
        buyer_name=Field(value="Western Engineering Works", confidence=0.96),
        buyer_gstin=Field(value=buyer_gstin, confidence=0.99),
        buyer_state=Field(value="27", confidence=0.99),
        number=Field(value=invoice_id, confidence=0.99),
        date=Field(value="2024-05-15", confidence=0.98),
        place_of_supply=Field(value="27", confidence=0.98),
        reverse_charge=Field(value=False, confidence=0.99),
        irn=Field(value=None, confidence=0.90),
        items=[item],
        totals=totals,
        status="draft",
    )


class FakeDocumentReader:
    """Fake document reader returning reproducible invoices."""

    def __init__(self, fixture: Invoice | None = None):
        self._fixture = fixture or create_fake_invoice()

    def extract(self, document_bytes: bytes, filename: str) -> Invoice:
        doc_hash = hashlib.sha256(document_bytes or b"dummy").hexdigest()
        inv = self._fixture.model_copy(deep=True)
        inv.source_file_hash = doc_hash
        return inv


class FakeDocumentPreprocessor:
    """Fake preprocessor returning synthetic image metrics."""

    def process(self, document_bytes: bytes, filename: str) -> dict[str, Any]:
        return {
            "quality_score": 0.92,
            "dpi": 300,
            "detected_language": "en",
            "is_handwritten": False,
            "qr_detected": True,
            "qr_payload": "GST:27AABCS1429B1ZU:INV-2024-001:11800.00",
        }


class FakeLLMPolisher:
    """Fake polisher returning template text unchanged."""

    def polish(self, template_text: str, context: dict[str, Any]) -> str:
        return template_text


class FakeVendorStore:
    """Fake vendor risk store."""

    def __init__(self) -> None:
        self._events: list[dict[str, Any]] = []

    def get_risk(self, gstin: str) -> VendorRisk:
        return VendorRisk(
            gstin=gstin,
            vendor_name="Apex Fasteners Pvt Ltd",
            score=82.5,
            credible_interval=(75.0, 90.0),
            limited_history=False,
            tag="Watch",
            contributions=[
                RiskContribution(
                    feature="late_filing_rate",
                    weight=0.35,
                    value=0.15,
                    effect_points=12.5,
                ),
                RiskContribution(
                    feature="mismatch_rate",
                    weight=0.25,
                    value=0.08,
                    effect_points=6.0,
                ),
            ],
            filing_history=[
                {"period": "2024-01", "status": "filed_on_time"},
                {"period": "2024-02", "status": "filed_on_time"},
                {"period": "2024-03", "status": "filed_late"},
            ],
        )

    def record_event(self, event: dict[str, Any]) -> None:
        self._events.append(event)


class FakeGuardrailScreener:
    """Fake guardrail screener."""

    def screen(self, text: str) -> dict[str, Any]:
        return {
            "risk": "low",
            "action": "allow",
            "spans": [],
        }
