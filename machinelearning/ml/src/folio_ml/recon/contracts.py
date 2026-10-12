"""Internal contracts and data models for GSTR-2B and Purchase Register reconciliation."""

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

from folio_ml.contracts.recon import ReconBucket, ReconMatch, ReconReport
from folio_ml.utils.money import StrictMoney, StrictMoneyOpt


class Gstr2bRecord(BaseModel):
    """Normalized entry from GSTR-2B statement."""
    supplier_gstin: str
    supplier_name: str
    invoice_number: str
    invoice_date: str  # YYYY-MM-DD
    taxable_value: StrictMoney
    cgst: StrictMoney = Decimal("0.00")
    sgst: StrictMoney = Decimal("0.00")
    igst: StrictMoney = Decimal("0.00")
    cess: StrictMoney = Decimal("0.00")
    total: StrictMoneyOpt = None
    itc_available: str = "Y"  # "Y" or "N"
    itc_reason: str = ""
    period: str = ""
    raw: dict[str, Any] = Field(default_factory=dict)


class Gstr2bDocument(BaseModel):
    """Complete GSTR-2B document containing records for a filing period."""
    period: str
    records: list[Gstr2bRecord] = Field(default_factory=list)
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


class PurchaseRegisterRecord(BaseModel):
    """Entry from the company's internal ERP / purchase register."""
    supplier_gstin: str
    supplier_name: str
    invoice_number: str
    invoice_date: str  # YYYY-MM-DD
    taxable_value: StrictMoney
    cgst: StrictMoney = Decimal("0.00")
    sgst: StrictMoney = Decimal("0.00")
    igst: StrictMoney = Decimal("0.00")
    cess: StrictMoney = Decimal("0.00")
    total: StrictMoneyOpt = None
    period: str = ""
    raw: dict[str, Any] = Field(default_factory=dict)


class PurchaseRegister(BaseModel):
    """Internal purchase register for a financial period."""
    period: str
    records: list[PurchaseRegisterRecord] = Field(default_factory=list)


class NormalizedRecord(BaseModel):
    """Canonical representation of an invoice line item used for reconciliation matching."""
    record_id: str
    source: Literal["books", "gstr2b"]
    original_invoice_number: str
    normalized_invoice_number: str
    supplier_gstin: str
    supplier_name: str
    invoice_date: str  # YYYY-MM-DD
    taxable_value: StrictMoney
    cgst: StrictMoney
    sgst: StrictMoney
    igst: StrictMoney
    cess: StrictMoney
    total: StrictMoney
    tax_total: StrictMoney
    itc_available: bool = True
    itc_reason: str = ""
    period: str = ""


class FieldDiff(BaseModel):
    """Field-level numeric discrepancy between books and GSTR-2B."""
    field_name: str
    book_value: StrictMoney
    gstr2b_value: StrictMoney
    difference: StrictMoney


__all__ = [
    "FieldDiff",
    "Gstr2bDocument",
    "Gstr2bRecord",
    "NormalizedRecord",
    "PurchaseRegister",
    "PurchaseRegisterRecord",
    "ReconBucket",
    "ReconMatch",
    "ReconReport",
]
