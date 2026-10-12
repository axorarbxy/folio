"""Reconciliation contracts for GSTR-2B vs Purchase Register matching."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField

from folio_ml.utils.money import StrictMoney, StrictMoneyOpt

ReconBucket = Literal[
    "matched",
    "value_mismatch",
    "missing_in_2b",
    "missing_in_books",
    "vendor_not_filed",
    "ineligible",
    "duplicate",
    "timing_difference",
]


class ReconMatch(BaseModel):
    """An individual invoice-level reconciliation match or difference."""
    match_id: str
    bucket: ReconBucket
    supplier_gstin: str
    invoice_number: str
    book_amount: StrictMoneyOpt = None
    gstr2b_amount: StrictMoneyOpt = None
    difference: StrictMoneyOpt = None
    score: float = PydanticField(default=1.0, ge=0.0, le=1.0)
    reasons: list[str] = PydanticField(default_factory=list)
    resolution: str | None = None


class ReconReport(BaseModel):
    """Summary of reconciliation results for a tax period."""
    period: str  # e.g. "2024-04"
    total_invoices_books: int = 0
    total_invoices_2b: int = 0
    matched_count: int = 0
    mismatched_count: int = 0
    missing_in_2b_count: int = 0
    rupee_at_risk: StrictMoney = PydanticField(default=Decimal("0.00"))
    bucket_counts: dict[str, int] = PydanticField(default_factory=dict)
    matches: list[ReconMatch] = PydanticField(default_factory=list)
