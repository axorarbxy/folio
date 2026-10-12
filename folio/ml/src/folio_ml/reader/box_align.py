"""Bounding box alignment using word-level OCR coordinates."""

from typing import Any

from folio_ml.contracts.base import Box
from folio_ml.contracts.invoice import Invoice
from folio_ml.reader.normalize import normalize_string


def align_word_boxes(
    invoice: Invoice,
    word_boxes: list[dict[str, Any]] | None = None,
) -> Invoice:
    """Aligns extracted text fields to word-level bounding boxes.

    If external OCR (Tesseract / PaddleOCR) is not installed or word_boxes is None,
    preserves existing boxes or leaves them as None, documenting that no external
    OCR engine is active.
    """
    if not word_boxes:
        return invoice

    updated_inv = invoice.model_copy(deep=True)

    # Simple fuzzy search over word tokens:
    # word_box dict format: {"text": str, "x0": float, "y0": float, "x1": float, "y1": float, "page": int}
    def find_box_for_str(target: str | None) -> Box | None:
        if not target:
            return None
        clean_target = normalize_string(target).lower()
        if not clean_target:
            return None

        # Search for token match
        matching = [
            b for b in word_boxes
            if normalize_string(b.get("text", "")).lower() in clean_target
        ]
        if not matching:
            return None

        min_x0 = min(b["x0"] for b in matching)
        min_y0 = min(b["y0"] for b in matching)
        max_x1 = max(b["x1"] for b in matching)
        max_y1 = max(b["y1"] for b in matching)
        page = matching[0].get("page", 1)

        return Box(
            page=page,
            x0=round(min_x0, 3),
            y0=round(min_y0, 3),
            x1=round(max_x1, 3),
            y1=round(max_y1, 3),
        )

    # Align header fields if currently unassigned
    if updated_inv.number.box is None and updated_inv.number.value:
        updated_inv.number.box = find_box_for_str(updated_inv.number.value)

    if updated_inv.supplier_gstin.box is None and updated_inv.supplier_gstin.value:
        updated_inv.supplier_gstin.box = find_box_for_str(updated_inv.supplier_gstin.value)

    if updated_inv.date.box is None and updated_inv.date.value:
        updated_inv.date.box = find_box_for_str(updated_inv.date.value)

    return updated_inv
