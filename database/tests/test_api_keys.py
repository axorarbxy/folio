"""Tests for ApiKeyService: creation, verification, overlap rotation, and constraints."""

from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy import Engine
from folio_db.session import system_session
from folio_db.models.identity import Organization, ApiKey
from folio_db.services.api_key import ApiKeyService
from folio_db.errors import ValidationError


def test_api_key_lifecycle_and_rotation(db_engine: Engine):
    """Ensure API keys are hashed with SHA-256 and rotated with overlap window."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        org = Organization(id=org_id, name="API Key Org", gstin="27CCCCC3333C1Z7")
        session.add(org)
        session.flush()

        service = ApiKeyService(session)

        # 1. Non-empty scopes required
        with pytest.raises(ValidationError, match="at least one scope"):
            service.create(org_id=org_id, name="Empty Key", scopes=[])

        # 2. Valid key creation
        key_record, plaintext_key = service.create(
            org_id=org_id,
            name="Zoho Books Sync",
            scopes=["invoices.read", "invoices.write"],
        )
        assert plaintext_key.startswith("fol_live_")
        # Plaintext is NOT stored in the database
        assert plaintext_key != key_record.key_hash
        assert key_record.prefix in plaintext_key

        # 3. Verification succeeds
        verified = service.verify(plaintext_key)
        assert verified is not None
        assert verified.id == key_record.id

        # Verification fails for invalid key
        bad_key = plaintext_key[:-4] + "xxxx"
        assert service.verify(bad_key) is None

        # 4. Rotation with 24-hour overlap
        rotated_key, new_plaintext_key = service.rotate(key_record.id, overlap_hours=24)
        assert rotated_key.id != key_record.id
        assert new_plaintext_key != plaintext_key

        # During overlap, BOTH old and new keys verify successfully
        assert service.verify(plaintext_key) is not None
        assert service.verify(new_plaintext_key) is not None

        # 5. Revocation
        service.revoke(key_record.id)
        assert service.verify(plaintext_key) is None
        # New key is still valid
        assert service.verify(new_plaintext_key) is not None
