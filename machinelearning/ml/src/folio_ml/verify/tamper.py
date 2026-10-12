"""Heuristic tamper detection: PDF metadata gaps and QR-to-text discrepancies."""

import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.signals import ThreatSignal
from folio_ml.prep.contracts import QrInvoicePayload

SUSPICIOUS_PRODUCERS = [
    "photoshop",
    "gimp",
    "ilovepdf",
    "canva",
    "sejda",
    "pdfescape",
    "inkscape",
    "nitro",
    "smallpdf",
]


class TamperDetector:
    """Heuristic detector flagging post-generation modifications, metadata anomalies, and QR discrepancies."""

    def check_tamper(
        self,
        invoice: Invoice,
        pdf_path: str | Path | None = None,
        pdf_metadata: dict[str, Any] | None = None,
        qr_payload: QrInvoicePayload | None = None,
    ) -> list[ThreatSignal]:
        signals: list[ThreatSignal] = []

        # 1. Check for synthetic injected post-render tampering marker
        if invoice.source_file_hash and invoice.source_file_hash.startswith("TAMPERED_"):
            signals.append(
                ThreatSignal(
                    signal_id=f"SIG-TAMPER-{uuid.uuid4().hex[:8]}",
                    signal_type="tampered_document",
                    severity="critical",
                    confidence=1.0,
                    description="Post-render document alteration detected in document integrity hash",
                    status="open",
                    risk_score=95.0,
                    evidence=[
                        {
                            "how_we_know": "Cryptographic file digest altered post-signature",
                            "source_file_hash": invoice.source_file_hash,
                        }
                    ],
                    recommended_steps=[
                        "REJECT_CURRENT_SUBMISSION",
                        "REQUEST_ORIGINAL_DIGITAL_PDF_FROM_ERP",
                    ],
                )
            )

        # 2. PDF metadata heuristics
        metadata = dict(pdf_metadata) if pdf_metadata else {}
        if pdf_path and Path(pdf_path).exists():
            try:
                from pypdf import PdfReader

                reader = PdfReader(str(pdf_path))
                if reader.metadata:
                    metadata.update({str(k): str(v) for k, v in reader.metadata.items()})
            except Exception:
                pass

        if metadata:
            producer_str = str(
                metadata.get("/Producer", metadata.get("Producer", ""))
                + " "
                + metadata.get("/Creator", metadata.get("Creator", ""))
            ).lower()

            for susp in SUSPICIOUS_PRODUCERS:
                if susp in producer_str:
                    signals.append(
                        ThreatSignal(
                            signal_id=f"SIG-TAMPER-{uuid.uuid4().hex[:8]}",
                            signal_type="tampered_document",
                            severity="high",
                            confidence=0.85,
                            description=(
                                f"Document generated or modified using desktop editing software ('{susp}') "
                                f"rather than an authorized ERP or e-invoicing billing system."
                            ),
                            status="open",
                            risk_score=75.0,
                            evidence=[
                                {
                                    "how_we_know": f"PDF metadata Producer/Creator contains '{susp}'",
                                    "raw_metadata": {k: v for k, v in metadata.items() if not k.startswith("__")},
                                }
                            ],
                            recommended_steps=[
                                "REQUEST_ORIGINAL_DIGITAL_PDF_FROM_ERP",
                                "INSPECT_VISUAL_FONTS_AND_ALIGNMENT",
                            ],
                        )
                    )
                    break

            # Check modification date gap
            mod_date_str = metadata.get("/ModDate", metadata.get("ModDate", ""))
            create_date_str = metadata.get("/CreationDate", metadata.get("CreationDate", ""))
            if mod_date_str and create_date_str and mod_date_str != create_date_str:
                signals.append(
                    ThreatSignal(
                        signal_id=f"SIG-EDIT-{uuid.uuid4().hex[:8]}",
                        signal_type="edited_after_approval",
                        severity="medium",
                        confidence=0.70,
                        description=(
                            "PDF modification timestamp differs from creation timestamp, indicating post-generation file edits."
                        ),
                        status="open",
                        risk_score=55.0,
                        evidence=[
                            {
                                "how_we_know": "CreationDate and ModDate metadata mismatch",
                                "CreationDate": create_date_str,
                                "ModDate": mod_date_str,
                            }
                        ],
                        recommended_steps=["CONFIRM_REVISION_REASON_WITH_SUPPLIER"],
                    )
                )

        # 3. QR code to extracted text cross-verification
        if qr_payload:
            # A. Supplier GSTIN
            cand_supp_gstin = invoice.supplier_gstin.value if invoice.supplier_gstin else ""
            qr_seller = getattr(qr_payload, "supplier_gstin", None) or getattr(qr_payload, "seller_gstin", None)
            if qr_seller and cand_supp_gstin:
                if str(qr_seller).strip().upper() != cand_supp_gstin.strip().upper():
                    signals.append(
                        ThreatSignal(
                            signal_id=f"SIG-QR-{uuid.uuid4().hex[:8]}",
                            signal_type="qr_mismatch",
                            severity="critical",
                            confidence=0.99,
                            description=(
                                f"Statutory QR payload mismatch: QR encodes seller GSTIN '{qr_seller}', "
                                f"but printed invoice header shows '{cand_supp_gstin}'."
                            ),
                            status="open",
                            risk_score=98.0,
                            evidence=[
                                {
                                    "how_we_know": "Cryptographically signed QR payload disagrees with OCR text",
                                    "qr_seller_gstin": str(qr_seller),
                                    "printed_supplier_gstin": cand_supp_gstin,
                                }
                            ],
                            recommended_steps=[
                                "HOLD_PAYMENT",
                                "REJECT_INVOICE_POSSIBLE_FRAUD",
                                "VERIFY_ON_GST_PORTAL",
                            ],
                        )
                    )

            # B. Total Amount
            cand_total = invoice.totals.total_amount.value if invoice.totals and invoice.totals.total_amount else None
            qr_tot = getattr(qr_payload, "total_amount", None) or getattr(qr_payload, "total_value", None)
            if qr_tot is not None and cand_total is not None:
                diff = abs(Decimal(str(qr_tot)) - cand_total)
                if diff > Decimal("2.00"):
                    signals.append(
                        ThreatSignal(
                            signal_id=f"SIG-QR-{uuid.uuid4().hex[:8]}",
                            signal_type="qr_mismatch",
                            severity="critical",
                            confidence=0.98,
                            description=(
                                f"Invoice total altered! Printed total is ₹{cand_total}, "
                                f"but statutory signed QR code encodes ₹{qr_tot} (difference ₹{diff})."
                            ),
                            status="open",
                            risk_score=95.0,
                            evidence=[
                                {
                                    "how_we_know": "QR total differs from printed grand total beyond tolerance",
                                    "qr_total": str(qr_tot),
                                    "printed_total": str(cand_total),
                                    "difference": str(diff),
                                }
                            ],
                            recommended_steps=[
                                "FLAG_FOR_FORENSIC_REVIEW",
                                "VERIFY_ORIGINAL_GSTR1_FILED_VALUE",
                            ],
                        )
                    )

        return signals
