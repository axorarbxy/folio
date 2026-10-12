"""Mandatory Number Guard verifying that AI-polished texts contain no hallucinated or altered figures."""

import logging
import re
from decimal import Decimal
from typing import Any

from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice

logger = logging.getLogger("folio_ml.explain.number_guard")

# Regexes for entity extraction
GSTIN_REGEX = re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b")
DATE_REGEX = re.compile(r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")
NUMBER_REGEX = re.compile(r"(?:₹|Rs\.?|INR\s*)?(\b\d+(?:,\d+)*(?:\.\d+)?\b)")

# Permitted statutory section numbers (GST law provisions cited in templates)
STATUTORY_ALLOWED_NUMBERS = {
    Decimal("16"),
    Decimal("2"),
    Decimal("17"),
    Decimal("5"),
    Decimal("36"),
    Decimal("4"),
    Decimal("50"),
    Decimal("1"),
    Decimal("73"),
    Decimal("74"),
    Decimal("18"),
}


def _extract_numbers_from_string(text: str) -> set[Decimal]:
    """Finds all numeric values in a string and converts them to Decimal."""
    found: set[Decimal] = set()
    for match in NUMBER_REGEX.finditer(text):
        val_str = match.group(1).replace(",", "").strip()
        if not val_str:
            continue
        try:
            d = Decimal(val_str).quantize(Decimal("0.01")) if "." in val_str else Decimal(val_str)
            found.add(d)
        except Exception:
            continue
    return found


class NumberGuard:
    """Verifies that no extra, altered, or hallucinated numbers appear in candidate text."""

    def __init__(self) -> None:
        self.rejection_log: list[dict[str, Any]] = []

    def extract_allowed_entities(
        self,
        invoice: Invoice | None,
        verdict: Verdict | None,
        checks: list[CheckResult] | None,
        extra_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Extracts all legal numbers, amounts, dates, GSTINs, and identifiers from structured input."""
        allowed_numbers: set[Decimal] = set(STATUTORY_ALLOWED_NUMBERS)
        allowed_dates: set[str] = set()
        allowed_gstins: set[str] = set()
        allowed_invoice_tokens: set[str] = set()

        # From Invoice
        if invoice:
            if invoice.number and invoice.number.value:
                inv_raw = str(invoice.number.value).strip()
                allowed_invoice_tokens.add(inv_raw)
                allowed_invoice_tokens.add(inv_raw.upper())
                # Add numeric sub-tokens from invoice number
                for num in re.findall(r"\d+", inv_raw):
                    try:
                        allowed_numbers.add(Decimal(num))
                    except Exception:
                        pass

            if invoice.supplier_gstin and invoice.supplier_gstin.value:
                allowed_gstins.add(invoice.supplier_gstin.value.strip().upper())
            if invoice.buyer_gstin and invoice.buyer_gstin.value:
                allowed_gstins.add(invoice.buyer_gstin.value.strip().upper())

            if invoice.date and invoice.date.value:
                dt_str = str(invoice.date.value).strip()
                allowed_dates.add(dt_str)
                for num in re.findall(r"\d+", dt_str):
                    try:
                        allowed_numbers.add(Decimal(num))
                    except Exception:
                        pass

            if invoice.totals:
                for field_val in [
                    invoice.totals.total_amount,
                    invoice.totals.taxable_amount,
                    invoice.totals.cgst_amount,
                    invoice.totals.sgst_amount,
                    invoice.totals.igst_amount,
                    invoice.totals.cess_amount,
                ]:
                    if field_val and field_val.value is not None:
                        d = Decimal(str(field_val.value))
                        allowed_numbers.add(d)
                        allowed_numbers.add(d.quantize(Decimal("0.01")))
                        if d == d.to_integral_value():
                            allowed_numbers.add(Decimal(int(d)))

            for item in invoice.items or []:
                for field_val in [item.rate, item.taxable, item.cgst_pct, item.sgst_pct, item.igst_pct, item.cess_pct, item.qty]:
                    if field_val and field_val.value is not None:
                        d = Decimal(str(field_val.value))
                        allowed_numbers.add(d)
                        allowed_numbers.add(d.quantize(Decimal("0.01")))
                        if d == d.to_integral_value():
                            allowed_numbers.add(Decimal(int(d)))
                if item.hsn and item.hsn.value:
                    hsn_str = str(item.hsn.value).strip()
                    allowed_invoice_tokens.add(hsn_str)
                    for num in re.findall(r"\d+", hsn_str):
                        try:
                            allowed_numbers.add(Decimal(num))
                        except Exception:
                            pass

        # From Verdict
        if verdict:
            if verdict.rupee_at_risk is not None:
                d = Decimal(str(verdict.rupee_at_risk))
                allowed_numbers.add(d)
                allowed_numbers.add(d.quantize(Decimal("0.01")))
                if d == d.to_integral_value():
                    allowed_numbers.add(Decimal(int(d)))

        # From Check results
        if checks:
            for c in checks:
                if c.found:
                    allowed_numbers.update(_extract_numbers_from_string(str(c.found)))
                if c.expected:
                    allowed_numbers.update(_extract_numbers_from_string(str(c.expected)))

        # From extra context
        if extra_context:
            for v in extra_context.values():
                if isinstance(v, (int, float, Decimal)):
                    d = Decimal(str(v))
                    allowed_numbers.add(d)
                    allowed_numbers.add(d.quantize(Decimal("0.01")))
                elif isinstance(v, str):
                    allowed_numbers.update(_extract_numbers_from_string(v))
                    for gstin in GSTIN_REGEX.findall(v):
                        allowed_gstins.add(gstin.upper())

        return {
            "allowed_numbers": allowed_numbers,
            "allowed_dates": allowed_dates,
            "allowed_gstins": allowed_gstins,
            "allowed_tokens": allowed_invoice_tokens,
        }

    def verify_text(
        self,
        candidate_text: str,
        allowed_entities: dict[str, Any],
    ) -> tuple[bool, list[str]]:
        """Validates candidate text against permitted structured entities.

        Returns:
            (is_valid, list_of_violations)
        """
        violations: list[str] = []
        allowed_numbers: set[Decimal] = allowed_entities.get("allowed_numbers", set())
        allowed_gstins: set[str] = allowed_entities.get("allowed_gstins", set())

        # 1. Check GSTINs in text
        for found_gstin in GSTIN_REGEX.findall(candidate_text):
            if found_gstin.upper() not in allowed_gstins:
                violations.append(f"Unauthorized GSTIN: {found_gstin}")

        # 2. Check Numbers in text
        text_numbers = _extract_numbers_from_string(candidate_text)
        for num in text_numbers:
            # Check exact match or integral match
            matched = False
            for allowed in allowed_numbers:
                if num == allowed or (num == allowed.quantize(Decimal("0.01"))) or (allowed == num.quantize(Decimal("0.01"))):
                    matched = True
                    break
                # If both are integral
                if num == num.to_integral_value() and allowed == allowed.to_integral_value() and int(num) == int(allowed):
                    matched = True
                    break
            if not matched:
                violations.append(f"Unauthorized or altered numeric value: {num}")

        is_valid = len(violations) == 0
        if not is_valid:
            log_entry = {
                "violations": violations,
                "text_snippet": candidate_text[:120],
            }
            self.rejection_log.append(log_entry)
            logger.warning(
                "NumberGuard triggered: Rejected candidate text with %d violations: %s",
                len(violations),
                "; ".join(violations[:3]),
            )

        return is_valid, violations
