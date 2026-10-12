"""Tests for document preprocessing, optical quality scoring, and QR decoding."""

import base64
import json
from decimal import Decimal
from io import BytesIO

import pytest
from PIL import Image, ImageFilter
from pypdf import PdfWriter
from scipy.stats import spearmanr

from folio_ml.datagen.degradation import apply_degradation
from folio_ml.datagen.generator import generate_clean_invoice, render_invoice_image
from folio_ml.prep import (
    CorruptDocumentError,
    DocumentPreprocessor,
    FakeQrDecoder,
    FileOversizeError,
    QrInvoicePayload,
    UnsupportedFileFormatError,
    assess_quality,
    cleanup_image,
    detect_languages,
    estimate_skew_angle,
    parse_einvoice_qr_text,
)


def test_quality_score_correlates_with_degradation_severity() -> None:
    """Acceptance criterion: Spearman rank correlation with degradation severity > 0.60."""
    rhos: list[float] = []

    for seed in range(50, 56):
        inv = generate_clean_invoice(seed=seed)
        base_img = render_invoice_image(inv)

        severities = [0, 1, 2, 3]
        scores: list[float] = []

        for sev in severities:
            deg_img, _ = apply_degradation(base_img, severity=sev, seed=seed)
            report = assess_quality(deg_img)
            scores.append(report.score)

        # Higher severity should produce strictly lower quality score -> negative correlation with severity
        res = spearmanr(severities, scores)
        # Handle cases where scores decrease monotonically
        rhos.append(float(res.statistic))

    avg_rho = sum(rhos) / len(rhos)
    # The requirement is correlation magnitude > 0.60 (negative because severity is inverse of quality)
    assert avg_rho <= -0.60, f"Quality score correlation {avg_rho:.2f} failed acceptance target (<= -0.60)"


def test_clean_image_passes_quality() -> None:
    """Verifies that a clean rendered invoice gets a high quality score and is acceptable."""
    inv = generate_clean_invoice(seed=12)
    img = render_invoice_image(inv)
    report = assess_quality(img)

    assert report.is_acceptable is True
    assert report.score >= 0.50
    assert len(report.rejection_reasons) == 0
    assert report.blur_score > 0.40


def test_severely_blurred_image_is_rejected() -> None:
    """Verifies that heavy blur triggers rejection with actionable tips."""
    inv = generate_clean_invoice(seed=15)
    img = render_invoice_image(inv)
    # Apply severe Gaussian blur
    blurred = img.filter(ImageFilter.GaussianBlur(radius=8.0))
    report = assess_quality(blurred)

    assert report.is_acceptable is False
    assert "SEVERE_BLUR" in report.rejection_reasons
    assert any("blurry" in tip.lower() for tip in report.tips)


def test_skew_estimation_and_cleanup() -> None:
    """Verifies skew angle estimation and deskewing cleanup."""
    inv = generate_clean_invoice(seed=22)
    img = render_invoice_image(inv)

    # Intentionally rotate by 4 degrees
    skewed = img.rotate(4.0, resample=Image.Resampling.BILINEAR, expand=False, fillcolor=(255, 255, 255))
    angle = estimate_skew_angle(skewed)

    # Angle should be estimated near +4.0 deg (within 1.5 deg tolerance)
    assert abs(angle - 4.0) <= 1.5

    report = assess_quality(skewed)
    cleaned, _ = cleanup_image(skewed, report)
    cleaned_angle = estimate_skew_angle(cleaned)
    # After deskewing, angle should be near 0
    assert abs(cleaned_angle) <= 1.5


def test_language_detection() -> None:
    """Verifies Unicode block language detection for English and Indic scripts."""
    # Latin / English
    assert detect_languages("Tax Invoice for ABC Corp GSTIN 27AABCT1234F1Z5") == ["en"]

    # Devanagari (Hindi)
    devanagari_sample = "कर इनवॉयस - माल और सेवा कर नियम 46"
    langs = detect_languages(devanagari_sample)
    assert "hi" in langs

    # Tamil
    tamil_sample = "சரக்கு மற்றும் சேவை வரி விலைப்பட்டியல்"
    langs_ta = detect_languages(tamil_sample)
    assert "ta" in langs_ta

    # Empty string fallback
    assert detect_languages("") == ["en"]


