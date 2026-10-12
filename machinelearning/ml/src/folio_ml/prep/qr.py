"""e-Invoice B2B QR code detection, decoding, and payload extraction."""

import base64
import json
import re
from decimal import Decimal
from typing import Any, Protocol

from PIL import Image

from folio_ml.prep.contracts import QrInvoicePayload


def parse_einvoice_qr_text(raw_text: str) -> QrInvoicePayload:
    """Parses raw text decoded from an Indian GST e-invoice QR code.

    Supports:
    1. Signed JWT tokens issued by CBIC / NIC e-invoice portals (RS256 signed payload).
    2. Direct JSON payloads (standard in synthetic test fixtures).
    3. Delimited key-value strings (older or mock representations).
    """
    clean_text = raw_text.strip()
    parsed_dict: dict[str, Any] = {}

    # Case 1: Signed JWT token (header.payload.signature)
    if clean_text.count(".") == 2:
        parts = clean_text.split(".")
        payload_b64 = parts[1]
        # Restore base64url padding
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += "=" * padding
        try:
            decoded_bytes = base64.urlsafe_b64decode(payload_b64)
            parsed_dict = json.loads(decoded_bytes.decode("utf-8"))
        except Exception:
            parsed_dict = {}

    # Case 2: Plain JSON string
    if not parsed_dict and clean_text.startswith("{") and clean_text.endswith("}"):
        try:
            parsed_dict = json.loads(clean_text)
        except Exception:
            parsed_dict = {}

    # Case 3: Key-value delimited string (e.g. IRN:xxx|GSTIN:yyy)
    if not parsed_dict and "|" in clean_text:
        for pair in clean_text.split("|"):
            if ":" in pair:
                k, v = pair.split(":", 1)
                parsed_dict[k.strip()] = v.strip()

    # Extract standardized fields
    irn = parsed_dict.get("Irn") or parsed_dict.get("irn") or parsed_dict.get("IRN")
    supp_gstin = (
        parsed_dict.get("SellerGstin")
        or parsed_dict.get("supplier_gstin")
        or parsed_dict.get("GSTIN")
    )
    buyer_gstin = (
        parsed_dict.get("BuyerGstin")
        or parsed_dict.get("buyer_gstin")
    )
    doc_num = (
        parsed_dict.get("DocNo")
        or parsed_dict.get("doc_no")
        or parsed_dict.get("invoice_number")
        or parsed_dict.get("number")
    )
    doc_dt = (
        parsed_dict.get("DocDt")
        or parsed_dict.get("doc_dt")
        or parsed_dict.get("date")
    )
    raw_tot = (
        parsed_dict.get("TotInvVal")
        or parsed_dict.get("total_amount")
        or parsed_dict.get("total")
    )

    total_amount: Decimal | None = None
    if raw_tot is not None:
        try:
            # Clean possible currency signs or commas
            clean_tot = re.sub(r"[^\d.]", "", str(raw_tot))
            if clean_tot:
                total_amount = Decimal(clean_tot).quantize(Decimal("0.01"))
        except Exception:
            total_amount = None

    return QrInvoicePayload(
        raw_text=raw_text,
        irn=str(irn).strip() if irn else None,
        supplier_gstin=str(supp_gstin).strip().upper() if supp_gstin else None,
        buyer_gstin=str(buyer_gstin).strip().upper() if buyer_gstin else None,
        invoice_number=str(doc_num).strip() if doc_num else None,
        invoice_date=str(doc_dt).strip() if doc_dt else None,
        total_amount=total_amount,
        signature_verified=False,  # HARD RULE: # TODO: NIC RSA public key verification
        parsed_fields=parsed_dict,
    )


class QrDecoder(Protocol):
    """Protocol for scanning and decoding QR codes from invoice images."""

    def decode(self, image: Image.Image) -> QrInvoicePayload | None:
        """Attempts to detect and decode a QR code from the provided image."""
        ...


class FakeQrDecoder:
    """Deterministic offline fake QR decoder for unit tests and synthetic datasets."""

    def __init__(self, canned_payload: QrInvoicePayload | None = None) -> None:
        self.canned_payload: QrInvoicePayload | None = canned_payload
        self.lookup_table: dict[str, QrInvoicePayload] = {}

    def register_fixture(self, key: str, payload: QrInvoicePayload) -> None:
        self.lookup_table[key] = payload

    def decode(self, image: Image.Image) -> QrInvoicePayload | None:
        if self.canned_payload:
            return self.canned_payload

        # Check if canned payload is registered for this image dimension or hash
        key = f"{image.width}x{image.height}"
        return self.lookup_table.get(key)
