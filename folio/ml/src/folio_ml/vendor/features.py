"""Recency-weighted feature engineering for vendor risk modeling.

FAIRNESS GUARANTEE:
Per Folio design principles and Section 2 of README 08, this feature extractor
strictly refuses to use supplier location, state, name-derived attributes, religion,
or balance sheet size as risk factors. All features are strictly grounded in observed
statutory filing history, reconciliation results, and arithmetic precision.
"""

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from folio_ml.vendor.contracts import VendorEvent


def compute_month_diff(period_a: str, period_b: str) -> int:
    """Computes difference in months between two YYYY-MM periods (b - a)."""
    try:
        y_a, m_a = map(int, period_a.split("-")[:2])
        y_b, m_b = map(int, period_b.split("-")[:2])
        return (y_b - y_a) * 12 + (m_b - m_a)
    except Exception:
        return 0


class VendorFeatures:
    """Extracted feature vector for vendor risk scoring."""

    def __init__(
        self,
        gstin: str,
        total_invoices: int,
        tenure_months: int,
        late_filing_rate: float,
        effective_filing_n: float,
        mismatch_rate: float,
        effective_invoice_n: float,
        rate_error_rate: float,
        math_error_rate: float,
        unresolved_issues: int,
        avg_response_time_hours: float,
        trend: float,
        filing_history: list[dict[str, Any]],
    ) -> None:
        self.gstin = gstin
        self.total_invoices = total_invoices
        self.tenure_months = tenure_months
        self.late_filing_rate = late_filing_rate
        self.effective_filing_n = effective_filing_n
        self.mismatch_rate = mismatch_rate
        self.effective_invoice_n = effective_invoice_n
        self.rate_error_rate = rate_error_rate
        self.math_error_rate = math_error_rate
        self.unresolved_issues = unresolved_issues
        self.avg_response_time_hours = avg_response_time_hours
        self.trend = trend
        self.filing_history = filing_history


