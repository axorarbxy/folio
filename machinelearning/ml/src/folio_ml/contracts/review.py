"""Human review routing contracts."""

from typing import Any, Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField


class ReviewFieldDetail(BaseModel):
    """Details on why a specific field was flagged for human review."""
    field_name: str
    reason: str
    confidence: float
    current_value: Any = None


class ReviewDecision(BaseModel):
    """Triage and routing decision for an invoice."""
    invoice_id: str
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    auto_accept: list[str] = PydanticField(default_factory=list)
    needs_review: list[ReviewFieldDetail] = PydanticField(default_factory=list)
    reasons: list[str] = PydanticField(default_factory=list)
