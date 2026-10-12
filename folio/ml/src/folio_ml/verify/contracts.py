"""Contracts for independent verification, tamper detection, and anomaly scanning."""

import uuid
from typing import Any, Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField

from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.signals import ThreatSignal


class VerifierFlag(BaseModel):
    """Flag raised by independent arithmetic or statutory verification."""

    field: str
    message: str
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    expected: Any = None
    found: Any = None


class VerificationResult(BaseModel):
    """Aggregate result from independent document verification."""

    invoice_id: str
    is_valid: bool
    flags: list[VerifierFlag] = PydanticField(default_factory=list)
    signals: list[ThreatSignal] = PydanticField(default_factory=list)


class ScanRequest(BaseModel):
    """Payload for POST /v1/signals/scan."""

    invoice_id: str | None = None
    invoice: Invoice | None = None
    pdf_path: str | None = None
    image_path: str | None = None


class ScanResponse(BaseModel):
    """Response returned by threat and anomaly scanning."""

    scan_id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str
    clean: bool
    signals: list[ThreatSignal] = PydanticField(default_factory=list)
    flags: list[VerifierFlag] = PydanticField(default_factory=list)
