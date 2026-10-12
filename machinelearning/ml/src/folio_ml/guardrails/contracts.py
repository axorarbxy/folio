"""Contracts for AI guardrails, prompt injection screening, and PII redaction."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class InjectionSpan(BaseModel):
    """Specific substring flagged by the injection screener."""

    start: int
    end: int
    text: str
    reason: str
    category: Literal["instruction", "system_prompt", "role_marker", "hidden_text", "imperative"]


class ScreenResult(BaseModel):
    """Result of prompt injection screening on untrusted text."""

    text: str
    risk: Literal["low", "medium", "high"]
    action: Literal["allow", "review", "block", "strip"]
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    spans: list[InjectionSpan] = Field(default_factory=list)
    cleaned_text: str | None = None


class RedactionResult(BaseModel):
    """Result of PII redaction on text prior to third-party model inference."""

    redacted_text: str
    masks_count: int
    masked_types: list[str] = Field(default_factory=list)


class OverrideRecord(BaseModel):
    """Audit log entry capturing human correction or override of AI/model verdicts."""

    override_id: str
    invoice_id: str
    field_name: str
    original_value: Any
    override_value: Any
    user_id: str
    reason: str
    timestamp_iso: str


__all__ = [
    "InjectionSpan",
    "OverrideRecord",
    "RedactionResult",
    "ScreenResult",
]
