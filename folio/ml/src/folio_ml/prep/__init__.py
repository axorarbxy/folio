"""Document intake, quality analysis, deskewing, and preprocessing."""

from folio_ml.prep.cleanup import cleanup_image
from folio_ml.prep.contracts import (
    PreparedDocument,
    PreparedPage,
    QrInvoicePayload,
    QualityReport,
)
from folio_ml.prep.errors import (
    CorruptDocumentError,
    FileOversizeError,
    PreprocessingError,
    UnsupportedFileFormatError,
)
from folio_ml.prep.language import detect_languages, estimate_handwritten_likelihood
from folio_ml.prep.preprocessor import DocumentPreprocessor
from folio_ml.prep.qr import FakeQrDecoder, QrDecoder, parse_einvoice_qr_text
from folio_ml.prep.quality import assess_quality, estimate_skew_angle

__all__ = [
    "CorruptDocumentError",
    "DocumentPreprocessor",
    "FakeQrDecoder",
    "FileOversizeError",
    "PreparedDocument",
    "PreparedPage",
    "PreprocessingError",
    "QrDecoder",
    "QrInvoicePayload",
    "QualityReport",
    "UnsupportedFileFormatError",
    "assess_quality",
    "cleanup_image",
    "detect_languages",
    "estimate_handwritten_likelihood",
    "estimate_skew_angle",
    "parse_einvoice_qr_text",
]
