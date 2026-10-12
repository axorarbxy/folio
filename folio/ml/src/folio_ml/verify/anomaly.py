"""Per-supplier statistical anomaly detection: robust z-score, sequence gaps, and new vendor thresholds."""

import re
import uuid
from decimal import Decimal

import numpy as np

from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.signals import ThreatSignal


class AnomalyDetector:
    """Detects statistical outliers, sequence gaps, and high-value exposure on new vendors."""

    def __init__(self, high_value_new_vendor_threshold: Decimal = Decimal("500000.00")) -> None:
        self.high_value_new_vendor_threshold = high_value_new_vendor_threshold

    def check_anomalies(
        self,
        invoice: Invoice,
        supplier_history: list[Invoice] | None = None,
    ) -> list[ThreatSignal]:
        signals: list[ThreatSignal] = []
        history = list(supplier_history) if supplier_history else []

        total_amt = invoice.totals.total_amount.value if invoice.totals and invoice.totals.total_amount else Decimal("0.00")

        # 1. First invoice from new supplier with unusually high value
        if len(history) == 0 and total_amt >= self.high_value_new_vendor_threshold:
            signals.append(
                ThreatSignal(
                    signal_id=f"SIG-ANOM-{uuid.uuid4().hex[:8]}",
                    signal_type="new_vendor_high_value",
                    severity="high",
                    confidence=0.90,
                    description=(
                        f"First invoice from newly onboarded supplier exceeds exposure threshold of "
                        f"₹{self.high_value_new_vendor_threshold} (Invoice total: ₹{total_amt})."
                    ),
                    status="open",
                    risk_score=75.0,
                    evidence=[
                        {
                            "historical_invoices_count": 0,
                            "invoice_total": str(total_amt),
                            "threshold": str(self.high_value_new_vendor_threshold),
                        }
                    ],
                    recommended_steps=[
                        "VERIFY_VENDOR_BANK_ACCOUNT",
                        "OBTAIN_SENIOR_FINANCE_SIGN_OFF",
                    ],
                )
            )

        # 2. Robust z-score on invoice amounts (Median and MAD)
        if len(history) >= 5 and total_amt > 0:
            hist_amounts = [
                float(inv.totals.total_amount.value)
                for inv in history
                if inv.totals and inv.totals.total_amount and inv.totals.total_amount.value
            ]
            if len(hist_amounts) >= 5:
                med = float(np.median(hist_amounts))
                abs_devs = np.abs(np.array(hist_amounts) - med)
                mad = float(np.median(abs_devs))

                if mad > 0:
                    cand_val = float(total_amt)
                    robust_z = (0.6745 * abs(cand_val - med)) / mad
                    if robust_z > 3.5 and cand_val > med:
                        signals.append(
                            ThreatSignal(
                                signal_id=f"SIG-ANOM-{uuid.uuid4().hex[:8]}",
                                signal_type="sequence_anomaly",
                                severity="medium",
                                confidence=min(0.95, round(robust_z / 5.0, 2)),
                                description=(
                                    f"Invoice amount ₹{total_amt} is a statistical anomaly for this vendor "
                                    f"(robust z-score {robust_z:.1f} vs median ₹{med:.2f}, MAD ₹{mad:.2f})."
                                ),
                                status="open",
                                risk_score=min(90.0, round(50.0 + robust_z * 8.0, 1)),
                                evidence=[
                                    {
                                        "robust_z_score": round(robust_z, 2),
                                        "median_amount": round(med, 2),
                                        "mad": round(mad, 2),
                                        "sample_size": len(hist_amounts),
                                    }
                                ],
                                recommended_steps=[
                                    "CONFIRM_PURCHASE_ORDER_VALUE",
                                    "VERIFY_GOODS_RECEIPT_NOTE",
                                ],
                            )
                        )

        # 3. Invoice number sequence gaps or reversals
        if history:
            current_num_str = invoice.number.value if invoice.number else ""
            match_curr = re.search(r"(\d+)", current_num_str)
            if match_curr:
                curr_seq = int(match_curr.group(1))
                hist_seqs: list[int] = []
                for h in history:
                    h_num = h.number.value if h.number else ""
                    m = re.search(r"(\d+)", h_num)
                    if m:
                        hist_seqs.append(int(m.group(1)))

                if hist_seqs:
                    max_hist_seq = max(hist_seqs)
                    # Gap check (> 500 number jump)
                    if curr_seq > max_hist_seq + 500:
                        signals.append(
                            ThreatSignal(
                                signal_id=f"SIG-ANOM-{uuid.uuid4().hex[:8]}",
                                signal_type="sequence_anomaly",
                                severity="low",
                                confidence=0.75,
                                description=(
                                    f"Invoice number jump anomaly: current sequence {curr_seq} jumps "
                                    f"by {curr_seq - max_hist_seq} numbers past highest prior sequence ({max_hist_seq})."
                                ),
                                status="open",
                                risk_score=40.0,
                                evidence=[
                                    {
                                        "current_sequence": curr_seq,
                                        "max_prior_sequence": max_hist_seq,
                                        "jump": curr_seq - max_hist_seq,
                                    }
                                ],
                                recommended_steps=["CHECK_FOR_MISSING_INTERVENING_INVOICES"],
                            )
                        )

        return signals
