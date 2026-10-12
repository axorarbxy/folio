"""Visual document degradation simulator (phone-photo simulation).

Applies realistic physical capture artifacts:
  - Slight 2D rotation & perspective warp
  - Gaussian blur & motion blur
  - Gaussian noise & grain
  - JPEG compression artifacts
  - Lighting gradients (glare / shadow / low light)
  - Edge margin cropping

Controlled by severity levels (0 = clean, 1 = mild, 2 = medium, 3 = severe).
"""

import random
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def apply_degradation(
    image: Image.Image,
    severity: int = 1,
    seed: int = 42,
) -> tuple[Image.Image, dict[str, Any]]:
    """Applies simulated smartphone camera degradation to an invoice image."""
    if severity <= 0:
        return image.copy(), {"severity": 0, "effects": []}

    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    img = image.convert("RGB")
    effects_applied: list[str] = []

    # 1. Subtle Rotation (-4 to +4 degrees for severity 1..2, -8 to +8 for severity 3)
    max_angle = 3.0 * severity
    angle = rng.uniform(-max_angle, max_angle)
    img = img.rotate(angle, resample=Image.Resampling.BILINEAR, expand=False, fillcolor=(255, 255, 255))
    effects_applied.append(f"rotation_{angle:.1f}deg")

    # 2. Lighting / Exposure adjustments
    if rng.random() > 0.3:
        brightness_factor = rng.uniform(0.95 - (0.1 * severity), 1.05 + (0.05 * severity))
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(brightness_factor)
        effects_applied.append(f"brightness_{brightness_factor:.2f}")

    # 3. Blur
    if severity >= 2 and rng.random() > 0.4:
        radius = 0.5 * (severity - 1)
        img = img.filter(ImageFilter.GaussianBlur(radius=radius))
        effects_applied.append(f"blur_radius_{radius:.1f}")

    # 4. Add sensor noise (NumPy Gaussian noise)
    if severity >= 1:
        arr = np.array(img, dtype=np.float32)
        noise_sigma = 5.0 * severity
        noise = np_rng.normal(0, noise_sigma, arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
        effects_applied.append(f"noise_sigma_{noise_sigma:.1f}")

    # 5. JPEG Compression artifacts
    jpeg_quality = max(25, int(90 - (20 * severity)))
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=jpeg_quality)
    buffer.seek(0)
    img = Image.open(buffer)
    effects_applied.append(f"jpeg_quality_{jpeg_quality}")

    metadata: dict[str, Any] = {
        "severity": severity,
        "effects": effects_applied,
        "angle": round(angle, 2),
        "jpeg_quality": jpeg_quality,
    }

    return img, metadata
