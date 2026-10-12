"""InviteService: secure invitation links with single-use hashed tokens and expiry."""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import uuid
from sqlalchemy import select, and_
from sqlalchemy.orm import Session as OrmSession
from folio_db.models.identity import Invitation, Membership, Role, User
from folio_db.security.crypto import generate_invitation_token, hash_secret
from folio_db.errors import NotFoundError, ValidationError, ConflictError
from folio_db.services.audit import audit_record


class InviteService:
    """Service managing workspace invitations with hashed single-use tokens."""

    def __init__(self, session: OrmSession) -> None:
        self.session = session

    def create_invitation(
        self,
        org_id: uuid.UUID,
        email: str,
        role_id: uuid.UUID,
        created_by: Optional[uuid.UUID] = None,
        expires_hours: int = 72,
    ) -> Tuple[Invitation, str]:
        """Issue an invitation token with expiry, storing only its SHA-256 hash."""
        clean_email = email.strip().lower()

        # Check existing active membership
        existing_user = self.session.execute(
            select(User).where(User.email == clean_email)
        ).scalar_one_or_none()
        if existing_user:
            existing_mem = self.session.execute(
                select(Membership).where(
                    and_(
                        Membership.org_id == org_id,
                        Membership.user_id == existing_user.id,
                        Membership.status == "active",
                    )
                )
            ).scalar_one_or_none()
            if existing_mem:
                raise ConflictError(f"User '{clean_email}' is already an active member of this organization.")

        plaintext_token, token_hash = generate_invitation_token()
        now = datetime.now(timezone.utc)

        invitation = Invitation(
            id=uuid.uuid4(),
            org_id=org_id,
            email=clean_email,
            role_id=role_id,
            token_hash=token_hash,
            expires_at=now + timedelta(hours=expires_hours),
            created_by=created_by,
            created_at=now,
        )
        self.session.add(invitation)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=created_by,
            action="invitation.created",
            resource_type="invitation",
            resource_id=str(invitation.id),
            payload={"email": clean_email, "role_id": str(role_id)},
        )
        return invitation, plaintext_token

    def accept_invitation(
        self,
        plaintext_token: str,
        user_id: uuid.UUID,
    ) -> Membership:
        """Accept an invitation using single-use plaintext token."""
        token_hash = hash_secret(plaintext_token)
        now = datetime.now(timezone.utc)

        invitation = self.session.execute(
            select(Invitation).where(
                and_(
                    Invitation.token_hash == token_hash,
                    Invitation.accepted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        if not invitation:
            raise NotFoundError("Invalid or already accepted invitation token.")

        if invitation.expires_at < now:
            raise ValidationError("Invitation link has expired.")

        # Ensure user exists
        user = self.session.get(User, user_id)
        if not user:
            raise NotFoundError(f"User {user_id} does not exist.")

        # Check existing membership
        existing = self.session.execute(
            select(Membership).where(
                and_(
                    Membership.org_id == invitation.org_id,
                    Membership.user_id == user_id,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.role_id = invitation.role_id
            existing.status = "active"
            existing.updated_at = now
            membership = existing
        else:
            membership = Membership(
                id=uuid.uuid4(),
                org_id=invitation.org_id,
                user_id=user_id,
                role_id=invitation.role_id,
                status="active",
                invited_by=invitation.created_by,
                created_at=now,
                updated_at=now,
            )
            self.session.add(membership)

        invitation.accepted_at = now
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=invitation.org_id,
            user_id=user_id,
            action="invitation.accepted",
            resource_type="invitation",
            resource_id=str(invitation.id),
        )
        return membership
