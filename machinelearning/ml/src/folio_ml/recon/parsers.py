"""Parsers for GSTR-2B JSON files and Purchase Register CSV/JSON data with column mapping."""

import csv
import io
import json
from decimal import Decimal
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

from folio_ml.recon.contracts import (
    Gstr2bDocument,
    Gstr2bRecord,
    PurchaseRegister,
    PurchaseRegisterRecord,
)
from folio_ml.utils.money import validate_strict_decimal


def _to_decimal(val: Any) -> Decimal:
    """Safely converts string, int, float, or Decimal to Decimal."""
    if val is None or val == "":
        return Decimal("0.00")
    if isinstance(val, (int, str)):
        return validate_strict_decimal(str(val).replace(",", "").strip())
    if isinstance(val, float):
        # Format cleanly to 2 decimal places to avoid float representation artifacts
        return Decimal(f"{val:.2f}")
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))


@runtime_checkable
class Gstr2bParser(Protocol):
    """Protocol for parsing GSTR-2B statement files."""

    def parse(self, content: str | bytes | dict[str, Any]) -> Gstr2bDocument:
        """Parse raw content into Gstr2bDocument."""
        ...


class SyntheticGstr2bParser:
    """Parser for the standard synthetic GSTR-2B JSON layout generated in Item 3."""

    def parse(self, content: str | bytes | dict[str, Any]) -> Gstr2bDocument:
        if isinstance(content, (str, bytes)):
            data = json.loads(content)
        else:
            data = content

        period = str(data.get("period", ""))
        raw_records = data.get("records", [])
        parsed_records: list[Gstr2bRecord] = []

        for item in raw_records:
            taxable = _to_decimal(item.get("taxable_value", 0))
            cgst = _to_decimal(item.get("cgst", 0))
            sgst = _to_decimal(item.get("sgst", 0))
            igst = _to_decimal(item.get("igst", 0))
            cess = _to_decimal(item.get("cess", 0))
            total = _to_decimal(item.get("total")) if item.get("total") is not None else None

            rec = Gstr2bRecord(
                supplier_gstin=str(item.get("supplier_gstin", "")).strip(),
                supplier_name=str(item.get("supplier_name", "")).strip(),
                invoice_number=str(item.get("invoice_number", "")).strip(),
                invoice_date=str(item.get("invoice_date", "")).strip(),
                taxable_value=taxable,
                cgst=cgst,
                sgst=sgst,
                igst=igst,
                cess=cess,
                total=total,
                itc_available=str(item.get("itc_available", "Y")).strip(),
                itc_reason=str(item.get("itc_reason", "")).strip(),
                period=str(item.get("period", period)).strip(),
                raw=item,
            )
            parsed_records.append(rec)

        return Gstr2bDocument(period=period, records=parsed_records, raw_metadata=data)


class PortalGstr2bParser:
    """Parser for standard government portal JSON exports (b2b section hierarchy)."""

    def parse(self, content: str | bytes | dict[str, Any]) -> Gstr2bDocument:
        if isinstance(content, (str, bytes)):
            data = json.loads(content)
        else:
            data = content

        root = data.get("data", data)
        period = str(root.get("fp", root.get("period", "")))
        b2b_list = root.get("b2b", root.get("b2b_invoices", []))

        parsed_records: list[Gstr2bRecord] = []

        for supplier_entry in b2b_list:
            ctin = str(supplier_entry.get("ctin", supplier_entry.get("supplier_gstin", ""))).strip()
            cname = str(supplier_entry.get("cname", supplier_entry.get("supplier_name", ""))).strip()

            inv_list = supplier_entry.get("inv", supplier_entry.get("invoices", []))
            for inv in inv_list:
                inum = str(inv.get("inum", inv.get("invoice_number", ""))).strip()
                idt = str(inv.get("idt", inv.get("invoice_date", ""))).strip()
                val = _to_decimal(inv.get("val", inv.get("total", 0)))
                itc_avail = str(inv.get("itcavl", inv.get("itc_available", "Y"))).strip()
                itc_rsn = str(inv.get("rsn", inv.get("itc_reason", ""))).strip()

                items = inv.get("items", inv.get("itms", []))
                txval = Decimal("0.00")
                iamt = Decimal("0.00")
                camt = Decimal("0.00")
                samt = Decimal("0.00")
                csamt = Decimal("0.00")

                for itm in items:
                    itm_det = itm.get("itm_det", itm)
                    txval += _to_decimal(itm_det.get("txval", 0))
                    iamt += _to_decimal(itm_det.get("iamt", 0))
                    camt += _to_decimal(itm_det.get("camt", 0))
                    samt += _to_decimal(itm_det.get("samt", 0))
                    csamt += _to_decimal(itm_det.get("csamt", 0))

                rec = Gstr2bRecord(
                    supplier_gstin=ctin,
                    supplier_name=cname,
                    invoice_number=inum,
                    invoice_date=idt,
                    taxable_value=txval,
                    cgst=camt,
                    sgst=samt,
                    igst=iamt,
                    cess=csamt,
                    total=val,
                    itc_available=itc_avail,
                    itc_reason=itc_rsn,
                    period=period,
                    raw=inv,
                )
                parsed_records.append(rec)

        return Gstr2bDocument(period=period, records=parsed_records, raw_metadata=data)


