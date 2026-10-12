"""Tests for AccessRepo and RBAC permission evaluation."""

import uuid
import pytest
from sqlalchemy import Engine, text
from folio_db.session import system_session
from folio_db.models.identity import Organization, Role
from folio_db.repositories.auth import AuthRepo
from folio_db.repositories.access import AccessRepo
from folio_db.errors import ValidationError


def test_permission_resolution_across_roles(db_engine: Engine):
    """Ensure permission checks resolve role hierarchy accurately."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        org = Organization(id=org_id, name="RBAC Org", gstin="27AAAAA1111A1Z5")
        session.add(org)
        session.flush()

        auth_repo = AuthRepo(session)
        access_repo = AccessRepo(session)

        # 1. Owner
        owner_role = session.query(Role).filter_by(name="Owner", builtin=True).first()
        owner_user = auth_repo.create_user("owner@example.com", "Owner User", "Pass123!")
        access_repo.add_member(org_id=org_id, user_id=owner_user.id, role_id=owner_role.id)

        # Owner has admin level on everything
        assert access_repo.has_permission(owner_user.id, org_id, "invoice.view", "view") is True
        assert access_repo.has_permission(owner_user.id, org_id, "invoice.edit", "admin") is True
        assert access_repo.has_permission(owner_user.id, org_id, "billing.manage", "admin") is True

        # 2. Accountant
        acc_role = session.query(Role).filter_by(name="Accountant", builtin=True).first()
        acc_user = auth_repo.create_user("accountant@example.com", "Accountant User", "Pass123!")
        access_repo.add_member(org_id=org_id, user_id=acc_user.id, role_id=acc_role.id)

        assert access_repo.has_permission(acc_user.id, org_id, "invoice.edit", "edit") is True
        assert access_repo.has_permission(acc_user.id, org_id, "recon.manage", "view") is True
        # Accountant cannot manage security or billing
        assert access_repo.has_permission(acc_user.id, org_id, "security.manage", "view") is False
        assert access_repo.has_permission(acc_user.id, org_id, "billing.manage", "view") is False

        # 3. Auditor (read-only)
        auditor_role = session.query(Role).filter_by(name="Auditor", builtin=True).first()
        auditor_user = auth_repo.create_user("auditor@example.com", "Auditor User", "Pass123!")
        access_repo.add_member(org_id=org_id, user_id=auditor_user.id, role_id=auditor_role.id)

        assert access_repo.has_permission(auditor_user.id, org_id, "invoice.view", "view") is True
        # Auditor cannot edit invoices
        assert access_repo.has_permission(auditor_user.id, org_id, "invoice.edit", "edit") is False


def test_guard_against_removing_last_owner(db_engine: Engine):
    """Ensure removing or demoting the last active Owner of an organization fails."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        org = Organization(id=org_id, name="Owner Guard Org", gstin="27BBBBB2222B1Z6")
        session.add(org)
        session.flush()

        auth_repo = AuthRepo(session)
        access_repo = AccessRepo(session)

        owner_role = session.query(Role).filter_by(name="Owner", builtin=True).first()
        reviewer_role = session.query(Role).filter_by(name="Reviewer", builtin=True).first()

        sole_owner = auth_repo.create_user("sole.owner@example.com", "Sole Owner", "Pass123!")
        access_repo.add_member(org_id=org_id, user_id=sole_owner.id, role_id=owner_role.id)

        # 1. Demoting the last owner fails
        with pytest.raises(ValidationError, match="last active Owner"):
            access_repo.change_role(org_id=org_id, user_id=sole_owner.id, new_role_id=reviewer_role.id)

        # 2. Suspending the last owner fails
        with pytest.raises(ValidationError, match="last active Owner"):
            access_repo.suspend_member(org_id=org_id, user_id=sole_owner.id)

        # 3. Removing the last owner fails
        with pytest.raises(ValidationError, match="last active Owner"):
            access_repo.remove_member(org_id=org_id, user_id=sole_owner.id)

        # 4. Direct SQL delete is blocked by Postgres trigger when in tenant context (is_system = false)
        sp = session.begin_nested()
        session.execute(text("SELECT set_config('app.is_system', 'false', true)"))
        with pytest.raises(Exception):
            session.execute(
                text("DELETE FROM app.memberships WHERE org_id = :org_id AND user_id = :user_id"),
                {"org_id": str(org_id), "user_id": str(sole_owner.id)},
            )
        sp.rollback()
        # Restore is_system for rest of test
        session.execute(text("SELECT set_config('app.is_system', 'true', true)"))



        # 5. Add second owner -> now demoting one succeeds
        second_owner = auth_repo.create_user("second.owner@example.com", "Second Owner", "Pass123!")
        access_repo.add_member(org_id=org_id, user_id=second_owner.id, role_id=owner_role.id)

        # Now demoting sole_owner succeeds because second_owner remains
        updated_mem = access_repo.change_role(org_id=org_id, user_id=sole_owner.id, new_role_id=reviewer_role.id)
        assert updated_mem.role_id == reviewer_role.id
