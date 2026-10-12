"""Unified Document Ingestion and Preprocessing Pipeline."""

import hashlib
import json
from io import BytesIO
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

from folio_ml.prep.cleanup import cleanup_image
from folio_ml.prep.contracts import PreparedDocument, PreparedPage, QualityReport
from folio_ml.prep.errors import (
    CorruptDocumentError,
    FileOversizeError,
    UnsupportedFileFormatError,
)
from folio_ml.prep.language import detect_languages, estimate_handwritten_likelihood
from folio_ml.prep.qr import FakeQrDecoder, QrDecoder, parse_einvoice_qr_text
from folio_ml.prep.quality import assess_quality

MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB limit
SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".json"}


class DocumentPreprocessor:
    """Orchestrates intake, optical assessment, cleanup, and feature extraction."""

    def __init__(
        self,
        qr_decoder: QrDecoder | None = None,
        derived_output_dir: Path | None = None,
    ) -> None:
        self.qr_decoder: QrDecoder = qr_decoder or FakeQrDecoder()
        self.derived_output_dir: Path | None = derived_output_dir

    def preprocess_bytes(
        self,
        raw_bytes: bytes,
        filename: str,
        mime_type: str | None = None,
    ) -> PreparedDocument:
        """Processes raw document bytes into a fully prepared document."""
        # 1. Size guard
        if len(raw_bytes) > MAX_FILE_BYTES:
            raise FileOversizeError(filename, len(raw_bytes), MAX_FILE_BYTES)

        # 2. Extension / Format validation
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise UnsupportedFileFormatError(filename, mime_type)

        file_hash = hashlib.sha256(raw_bytes).hexdigest()

        # 3. Handle JSON e-invoice inputs directly
        if ext == ".json":
            return self._handle_json(raw_bytes, filename, file_hash)

        # 4. Handle PDF documents
        if ext == ".pdf":
            return self._handle_pdf(raw_bytes, filename, file_hash)

        # 5. Handle Image documents (PNG, JPG, JPEG)
        return self._handle_image(raw_bytes, filename, file_hash, mime_type or f"image/{ext[1:]}")

    def preprocess_file(self, file_path: Path | str) -> PreparedDocument:
        """Processes a local file from disk."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document file not found: {path}")

        raw_bytes = path.read_bytes()
        return self.preprocess_bytes(raw_bytes, path.name)

    def _handle_json(
        self,
        raw_bytes: bytes,
        filename: str,
        file_hash: str,
    ) -> PreparedDocument:
        try:
            payload = json.loads(raw_bytes.decode("utf-8"))
        except Exception as e:
            raise CorruptDocumentError(filename, f"Invalid JSON syntax: {e}") from e

        text_content = json.dumps(payload, indent=2)
        quality = QualityReport(
            score=1.0,
            blur_score=1.0,
            brightness_score=1.0,
            contrast_score=1.0,
            resolution_score=1.0,
            glare_score=0.0,
            skew_angle_deg=0.0,
            is_acceptable=True,
            rejection_reasons=[],
            tips=[],
        )

        qr_payload = None
        if "qr" in payload or "Irn" in payload or "irn" in payload:
            qr_payload = parse_einvoice_qr_text(json.dumps(payload))

        return PreparedDocument(
            file_hash=file_hash,
            file_name=filename,
            mime_type="application/json",
            pages=[
                PreparedPage(
                    page_num=1,
                    width=1000,
                    height=1400,
                    dpi=300,
                    text_layer=text_content,
                )
            ],
            text_layer=text_content,
            quality=quality,
            languages=detect_languages(text_content),
            is_handwritten_likely=False,
            qr_payload=qr_payload,
        )

    def _handle_pdf(
        self,
        raw_bytes: bytes,
        filename: str,
        file_hash: str,
    ) -> PreparedDocument:
        try:
            reader = PdfReader(BytesIO(raw_bytes))
        except Exception as e:
            raise CorruptDocumentError(filename, f"Cannot parse PDF structure: {e}") from e

        pages_extracted: list[PreparedPage] = []
        all_text_parts: list[str] = []

        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            all_text_parts.append(page_text)

            # Extract page dimensions from media box
            box = page.mediabox
            w_pt = float(box.width) if box else 595.0
            h_pt = float(box.height) if box else 842.0

            # Convert 72pt to ~300 DPI pixels
            px_w = int(w_pt * (300.0 / 72.0))
            px_h = int(h_pt * (300.0 / 72.0))

            pages_extracted.append(
                PreparedPage(
                    page_num=idx + 1,
                    width=px_w,
                    height=px_h,
                    dpi=300,
                    text_layer=page_text,
                )
            )

        full_text = "\n\n".join(all_text_parts)
        has_digital_text = len(full_text.strip()) > 50

        # Quality estimation for digital PDF:
        # High base score if native digital vector text is present
        quality = QualityReport(
            score=0.95 if has_digital_text else 0.80,
            blur_score=1.0 if has_digital_text else 0.85,
            brightness_score=1.0,
            contrast_score=1.0 if has_digital_text else 0.85,
            resolution_score=1.0,
            glare_score=0.0,
            skew_angle_deg=0.0,
            is_acceptable=True,
            rejection_reasons=[],
            tips=[],
        )

        languages = detect_languages(full_text)
        is_handwritten = estimate_handwritten_likelihood(
            full_text, has_digital_text_layer=has_digital_text
        )

        return PreparedDocument(
            file_hash=file_hash,
            file_name=filename,
            mime_type="application/pdf",
            pages=pages_extracted,
            text_layer=full_text,
            quality=quality,
            languages=languages,
            is_handwritten_likely=is_handwritten,
            qr_payload=None,
        )

    def _handle_image(
        self,
        raw_bytes: bytes,
        filename: str,
        file_hash: str,
        mime_type: str,
    ) -> PreparedDocument:
        try:
            image = Image.open(BytesIO(raw_bytes))
            image.load()
        except Exception as e:
            raise CorruptDocumentError(filename, f"Unrecognized image data: {e}") from e

        quality = assess_quality(image)
        _cleaned_img, derived_path = cleanup_image(
            image=image,
            quality=quality,
            output_dir=self.derived_output_dir,
            file_hash=file_hash,
        )

        qr_payload = self.qr_decoder.decode(image)

        languages = ["en"]
        if qr_payload and qr_payload.raw_text:
            languages = detect_languages(qr_payload.raw_text)

        w, h = image.size
        page = PreparedPage(
            page_num=1,
            width=w,
            height=h,
            dpi=None,
            text_layer="",
            image_path=derived_path,
        )

        return PreparedDocument(
            file_hash=file_hash,
            file_name=filename,
            mime_type=mime_type,
            pages=[page],
            text_layer="",
            quality=quality,
            languages=languages,
            is_handwritten_likely=False,
            qr_payload=qr_payload,
            derived_image_path=derived_path,
        )
