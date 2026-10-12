"""Vendor risk scoring contracts."""

from typing import Any, Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField


class RiskContribution(BaseModel):
    """Explainable contribution factor to vendor risk score."""
    feature: str
    weight: float
    value: Any
    effect_points: float


class VendorRisk(BaseModel):
    """Vendor risk evaluation report."""
    gstin: str
    vendor_name: str | None = None
    score: float = PydanticField(ge=0.0, le=100.0, description="Risk score in 0..100")
    credible_interval: tuple[float, float] = (0.0, 100.0)
    limited_history: bool = True
    tag: Literal["Reliable", "Watch", "High risk"] = "Watch"
    contributions: list[RiskContribution] = PydanticField(default_factory=list)
    filing_history: list[dict[str, Any]] = PydanticField(default_factory=list)
