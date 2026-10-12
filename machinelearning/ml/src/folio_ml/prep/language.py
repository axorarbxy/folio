"""Script and language detection heuristics for Indian multi-lingual GST documents."""

import re

# Unicode character ranges for prominent Indian scripts
SCRIPT_UNICODE_RANGES: dict[str, tuple[str, str, str]] = {
    "hi": ("Devanagari", r"[\u0900-\u097F]", "Hindi/Marathi"),
    "ta": ("Tamil", r"[\u0B80-\u0BFF]", "Tamil"),
    "te": ("Telugu", r"[\u0C00-\u0C7F]", "Telugu"),
    "kn": ("Kannada", r"[\u0C80-\u0CFF]", "Kannada"),
    "gu": ("Gujarati", r"[\u0A80-\u0AFF]", "Gujarati"),
    "bn": ("Bengali", r"[\u0980-\u09FF]", "Bengali"),
    "ml": ("Malayalam", r"[\u0D00-\u0D7F]", "Malayalam"),
    "pa": ("Gurmukhi", r"[\u0A00-\u0A7F]", "Punjabi"),
}

LATIN_REGEX = re.compile(r"[A-Za-z]")


def detect_languages(text: str) -> list[str]:
    """Detects languages present in invoice text using Unicode block heuristics."""
    if not text or not text.strip():
        return ["en"]

    detected: list[str] = []

    # Check for Latin characters (English standard in GST invoices)
    if LATIN_REGEX.search(text):
        detected.append("en")

    # Check Indian regional scripts
    for lang_code, (_name, pattern, _label) in SCRIPT_UNICODE_RANGES.items():
        matches = re.findall(pattern, text)
        if len(matches) >= 3:  # Threshold of 3+ glyphs to avoid stray symbols
            if lang_code not in detected:
                detected.append(lang_code)

    return detected if detected else ["en"]


def estimate_handwritten_likelihood(
    text: str,
    has_digital_text_layer: bool = False,
) -> bool:
    """Heuristic guess for whether an invoice is handwritten.

    Documented Heuristic:
    1. Digital vector PDFs with structured font embeddings are never handwritten.
    2. Printed synthetic invoices use standard typography and structured layout.
    3. Hand-filled manual chits typically have short fragmentary OCR text without standard
       fixed-pitch tabular structure.
    """
    if has_digital_text_layer:
        return False

    # Heuristic: Extremely short text fragments with irregular punctuation indicate manual chits
    clean = text.strip()
    if clean and len(clean) < 40 and not any(kw in clean.upper() for kw in ["INVOICE", "TAX", "GST"]):
        return True

    return False
