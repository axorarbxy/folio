"""Authentication repository: user management, password verification, lockout protection, and sessions."""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List
import uuid
import secrets
from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.orm import Session as OrmSession
from folio_db.models.identity import User, Session, LoginAttempt, Membership
from folio_db.security.crypto import hash_password, verify_password, encrypt_value, decrypt_value, hash_secret
from folio_db.errors import NotFoundError, ConflictError, ValidationError, TenantIsolationError
from folio_db.services.audit import audit_record


class AuthRepo:
    """Repository managing user accounts, authentication attempts, and active sessions."""

    def __init__(self, session: OrmSession) -> None:
        self.session = session

    def create_user(
        self,
        email: str,
        name: str,
        password: str,
        phone: Optional[str] = None,
        locale: str = "en",
    ) -> User:
        """Create a new global user with Argon2id hashed password and encrypted phone."""
        clean_email = email.strip().lower()
        existing = self.session.execute(
            select(User).where(func.lower(User.email) == clean_email)
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(f"User with email '{clean_email}' already exists.")

        user = User(
            id=uuid.uuid4(),
            email=clean_email,
            name=name.strip(),
            phone=encrypt_value(phone.strip()) if phone else None,
            password_hash=hash_password(password),
            status="active",
            locale=locale,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(user)
        self.session.flush()
        return user

    def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Fetch user by primary key."""
        return self.session.get(User, user_id)

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Fetch user by email (case-insensitive)."""
        return self.session.execute(
            select(User).where(func.lower(User.email) == email.strip().lower())
        ).scalar_one_or_none()

    def is_locked_out(self, email: str, window_minutes: int = 15, max_failures: int = 5) -> bool:
        """Check if email is temporarily locked out due to consecutive failed login attempts."""
        clean_email = email.strip().lower()
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

        recent_attempts = self.session.execute(
            select(LoginAttempt)
            .where(
                and_(
                    func.lower(LoginAttempt.email) == clean_email,
                    LoginAttempt.at >= cutoff,
                )
            )
            .order_by(LoginAttempt.at.desc())
            .limit(max_failures)
        ).scalars().all()

        if len(recent_attempts) < max_failures:
            return False

        # If all recent attempts up to threshold were failures, user is locked out
        return all(not att.success for att in recent_attempts)

    def record_login_attempt(
        self,
        email: str,
        success: bool,
        ip: Optional[str] = None,
        method: str = "password",
        reason: Optional[str] = None,
    ) -> LoginAttempt:
        """Append-only record of a login attempt."""
        attempt = LoginAttempt(
            id=uuid.uuid4(),
            email=email.strip().lower(),
            ip=ip,
            method=method,
            success=success,
            reason=reason,
            at=datetime.now(timezone.utc),
        )
        self.session.add(attempt)
        self.session.flush()
        return attempt

    def authenticate(
        self,
        email: str,
        password: str,
        ip: Optional[str] = None,
    ) -> Tuple[bool, Optional[User], Optional[str]]:
        """Authenticate user against Argon2id hash with lockout check.

        Returns:
            (success, user, failure_reason)
        """
        clean_email = email.strip().lower()

        if self.is_locked_out(clean_email):
            self.record_login_attempt(clean_email, success=False, ip=ip, reason="Account locked out due to repeated failures")
            return False, None, "Account temporarily locked out. Please try again later."

        user = self.get_user_by_email(clean_email)
        if not user or not user.password_hash:
            self.record_login_attempt(clean_email, success=False, ip=ip, reason="User not found or no password set")
            return False, None, "Invalid email or password."

        if user.status != "active":
            self.record_login_attempt(clean_email, success=False, ip=ip, reason=f"User status: {user.status}")
            return False, None, f"Account is {user.status}."

        is_valid = verify_password(user.password_hash, password)
        if not is_valid:
            self.record_login_attempt(clean_email, success=False, ip=ip, reason="Invalid credentials")
            return False, None, "Invalid email or password."

        # Success: update last login and log
        user.last_login_at = datetime.now(timezone.utc)
        self.record_login_attempt(clean_email, success=True, ip=ip, reason="Success")
        self.session.flush()
        return True, user, None

    def create_session(
        self,
        user_id: uuid.UUID,
        org_id: uuid.UUID,
        device: Optional[str] = None,
        user_agent: Optional[str] = None,
        ip: Optional[str] = None,
        duration_days: int = 30,
    ) -> Tuple[Session, str]:
        """Create an authenticated session for user in org.

        Suspended or inactive members cannot create sessions.
        Returns (Session, plaintext_token).
        """
        # Verify active membership in org
        membership = self.session.execute(
            select(Membership).where(
                and_(
                    Membership.user_id == user_id,
                    Membership.org_id == org_id,
                )
            )
        ).scalar_one_or_none()

        if not membership:
            raise TenantIsolationError(f"User {user_id} is not a member of organization {org_id}.")
        if membership.status != "active":
            raise ValidationError(f"Member is {membership.status} in this workspace and cannot create a session.")
        if membership.expires_at and membership.expires_at < datetime.now(timezone.utc):
            raise ValidationError("Temporary access membership has expired.")

        plaintext_token = f"fol_sess_{secrets.token_urlsafe(32)}"
        token_hash = hash_secret(plaintext_token)
        now = datetime.now(timezone.utc)

        session_obj = Session(
            id=uuid.uuid4(),
            user_id=user_id,
            org_id=org_id,
            token_hash=token_hash,
            device=device,
            user_agent=user_agent,
            ip=ip,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(days=duration_days),
            revoked_at=None,
        )
        self.session.add(session_obj)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="session.created",
            resource_type="session",
            resource_id=str(session_obj.id),
        )
        return session_obj, plaintext_token

    def get_session_by_token(self, plaintext_token: str) -> Optional[Session]:
        """Verify and return active unrevoked session by plaintext token."""
        token_hash = hash_secret(plaintext_token)
        now = datetime.now(timezone.utc)
        return self.session.execute(
            select(Session).where(
                and_(
                    Session.token_hash == token_hash,
                    Session.revoked_at.is_(None),
                    Session.expires_at > now,
                )
            )
        ).scalar_one_or_none()

    def revoke_session(self, session_id: uuid.UUID) -> bool:
        """Revoke a single session."""
        sess = self.session.get(Session, session_id)
        if not sess:
            return False
        sess.revoked_at = datetime.now(timezone.utc)
        self.session.flush()
        audit_record(
            session=self.session,
            org_id=sess.org_id,
            user_id=sess.user_id,
            action="session.revoked",
            resource_type="session",
            resource_id=str(session_id),
        )
        return True

    def revoke_all_other_sessions(
        self,
        user_id: uuid.UUID,
        org_id: uuid.UUID,
        current_session_id: uuid.UUID,
    ) -> int:
        """Revoke all active sessions for user in org except the current session."""
        now = datetime.now(timezone.utc)
        result = self.session.execute(
            update(Session)
            .where(
                and_(
                    Session.user_id == user_id,
                    Session.org_id == org_id,
                    Session.id != current_session_id,
                    Session.revoked_at.is_(None),
                )
            )
            .values(revoked_at=now)
        )
        self.session.flush()
        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="session.revoked_all_other",
            resource_type="session",
            resource_id=str(current_session_id),
        )
        return result.rowcount
