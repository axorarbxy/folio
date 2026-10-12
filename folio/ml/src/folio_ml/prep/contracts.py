"""Data contracts and quality models for document preprocessing."""

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class QualityReport(BaseModel):
    """Assessment of optical and capture quality of an invoice image."""

    score: float = Field(..., ge=0.0, le=1.0, description="Overall document quality (0..1)")
    blur_score: float = Field(..., ge=0.0, le=1.0, description="Sharpness measure based on Laplacian variance")
    brightness_score: float = Field(..., ge=0.0, le=1.0, description="Exposure optimality score")
    contrast_score: float = Field(..., ge=0.0, le=1.0, description="Dynamic range / contrast score")
    resolution_score: float = Field(..., ge=0.0, le=1.0, description="Pixel resolution adequacy")
    glare_score: float = Field(..., ge=0.0, le=1.0, description="Fraction of saturated glare/reflection")
    skew_angle_deg: float = Field(..., description="Estimated document skew angle in degrees")
    is_acceptable: bool = Field(..., description="Whether image meets minimum OCR/VLM thresholds")
    rejection_reasons: list[str] = Field(default_factory=list, description="Specific quality rejection triggers")
    tips: list[str] = Field(default_factory=list, description="Human-actionable tips for camera capture")


class QrInvoicePayload(BaseModel):
    """Parsed payload from an e-invoice signed B2B QR code."""

    raw_text: str = Field(..., description="Raw text decoded from the QR code")
    irn: str | None = Field(default=None, description="64-character Invoice Reference Number")
    supplier_gstin: str | None = Field(default=None, description="Supplier GSTIN extracted from QR")
    buyer_gstin: str | None = Field(default=None, description="Buyer GSTIN extracted from QR")
    invoice_number: str | None = Field(default=None, description="Invoice document number")
    invoice_date: str | None = Field(default=None, description="Invoice date in ISO 8601 YYYY-MM-DD")
    total_amount: Decimal | None = Field(default=None, description="Total invoice amount in Decimal")
    # HARD RULE: Never claim signature verification without official cryptographic signoff
    signature_verified: bool = Field(
        default=False,
        description="Whether NIC/CBIC public key signature was verified. Defaults to False (# TODO: NIC RSA key verification)",
    )
    parsed_fields: dict[str, Any] = Field(default_factory=dict, description="Additional decoded attributes")


class PreparedPage(BaseModel):
    """Metadata and extracted text layer for a single document page."""

    page_num: int = Field(..., ge=1, description="1-indexed page number")
    width: int = Field(..., gt=0, description="Width in pixels")
    height: int = Field(..., gt=0, description="Height in pixels")
    dpi: int | None = Field(default=None, description="Estimated dots per inch")
    text_layer: str = Field(default="", description="Digital text layer extracted from PDF if present")
    image_path: str | None = Field(default=None, description="Cache path to normalized page image")


class PreparedDocument(BaseModel):
    """Standardized output produced by document ingestion and preprocessing."""

    file_hash: str = Field(..., description="SHA-256 hash of original input file")
    file_name: str = Field(..., description="Original filename")
    mime_type: str = Field(..., description="MIME type of document")
    pages: list[PreparedPage] = Field(default_factory=list, description="Extracted pages")
    text_layer: str = Field(default="", description="Aggregated digital text across all pages")
    quality: QualityReport = Field(..., description="Optical capture quality report")
    languages: list[str] = Field(default_factory=lambda: ["en"], description="Detected ISO language codes (e.g. en, hi)")
    is_handwritten_likely: bool = Field(default=False, description="Heuristic flag for handwriting detection")
    qr_payload: QrInvoicePayload | None = Field(default=None, description="Decoded QR payload if detected")
    derived_image_path: str | None = Field(default=None, description="Path to deskewed, normalized derived image")
