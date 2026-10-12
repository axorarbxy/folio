"""WhatsApp wa.me click-to-chat URL builder with length limits and URL encoding."""

import re
import urllib.parse

MAX_WA_URL_LENGTH = 2048


def build_whatsapp_link(text: str, phone: str | None = None) -> str:
    """Constructs a pre-filled WhatsApp click-to-chat link.

    - Validates phone format (digits only, country code, e.g. '919876543210').
    - URL encodes the message text.
    - Enforces the 2048-character length limit.
    - NEVER sends anything automatically; generates draft link for human approval.
    """
    clean_phone = ""
    if phone:
        # Strip all non-digit characters (+, spaces, dashes)
        digits = re.sub(r"\D", "", phone)
        if digits:
            # If 10 digits (Indian mobile), prefix country code 91
            if len(digits) == 10:
                clean_phone = f"91{digits}"
            else:
                clean_phone = digits

    base_url = f"https://wa.me/{clean_phone}" if clean_phone else "https://wa.me/"

    # Check length and truncate text if necessary
    encoded = urllib.parse.quote(text)
    full_url = f"{base_url}?text={encoded}"

    if len(full_url) > MAX_WA_URL_LENGTH:
        # Truncate text until URL fits within MAX_WA_URL_LENGTH
        overflow = len(full_url) - MAX_WA_URL_LENGTH + 12
        truncated_text = text[:-overflow] + "..."
        encoded = urllib.parse.quote(truncated_text)
        full_url = f"{base_url}?text={encoded}"

    return full_url
