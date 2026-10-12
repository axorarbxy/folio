"""Validation checks and verdict contracts."""

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel
from pydantic import Field as PydanticField

from folio_ml.utils.money import StrictMoney


class CheckResult(BaseModel):
    """Result of an individual deterministic or AI validation check."""
    check_id: str
    name: str
    status: Literal["pass", "fail", "inconclusive", "skipped"]
    severity: Literal["critical", "high", "medium", "low"]
    kind: Literal["deterministic", "ai"] = "deterministic"
    expected: Any = None
    found: Any = None
    formula: str = ""
    why_it_matters: str = ""
    fixes: list[str] = PydanticField(
        default_factory=list,
        description="Structured action codes, e.g. REQUEST_CREDIT_NOTE, VERIFY_GSTIN_ON_PORTAL",
    )
    rule_table_version: str = "v1"


class Verdict(BaseModel):
    """High-level decision and financial exposure summary."""
    status: Literal["safe", "fix_first", "itc_blocked", "needs_review"]
    reasons: list[str] = PydanticField(default_factory=list)
    rupee_at_risk: StrictMoney = PydanticField(default=Decimal("0.00"))
    checks: list[CheckResult] = PydanticField(default_factory=list)
