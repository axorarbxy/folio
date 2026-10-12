"""Data models and event contracts for vendor risk modeling."""

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField


class VendorEvent(BaseModel):
    """An immutable atomic compliance or operational event recorded for a vendor."""

    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    gstin: str
    period: str = PydanticField(
        ...,
        description="Filing/tax period in YYYY-MM format, e.g. '2024-04'",
    )
    event_type: Literal[
        "invoice_received",
        "filing_status",
        "recon_mismatch",
        "message_sent",
        "response_received",
        "gstin_status_check",
    ]
    timestamp: str = PydanticField(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        description="Event occurrence timestamp in ISO 8601",
    )
    details: dict[str, Any] = PydanticField(
        default_factory=dict,
        description="Payload details (e.g. error checks failed, mismatch count, response hours)",
    )


class BatchScoreRequest(BaseModel):
    """Batch scoring request payload."""

    gstins: list[str]


class VendorHistoryResponse(BaseModel):
    """Historical timeline of events and 12-month filing records for a vendor."""

    gstin: str
    events: list[VendorEvent]
    filing_history: list[dict[str, Any]]
