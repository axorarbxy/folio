"""Comprehensive tests for Reader module: normalization, adapters, retry logic, two-pass agreement, and API."""

import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.prep.contracts import PreparedDocument, QualityReport
from folio_ml.reader.adapters import (
    FakeReader,
    GeminiVisionReader,
    IndicReader,
    NotConfiguredError,
    OpenAICompatReader,
    ReplayReader,
)
from folio_ml.reader.agreement import compare_field_values, evaluate_two_pass_agreement
from folio_ml.reader.base import parse_and_validate_invoice
from folio_ml.reader.box_align import align_word_boxes
from folio_ml.reader.contracts import RawExtraction, ReaderFailure
from folio_ml.reader.normalize import (
    normalize_amount,
    normalize_date,
    normalize_gstin,
    normalize_hsn,
)
from folio_ml.reader.pipeline import ExtractionPipeline

client = TestClient(app)


def test_normalization_strict_float_rejection() -> None:
    """HARD RULE: Money normalization must strictly reject float inputs."""
    with pytest.raises(TypeError, match="strictly forbids float"):
        normalize_amount(1250.50)


def test_normalization_indian_numbering_and_currency() -> None:
    """Verifies Indian comma groupings, currency signs, and Devanagari numerals."""
    # Indian formatting with rupee sign and lakhs comma
    assert normalize_amount("₹ 1,23,456.50") == Decimal("123456.50")
    assert normalize_amount("Rs. 45,000") == Decimal("45000.00")
    assert normalize_amount("INR 9,999.99") == Decimal("9999.99")

    # Devanagari digits: १२३४.५० -> 1234.50
    assert normalize_amount("१२३४.५०") == Decimal("1234.50")
    assert normalize_amount(None) is None


def test_normalization_gstin_and_date() -> None:
    """Verifies GSTIN and multi-format date normalization."""
    assert normalize_gstin(" 27-aabcf1234f1z5 ") == "27AABCF1234F1Z5"
    assert normalize_gstin("") is None

    # Date normalization
    assert normalize_date("15/04/2024") == "2024-04-15"
    assert normalize_date("15-04-2024") == "2024-04-15"
    assert normalize_date("15-Apr-24") == "2024-04-15"
    assert normalize_date("2024-04-15") == "2024-04-15"
    assert normalize_date("१५/०४/२०२४") == "2024-04-15"

    # HSN normalization
    assert normalize_hsn("HSN: 8481.10.00") == "84811000"


def test_parse_and_validate_invoice_with_markdown_fences() -> None:
    """Verifies parsing of model completions wrapped in markdown json fences."""
    sample = {
        "id": "INV-2024-01",
        "number": {"value": "INV-2024-01"},
        "date": {"value": "2024-04-15"},
        "supplier_gstin": {"value": "27AAPFU0939F1ZV"},
        "buyer_gstin": {"value": "29AABCB1234D1ZP"},
        "place_of_supply": {"value": "29"},
        "totals": {
            "taxable_amount": {"value": "1000.00"},
            "cgst_amount": {"value": "0.00"},
            "sgst_amount": {"value": "0.00"},
            "igst_amount": {"value": "180.00"},
            "cess_amount": {"value": "0.00"},
            "total_amount": {"value": "1180.00"},
        },
        "items": [
            {
                "description": {"value": "Industrial Valve"},
                "hsn": {"value": "8481"},
                "qty": {"value": "1"},
                "unit": {"value": "NOS"},
                "rate": {"value": "1000.00"},
                "taxable": {"value": "1000.00"},
                "cgst_pct": {"value": "0.00"},
                "sgst_pct": {"value": "0.00"},
                "igst_pct": {"value": "18.00"},
                "cess_pct": {"value": "0.00"},
            }
        ],
    }
    raw_markdown = f"```json\n{json.dumps(sample, indent=2)}\n```"
    inv = parse_and_validate_invoice(raw_markdown, "hash123")

    assert inv.id == "INV-2024-01"
    assert inv.totals.total_amount.value == Decimal("1180.00")
    assert inv.items[0].igst_pct.value == Decimal("18.00")


def test_parse_invalid_json_raises_reader_failure() -> None:
    """Verifies syntax errors in completions raise ReaderFailure."""
    with pytest.raises(ReaderFailure) as exc:
        parse_and_validate_invoice("{invalid_json_text", "hash456")
    assert exc.value.error_type == "JSON_SYNTAX_ERROR"


def _make_dummy_prepared_doc(file_hash: str = "testhash1234567890") -> PreparedDocument:
    quality = QualityReport(
        score=0.9,
        blur_score=0.9,
        brightness_score=0.9,
        contrast_score=0.9,
        resolution_score=0.9,
        glare_score=0.0,
        skew_angle_deg=0.0,
        is_acceptable=True,
    )
    return PreparedDocument(
        file_hash=file_hash,
        file_name="test.png",
        mime_type="image/png",
        quality=quality,
    )


