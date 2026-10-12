"""Invoice data contracts for Folio ML."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField

from folio_ml.contracts.base import Field
from folio_ml.utils.money import StrictMoney, StrictMoneyOpt


class LineItem(BaseModel):
    """An individual line item within an invoice."""
    description: Field[str]
    hsn: Field[str | None] = PydanticField(default_factory=lambda: Field(value=None))
    qty: Field[StrictMoneyOpt] = PydanticField(default_factory=lambda: Field(value=None))
    unit: Field[str | None] = PydanticField(default_factory=lambda: Field(value=None))
    rate: Field[StrictMoneyOpt] = PydanticField(default_factory=lambda: Field(value=None))
    taxable: Field[StrictMoney]
    cgst_pct: Field[StrictMoneyOpt] = PydanticField(default_factory=lambda: Field(value=None))
    sgst_pct: Field[StrictMoneyOpt] = PydanticField(default_factory=lambda: Field(value=None))
    igst_pct: Field[StrictMoneyOpt] = PydanticField(default_factory=lambda: Field(value=None))
    cess_pct: Field[StrictMoneyOpt] = PydanticField(default_factory=lambda: Field(value=None))


class InvoiceTotals(BaseModel):
    """Aggregate totals for taxable amount and taxes."""
    taxable_amount: Field[StrictMoney]
    cgst_amount: Field[StrictMoney] = PydanticField(
        default_factory=lambda: Field(value=Decimal("0.00"))
    )
    sgst_amount: Field[StrictMoney] = PydanticField(
        default_factory=lambda: Field(value=Decimal("0.00"))
    )
    igst_amount: Field[StrictMoney] = PydanticField(
        default_factory=lambda: Field(value=Decimal("0.00"))
    )
    cess_amount: Field[StrictMoney] = PydanticField(
        default_factory=lambda: Field(value=Decimal("0.00"))
    )
    total_amount: Field[StrictMoney]


class Invoice(BaseModel):
    """Normalized structured invoice representation."""
    id: str
    source_file_hash: str
    supplier_name: Field[str]
    supplier_gstin: Field[str]
    supplier_state: Field[str]
    buyer_name: Field[str]
    buyer_gstin: Field[str]
    buyer_state: Field[str]
    number: Field[str]
    date: Field[str]  # ISO 8601 YYYY-MM-DD
    place_of_supply: Field[str]
    reverse_charge: Field[bool] = PydanticField(
        default_factory=lambda: Field(value=False)
    )
    irn: Field[str | None] = PydanticField(default_factory=lambda: Field(value=None))
    items: list[LineItem] = PydanticField(default_factory=list)
    totals: InvoiceTotals
    status: Literal["draft", "validated", "reconciled", "needs_review"] = "draft"
