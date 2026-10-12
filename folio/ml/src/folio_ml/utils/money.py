"""Money utility module.

Principle: Money is Decimal, never float.
All float representations are strictly rejected to prevent IEEE 754 precision errors.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Any

from pydantic import BeforeValidator, PlainSerializer


def validate_strict_decimal(v: Any) -> Decimal | None:
    """Validates and enforces strict Decimal for monetary amounts.

    Rejects floats explicitly. Accepts Decimal, int, or string representations.
    """
    if v is None:
        return None
    if isinstance(v, float):
        raise ValueError("Float is not permitted for currency/money values. Use str or Decimal.")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, str)):
        try:
            return Decimal(str(v).strip())
        except Exception as e:
            raise ValueError(f"Invalid monetary decimal string: {v}") from e
    raise ValueError(f"Unsupported money type: {type(v)}. Use Decimal or str.")


def serialize_money(v: Decimal | None) -> str | None:
    if v is None:
        return None
    return str(v)


StrictMoney = Annotated[
    Decimal,
    BeforeValidator(validate_strict_decimal),
    PlainSerializer(serialize_money, return_type=str, when_used="json"),
]

StrictMoneyOpt = Annotated[
    Decimal | None,
    BeforeValidator(validate_strict_decimal),
    PlainSerializer(serialize_money, return_type=str | None, when_used="json"),
]


def quantize_money(amount: Decimal, places: int = 2) -> Decimal:
    """Quantizes money to fixed decimal places using ROUND_HALF_UP."""
    fmt = Decimal("10") ** -places
    return amount.quantize(fmt, rounding=ROUND_HALF_UP)
