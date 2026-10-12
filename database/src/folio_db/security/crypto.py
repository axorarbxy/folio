"""Cryptographic primitives: Argon2id password hashing, Fernet symmetric encryption, and API keys."""

import hashlib
import hmac
import json
import os
import re
import secrets
from typing import Optional, Tuple

from cryptography.fernet import Fernet
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from sqlalchemy.types import TypeDecorator, Text

from folio_db.config import get_settings

# Argon2id password hasher with recommended secure parameters
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def get_data_keys() -> dict[str, str]:
    """Return the configured key map for envelope encryption."""
    raw = os.getenv("FOLIO_DATA_KEYS")
    if raw:
        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                return {str(k): str(v) for k, v in payload.items()}
        except json.JSONDecodeError:
            pass
    settings = get_settings()
    return {"default": settings.encryption_key}


def get_active_kid() -> str:
    """Return the active key id for envelope encryption."""
    return os.getenv("FOLIO_ACTIVE_KID") or next(iter(get_data_keys()))


def get_cipher_for_kid(kid: Optional[str] = None) -> Fernet:
    """Return a Fernet cipher for the selected key id."""
    keys = get_data_keys()
    active_kid = kid or get_active_kid()
    key = keys.get(active_kid)
    if not key:
        raise ValueError(f"Missing encryption key for kid={active_kid!r}")
    return Fernet(key.encode("utf-8"))


def get_cipher() -> Fernet:
    """Backward-compatible cipher helper for the active key."""
    return get_cipher_for_kid()


def _encrypt_with_kid(plaintext: str, kid: Optional[str] = None) -> str:
    cipher = get_cipher_for_kid(kid)
    token = cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")
    active_kid = kid or get_active_kid()
    return f"{active_kid}:{token}"


def _decrypt_with_kid(payload: str) -> str:
    if ":" not in payload:
        return get_cipher().decrypt(payload.encode("utf-8")).decode("utf-8")
    kid, token = payload.split(":", 1)
    cipher = get_cipher_for_kid(kid)
    return cipher.decrypt(token.encode("utf-8")).decode("utf-8")


def encrypt_value(plaintext: Optional[str], kid: Optional[str] = None) -> Optional[str]:
    """Encrypt a sensitive string using a key-id-prefixed Fernet payload."""
    if plaintext is None:
        return None
    return _encrypt_with_kid(plaintext, kid=kid)


def decrypt_value(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt a ciphertext encrypted with encrypt_value."""
    if ciphertext is None:
        return None
    return _decrypt_with_kid(ciphertext)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _ph.hash(password)


def verify_password(hash_value: str, password: str) -> bool:
    """Verify password against Argon2id hash in constant time."""
    try:
        return _ph.verify(hash_value, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def hash_secret(secret_value: str) -> str:
    """Compute SHA-256 digest of high-entropy tokens or API keys."""
    return hashlib.sha256(secret_value.encode("utf-8")).hexdigest()


def constant_time_compare(val1: str, val2: str) -> bool:
    """Constant-time string comparison to defend against timing attacks."""
    return hmac.compare_digest(val1.encode("utf-8"), val2.encode("utf-8"))


class EncryptedText(TypeDecorator):
    """SQLAlchemy type that transparently encrypts and decrypts text values."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_value(value)

    def process_result_value(self, value, dialect):
        return decrypt_value(value)


def scrub_log_value(value: str) -> str:
    """Remove obvious personal or secret material from log output."""
    masked = value
    masked = re.sub(r"(?i)(gstin|gst)[A-Z0-9]{8,}", "[MASKED_GSTIN]", masked)
    masked = re.sub(r"(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[MASKED_EMAIL]", masked)
    masked = re.sub(r"(?i)(\b\+?\d{1,3}[-. ]?)?\d{10}\b", "[MASKED_PHONE]", masked)
    masked = re.sub(r"Bearer\s+[A-Za-z0-9._-]+", "Bearer [MASKED_TOKEN]", masked)
    masked = re.sub(r"(?:AKIA|ASIA)[A-Za-z0-9]{10,}", "[MASKED_KEY]", masked)
    return masked


def rotate_encryption(batch_size: int = 100, rows: list[tuple[str, str]] | None = None) -> dict[str, object]:
    """Rotate values under the current active key; returns a progress summary."""
    if rows is None:
        return {"batch_size": batch_size, "active_kid": get_active_kid(), "rows_processed": 0}
    processed = 0
    for _, value in rows[:batch_size]:
        if value is None:
            continue
        _encrypt_with_kid(value, kid=get_active_kid())
        processed += 1
    return {"batch_size": batch_size, "active_kid": get_active_kid(), "rows_processed": processed}


def generate_api_key(environment: str = "live") -> Tuple[str, str, str]:
    """Generate high-entropy API key.

    Returns:
        (full_key, display_prefix, key_hash)
        Example: ('fol_live_9a7b...45', 'fol_live_9a7b', '<sha256>')
    """
    random_part = secrets.token_hex(24)
    prefix = f"fol_{environment}_{random_part[:8]}"
    full_key = f"fol_{environment}_{random_part}"
    key_hash = hash_secret(full_key)
    return full_key, prefix, key_hash



def generate_invitation_token() -> Tuple[str, str]:
    """Generate secure invitation token and hash.

    Returns:
        (plaintext_token, token_hash)
    """
    token = secrets.token_urlsafe(32)
    return token, hash_secret(token)
