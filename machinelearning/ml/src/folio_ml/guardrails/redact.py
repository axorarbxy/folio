"""Optional PII redactor masking phones, emails, and bank accounts while preserving GSTINs."""

import re

from folio_ml.guardrails.contracts import RedactionResult
from folio_ml.utils.gstin import GSTIN_REGEX

EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_REGEX = re.compile(r"(?:\+91[\s\-]?)?(?:[6-9]\d{9})\b")
BANK_ACCOUNT_REGEX = re.compile(
    r"(?i)(?:A/C(?:\s*No\.?)?|Account(?:\s*No\.?)?|Acc(?:\s*No\.?)?|Bank\s*Account|IBAN)\s*[:\-]?\s*(\d{9,18})\b"
)


class PIIRedactor:
    """Masks personal and banking PII from text while strictly protecting statutory GSTINs."""

    def __init__(self, enabled_by_default: bool = True) -> None:
        self.enabled = enabled_by_default

    def redact(self, text: str, force_enabled: bool | None = None) -> RedactionResult:
        """Applies masking to phone numbers, emails, and bank accounts."""
        is_active = self.enabled if force_enabled is None else force_enabled
        if not is_active or not text:
            return RedactionResult(redacted_text=text, masks_count=0, masked_types=[])

        # Step 1: Temporarily protect GSTINs so no sub-token gets masked as phone/account
        gstin_map: dict[str, str] = {}

        def _protect_gstin(match: re.Match[str]) -> str:
            val = match.group(0)
            token = f"__GSTIN_PROTECTED_{len(gstin_map)}__"
            gstin_map[token] = val
            return token

        working_text = GSTIN_REGEX.sub(_protect_gstin, text)

        masks_count = 0
        masked_types: list[str] = []

        # Step 2: Redact Bank Accounts
        def _mask_account(match: re.Match[str]) -> str:
            nonlocal masks_count
            masks_count += 1
            if "bank_account" not in masked_types:
                masked_types.append("bank_account")
            full_match = match.group(0)
            acc_num = match.group(1)
            return full_match.replace(acc_num, "[REDACTED_ACCOUNT]")

        working_text = BANK_ACCOUNT_REGEX.sub(_mask_account, working_text)

        # Step 3: Redact Emails
        def _mask_email(match: re.Match[str]) -> str:
            nonlocal masks_count
            masks_count += 1
            if "email" not in masked_types:
                masked_types.append("email")
            return "[REDACTED_EMAIL]"

        working_text = EMAIL_REGEX.sub(_mask_email, working_text)

        # Step 4: Redact Phones
        def _mask_phone(match: re.Match[str]) -> str:
            nonlocal masks_count
            masks_count += 1
            if "phone" not in masked_types:
                masked_types.append("phone")
            return "[REDACTED_PHONE]"

        working_text = PHONE_REGEX.sub(_mask_phone, working_text)

        # Step 5: Restore GSTINs completely unaltered
        for token, original_gstin in gstin_map.items():
            working_text = working_text.replace(token, original_gstin)

        return RedactionResult(
            redacted_text=working_text,
            masks_count=masks_count,
            masked_types=masked_types,
        )
