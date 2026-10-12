"""SmallJudge protocol and FakeJudge implementation for verification arbitration."""

from typing import Any, Protocol, runtime_checkable

from folio_ml.contracts.invoice import Invoice
from folio_ml.verify.contracts import VerifierFlag


@runtime_checkable
class SmallJudge(Protocol):
    """Protocol for secondary model-assisted verification arbitration."""

    def arbitrate(self, invoice: Invoice, flag: VerifierFlag) -> dict[str, Any]:
        """Reviews an ambiguous verifier flag against document context."""
        ...


class FakeJudge:
    """Offline test-double judge providing deterministic arbitration."""

    def arbitrate(self, invoice: Invoice, flag: VerifierFlag) -> dict[str, Any]:
        is_upheld = flag.severity in {"critical", "high"}
        return {
            "upheld": is_upheld,
            "confidence": 0.95 if is_upheld else 0.40,
            "explanation": (
                f"Arbitration for {flag.field}: "
                f"{'Discrepancy confirmed by independent re-reading' if is_upheld else 'Discrepancy considered within benign visual rounding'}"
            ),
            "recommended_action": "FLAG_FOR_AUDIT" if is_upheld else "AUTO_ACCEPT",
        }
