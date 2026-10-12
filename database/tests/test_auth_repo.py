"""Tests for AuthRepo: Argon2id authentication, lockout protection, and sessions."""

import uuid
import pytest
from sqlalchemy import Engine
from folio_db.session import system_session, tenant_session
from folio_db.models.identity import Organization, Role
from folio_db.repositories.auth import AuthRepo
from folio_db.repositories.access import AccessRepo
from folio_db.errors import ValidationError, ConflictError


def test_user_creation_and_argon2_authentication(db_engine: Engine):
    """Ensure passwords are encrypted with Argon2id and authenticated in constant time."""
    with system_session(db_engine) as session:
        auth_repo = AuthRepo(session)
        user = auth_repo.create_user(
            email="test.user@example.com",
            name="Test User",
            password="StrongPassword123!",
            phone="+919876543210",
        )
        assert user.id is not None
        assert user.password_hash.startswith("$argon2id$")
        # Ensure plaintext password is NOT in the database
        assert "StrongPassword123!" not in user.password_hash

        # Valid login
        success, authenticated_user, error = auth_repo.authenticate(
            email="test.user@example.com",
            password="StrongPassword123!",
        )
        assert success is True
        assert authenticated_user.id == user.id
        assert error is None

        # Invalid password
        bad_success, bad_user, bad_error = auth_repo.authenticate(
            email="test.user@example.com",
            password="WrongPassword!",
        )
        assert bad_success is False
        assert bad_user is None
        assert bad_error == "Invalid email or password."


def test_lockout_after_repeated_failures(db_engine: Engine):
    """Ensure account locks out after 5 consecutive failed login attempts."""
    with system_session(db_engine) as session:
        auth_repo = AuthRepo(session)
        user = auth_repo.create_user(
            email="lockout.target@example.com",
            name="Lockout Target",
            password="CorrectPassword123!",
        )

        # Trigger 5 failed attempts
        for _ in range(5):
            success, _, _ = auth_repo.authenticate("lockout.target@example.com", "WrongPassword")
            assert success is False

        assert auth_repo.is_locked_out("lockout.target@example.com") is True

        # Even with correct password, login is blocked
        success, _, err = auth_repo.authenticate("lockout.target@example.com", "CorrectPassword123!")
        assert success is False
        assert "temporarily locked out" in err


def test_session_lifecycle_and_suspended_member_blocked(db_engine: Engine):
    """Ensure active members can create sessions, while suspended members cannot."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        org = Organization(id=org_id, name="Session Org", gstin="27AAAAA0000A1Z5")
        session.add(org)
        session.flush()

        role = session.query(Role).filter_by(name="Reviewer", builtin=True).first()
        auth_repo = AuthRepo(session)
        access_repo = AccessRepo(session)

        # Active user
        active_user = auth_repo.create_user("active.member@example.com", "Active Member", "Password123!")
        access_repo.add_member(org_id=org_id, user_id=active_user.id, role_id=role.id, status="active")

        # Suspended user
        suspended_user = auth_repo.create_user("suspended.member@example.com", "Suspended Member", "Password123!")
        access_repo.add_member(org_id=org_id, user_id=suspended_user.id, role_id=role.id, status="suspended")

        # Active user creates session
        sess, token = auth_repo.create_session(active_user.id, org_id)
        assert sess.token_hash is not None
        assert token.startswith("fol_sess_")

        # Verify session lookup
        fetched_sess = auth_repo.get_session_by_token(token)
        assert fetched_sess is not None
        assert fetched_sess.id == sess.id

        # Suspended member cannot create session
        with pytest.raises(ValidationError, match="suspended"):
            auth_repo.create_session(suspended_user.id, org_id)

        # Revoke session
        revoked = auth_repo.revoke_session(sess.id)
        assert revoked is True
        assert auth_repo.get_session_by_token(token) is None
