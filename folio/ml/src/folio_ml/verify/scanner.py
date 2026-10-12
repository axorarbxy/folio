"""Unified document verification and anomaly scanning orchestrator."""

from pathlib import Path
from typing import Any

from folio_ml.contracts.invoice import Invoice
from folio_ml.contracts.signals import ThreatSignal
from folio_ml.prep.contracts import QrInvoicePayload
from folio_ml.verify.anomaly import AnomalyDetector
from folio_ml.verify.contracts import ScanResponse, VerifierFlag
from folio_ml.verify.duplicates import DuplicateDetector
from folio_ml.verify.tamper import TamperDetector
from folio_ml.verify.verifier import IndependentVerifier


class DocumentScanner:
    """End-to-end scanner orchestrating verifier math, near-duplicate checks, and tamper heuristics."""

    def __init__(
        self,
        verifier: IndependentVerifier | None = None,
        duplicate_detector: DuplicateDetector | None = None,
        tamper_detector: TamperDetector | None = None,
        anomaly_detector: AnomalyDetector | None = None,
    ) -> None:
        self.verifier = verifier or IndependentVerifier()
        self.duplicate_detector = duplicate_detector or DuplicateDetector()
        self.tamper_detector = tamper_detector or TamperDetector()
        self.anomaly_detector = anomaly_detector or AnomalyDetector()

        # In-memory store for emitted threat signals queried by GET /v1/signals
        self._signals_store: dict[str, ThreatSignal] = {}

    def record_signal(self, sig: ThreatSignal) -> None:
        self._signals_store[sig.signal_id] = sig

    def get_signals(self, status: str | None = None) -> list[ThreatSignal]:
        sigs = list(self._signals_store.values())
        if status:
            sigs = [s for s in sigs if s.status == status]
        return sigs

    def register_approved_invoice(self, invoice: Invoice) -> None:
        """Registers an invoice into duplicate detection history."""
        self.duplicate_detector.register_invoice(invoice)

    def scan(
        self,
        invoice: Invoice,
        pdf_path: str | Path | None = None,
        pdf_metadata: dict[str, Any] | None = None,
        qr_payload: QrInvoicePayload | None = None,
        supplier_history: list[Invoice] | None = None,
    ) -> ScanResponse:
        inv_id = str(invoice.id or "")

        # 1. Independent arithmetic & statutory verification
        flags: list[VerifierFlag] = self.verifier.verify(invoice)

        # 2. Near-duplicate check
        signals: list[ThreatSignal] = []
        dup_sig = self.duplicate_detector.check_duplicate(invoice)
        if dup_sig:
            signals.append(dup_sig)

        # 3. Tamper heuristics (PDF metadata, QR discrepancy, tamper markers)
        tamper_sigs = self.tamper_detector.check_tamper(
            invoice=invoice,
            pdf_path=pdf_path,
            pdf_metadata=pdf_metadata,
            qr_payload=qr_payload,
        )
        signals.extend(tamper_sigs)

        # 4. Statistical anomalies (new vendor threshold, robust z-score, sequence gaps)
        anom_sigs = self.anomaly_detector.check_anomalies(
            invoice=invoice,
            supplier_history=supplier_history,
        )
        signals.extend(anom_sigs)

        # Save all discovered signals into scanner store
        for sig in signals:
            self.record_signal(sig)

        # Clean is true if no critical/high signals or critical flags
        has_critical = any(s.severity in {"critical", "high"} for s in signals) or any(
            f.severity in {"critical", "high"} for f in flags
        )
        clean = not has_critical

        return ScanResponse(
            invoice_id=inv_id,
            clean=clean,
            signals=signals,
            flags=flags,
        )
