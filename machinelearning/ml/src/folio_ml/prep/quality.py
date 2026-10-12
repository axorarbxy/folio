"""Document optical quality assessment engine."""

import numpy as np
from PIL import Image, ImageFilter

from folio_ml.prep.contracts import QualityReport


def estimate_skew_angle(image: Image.Image, max_angle: float = 10.0, step: float = 0.5) -> float:
    """Estimates document skew angle in degrees using horizontal projection variance."""
    # Downsample for fast projection profile analysis
    thumb = image.convert("L").resize((300, 400), resample=Image.Resampling.BILINEAR)
    arr = np.array(thumb, dtype=np.float32)

    # Edge detection for projection profile
    edges = np.abs(arr[1:, :] - arr[:-1, :]) > 15.0

    best_angle = 0.0
    max_variance = -1.0

    # Test candidate angles from -max_angle to +max_angle
    angles = np.arange(-max_angle, max_angle + step, step)
    for angle in angles:
        # Rotate binary edge map
        rotated = Image.fromarray(edges).rotate(
            float(angle),
            resample=Image.Resampling.NEAREST,
            expand=False,
            fillcolor=0,
        )
        profile = np.sum(np.array(rotated), axis=1)
        variance = float(np.var(profile))
        if variance > max_variance:
            max_variance = variance
            best_angle = float(angle)

    return -round(best_angle, 1)


def assess_quality(image: Image.Image) -> QualityReport:
    """Computes comprehensive optical capture quality report for an invoice image."""
    img_rgb = image.convert("RGB")
    width, height = img_rgb.size

    # 1. Resolution score (target: >= 1600px along longest edge for good OCR)
    long_edge = max(width, height)
    resolution_score = min(1.0, max(0.0, long_edge / 1600.0))

    # 2. Skew angle estimation
    skew_angle = estimate_skew_angle(img_rgb)
    skew_penalty = min(1.0, abs(skew_angle) / 10.0)

    # 3. Blur & Sharpness (via smoothed Laplacian variance)
    # BoxBlur(1) removes single-pixel camera sensor grain before measuring text edge sharpness
    smoothed = img_rgb.filter(ImageFilter.BoxBlur(1))
    arr_lum = np.array(smoothed.convert("L"), dtype=np.float32)

    laplacian = (
        -4.0 * arr_lum[1:-1, 1:-1]
        + arr_lum[:-2, 1:-1]
        + arr_lum[2:, 1:-1]
        + arr_lum[1:-1, :-2]
        + arr_lum[1:-1, 2:]
    )
    lap_var = float(np.var(laplacian))

    # Map laplacian variance to 0..1 scale (sharp printed text ~ 1200+, blurry < 250)
    blur_score = min(1.0, max(0.0, float(np.log1p(lap_var) / np.log1p(1800.0))))

    # 4. Brightness & Exposure
    raw_lum = np.array(img_rgb.convert("L"), dtype=np.float32)
    mean_lum = float(np.mean(raw_lum))
    # Ideal invoice brightness is ~190..230 on white paper
    brightness_dev = abs(mean_lum - 200.0)
    brightness_score = max(0.0, 1.0 - (brightness_dev / 140.0))

    # 5. Contrast (clean documents have std ~ 40..65)
    std_lum = float(np.std(raw_lum))
    contrast_score = min(1.0, max(0.0, std_lum / 50.0))

    # 6. Glare detection: on digital/scanned white sheets (mean_lum >= 235), white background
    # is standard. In physical camera photos (mean_lum < 235), high clipped highlights (> 253) indicate glare.
    if mean_lum < 235.0:
        glare_fraction = float(np.mean(raw_lum > 253.0))
        glare_score = min(1.0, glare_fraction * 5.0)
    else:
        glare_score = 0.0

    # 7. Overall Composite Score (weighted blend)
    composite = (
        0.40 * blur_score
        + 0.25 * contrast_score
        + 0.15 * brightness_score
        + 0.10 * resolution_score
        + 0.10 * (1.0 - skew_penalty)
    )
    # Deduct glare penalty if severe
    if glare_score > 0.3:
        composite *= (1.0 - 0.25 * glare_score)

    overall_score = round(max(0.0, min(1.0, composite)), 3)

    # 8. Rejection and Tips determination
    rejections: list[str] = []
    tips: list[str] = []

    if blur_score < 0.35:
        rejections.append("SEVERE_BLUR")
        tips.append("Photo is blurry. Hold phone steady and tap screen to focus.")
    if brightness_score < 0.35:
        rejections.append("POOR_LIGHTING")
        tips.append("Image is too dark or poorly lit. Retake under direct overhead lighting.")
    if glare_score > 0.40:
        rejections.append("SEVERE_GLARE")
        tips.append("Glare or flash reflection detected on document. Turn off camera flash.")
    if abs(skew_angle) > 6.0:
        rejections.append("EXCESSIVE_SKEW")
        tips.append(f"Document is skewed ({skew_angle:+.1f}°). Align camera parallel to invoice.")
    if resolution_score < 0.35:
        rejections.append("LOW_RESOLUTION")
        tips.append("Image resolution is too low. Move closer so invoice fills camera frame.")

    is_acceptable = (overall_score >= 0.40) and (len(rejections) == 0)

    return QualityReport(
        score=overall_score,
        blur_score=round(blur_score, 3),
        brightness_score=round(brightness_score, 3),
        contrast_score=round(contrast_score, 3),
        resolution_score=round(resolution_score, 3),
        glare_score=round(glare_score, 3),
        skew_angle_deg=skew_angle,
        is_acceptable=is_acceptable,
        rejection_reasons=rejections,
        tips=tips,
    )
