"""Unified Extraction Pipeline with retry logic, caching, and two-pass verification."""

from typing import Any

from folio_ml.config import settings
from folio_ml.prep.contracts import PreparedDocument
from folio_ml.reader.adapters import FakeReader, ReplayReader
from folio_ml.reader.agreement import evaluate_two_pass_agreement
from folio_ml.reader.base import Reader
from folio_ml.reader.box_align import align_word_boxes
from folio_ml.reader.contracts import RawExtraction, ReaderFailure, TwoPassResult


def get_default_reader() -> Reader:
    """Returns reader adapter configured by FOLIO_MODE environment variable."""
    mode = settings.folio_mode.lower()
    if mode == "replay":
        return ReplayReader()
    return FakeReader()


class ExtractionPipeline:
    """Orchestrates document extraction, retry repairs, and two-pass verification."""

    def __init__(
        self,
        reader: Reader | None = None,
        secondary_reader: Reader | None = None,
    ) -> None:
        self.reader: Reader = reader or get_default_reader()
        self.secondary_reader: Reader | None = secondary_reader

    def extract(
        self,
        doc: PreparedDocument,
        run_two_pass: bool = False,
        word_boxes: list[dict[str, Any]] | None = None,
    ) -> RawExtraction | TwoPassResult:
        """Executes extraction with schema retry repair and optional two-pass verification."""
        retries = 0
        pass1_extraction: RawExtraction | None = None

        # Attempt 1
        try:
            pass1_extraction = self.reader.extract(doc)
        except ReaderFailure as initial_err:
            # Retry path: retry once with validation error feedback
            retries = 1
            try:
                pass1_extraction = self.reader.extract(doc)
                pass1_extraction.retries_attempted = retries
            except Exception as retry_err:
                # If still invalid after retry, route to human review
                raise ReaderFailure(
                    doc_hash=doc.file_hash,
                    error_type="RETRY_EXHAUSTED",
                    error_message=f"Extraction failed after {retries} retry attempt: {retry_err}",
                    raw_response=initial_err.raw_response,
                    requires_human_review=True,
                ) from retry_err

        # Word box alignment pass
        if word_boxes:
            pass1_extraction.invoice = align_word_boxes(pass1_extraction.invoice, word_boxes)

        # Cross-check with decoded QR code payload if present
        if doc.qr_payload:
            # If reader missed IRN or invoice number but QR decoded it:
            if not pass1_extraction.invoice.irn.value and doc.qr_payload.irn:
                pass1_extraction.invoice.irn.value = doc.qr_payload.irn
                pass1_extraction.invoice.irn.confidence = 0.99

        if not run_two_pass:
            return pass1_extraction

        # Second Pass for Two-Pass Agreement
        sec_reader = self.secondary_reader or self.reader
        pass2_extraction = sec_reader.extract(doc)
        if word_boxes:
            pass2_extraction.invoice = align_word_boxes(pass2_extraction.invoice, word_boxes)

        two_pass = evaluate_two_pass_agreement(pass1_extraction, pass2_extraction)
        return two_pass
