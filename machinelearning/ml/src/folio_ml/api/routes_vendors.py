"""Vendor risk and compliance tracking API endpoints."""

from fastapi import APIRouter

from folio_ml.contracts.vendor import VendorRisk
from folio_ml.vendor.contracts import BatchScoreRequest, VendorEvent, VendorHistoryResponse
from folio_ml.vendor.scorer import VendorRiskScorer
from folio_ml.vendor.store import InMemoryVendorStore

router = APIRouter(prefix="/vendors", tags=["Vendors"])

# Global shared scorer instance for API execution
_default_store = InMemoryVendorStore()
scorer = VendorRiskScorer(store=_default_store)


@router.get("/{gstin}/risk", response_model=VendorRisk)
def get_vendor_risk(gstin: str) -> VendorRisk:
    """Returns explainable supplier risk score, Bayesian credible interval, and factor contributions."""
    return scorer.evaluate_vendor(gstin)


@router.post("/score-batch", response_model=list[VendorRisk])
def score_vendor_batch(request: BatchScoreRequest) -> list[VendorRisk]:
    """Evaluates risk for a list of supplier GSTINs in batch."""
    return scorer.score_batch(request.gstins)


@router.post("/events", response_model=VendorEvent)
def record_vendor_event(event: VendorEvent) -> VendorEvent:
    """Appends an immutable compliance or operational event for a supplier."""
    return scorer.record_event(event)


@router.get("/{gstin}/history", response_model=VendorHistoryResponse)
def get_vendor_history(gstin: str) -> VendorHistoryResponse:
    """Retrieves full audit event timeline and 12-month filing history."""
    events = scorer.store.get_events(gstin)
    risk = scorer.evaluate_vendor(gstin)
    return VendorHistoryResponse(
        gstin=gstin,
        events=events,
        filing_history=risk.filing_history,
    )
