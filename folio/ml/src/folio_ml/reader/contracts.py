"""Contracts and execution models for VLM / OCR extraction."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from folio_ml.contracts.invoice import Invoice

AgreementKind = Literal["exact", "normalized_equal", "numeric_close", "disagree"]


class RawExtraction(BaseModel):
    """Raw VLM / OCR extraction output with audit and cost signals."""

    invoice: Invoice = Field(..., description="Validated Pydantic invoice contract")
    raw_response_text: str = Field(..., description="Unparsed model completion text")
    provider_name: str = Field(..., description="AI or OCR service provider name")
    model_name: str = Field(..., description="Model identifier used for inference")
    latency_ms: float = Field(..., description="Total inference and parsing latency in milliseconds")
    token_usage: dict[str, int] = Field(
        default_factory=dict,
        description="Token consumption metrics (prompt, completion, total)",
    )
    estimated_cost_usd: float = Field(
        default=0.0,
        description="Estimated inference cost in USD for FinOps tracking",
    )
    retries_attempted: int = Field(default=0, description="Schema repair retry attempts")


class ReaderFailure(Exception):
    """Raised when document extraction fails schema validation after retries."""

    def __init__(
        self,
        doc_hash: str,
        error_type: str,
        error_message: str,
        raw_response: str | None = None,
        requires_human_review: bool = True,
    ) -> None:
        super().__init__(
            f"Extraction failure [{error_type}] on doc {doc_hash[:10]}: {error_message}"
        )
        self.doc_hash = doc_hash
        self.error_type = error_type
        self.error_message = error_message
        self.raw_response = raw_response
        self.requires_human_review = requires_human_review


class FieldAgreement(BaseModel):
    """Two-pass consistency measurement for an individual invoice field."""

    field_name: str
    pass1_val: Any
    pass2_val: Any
    agreement: AgreementKind


class TwoPassResult(BaseModel):
    """Aggregated two-pass extraction results and agreement evaluation."""

    pass1: RawExtraction
    pass2: RawExtraction
    agreements: dict[str, FieldAgreement] = Field(default_factory=dict)
    agreement_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Fraction of fields where pass1 and pass2 agreed (0..1)",
    )
