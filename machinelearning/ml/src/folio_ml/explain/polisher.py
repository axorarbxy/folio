"""LLM Polisher Protocol, FakePolisher, and testing test-doubles for message rephrasing."""

from typing import Any, Protocol, runtime_checkable

from folio_ml.providers.fake import FakeLLMPolisher


@runtime_checkable
class Polisher(Protocol):
    """Protocol for optional LLM message polishing and rephrasing."""

    def polish(self, template_text: str, context: dict[str, Any]) -> str:
        """Rephrases template text politely while preserving structured entities."""
        ...


class IdentityPolisher:
    """Default fake polisher returning template text unchanged."""

    def polish(self, template_text: str, context: dict[str, Any]) -> str:
        return template_text


class MockHallucinatingPolisher:
    """Test-double that simulates an LLM hallucinating or altering a monetary value."""

    def __init__(self, hallucinated_number: str = "₹15,000") -> None:
        self.hallucinated_number = hallucinated_number

    def polish(self, template_text: str, context: dict[str, Any]) -> str:
        # Appends or alters number to trigger NumberGuard
        return f"{template_text} Please note an extra charge of {self.hallucinated_number} is pending."


__all__ = [
    "FakeLLMPolisher",
    "IdentityPolisher",
    "MockHallucinatingPolisher",
    "Polisher",
]
