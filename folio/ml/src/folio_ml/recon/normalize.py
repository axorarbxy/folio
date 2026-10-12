"""Canonical normalization for reconciliation matching (invoice numbers, GSTIN, dates, amounts)."""

import re

from folio_ml.reader.normalize import normalize_date as _reader_norm_date
from folio_ml.recon.contracts import (
    Gstr2bRecord,
    NormalizedRecord,
    PurchaseRegisterRecord,
)

# Financial Year patterns (e.g., "FY24-25/", "2023-24/", "23-24/", "FY2024/")
FY_PREFIX_REGEX = re.compile(
    r"^(?:FY[\s\-_]?)?(?:20\d{2}|\d{2})[\s\-_/](?:20\d{2}|\d{2})[\s\-_/]+",
    re.IGNORECASE,
)

# Punctuation and separators to remove
SEPARATORS_REGEX = re.compile(r"[\s/\-_\\#\.]+")


def normalize_invoice_number(inv_no: str) -> str:
    """Normalizes an invoice number for fuzzy/exact matching.

    - Strips leading/trailing whitespace.
    - Strips financial-year prefixes (e.g. 'FY23-24/', '2024-25/').
    - Removes punctuation separators ('/', '-', '_', '#', spaces).
    - Uppercases all alphanumeric characters.
    - Strips leading zeros (e.g. '00104' -> '104'), retaining '0' if all zero.
    """
    if not inv_no:
        return ""

    cleaned = inv_no.strip()

    # 1. Strip financial year prefix if present
    cleaned = FY_PREFIX_REGEX.sub("", cleaned)

    # 2. Uppercase
    cleaned = cleaned.upper()

    # 3. Strip leading zeros from numeric components (at start or following letter/separator)
    cleaned = re.sub(r"(?:^|(?<=[A-Z\-_/]))0+(\d+)", r"\1", cleaned)

    # 4. Strip separator punctuation
    cleaned = SEPARATORS_REGEX.sub("", cleaned)

    if not cleaned:
        return "0"

    return cleaned


def normalize_gstin(gstin: str) -> str:
    """Canonical uppercase GSTIN without whitespace."""
    if not gstin:
        return ""
    return re.sub(r"\s+", "", gstin).upper()


def normalize_date(date_str: str) -> str:
    """Normalizes date string to ISO 8601 YYYY-MM-DD."""
    if not date_str:
        return ""
    iso = _reader_norm_date(date_str)
    return iso or date_str.strip()


def normalize_gstr2b_record(rec: Gstr2bRecord, record_id: str) -> NormalizedRecord:
    """Produces a canonical NormalizedRecord from a Gstr2bRecord."""
    taxable = rec.taxable_value
    cgst = rec.cgst
    sgst = rec.sgst
    igst = rec.igst
    cess = rec.cess
    tax_total = cgst + sgst + igst + cess
    total = rec.total if rec.total is not None else (taxable + tax_total)

    itc_avail = str(rec.itc_available).strip().upper() == "Y"

    return NormalizedRecord(
        record_id=record_id,
        source="gstr2b",
        original_invoice_number=rec.invoice_number,
        normalized_invoice_number=normalize_invoice_number(rec.invoice_number),
        supplier_gstin=normalize_gstin(rec.supplier_gstin),
        supplier_name=rec.supplier_name.strip(),
        invoice_date=normalize_date(rec.invoice_date),
        taxable_value=taxable,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        cess=cess,
        total=total,
        tax_total=tax_total,
        itc_available=itc_avail,
        itc_reason=rec.itc_reason.strip(),
        period=rec.period.strip(),
    )


def normalize_purchase_register_record(
    rec: PurchaseRegisterRecord, record_id: str
) -> NormalizedRecord:
    """Produces a canonical NormalizedRecord from a PurchaseRegisterRecord."""
    taxable = rec.taxable_value
    cgst = rec.cgst
    sgst = rec.sgst
    igst = rec.igst
    cess = rec.cess
    tax_total = cgst + sgst + igst + cess
    total = rec.total if rec.total is not None else (taxable + tax_total)

    return NormalizedRecord(
        record_id=record_id,
        source="books",
        original_invoice_number=rec.invoice_number,
        normalized_invoice_number=normalize_invoice_number(rec.invoice_number),
        supplier_gstin=normalize_gstin(rec.supplier_gstin),
        supplier_name=rec.supplier_name.strip(),
        invoice_date=normalize_date(rec.invoice_date),
        taxable_value=taxable,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        cess=cess,
        total=total,
        tax_total=tax_total,
        itc_available=True,
        itc_reason="",
        period=rec.period.strip(),
    )
