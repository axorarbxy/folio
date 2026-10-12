"""Human review routing endpoint."""

from fastapi import APIRouter

from folio_ml.confidence.routing import route_invoice
from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.review import ReviewDecision

router = APIRouter(prefix="/review", tags=["Review"])


@router.post("/route", response_model=ReviewDecision)
def route_for_review(invoice: Invoice) -> ReviewDecision:
    """Evaluates field confidences, agreement, and deterministic flags to route uncertain items to humans."""
    return route_invoice(invoice)
