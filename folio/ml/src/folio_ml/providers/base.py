"""Base protocol interfaces for Folio ML models and services."""

from typing import Any, Protocol, runtime_checkable

from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.vendor import VendorRisk


@runtime_checkable
class DocumentReader(Protocol):
    """Protocol for OCR/LLM document readers extracting structured invoices."""

    def extract(self, document_bytes: bytes, filename: str) -> Invoice:
        ...


@runtime_checkable
class DocumentPreprocessor(Protocol):
    """Protocol for image/PDF preprocessors computing quality and detecting language/QR."""

    def process(self, document_bytes: bytes, filename: str) -> dict[str, Any]:
        ...


@runtime_checkable
class LLMPolisher(Protocol):
    """Protocol for LLM text rephrasing and notification generation."""

    def polish(self, template_text: str, context: dict[str, Any]) -> str:
        ...


@runtime_checkable
class VendorStore(Protocol):
    """Protocol for vendor event persistence and risk lookup."""

    def get_risk(self, gstin: str) -> VendorRisk:
        ...

    def record_event(self, event: dict[str, Any]) -> None:
        ...


@runtime_checkable
class GuardrailScreener(Protocol):
    """Protocol for prompt-injection screening and untrusted document checks."""

    def screen(self, text: str) -> dict[str, Any]:
        ...
