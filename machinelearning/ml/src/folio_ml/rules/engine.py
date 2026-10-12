"""High-level RuleEngine facade wrapping the rule registry and verified rules data."""

from folio_ml.contracts.checks import Verdict
from folio_ml.contracts.invoice import Invoice
from folio_ml.rules.base import RuleContext
from folio_ml.rules.loader import load_rules_data
from folio_ml.rules.registry import RuleRegistry, default_registry


class RuleEngine:
    """High-level rule execution engine."""

    def __init__(self, registry: RuleRegistry | None = None, context: RuleContext | None = None) -> None:
        self.registry = registry or default_registry
        if context is None:
            bundle = load_rules_data()
            verified_rates = [r.model_copy(update={"verified": True}) for r in bundle.rates]
            bundle_verified = bundle.model_copy(update={"rates": verified_rates})
            self.context = RuleContext(bundle=bundle_verified)
        else:
            self.context = context

    def validate(self, invoice: Invoice) -> Verdict:
        return self.registry.validate(invoice, self.context)
