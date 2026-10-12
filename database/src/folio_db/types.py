"""Domain types, financial precision definitions, and custom column types."""

from decimal import Decimal
import re
from typing import Annotated
from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import mapped_column

# Financial Numeric standard: NUMERIC(18, 2) - strictly never float
MoneyNumeric = Numeric(precision=18, scale=2, asdecimal=True)
Money = Annotated[Decimal, mapped_column(MoneyNumeric)]

# Tax Rate standard: NUMERIC(5, 2) e.g. 18.00, 28.00, 0.25
TaxRateNumeric = Numeric(precision=5, scale=2, asdecimal=True)
TaxRate = Annotated[Decimal, mapped_column(TaxRateNumeric)]

# Quantity standard: NUMERIC(14, 4)
QuantityNumeric = Numeric(precision=14, scale=4, asdecimal=True)
Quantity = Annotated[Decimal, mapped_column(QuantityNumeric)]

# Custom domain string regexes
GSTIN_REGEX = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
PAN_REGEX = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
HSN_REGEX = r"^[0-9]{2,8}$"
STATE_CODE_REGEX = r"^[0-9]{2}$"

gstin_pattern = re.compile(GSTIN_REGEX)
pan_pattern = re.compile(PAN_REGEX)
hsn_pattern = re.compile(HSN_REGEX)
state_code_pattern = re.compile(STATE_CODE_REGEX)


def validate_gstin(value: str | None) -> bool:
    """Validate GSTIN format."""
    if not value:
        return False
    return bool(gstin_pattern.match(value.strip()))


def validate_pan(value: str | None) -> bool:
    """Validate PAN format."""
    if not value:
        return False
    return bool(pan_pattern.match(value.strip()))


def validate_hsn(value: str | None) -> bool:
    """Validate HSN / SAC format."""
    if not value:
        return False
    return bool(hsn_pattern.match(value.strip()))


def validate_state_code(value: str | None) -> bool:
    """Validate 2-digit Indian state code."""
    if not value:
        return False
    return bool(state_code_pattern.match(value.strip()))