class FeatureExtractor:
    """Extracts recency-weighted exponential decay features from raw vendor events."""

    def __init__(self, half_life_months: float = 6.0) -> None:
        self.half_life_months = half_life_months

    def extract_features(
        self,
        gstin: str,
        events: list[VendorEvent],
        current_period: str | None = None,
    ) -> VendorFeatures:
        if not events:
            return VendorFeatures(
                gstin=gstin,
                total_invoices=0,
                tenure_months=0,
                late_filing_rate=0.0,
                effective_filing_n=0.0,
                mismatch_rate=0.0,
                effective_invoice_n=0.0,
                rate_error_rate=0.0,
                math_error_rate=0.0,
                unresolved_issues=0,
                avg_response_time_hours=24.0,
                trend=0.0,
                filing_history=[],
            )

        if current_period is None:
            # Use latest period among events or current UTC month
            periods = [e.period for e in events if e.period]
            current_period = max(periods) if periods else datetime.now(UTC).strftime("%Y-%m")

        # 1. Filing history and late filing rate
        filing_events = [e for e in events if e.event_type == "filing_status"]
        filing_history_map: dict[str, dict[str, Any]] = defaultdict(lambda: {"status": "filed_on_time", "invoices": 0})

        for e in filing_events:
            status = e.details.get("status", "filed_on_time")
            filing_history_map[e.period]["status"] = status

        total_filing_w = 0.0
        late_filing_w = 0.0
        for p, rec in filing_history_map.items():
            age_months = max(0, compute_month_diff(p, current_period))
            w = 2.0 ** (-age_months / self.half_life_months)
            total_filing_w += w
            if rec["status"] in {"filed_late", "not_filed"}:
                late_filing_w += w

        late_filing_rate = (late_filing_w / total_filing_w) if total_filing_w > 0 else 0.0

        # 2. Invoices, mismatches, rate errors, math errors
        invoice_events = [e for e in events if e.event_type == "invoice_received"]
        mismatch_events = [e for e in events if e.event_type == "recon_mismatch"]

        total_inv_w = 0.0
        total_invoices = 0
        rate_err_w = 0.0
        math_err_w = 0.0

        for e in invoice_events:
            total_invoices += 1
            age_months = max(0, compute_month_diff(e.period, current_period))
            w = 2.0 ** (-age_months / self.half_life_months)
            total_inv_w += w

            errors = e.details.get("errors", [])
            if any("hsn_rate" in str(err) or "wrong_rate" in str(err) for err in errors):
                rate_err_w += w
            if any("math" in str(err) for err in errors):
                math_err_w += w

            filing_history_map[e.period]["invoices"] += 1

        rate_error_rate = (rate_err_w / total_inv_w) if total_inv_w > 0 else 0.0
        math_error_rate = (math_err_w / total_inv_w) if total_inv_w > 0 else 0.0

        mismatch_w = 0.0
        for e in mismatch_events:
            age_months = max(0, compute_month_diff(e.period, current_period))
            w = 2.0 ** (-age_months / self.half_life_months)
            count = float(e.details.get("mismatch_count", 1))
            mismatch_w += w * count

        # Mismatch rate normalized against total weighted invoices or min 1
        denom = max(total_inv_w, 1.0) if total_inv_w > 0 else 1.0
        mismatch_rate = min(1.0, mismatch_w / denom) if total_inv_w > 0 else 0.0

        # 3. Response times & unresolved issues
        response_events = [e for e in events if e.event_type == "response_received"]
        resp_times = [float(e.details.get("response_time_hours", 24.0)) for e in response_events]
        avg_response_time = (sum(resp_times) / len(resp_times)) if resp_times else 24.0

        resolved_count = sum(1 for e in response_events if e.details.get("status") == "resolved")
        total_issues = len(mismatch_events) + int(rate_err_w) + int(math_err_w)
        unresolved_issues = max(0, total_issues - resolved_count)

        # 4. Tenure months
        all_periods = sorted(list({e.period for e in events if e.period}))
        tenure_months = compute_month_diff(all_periods[0], all_periods[-1]) + 1 if all_periods else 0

        # 5. Trend: Last 3 months vs Prior 3 months
        # Comparing defect events in months 0..2 vs 3..5
        recent_defects = 0.0
        recent_count = 0.0
        prior_defects = 0.0
        prior_count = 0.0

        for e in events:
            age = max(0, compute_month_diff(e.period, current_period))
            is_defect = (
                e.event_type == "recon_mismatch"
                or (e.event_type == "filing_status" and e.details.get("status") in {"filed_late", "not_filed"})
                or (e.event_type == "invoice_received" and bool(e.details.get("errors")))
            )
            if age < 3:
                recent_count += 1.0
                if is_defect:
                    recent_defects += 1.0
            elif 3 <= age < 6:
                prior_count += 1.0
                if is_defect:
                    prior_defects += 1.0

        recent_rate = recent_defects / recent_count if recent_count > 0 else 0.0
        prior_rate = prior_defects / prior_count if prior_count > 0 else 0.0
        trend = round(recent_rate - prior_rate, 3)

        # Prepare 12-month filing history list
        filing_history_list: list[dict[str, Any]] = [
            {"period": p, "status": rec["status"], "invoices": rec["invoices"]}
            for p, rec in sorted(filing_history_map.items())[-12:]
        ]

        return VendorFeatures(
            gstin=gstin,
            total_invoices=total_invoices,
            tenure_months=tenure_months,
            late_filing_rate=round(late_filing_rate, 4),
            effective_filing_n=round(total_filing_w, 2),
            mismatch_rate=round(mismatch_rate, 4),
            effective_invoice_n=round(total_inv_w, 2),
            rate_error_rate=round(rate_error_rate, 4),
            math_error_rate=round(math_error_rate, 4),
            unresolved_issues=unresolved_issues,
            avg_response_time_hours=round(avg_response_time, 1),
            trend=trend,
            filing_history=filing_history_list,
        )
