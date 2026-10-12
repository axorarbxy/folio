"""Reconciliation API endpoints for GSTR-2B matching, simulation, and resolution."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from folio_ml.contracts.recon import ReconMatch, ReconReport
from folio_ml.recon.contracts import (
    Gstr2bDocument,
    PurchaseRegister,
    PurchaseRegisterRecord,
)
from folio_ml.recon.engine import (
    AuditEvent,
    ReconciliationEngine,
    SimulationImpact,
)
from folio_ml.recon.parsers import PurchaseRegisterParser, UniversalGstr2bParser

router = APIRouter(prefix="/reconcile", tags=["Reconciliation"])
engine = ReconciliationEngine()
gstr2b_parser = UniversalGstr2bParser()
pr_parser = PurchaseRegisterParser()


class ReconcileRequest(BaseModel):
    period: str = Field(default="2024-04")
    register_data: list[dict[str, Any]] | str = Field(default_factory=list)
    gstr2b_data: list[dict[str, Any]] | dict[str, Any] = Field(default_factory=dict)


class SimulateRequest(BaseModel):
    report: ReconReport
    vendors_not_filing: list[str] = Field(default_factory=list)


class ResolveRequest(BaseModel):
    match: ReconMatch
    action: str
    note: str = ""


class ResolveResponse(BaseModel):
    match: ReconMatch
    audit_event: AuditEvent


@router.post("", response_model=ReconReport)
def reconcile_invoices(payload: ReconcileRequest) -> ReconReport:
    """Matches purchase register against GSTR-2B data and calculates ITC at risk."""
    # 1. Parse Purchase Register
    if isinstance(payload.register_data, str) and payload.register_data.strip():
        books = pr_parser.parse_csv(payload.register_data, period=payload.period)
    elif isinstance(payload.register_data, list):
        parsed_records: list[PurchaseRegisterRecord] = []
        for item in payload.register_data:
            from folio_ml.recon.parsers import _to_decimal

            parsed_records.append(
                PurchaseRegisterRecord(
                    supplier_gstin=str(item.get("supplier_gstin", item.get("gstin", ""))).strip(),
                    supplier_name=str(item.get("supplier_name", item.get("vendor_name", ""))).strip(),
                    invoice_number=str(item.get("invoice_number", item.get("inv_no", ""))).strip(),
                    invoice_date=str(item.get("invoice_date", item.get("date", ""))).strip(),
                    taxable_value=_to_decimal(item.get("taxable_value", item.get("taxable", 0))),
                    cgst=_to_decimal(item.get("cgst", 0)),
                    sgst=_to_decimal(item.get("sgst", 0)),
                    igst=_to_decimal(item.get("igst", 0)),
                    cess=_to_decimal(item.get("cess", 0)),
                    total=_to_decimal(item.get("total")) if item.get("total") is not None else None,
                    period=payload.period,
                    raw=item,
                )
            )
        books = PurchaseRegister(period=payload.period, records=parsed_records)
    else:
        books = PurchaseRegister(period=payload.period, records=[])

    # 2. Parse GSTR-2B
    if isinstance(payload.gstr2b_data, dict) and payload.gstr2b_data:
        gstr2b = gstr2b_parser.parse(payload.gstr2b_data)
    elif isinstance(payload.gstr2b_data, list) and payload.gstr2b_data:
        gstr2b = gstr2b_parser.parse({"period": payload.period, "records": payload.gstr2b_data})
    else:
        gstr2b = Gstr2bDocument(period=payload.period, records=[])

    return engine.reconcile(payload.period, books, gstr2b)


@router.post("/simulate", response_model=SimulationImpact)
def simulate_exposure(payload: SimulateRequest) -> SimulationImpact:
    """Calculates what-if projected ITC loss when specified vendors fail to file."""
    return engine.simulate(payload.report, set(payload.vendors_not_filing))


@router.post("/resolve", response_model=ResolveResponse)
def resolve_mismatch(payload: ResolveRequest) -> ResolveResponse:
    """Records human auditor resolution on a reconciliation mismatch."""
    updated_match, event = engine.resolve(payload.match, payload.action, payload.note)
    return ResolveResponse(match=updated_match, audit_event=event)
