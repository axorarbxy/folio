"""Deterministic GST compliance rules package."""

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
from folio_ml.rules.engine import RuleEngine
from folio_ml.rules.loader import (
    HsnRateEntry,
    RuleDataBundle,
    StateCodeEntry,
    load_rules_data,
    match_hsn_rate,
)
from folio_ml.rules.registry import ALL_RULES, RuleRegistry, default_registry
from folio_ml.rules.verdict import compute_verdict

__all__ = [
    "Rule",
    "RuleContext",
    "RuleDataBundle",
    "StateCodeEntry",
    "HsnRateEntry",
    "load_rules_data",
    "match_hsn_rate",
    "CheckGstinFormatChecksum",
    "CheckGstinStateMatchesAddress",
    "CheckTaxTypeVsPlaceOfSupply",
    "CheckHsnRateMatch",
    "CheckLineMath",
    "CheckTaxMath",
    "CheckInvoiceNumberFormat",
    "CheckDuplicateDetection",
    "CheckDateValidity",
    "CheckIrnPresence",
    "CheckReverseChargeConsistency",
    "compute_verdict",
    "ALL_RULES",
    "RuleRegistry",
    "RuleEngine",
    "default_registry",
]
