"""Reader module for multimodal VLM and OCR document extraction."""

from folio_ml.reader.adapters import (
    FakeReader,
    GeminiVisionReader,
    IndicReader,
    NotConfiguredError,
    OpenAICompatReader,
    ReplayReader,
)
from folio_ml.reader.agreement import compare_field_values, evaluate_two_pass_agreement
from folio_ml.reader.base import Reader, parse_and_validate_invoice
from folio_ml.reader.box_align import align_word_boxes
from folio_ml.reader.contracts import (
    AgreementKind,
    FieldAgreement,
    RawExtraction,
    ReaderFailure,
    TwoPassResult,
)
from folio_ml.reader.normalize import (
    normalize_amount,
    normalize_date,
    normalize_gstin,
    normalize_hsn,
    normalize_string,
)
from folio_ml.reader.pipeline import ExtractionPipeline, get_default_reader

__all__ = [
    "AgreementKind",
    "ExtractionPipeline",
    "FakeReader",
    "FieldAgreement",
    "GeminiVisionReader",
    "IndicReader",
    "NotConfiguredError",
    "OpenAICompatReader",
    "RawExtraction",
    "Reader",
    "ReaderFailure",
    "ReplayReader",
    "TwoPassResult",
    "align_word_boxes",
    "compare_field_values",
    "evaluate_two_pass_agreement",
    "get_default_reader",
    "normalize_amount",
    "normalize_date",
    "normalize_gstin",
    "normalize_hsn",
    "normalize_string",
    "parse_and_validate_invoice",
]
