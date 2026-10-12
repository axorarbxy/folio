"""Base framework for deterministic GST validation rules."""

from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal
from typing import Literal

from folio_ml.contracts.checks import CheckResult
from folio_ml.contracts.invoice import Invoice
from folio_ml.rules.loader import RuleDataBundle, load_rules_data
from folio_ml.utils.dates import now_ist


class RuleContext:
    """Execution context and reference data for rule evaluation."""

    def __init__(
        self,
        as_of: date | None = None,
        bundle: RuleDataBundle | None = None,
        tolerance: Decimal = Decimal("1.00"),
    ) -> None:
        self.as_of: date = as_of or now_ist().date()
        self.bundle: RuleDataBundle = bundle or load_rules_data()
        self.tolerance: Decimal = tolerance
        self.version: str = self.bundle.version


class Rule(ABC):
    """Abstract base class for all GST validation checks."""

    id: str
    name: str
    kind: Literal["deterministic", "ai"] = "deterministic"
    severity: Literal["critical", "high", "medium", "low"] = "high"
    required: bool = True

    @abstractmethod
    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        """Executes validation logic against an invoice."""
        raise NotImplementedError