GovernmentPortalGstr2bParser = PortalGstr2bParser


class UniversalGstr2bParser:
    """Auto-detecting dispatcher across GSTR-2B layout variants."""

    def __init__(self) -> None:
        self.synthetic = SyntheticGstr2bParser()
        self.portal = PortalGstr2bParser()

    def parse(self, content: str | bytes | dict[str, Any] | Path) -> Gstr2bDocument:
        if isinstance(content, Path):
            with open(content, encoding="utf-8") as f:
                data = json.load(f)
        elif isinstance(content, (str, bytes)):
            data = json.loads(content)
        else:
            data = content

        if "records" in data:
            return self.synthetic.parse(data)
        return self.portal.parse(data)


DEFAULT_PURCHASE_REGISTER_COLUMN_MAP: dict[str, list[str]] = {
    "supplier_gstin": ["supplier_gstin", "gstin", "vendor_gstin", "supplier gstin"],
    "supplier_name": ["supplier_name", "vendor_name", "party_name", "supplier name", "vendor"],
    "invoice_number": ["invoice_number", "inv_no", "invoice_no", "bill_no", "invoice number"],
    "invoice_date": ["invoice_date", "inv_date", "date", "bill_date", "invoice date"],
    "taxable_value": ["taxable_value", "taxable_amount", "taxable", "taxable value"],
    "cgst": ["cgst", "cgst_amount", "cgst amount"],
    "sgst": ["sgst", "sgst_amount", "sgst amount"],
    "igst": ["igst", "igst_amount", "igst amount"],
    "cess": ["cess", "cess_amount", "cess amount"],
    "total": ["total", "total_amount", "invoice_amount", "grand_total", "total amount"],
}


class PurchaseRegisterParser:
    """Parser for Purchase Register CSV / tabular data with configurable column mapping."""

    def __init__(
        self,
        column_mapping: dict[str, str | list[str]] | None = None,
    ) -> None:
        self.column_mapping = column_mapping or DEFAULT_PURCHASE_REGISTER_COLUMN_MAP

    def _resolve_column(self, headers: list[str], target_field: str) -> str | None:
        aliases = self.column_mapping.get(target_field, [target_field])
        if isinstance(aliases, str):
            aliases = [aliases]
        cleaned_headers = {h.strip().lower().replace("_", "").replace(" ", ""): h for h in headers}

        for alias in aliases:
            norm_alias = alias.strip().lower().replace("_", "").replace(" ", "")
            if norm_alias in cleaned_headers:
                return cleaned_headers[norm_alias]
        return None

    def parse_csv(
        self,
        content: str | bytes | Path,
        period: str = "",
    ) -> PurchaseRegister:
        """Parses CSV content into PurchaseRegister."""
        if isinstance(content, Path):
            with open(content, encoding="utf-8-sig") as f:
                text = f.read()
        elif isinstance(content, bytes):
            text = content.decode("utf-8-sig")
        else:
            text = content

        reader = csv.DictReader(io.StringIO(text))
        headers = reader.fieldnames or []

        col_gstin = self._resolve_column(headers, "supplier_gstin") or "supplier_gstin"
        col_name = self._resolve_column(headers, "supplier_name") or "supplier_name"
        col_inv = self._resolve_column(headers, "invoice_number") or "invoice_number"
        col_date = self._resolve_column(headers, "invoice_date") or "invoice_date"
        col_taxable = self._resolve_column(headers, "taxable_value") or "taxable_value"
        col_cgst = self._resolve_column(headers, "cgst") or "cgst"
        col_sgst = self._resolve_column(headers, "sgst") or "sgst"
        col_igst = self._resolve_column(headers, "igst") or "igst"
        col_cess = self._resolve_column(headers, "cess") or "cess"
        col_total = self._resolve_column(headers, "total") or "total"

        records: list[PurchaseRegisterRecord] = []

        for row in reader:
            if not row or not any(row.values()):
                continue

            taxable = _to_decimal(row.get(col_taxable, 0))
            cgst = _to_decimal(row.get(col_cgst, 0))
            sgst = _to_decimal(row.get(col_sgst, 0))
            igst = _to_decimal(row.get(col_igst, 0))
            cess = _to_decimal(row.get(col_cess, 0))
            raw_total = row.get(col_total)
            total = _to_decimal(raw_total) if raw_total is not None and raw_total != "" else None

            rec = PurchaseRegisterRecord(
                supplier_gstin=str(row.get(col_gstin, "")).strip(),
                supplier_name=str(row.get(col_name, "")).strip(),
                invoice_number=str(row.get(col_inv, "")).strip(),
                invoice_date=str(row.get(col_date, "")).strip(),
                taxable_value=taxable,
                cgst=cgst,
                sgst=sgst,
                igst=igst,
                cess=cess,
                total=total,
                period=period,
                raw=dict(row),
            )
            records.append(rec)

        return PurchaseRegister(period=period, records=records)