def test_pipeline_retry_mechanism_recovers_from_single_failure() -> None:
    """Verifies extraction pipeline catches first failure and succeeds on retry."""
    # Fake reader fails attempt 1, succeeds on attempt 2
    reader = FakeReader(fail_attempts=1)
    pipeline = ExtractionPipeline(reader=reader)

    doc = _make_dummy_prepared_doc()
    res = pipeline.extract(doc)

    assert isinstance(res, RawExtraction)
    assert res.retries_attempted == 1
    assert res.invoice.id is not None


def test_pipeline_unrecoverable_failure_routes_to_human_review() -> None:
    """Verifies that persistent failure exhausts retries and raises ReaderFailure with requires_human_review."""
    reader = FakeReader(always_fail=True)
    pipeline = ExtractionPipeline(reader=reader)

    doc = _make_dummy_prepared_doc()
    with pytest.raises(ReaderFailure) as exc:
        pipeline.extract(doc)

    assert exc.value.error_type == "RETRY_EXHAUSTED"
    assert exc.value.requires_human_review is True


def test_replay_reader(tmp_path: Path) -> None:
    """Verifies ReplayReader loads recorded completions correctly."""
    clean_inv = generate_clean_invoice(seed=77)
    file_hash = "abcdef1234567890"

    bundle_data = {
        "model_name": "gemini-1.5-flash",
        "latency_ms": 250.0,
        "token_usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        "raw_response_text": clean_inv.model_dump_json(),
    }
    replay_file = tmp_path / f"{file_hash}_v1.json"
    replay_file.write_text(json.dumps(bundle_data), encoding="utf-8")

    reader = ReplayReader(replay_dir=tmp_path, prompt_version="v1")
    doc = _make_dummy_prepared_doc(file_hash=file_hash)

    extraction = reader.extract(doc)
    assert extraction.invoice.id == clean_inv.id
    assert extraction.model_name == "gemini-1.5-flash"

    # Missing replay file
    missing_doc = _make_dummy_prepared_doc(file_hash="unknown_hash")
    with pytest.raises(ReaderFailure) as exc:
        reader.extract(missing_doc)
    assert exc.value.error_type == "REPLAY_NOT_FOUND"


def test_two_pass_agreement_evaluation() -> None:
    """Verifies field comparison and agreement scoring across two passes."""
    inv1 = generate_clean_invoice(seed=80)
    inv2 = inv1.model_copy(deep=True)

    # Identical passes -> agreement score 1.0
    ext1 = RawExtraction(
        invoice=inv1,
        raw_response_text="{}",
        provider_name="fake",
        model_name="m1",
        latency_ms=10.0,
    )
    ext2 = RawExtraction(
        invoice=inv2,
        raw_response_text="{}",
        provider_name="fake",
        model_name="m2",
        latency_ms=10.0,
    )

    two_pass = evaluate_two_pass_agreement(ext1, ext2)
    assert two_pass.agreement_score == 1.0
    assert two_pass.agreements["number"].agreement == "exact"

    # Perturb date on second pass
    inv2.date.value = "2024-05-20"
    two_pass_diff = evaluate_two_pass_agreement(ext1, ext2)
    assert two_pass_diff.agreements["date"].agreement == "disagree"
    assert two_pass_diff.agreement_score < 1.0


def test_field_value_comparison_types() -> None:
    """Verifies agreement categorization rules (exact, normalized_equal, numeric_close, disagree)."""
    assert compare_field_values("ABC CORP", "abc corp") == "normalized_equal"
    assert compare_field_values(Decimal("100.00"), Decimal("100.01")) == "numeric_close"
    assert compare_field_values(Decimal("100.00"), Decimal("105.00")) == "disagree"
    assert compare_field_values("A", None) == "disagree"
    assert compare_field_values(None, None) == "exact"


def test_word_box_alignment() -> None:
    """Verifies bounding box assignment when word-level tokens are provided."""
    inv = generate_clean_invoice(seed=88)
    inv.number.box = None
    inv.number.value = "INV-999"

    tokens = [
        {"text": "INV-999", "x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.25, "page": 1}
    ]
    aligned = align_word_boxes(inv, tokens)
    assert aligned.number.box is not None
    assert aligned.number.box.x0 == 0.1
    assert aligned.number.box.y1 == 0.25


def test_unconfigured_readers_raise_not_configured_error() -> None:
    """Verifies that live adapters fail cleanly when required env vars are missing."""
    with pytest.raises(NotConfiguredError, match="GEMINI_API_KEY"):
        GeminiVisionReader(api_key="").extract(_make_dummy_prepared_doc())

    with pytest.raises(NotConfiguredError, match="INDIC_OCR_ENDPOINT"):
        IndicReader(endpoint="").extract(_make_dummy_prepared_doc())

    with pytest.raises(NotConfiguredError, match="OPENAI_BASE_URL"):
        OpenAICompatReader(base_url="").extract(_make_dummy_prepared_doc())


def test_api_extract_endpoint() -> None:
    """Verifies end-to-end POST /v1/invoices/extract."""
    response = client.post("/v1/invoices/extract")
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "totals" in data
    assert "items" in data
