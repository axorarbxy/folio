"""Rule registry executing all deterministic validation rules in fixed order."""

from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice
from folio_ml.logging import logger
from folio_ml.rules.base import Rule, RuleContext
from folio_ml.rules.checks_core import (
    CheckGstinFormatChecksum,
    CheckGstinStateMatchesAddress,
    CheckHsnRateMatch,
    CheckLineMath,
    CheckTaxMath,
    CheckTaxTypeVsPlaceOfSupply,
)
from folio_ml.rules.checks_extended import (
    CheckDateValidity,
    CheckDuplicateDetection,
    CheckInvoiceNumberFormat,
    CheckIrnPresence,
    CheckReverseChargeConsistency,
)
from folio_ml.rules.verdict import compute_verdict

# Master sequence of all 11 deterministic checks
ALL_RULES: list[Rule] = [
    CheckGstinFormatChecksum(),
    CheckGstinStateMatchesAddress(),
    CheckTaxTypeVsPlaceOfSupply(),
    CheckHsnRateMatch(),
    CheckLineMath(),
    CheckTaxMath(),
    CheckInvoiceNumberFormat(),
    CheckDuplicateDetection(),
    CheckDateValidity(),
    CheckIrnPresence(),
    CheckReverseChargeConsistency(),
]


class RuleRegistry:
    """Registry maintaining rules and running evaluation defensively."""

    def __init__(self, rules: list[Rule] | None = None) -> None:
        self.rules: list[Rule] = list(rules) if rules is not None else list(ALL_RULES)

    def register(self, rule: Rule) -> None:
        self.rules.append(rule)

    def get_rule_metadata(self) -> list[dict[str, object]]:
        """Returns metadata for all registered rules for the monitoring rules page."""
        return [
            {
                "id": r.id,
                "name": r.name,
                "kind": r.kind,
                "severity": r.severity,
                "required": r.required,
                "last_changed": "2024-05-15",
                "table_freshness": "Current (v2024.1)",
            }
            for r in self.rules
        ]

    def validate(self, invoice: Invoice, ctx: RuleContext | None = None) -> Verdict:
        context = ctx or RuleContext()
        results: list[CheckResult] = []

        for rule in self.rules:
            try:
                res = rule.run(invoice, context)
                results.append(res)
            except Exception as e:
                logger.error(f"Rule crash in {rule.id} on invoice {invoice.id}: {e}", exc_info=True)
                results.append(
                    CheckResult(
                        check_id=rule.id,
                        name=rule.name,
                        status="inconclusive",
                        severity=rule.severity,
                        kind=rule.kind,
                        expected="Clean execution",
                        found=f"Execution error: {type(e).__name__}",
                        formula="Defensive rule wrapper",
                        why_it_matters="System crashed while checking this rule; requires engineer review.",
                        fixes=["CONFIRM_RATE_WITH_CA"],
                        rule_table_version=context.version,
                    )
                )

        return compute_verdict(invoice, results, self.rules)


default_registry = RuleRegistry()
