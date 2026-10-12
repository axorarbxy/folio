"""Reconciliation pipeline engine compiling buckets, calculating ITC exposure, and simulating risk."""

from collections import defaultdict
from datetime import UTC
from decimal import Decimal

from pydantic import BaseModel, Field

from folio_ml.contracts.recon import ReconBucket, ReconMatch, ReconReport
from folio_ml.recon.contracts import (
    Gstr2bDocument,
    NormalizedRecord,
    PurchaseRegister,
)
from folio_ml.recon.matcher import ReconciliationMatcher
from folio_ml.recon.normalize import (
    normalize_gstr2b_record,
    normalize_purchase_register_record,
)
from folio_ml.utils.money import StrictMoney


class SupplierExposure(BaseModel):
    """Aggregate ITC exposure for a single supplier."""

    supplier_gstin: str
    supplier_name: str = ""
    invoice_count: int
    rupee_at_risk: StrictMoney
    buckets: dict[str, int] = Field(default_factory=dict)


class SimulationImpact(BaseModel):
    """Projected ITC loss when specific vendors fail to file GSTR-1/GSTR-2B."""

    base_rupee_at_risk: StrictMoney
    simulated_rupee_at_risk: StrictMoney
    additional_risk: StrictMoney
    affected_vendors: list[str]
    affected_invoices_count: int


class AuditEvent(BaseModel):
    """Resolution audit log entry."""

    match_id: str
    action: str  # "contact_vendor" | "defer" | "reverse_itc" | "accept_difference"
    note: str = ""
    resolved_at_iso: str
    previous_resolution: str | None = None


# Buckets that contribute to ITC at risk
RISK_BUCKETS: set[ReconBucket] = {
    "vendor_not_filed",
    "missing_in_2b",
    "value_mismatch",
    "ineligible",
    "duplicate",
}


class ReconciliationEngine:
    """Core reconciliation orchestrator."""

    def __init__(self, matcher: ReconciliationMatcher | None = None) -> None:
        self.matcher = matcher or ReconciliationMatcher()
        self._audit_log: list[AuditEvent] = []

    def reconcile(
        self,
        period: str,
        purchase_register: PurchaseRegister,
        gstr2b: Gstr2bDocument,
    ) -> ReconReport:
        """Runs end-to-end reconciliation between purchase register and GSTR-2B."""
        # 1. Normalize purchase register records
        books_norm: list[NormalizedRecord] = [
            normalize_purchase_register_record(rec, f"B-{idx}")
            for idx, rec in enumerate(purchase_register.records)
        ]

        # 2. Normalize GSTR-2B records
        gstr2b_norm: list[NormalizedRecord] = [
            normalize_gstr2b_record(rec, f"2B-{idx}")
            for idx, rec in enumerate(gstr2b.records)
        ]

        # 3. Match across normalized records
        matches = self.matcher.match(period, books_norm, gstr2b_norm)

        # 4. Compute bucket counts and totals
        bucket_counts: dict[str, int] = defaultdict(int)
        total_risk = Decimal("0.00")

        for m in matches:
            bucket_counts[m.bucket] += 1
            if m.bucket in RISK_BUCKETS:
                # If difference is tracked, use difference, otherwise book amount
                risk_amt = m.difference if m.difference is not None else (m.book_amount or Decimal("0.00"))
                total_risk += risk_amt

        matched_count = bucket_counts.get("matched", 0)
        mismatched_count = bucket_counts.get("value_mismatch", 0)
        missing_in_2b_count = bucket_counts.get("missing_in_2b", 0) + bucket_counts.get("vendor_not_filed", 0)

        return ReconReport(
            period=period,
            total_invoices_books=len(purchase_register.records),
            total_invoices_2b=len(gstr2b.records),
            matched_count=matched_count,
            mismatched_count=mismatched_count,
            missing_in_2b_count=missing_in_2b_count,
            rupee_at_risk=total_risk,
            bucket_counts=dict(bucket_counts),
            matches=matches,
        )

    def calculate_supplier_exposures(self, report: ReconReport) -> list[SupplierExposure]:
        """Ranks suppliers by total rupee amount at risk."""
        supplier_risk: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        supplier_inv_count: dict[str, int] = defaultdict(int)
        supplier_buckets: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

        for m in report.matches:
            gstin = m.supplier_gstin
            supplier_inv_count[gstin] += 1
            supplier_buckets[gstin][m.bucket] += 1
            if m.bucket in RISK_BUCKETS:
                amt = m.difference if m.difference is not None else (m.book_amount or Decimal("0.00"))
                supplier_risk[gstin] += amt

        exposures: list[SupplierExposure] = []
        for gstin, risk in supplier_risk.items():
            exposures.append(
                SupplierExposure(
                    supplier_gstin=gstin,
                    invoice_count=supplier_inv_count[gstin],
                    rupee_at_risk=risk,
                    buckets=dict(supplier_buckets[gstin]),
                )
            )

        # Sort descending by rupee at risk
        exposures.sort(key=lambda x: x.rupee_at_risk, reverse=True)
        return exposures

    def simulate(
        self,
        report: ReconReport,
        vendors_not_filing: set[str],
    ) -> SimulationImpact:
        """Simulates what-if impact if specified vendors do not file their returns."""
        vendors_norm = {v.strip().upper() for v in vendors_not_filing}
        base_risk = report.rupee_at_risk
        simulated_risk = base_risk
        additional_risk = Decimal("0.00")
        affected_count = 0

        for m in report.matches:
            if m.supplier_gstin.upper() in vendors_norm:
                # If it was previously matched or timing difference, availing ITC is now blocked
                if m.bucket in {"matched", "timing_difference"}:
                    amt = m.book_amount or m.gstr2b_amount or Decimal("0.00")
                    additional_risk += amt
                    affected_count += 1

        simulated_risk = base_risk + additional_risk

        return SimulationImpact(
            base_rupee_at_risk=base_risk,
            simulated_rupee_at_risk=simulated_risk,
            additional_risk=additional_risk,
            affected_vendors=sorted(vendors_norm),
            affected_invoices_count=affected_count,
        )

    def resolve(
        self,
        match: ReconMatch,
        action: str,
        note: str = "",
    ) -> tuple[ReconMatch, AuditEvent]:
        """Records a user resolution decision on a reconciliation mismatch."""
        valid_actions = {
            "contact_vendor",
            "defer",
            "reverse_itc",
            "accept_difference",
            "claim_itc_provisionally",
        }
        if action not in valid_actions:
            raise ValueError(f"Invalid resolution action: {action}. Must be one of {valid_actions}")

        from datetime import datetime

        event = AuditEvent(
            match_id=match.match_id,
            action=action,
            note=note,
            resolved_at_iso=datetime.now(UTC).isoformat(),
            previous_resolution=match.resolution,
        )
        self._audit_log.append(event)

        updated_match = match.model_copy(update={"resolution": action})
        return updated_match, event

    @property
    def audit_log(self) -> list[AuditEvent]:
        return list(self._audit_log)
