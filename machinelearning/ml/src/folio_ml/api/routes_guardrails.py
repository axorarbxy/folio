"""Guardrails and prompt-injection screening endpoints."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from folio_ml.guardrails.contracts import InjectionSpan, ScreenResult
from folio_ml.guardrails.screen import InjectionScreener

router = APIRouter(prefix="/guardrails", tags=["Guardrails"])
screener = InjectionScreener()


class ScreenRequest(BaseModel):
    text: str = Field(description="Document text or prompt to screen for security risks")


class ScreenResponse(BaseModel):
    risk: Literal["low", "medium", "high", "critical"]
    action: Literal["allow", "strip", "block", "review"]
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    spans: list[InjectionSpan] = Field(default_factory=list)
    cleaned_text: str | None = None


@router.post("/screen", response_model=ScreenResponse)
def screen_content(request: ScreenRequest) -> ScreenResponse:
    """Screens untrusted OCR or user input for prompt injections, system prompt lookalikes, or hidden instructions."""
    result: ScreenResult = screener.screen(request.text)
    return ScreenResponse(
        risk=result.risk,
        action=result.action,
        score=result.score,
        spans=result.spans,
        cleaned_text=result.cleaned_text,
    )
