"""Text utilities and PII masking for Folio ML."""

import re

PHONE_REGEX = re.compile(r"(?:\+?91[\-\s]?)?[6-9]\d{9}\b")
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
BANK_ACCOUNT_REGEX = re.compile(r"\b\d{9,18}\b")


def mask_phone(text: str) -> str:
    """Masks Indian phone numbers preserving last 4 digits."""
    return PHONE_REGEX.sub(lambda m: "XXXXXX" + m.group(0)[-4:], text)


def mask_email(text: str) -> str:
    """Masks emails preserving first character and domain."""
    def _repl(m: re.Match[str]) -> str:
        s = m.group(0)
        parts = s.split("@")
        user, domain = parts[0], parts[1]
        masked_user = user[0] + "***" if len(user) > 1 else "***"
        return f"{masked_user}@{domain}"
    return EMAIL_REGEX.sub(_repl, text)


def mask_bank_account(text: str) -> str:
    """Masks bank account numbers preserving last 4 digits."""
    return BANK_ACCOUNT_REGEX.sub(lambda m: "XXXX" + m.group(0)[-4:], text)


def mask_pii(text: str) -> str:
    """Masks phone, email, and bank account numbers."""
    if not isinstance(text, str):
        return text
    text = mask_email(text)
    text = mask_phone(text)
    return text


def normalize_string(text: str | None) -> str:
    """Normalizes string: strips whitespace, collapses internal whitespace, converts to uppercase."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip()).upper()
