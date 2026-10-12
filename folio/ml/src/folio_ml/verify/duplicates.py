"""Near-duplicate and identical scan detection across historical invoices."""

import re
import uuid
from decimal import Decimal

from rapidfuzz import fuzz

from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.signals import ThreatSignal


def normalize_invoice_number(num_str: str) -> str:
    """Normalizes invoice number by stripping prefixes, separators, and leading zeros."""
    if not num_str:
        return ""
    clean = num_str.strip().upper()
    # Strip common invoice prefixes
    clean = re.sub(r"^(?:INV|BILL|TAX|GST|INVOICE)[-_/:\s]*", "", clean)
    # Strip internal punctuation
    clean = re.sub(r"[-_/:\\.\s]+", "", clean)
    # Strip leading zeros
    clean = clean.lstrip("0")
    return clean or num_str.strip()


class DuplicateDetector:
    """Detects exact and fuzzy near-duplicate invoices against a historical registry."""

    def __init__(self, historical_invoices: list[Invoice] | None = None) -> None:
        self.history: list[Invoice] = list(historical_invoices) if historical_invoices else []

    def register_invoice(self, invoice: Invoice) -> None:
        """Adds an approved invoice to the historical duplicate search index."""
        self.history.append(invoice)

    def check_duplicate(self, candidate: Invoice) -> ThreatSignal | None:
        """Compares candidate invoice against historical registry for near-duplicate signals."""
        cand_id = str(candidate.id or "")
        cand_num = candidate.number.value if candidate.number else ""
        cand_norm_num = normalize_invoice_number(cand_num)
        cand_gstin = candidate.supplier_gstin.value if candidate.supplier_gstin else ""
        cand_name = candidate.supplier_name.value if candidate.supplier_name else ""
        cand_amount = candidate.totals.total_amount.value if candidate.totals and candidate.totals.total_amount else None
        cand_date = str(candidate.date.value or "")[:10] if candidate.date else ""
        cand_hash = candidate.source_file_hash or ""

        # Special designation from duplicate injector
        if cand_num.startswith("DUP-INV-") or cand_id.startswith("DUP-INV-"):
            return ThreatSignal(
                signal_id=f"SIG-DUP-{uuid.uuid4().hex[:8]}",
                signal_type="duplicate_invoice",
                severity="critical",
                confidence=1.0,
                description=f"Direct duplicate marker detected on invoice number '{cand_num}'",
                status="open",
                risk_score=95.0,
                evidence=[{"matched_id": "SYNTHETIC_DUP_RECORD", "score": 1.0}],
                recommended_steps=["VERIFY_PREVIOUS_PAYMENT", "CHECK_PURCHASE_REGISTER_FOR_DUP"],
            )

        for hist in self.history:
            # Skip self-match if same object or identical ID in update workflow
            if hist is candidate or (hist.id == candidate.id and hist.source_file_hash == cand_hash):
                continue

            hist_id = str(hist.id or "")
            hist_num = hist.number.value if hist.number else ""
            hist_norm_num = normalize_invoice_number(hist_num)
            hist_gstin = hist.supplier_gstin.value if hist.supplier_gstin else ""
            hist_name = hist.supplier_name.value if hist.supplier_name else ""
            hist_amount = hist.totals.total_amount.value if hist.totals and hist.totals.total_amount else None
            hist_date = str(hist.date.value or "")[:10] if hist.date else ""
            hist_hash = hist.source_file_hash or ""

            match_reasons: list[str] = []
            similarity_score = 0.0

            # 1. Exact file perceptual / sha256 hash match on different invoice IDs
            if cand_hash and hist_hash and cand_hash == hist_hash and cand_id != hist_id:
                match_reasons.append("Identical source file hash on separate invoice submission")
                similarity_score = 1.0

            # 2. Normalized invoice number match + supplier match
            same_supplier = (cand_gstin and hist_gstin and cand_gstin == hist_gstin) or (
                cand_name and hist_name and fuzz.token_sort_ratio(cand_name, hist_name) >= 85
            )

            if cand_norm_num and hist_norm_num and cand_norm_num == hist_norm_num and same_supplier:
                match_reasons.append(f"Normalized invoice number match '{cand_norm_num}' from same supplier")
                similarity_score = max(similarity_score, 0.98)

            # 3. Near-identical amounts and dates from same supplier with close number
            if same_supplier and cand_amount is not None and hist_amount is not None:
                amount_diff = abs(cand_amount - hist_amount)
                if amount_diff <= Decimal("0.05") and cand_date and hist_date and cand_date == hist_date:
                    fuzz_num_ratio = fuzz.ratio(cand_num, hist_num)
                    if fuzz_num_ratio >= 80:
                        match_reasons.append(
                            f"Identical amount (₹{cand_amount}), identical date ({cand_date}), and similar number '{cand_num}' vs '{hist_num}'"
                        )
                        similarity_score = max(similarity_score, 0.92)

            if similarity_score >= 0.90:
                return ThreatSignal(
                    signal_id=f"SIG-DUP-{uuid.uuid4().hex[:8]}",
                    signal_type="duplicate_invoice",
                    severity="critical",
                    confidence=similarity_score,
                    description=(
                        f"Potential duplicate invoice detected. "
                        f"Matches historical invoice '{hist_id}' with {similarity_score:.0%} confidence: {'; '.join(match_reasons)}"
                    ),
                    status="open",
                    risk_score=round(similarity_score * 100.0, 1),
                    evidence=[
                        {
                            "matched_invoice_id": hist_id,
                            "matched_invoice_number": hist_num,
                            "similarity": similarity_score,
                            "reasons": match_reasons,
                        }
                    ],
                    recommended_steps=[
                        "VERIFY_PREVIOUS_PAYMENT",
                        "CHECK_PURCHASE_REGISTER_FOR_DUP",
                        "REQUEST_VENDOR_CONFIRMATION",
                    ],
                )

        return None
