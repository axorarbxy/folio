"""Contracts and data models for explanation and communication drafts."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from folio_ml.utils.money import StrictMoney


class IssueExplanation(BaseModel):
    """Detailed plain-language explanation for a check finding."""

    check_id: str
    name: str
    severity: str
    what_we_found: str
    why_it_matters: str
    how_to_fix: list[str]
    rule_table_version: str = "v1"


class MessageVariant(BaseModel):
    """A draft notification message for a specific channel, language, and tone."""

    channel: Literal["whatsapp", "email", "sms"]
    language: Literal["en", "hi", "mr"]
    tone: Literal["polite", "firm"]
    content: str
    wa_link: str | None = None
    needs_native_review: bool = False
    polished_by_ai: bool = False
    number_guard_triggered: bool = False


class ExplainResult(BaseModel):
    """Complete explanation payload for an invoice validation result."""

    invoice_number: str
    supplier_name: str
    supplier_gstin: str
    verdict_status: str
    rupee_at_risk: StrictMoney = Field(default=Decimal("0.00"))
    explanations: list[IssueExplanation] = Field(default_factory=list)
    messages: list[MessageVariant] = Field(default_factory=list)


__all__ = [
    "ExplainResult",
    "IssueExplanation",
    "MessageVariant",
]
