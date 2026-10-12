"""Field normalization utilities for Indian GST invoice values.

Handles:
- Indian numbering system groupings (e.g. 1,23,456.50).
- Currency symbol stripping (₹, Rs, INR).
- Devanagari numerals (०-९ to 0-9).
- Multi-format date parsing to ISO 8601 (YYYY-MM-DD).
- Strict GSTIN and HSN cleanup.
"""

import re
from datetime import datetime
from decimal import Decimal

# Devanagari numeral translation table
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

CURRENCY_SYMBOLS_PATTERN = re.compile(r"[₹$€£\s]|(?:INR|Rs\.?|Rupees?)\s*", re.IGNORECASE)


def normalize_string(val: str | None) -> str:
    """Trims whitespace and collapses multiple spaces."""
    if not val:
        return ""
    # Translate Devanagari digits to ASCII if present
    translated = val.translate(DEVANAGARI_DIGITS)
    return " ".join(translated.strip().split())


def normalize_gstin(val: str | None) -> str | None:
    """Standardizes GSTIN to uppercase with whitespace and punctuation stripped."""
    if not val:
        return None
    clean = re.sub(r"[^A-Za-z0-9]", "", val).upper()
    return clean if clean else None


def normalize_amount(val: str | Decimal | int | None) -> Decimal | None:
    """Normalizes raw invoice monetary string to exact Decimal with 2 decimal places.

    HARD RULE: Floats are strictly prohibited to prevent binary floating-point inaccuracies.
    """
    if val is None:
        return None

    if isinstance(val, float):
        raise TypeError(
            f"Money normalization strictly forbids float ({val}). "
            "Pass string, int, or Decimal to prevent rounding drift."
        )

    if isinstance(val, (Decimal, int)):
        return Decimal(str(val)).quantize(Decimal("0.01"))

    clean_str = str(val).translate(DEVANAGARI_DIGITS).strip()
    # Remove currency prefixes/suffixes
    clean_str = CURRENCY_SYMBOLS_PATTERN.sub("", clean_str).strip()

    # Handle Indian commas: in Indian numbering 1,23,456.50 commas are thousands/lakhs separators
    clean_str = clean_str.replace(",", "")

    # Extract valid decimal pattern
    match = re.search(r"[-+]?\d+(?:\.\d+)?", clean_str)
    if not match:
        return None

    try:
        dec = Decimal(match.group(0))
        return dec.quantize(Decimal("0.01"))
    except Exception:
        return None


def normalize_date(val: str | None) -> str | None:
    """Parses various date formats to standardized ISO 8601 YYYY-MM-DD."""
    if not val:
        return None

    clean = str(val).translate(DEVANAGARI_DIGITS).strip()

    # Common Indian & International date formats
    candidate_formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d %b %Y",
        "%d %B %Y",
        "%Y/%m/%d",
    ]

    for fmt in candidate_formats:
        try:
            parsed = datetime.strptime(clean, fmt)
            # Enforce 4-digit year expansion
            if parsed.year < 100:
                parsed = parsed.replace(year=parsed.year + 2000)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def normalize_hsn(val: str | None) -> str | None:
    """Extracts clean digits from HSN / SAC codes."""
    if not val:
        return None
    clean = re.sub(r"[^\d]", "", str(val).translate(DEVANAGARI_DIGITS))
    return clean if clean else None
