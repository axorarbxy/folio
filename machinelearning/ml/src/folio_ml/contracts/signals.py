"""Threat, anomaly, and tamper signals contracts."""

from typing import Any, Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField


class ThreatSignal(BaseModel):
    """Signal indicating tampering, injection, near-duplicate, or anomaly in invoice documents."""

    signal_id: str
    signal_type: Literal[
        "prompt_injection",
        "hidden_text",
        "tamper",
        "near_duplicate",
        "heuristic",
        "qr_mismatch",
        "duplicate_invoice",
        "edited_after_approval",
        "gstin_name_mismatch",
        "bank_detail_change",
        "sequence_anomaly",
        "tampered_document",
        "new_vendor_high_value",
    ]
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float = PydanticField(default=1.0, ge=0.0, le=1.0)
    description: str
    status: Literal["open", "resolved", "dismissed"] = "open"
    risk_score: float = PydanticField(default=50.0, ge=0.0, le=100.0)
    evidence: list[dict[str, Any]] = PydanticField(default_factory=list)
    recommended_steps: list[str] = PydanticField(default_factory=list)
    spans: list[dict[str, Any]] = PydanticField(default_factory=list)
