"""ApiKeyService: high-entropy generation, constant-time verification, rotation with overlap, and revocation."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session as OrmSession
from folio_db.models.identity import ApiKey
from folio_db.security.crypto import generate_api_key, hash_secret, constant_time_compare
from folio_db.errors import NotFoundError, ValidationError
from folio_db.services.audit import audit_record


class ApiKeyService:
    """Service managing tenant API key lifecycle with zero-plaintext persistence."""

    def __init__(self, session: OrmSession) -> None:
        self.session = session

    def create(
        self,
        org_id: uuid.UUID,
        name: str,
        scopes: List[str],
        created_by: Optional[uuid.UUID] = None,
        expires_at: Optional[datetime] = None,
        environment: str = "live",
    ) -> Tuple[ApiKey, str]:
        """Generate a new high-entropy API key.

        The plaintext key is returned once to the caller and NEVER saved to the database.
        """
        if not scopes:
            raise ValidationError("API key must contain at least one scope.")

        full_key, prefix, key_hash = generate_api_key(environment=environment)
        now = datetime.now(timezone.utc)

        api_key = ApiKey(
            id=uuid.uuid4(),
            org_id=org_id,
            name=name.strip(),
            prefix=prefix,
            key_hash=key_hash,
            scopes=scopes,
            created_by=created_by,
            expires_at=expires_at,
            created_at=now,
        )
        self.session.add(api_key)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=created_by,
            action="api_key.created",
            resource_type="api_key",
            resource_id=str(api_key.id),
            payload={"name": name, "prefix": prefix, "scopes": scopes},
        )
        return api_key, full_key

    def verify(self, full_key: str) -> Optional[ApiKey]:
        """Look up by prefix then verify key hash in constant time."""
        if not full_key or not full_key.startswith("fol_"):
            return None

        # Extract prefix (fol_{env}_{8chars})
        parts = full_key.split("_")
        if len(parts) < 3:
            return None
        prefix = f"{parts[0]}_{parts[1]}_{parts[2][:8]}"

        now = datetime.now(timezone.utc)
        candidate = self.session.execute(
            select(ApiKey).where(
                and_(
                    ApiKey.prefix == prefix,
                    ApiKey.revoked_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        if not candidate:
            return None

        # Check expiration and rotation overlap
        if candidate.expires_at and candidate.expires_at < now:
            return None
        if candidate.overlap_until and candidate.overlap_until < now:
            return None

        computed_hash = hash_secret(full_key)
        if not constant_time_compare(computed_hash, candidate.key_hash):
            return None

        return candidate

    def rotate(
        self,
        api_key_id: uuid.UUID,
        overlap_hours: int = 24,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Tuple[ApiKey, str]:
        """Rotate an existing key, preserving an overlap window for graceful migration."""
        old_key = self.session.get(ApiKey, api_key_id)
        if not old_key:
            raise NotFoundError(f"API key {api_key_id} not found.")

        now = datetime.now(timezone.utc)
        old_key.overlap_until = now + timedelta(hours=overlap_hours)

        # Create replacement key with identical scopes and name
        new_key, plaintext_key = self.create(
            org_id=old_key.org_id,
            name=f"{old_key.name} (Rotated)",
            scopes=old_key.scopes,
            created_by=actor_user_id,
            expires_at=old_key.expires_at,
        )

        audit_record(
            session=self.session,
            org_id=old_key.org_id,
            user_id=actor_user_id,
            action="api_key.rotated",
            resource_type="api_key",
            resource_id=str(new_key.id),
            payload={"old_key_id": str(old_key.id), "overlap_until": old_key.overlap_until.isoformat()},
        )
        return new_key, plaintext_key

    def touch_last_used(self, api_key_id: uuid.UUID) -> None:
        """Record last used timestamp."""
        key = self.session.get(ApiKey, api_key_id)
        if key:
            key.last_used_at = datetime.now(timezone.utc)
            self.session.flush()

    def revoke(self, api_key_id: uuid.UUID, actor_user_id: Optional[uuid.UUID] = None) -> bool:
        """Revoke API key immediately."""
        key = self.session.get(ApiKey, api_key_id)
        if not key or key.revoked_at is not None:
            return False

        key.revoked_at = datetime.now(timezone.utc)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=key.org_id,
            user_id=actor_user_id,
            action="api_key.revoked",
            resource_type="api_key",
            resource_id=str(api_key_id),
        )
        return True
