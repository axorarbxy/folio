"""Explanation and communication draft endpoints."""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice
from folio_ml.explain.contracts import (
    IssueExplanation,
    MessageVariant,
)
from folio_ml.explain.service import ExplainerService
from folio_ml.utils.money import StrictMoney

router = APIRouter(prefix="/explain", tags=["Explain"])
service = ExplainerService()


class ExplainRequest(BaseModel):
    checks: list[CheckResult] = Field(default_factory=list)
    verdict: Verdict
    invoice: Invoice


class CommunicationDrafts(BaseModel):
    whatsapp: str
    email: str
    sms: str
    wa_link: str | None = None


class ExplainResponse(BaseModel):
    invoice_number: str = ""
    supplier_name: str = ""
    verdict_status: str = "safe"
    rupee_at_risk: StrictMoney = Field(default=Decimal("0.00"))
    explanations: list[IssueExplanation | dict[str, Any]]
    drafts: CommunicationDrafts
    messages: list[MessageVariant] = Field(default_factory=list)


@router.post("", response_model=ExplainResponse)
def explain_verdict(request: ExplainRequest) -> ExplainResponse:
    """Generates structured plain-language explanations and communication drafts for issues found."""
    result = service.explain(
        invoice=request.invoice,
        verdict=request.verdict,
        checks=request.checks,
    )

    # Find default English polite drafts for the primary drafts container
    wa_default = ""
    wa_link_default = None
    email_default = ""
    sms_default = ""

    for m in result.messages:
        if m.language == "en" and m.tone == "polite":
            if m.channel == "whatsapp":
                wa_default = m.content
                wa_link_default = m.wa_link
            elif m.channel == "email":
                email_default = m.content
            elif m.channel == "sms":
                sms_default = m.content

    return ExplainResponse(
        invoice_number=result.invoice_number,
        supplier_name=result.supplier_name,
        verdict_status=result.verdict_status,
        rupee_at_risk=result.rupee_at_risk,
        explanations=result.explanations,
        drafts=CommunicationDrafts(
            whatsapp=wa_default or "Invoice verified.",
            email=email_default or "Invoice verified.",
            sms=sms_default or "Invoice verified.",
            wa_link=wa_link_default,
        ),
        messages=result.messages,
    )