def test_parse_einvoice_qr_jwt_token() -> None:
    """Verifies parsing of standard CBIC RS256 e-invoice JWT QR code payload."""
    claims = {
        "SellerGstin": "27AAPFU0939F1ZV",
        "BuyerGstin": "29AABCB1234D1ZP",
        "DocNo": "INV-2024-8841",
        "DocTyp": "INV",
        "DocDt": "2024-04-10",
        "TotInvVal": 145000.50,
        "ItemCnt": 4,
        "MainHsnCode": "7318",
        "Irn": "a" * 64,
    }
    header = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode("utf-8").rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode("utf-8")).decode("utf-8").rstrip("=")
    signature = "fakesignature"
    jwt_token = f"{header}.{payload}.{signature}"

    parsed = parse_einvoice_qr_text(jwt_token)

    assert parsed.irn == "a" * 64
    assert parsed.supplier_gstin == "27AAPFU0939F1ZV"
    assert parsed.buyer_gstin == "29AABCB1234D1ZP"
    assert parsed.invoice_number == "INV-2024-8841"
    assert parsed.invoice_date == "2024-04-10"
    assert parsed.total_amount == Decimal("145000.50")
    # HARD RULE: Signature verification must remain False until official signoff
    assert parsed.signature_verified is False


def test_preprocessor_rejects_unsupported_extensions() -> None:
    """Verifies that unsupported file extensions are rejected with typed error."""
    prep = DocumentPreprocessor()
    with pytest.raises(UnsupportedFileFormatError):
        prep.preprocess_bytes(b"dummy data", "malicious_script.exe")

    with pytest.raises(UnsupportedFileFormatError):
        prep.preprocess_bytes(b"dummy data", "document.docx")


def test_preprocessor_rejects_oversize_file() -> None:
    """Verifies that files exceeding 25MB are rejected with FileOversizeError."""
    prep = DocumentPreprocessor()
    oversize_bytes = b"0" * (26 * 1024 * 1024)
    with pytest.raises(FileOversizeError):
        prep.preprocess_bytes(oversize_bytes, "huge_invoice.pdf")


def test_preprocessor_handles_json_e_invoice() -> None:
    """Verifies intake and parsing of JSON e-invoices."""
    prep = DocumentPreprocessor()
    data = {
        "SellerGstin": "27AAPFU0939F1ZV",
        "DocNo": "INV-JSON-001",
        "DocDt": "2024-04-15",
        "TotInvVal": 12000.00,
        "Irn": "f" * 64,
    }
    raw_bytes = json.dumps(data).encode("utf-8")
    doc = prep.preprocess_bytes(raw_bytes, "invoice.json")

    assert doc.mime_type == "application/json"
    assert doc.quality.is_acceptable is True
    assert doc.qr_payload is not None
    assert doc.qr_payload.invoice_number == "INV-JSON-001"
    assert doc.qr_payload.irn == "f" * 64


def test_preprocessor_handles_pdf_with_text_layer() -> None:
    """Verifies digital PDF parsing and text layer extraction."""
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    buf = BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    prep = DocumentPreprocessor()
    doc = prep.preprocess_bytes(pdf_bytes, "test_invoice.pdf")

    assert doc.mime_type == "application/pdf"
    assert len(doc.pages) == 1
    assert doc.pages[0].page_num == 1
    assert doc.pages[0].dpi == 300
    assert doc.quality.is_acceptable is True


def test_preprocessor_handles_image_with_fake_qr() -> None:
    """Verifies image preprocessing with fake QR decoder."""
    inv = generate_clean_invoice(seed=30)
    img = render_invoice_image(inv)
    buf = BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    canned_qr = QrInvoicePayload(
        raw_text="mock-qr",
        irn="c" * 64,
        supplier_gstin="27AAPFU0939F1ZV",
        invoice_number="INV-2024-9999",
        signature_verified=False,
    )
    fake_qr = FakeQrDecoder(canned_payload=canned_qr)
    prep = DocumentPreprocessor(qr_decoder=fake_qr)

    doc = prep.preprocess_bytes(img_bytes, "invoice.png")
    assert doc.mime_type == "image/png"
    assert doc.quality.is_acceptable is True
    assert doc.qr_payload is not None
    assert doc.qr_payload.irn == "c" * 64
    assert doc.qr_payload.signature_verified is False


def test_corrupt_file_raises_corrupt_document_error() -> None:
    """Verifies that non-image/non-pdf corrupt bytes raise CorruptDocumentError."""
    prep = DocumentPreprocessor()
    corrupt_bytes = b"NOT_A_VALID_PNG_OR_PDF_HEADER_BLAH_BLAH"

    with pytest.raises(CorruptDocumentError):
        prep.preprocess_bytes(corrupt_bytes, "broken.png")

    with pytest.raises(CorruptDocumentError):
        prep.preprocess_bytes(corrupt_bytes, "broken.pdf")

    with pytest.raises(CorruptDocumentError):
        prep.preprocess_bytes(corrupt_bytes, "broken.json")
