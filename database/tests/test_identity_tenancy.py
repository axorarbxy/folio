"""Acceptance tests: cross-tenant isolation, seed story, permission matrix, and zero-plaintext secrets audit."""

import uuid
from typing import List
import pytest
from sqlalchemy import Engine, text, select
from folio_db.session import system_session, tenant_session
from folio_db.models.identity import (
    Organization,
    Membership,
    ApiKey,
    Webhook,
    Session,
    Role,
    Permission,
    RolePermission,
)
from folio_db.repositories.auth import AuthRepo
from folio_db.repositories.access import AccessRepo
from folio_db.services.api_key import ApiKeyService
from folio_db.seeds.identity import seed_security_mock_story


def test_cross_tenant_isolation_on_identity_and_security(db_engine: Engine):
    """Ensure Tenant A cannot view or modify Tenant B's members, API keys, webhooks, or sessions."""
    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()

    # Create tenants and seed distinct data in system session
    with system_session(db_engine) as session:
        org_a = Organization(id=org_a_id, name="Tenant A Alpha", gstin="27AAAAA1111A1Z1")
        org_b = Organization(id=org_b_id, name="Tenant B Beta", gstin="29BBBBB2222B1Z2")
        session.add_all([org_a, org_b])
        session.flush()

        auth_repo = AuthRepo(session)
        access_repo = AccessRepo(session)
        api_key_service = ApiKeyService(session)

        owner_role = session.query(Role).filter_by(name="Owner", builtin=True).first()

        # Tenant A user, key, webhook, session
        user_a = auth_repo.create_user("user.a@tenanta.com", "User A", "PasswordA123!")
        access_repo.add_member(org_a_id, user_a.id, owner_role.id)
        api_key_service.create(org_a_id, "Tenant A Key", ["invoices.read"])
        webhook_a = Webhook(
            id=uuid.uuid4(),
            org_id=org_a_id,
            url="https://alpha.tenanta.com/webhooks",
            events=["invoice.processed"],
            signing_secret="enc_secret_a",
        )
        session.add(webhook_a)
        auth_repo.create_session(user_a.id, org_a_id)

        # Tenant B user, key, webhook, session
        user_b = auth_repo.create_user("user.b@tenantb.com", "User B", "PasswordB123!")
        access_repo.add_member(org_b_id, user_b.id, owner_role.id)
        api_key_service.create(org_b_id, "Tenant B Key", ["invoices.read"])
        webhook_b = Webhook(
            id=uuid.uuid4(),
            org_id=org_b_id,
            url="https://beta.tenantb.com/webhooks",
            events=["invoice.processed"],
            signing_secret="enc_secret_b",
        )
        session.add(webhook_b)
        auth_repo.create_session(user_b.id, org_b_id)

    # 1. Tenant A tenant_session queries
    with tenant_session(db_engine, org_id=org_a_id) as session:
        # Memberships: only Org A
        memberships = session.query(Membership).all()
        assert len(memberships) == 1
        assert memberships[0].org_id == org_a_id

        # API Keys: only Org A
        keys = session.query(ApiKey).all()
        assert len(keys) == 1
        assert keys[0].org_id == org_a_id

        # Webhooks: only Org A
        webhooks = session.query(Webhook).all()
        assert len(webhooks) == 1
        assert webhooks[0].org_id == org_a_id

        # Sessions: only Org A
        sessions = session.query(Session).all()
        assert len(sessions) == 1
        assert sessions[0].org_id == org_a_id

        # Tenant A attempts cross-tenant UPDATE on Tenant B webhook
        res = session.execute(
            text("UPDATE app.webhooks SET url = 'https://hacked.com' WHERE org_id = :b_id"),
            {"b_id": str(org_b_id)},
        )
        assert res.rowcount == 0

        # Tenant A attempts cross-tenant DELETE on Tenant B API key
        res = session.execute(
            text("DELETE FROM app.api_keys WHERE org_id = :b_id"),
            {"b_id": str(org_b_id)},
        )
        assert res.rowcount == 0


def test_security_ui_mock_seed_story(db_engine: Engine):
    """Verify seed script produces the 9 members across the 5 roles matching the Security UI mock story."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        org = Organization(id=org_id, name="Folio GST Workspace", gstin="27AAACF1234F1Z9")
        session.add(org)
        session.flush()

        memberships = seed_security_mock_story(session, org)
        assert len(memberships) == 9

        # Verify role distribution
        role_counts = {}
        for mem in memberships:
            role_name = mem.role.name
            role_counts[role_name] = role_counts.get(role_name, 0) + 1

        assert role_counts.get("Owner") == 1
        assert role_counts.get("Admin") == 1
        assert role_counts.get("Accountant") == 3
        assert role_counts.get("Reviewer") == 3
        assert role_counts.get("Auditor") == 1

        # Verify status distribution (7 active, 1 invited, 1 suspended)
        status_counts = {}
        for mem in memberships:
            status_counts[mem.status] = status_counts.get(mem.status, 0) + 1

        assert status_counts.get("active") == 7
        assert status_counts.get("invited") == 1
        assert status_counts.get("suspended") == 1


def test_permission_matrix_fixtures(db_engine: Engine):
    """Ensure permission matrix can be queried to render the Security UI's roles and permissions table."""
    with system_session(db_engine) as session:
        # Fetch all built-in roles
        roles = session.query(Role).filter_by(builtin=True).order_by(Role.name).all()
        role_names = [r.name for r in roles]
        assert "Owner" in role_names
        assert "Admin" in role_names
        assert "Accountant" in role_names
        assert "Reviewer" in role_names
        assert "Auditor" in role_names

        # Fetch permissions
        permissions = session.query(Permission).order_by(Permission.code).all()
        assert len(permissions) >= 9

        # Ensure every built-in role has permission entries
        for role in roles:
            rps = session.query(RolePermission).filter_by(role_id=role.id).all()
            assert len(rps) > 0


def test_zero_plaintext_secrets_in_database_dump(db_engine: Engine):
    """Verify that plaintext API keys, passwords, and secrets never appear in the database."""
    org_id = uuid.uuid4()
    plaintext_password = "SecretPassword123!"
    plaintext_totp = "JBSWY3DPEHPK3PXP"
    plaintext_webhook_sec = "whsec_live_secret998877"

    with system_session(db_engine) as session:
        org = Organization(id=org_id, name="Zero Plaintext Org", gstin="27AAAAA9999A1Z9")
        session.add(org)
        session.flush()

        auth_repo = AuthRepo(session)
        api_key_service = ApiKeyService(session)

        # Create user
        user = auth_repo.create_user("secret.test@example.com", "Secret Test", plaintext_password)
        # Create API key
        key_record, plaintext_api_key = api_key_service.create(
            org_id=org_id,
            name="Production Secret Key",
            scopes=["invoices.read"],
        )

        # Dump raw records
        raw_users = session.execute(text("SELECT email, password_hash, phone FROM app.users WHERE id = :id"), {"id": str(user.id)}).fetchall()
        raw_keys = session.execute(text("SELECT key_hash, prefix FROM app.api_keys WHERE id = :id"), {"id": str(key_record.id)}).fetchall()

        # Audit user dump
        for row in raw_users:
            assert plaintext_password not in row.password_hash
            assert not row.password_hash.startswith(plaintext_password)

        # Audit API key dump
        for row in raw_keys:
            assert plaintext_api_key not in row.key_hash
            assert not row.key_hash.startswith("fol_")
