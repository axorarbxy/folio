"""Document visual cleanup, deskewing, and perspective normalization."""

from pathlib import Path

from PIL import Image, ImageEnhance

from folio_ml.prep.contracts import QualityReport


def cleanup_image(
    image: Image.Image,
    quality: QualityReport,
    output_dir: Path | None = None,
    file_hash: str | None = None,
) -> tuple[Image.Image, str | None]:
    """Cleans up an invoice image via deskewing and normalization.

    HARD RULE: Never overwrites the original input image. Derived files are saved
    under a content-hash path.
    """
    cleaned = image.convert("RGB")

    # 1. Deskew if skew angle is noticeable (>= 0.5 deg)
    if abs(quality.skew_angle_deg) >= 0.5:
        # Rotate back to 0 degrees
        cleaned = cleaned.rotate(
            -quality.skew_angle_deg,
            resample=Image.Resampling.BILINEAR,
            expand=False,
            fillcolor=(255, 255, 255),
        )

    # 2. Mild text contrast enhancement for VLM readability
    enhancer = ImageEnhance.Contrast(cleaned)
    cleaned = enhancer.enhance(1.05)

    # 3. Save derived image under content-hash if output_dir provided
    derived_path_str: str | None = None
    if output_dir and file_hash:
        output_dir.mkdir(parents=True, exist_ok=True)
        dest_path = output_dir / f"{file_hash}_cleaned.png"
        cleaned.save(dest_path, format="PNG")
        derived_path_str = str(dest_path)

    return cleaned, derived_path_str
