"""Date and time utility module.

Dates are ISO 8601 (YYYY-MM-DD). Times are IST-aware (UTC+05:30).
"""

import re
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), name="IST")

ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def now_ist() -> datetime:
    """Returns current time in Indian Standard Time (IST)."""
    return datetime.now(IST)


def parse_iso_date(date_str: str) -> date:
    """Parses an ISO 8601 YYYY-MM-DD date string."""
    if not isinstance(date_str, str) or not ISO_DATE_REGEX.match(date_str.strip()):
        raise ValueError(f"Date '{date_str}' is not in valid ISO 8601 format (YYYY-MM-DD)")
    return date.fromisoformat(date_str.strip())


def format_iso_date(d: date) -> str:
    """Formats date as ISO 8601 string."""
    return d.isoformat()


def is_future_date(d: date | str, reference: date | None = None) -> bool:
    """Checks whether the date is strictly in the future compared to reference date or today (IST)."""
    if isinstance(d, str):
        d = parse_iso_date(d)
    if reference is None:
        reference = now_ist().date()
    return d > reference


def get_financial_year(d: date | str) -> str:
    """Returns the Indian financial year string (e.g., '2024-25') for a given date."""
    if isinstance(d, str):
        d = parse_iso_date(d)
    year = d.year
    if d.month >= 4:
        next_yr_short = str(year + 1)[-2:]
        return f"{year}-{next_yr_short}"
    else:
        prev_yr = year - 1
        curr_yr_short = str(year)[-2:]
        return f"{prev_yr}-{curr_yr_short}"
