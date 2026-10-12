"""Threat signals and document verification endpoints."""

from fastapi import APIRouter, Query

from folio_ml.contracts.signals import ThreatSignal
from folio_ml.providers.fake import create_fake_invoice
from folio_ml.verify.contracts import ScanRequest, ScanResponse
from folio_ml.verify.scanner import DocumentScanner

router = APIRouter(prefix="/signals", tags=["Signals & Threats"])

# Global shared scanner instance for the API
scanner = DocumentScanner()


@router.post("/scan", response_model=ScanResponse)
def scan_document_signals(request: ScanRequest) -> ScanResponse:
    """Scans an invoice for independent math discrepancies, duplicates, tamper markers, and anomalies."""
    invoice = request.invoice
    if invoice is None:
        inv_id = request.invoice_id or "INV-SCAN-001"
        invoice = create_fake_invoice(invoice_id=inv_id)

    return scanner.scan(
        invoice=invoice,
        pdf_path=request.pdf_path,
    )


@router.get("", response_model=list[ThreatSignal])
def list_signals(
    status: str | None = Query(default=None, description="Filter signals by status, e.g. 'open'"),
) -> list[ThreatSignal]:
    """Retrieves all threat and anomaly signals discovered across processed invoices."""
    return scanner.get_signals(status=status)
