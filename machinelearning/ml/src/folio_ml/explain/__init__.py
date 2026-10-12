"""Folio Explainer module generating multilingual issue explanations and communication drafts."""

from folio_ml.explain.contracts import (
    ExplainResult,
    IssueExplanation,
    MessageVariant,
)
from folio_ml.explain.number_guard import NumberGuard
from folio_ml.explain.polisher import (
    FakeLLMPolisher,
    IdentityPolisher,
    MockHallucinatingPolisher,
    Polisher,
)
from folio_ml.explain.service import ExplainerService
from folio_ml.explain.wa_link import build_whatsapp_link

__all__ = [
    "ExplainResult",
    "ExplainerService",
    "FakeLLMPolisher",
    "IdentityPolisher",
    "IssueExplanation",
    "MessageVariant",
    "MockHallucinatingPolisher",
    "NumberGuard",
    "Polisher",
    "build_whatsapp_link",
]
