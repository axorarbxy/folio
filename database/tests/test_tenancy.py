"""Test tenant isolation and Row-Level Security enforcement."""

import uuid
import pytest
from sqlalchemy import text, Engine
from folio_db.models.identity import Organization
from folio_db.repositories.organizations import OrganizationRepository
from folio_db.session import tenant_session, system_session
from folio_db.errors import NotFoundError
from tests.factories import create_organization_factory


def test_tenant_session_isolation(db_engine: Engine):
    """Ensure two orgs are completely isolated under tenant_session.

    Even when a query runs without WHERE id = ... or WHERE org_id = ...,
    Postgres Row-Level Security automatically restricts the result set to the tenant's own data.
    """
    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()

    # Create two organizations in a system administrative session
    with system_session(db_engine) as session:
        org_a = Organization(
            id=org_a_id,
            name="Tenant A Enterprises",
            legal_name="Tenant A Enterprises Pvt Ltd",
            gstin="27AABCA1111A1Z1",
            state_code="27",
        )
        org_b = Organization(
            id=org_b_id,
            name="Tenant B Logistics",
            legal_name="Tenant B Logistics LLP",
            gstin="29AABCB2222B1Z2",
            state_code="29",
        )
        session.add_all([org_a, org_b])

    # 1. Tenant A session queries all rows without filter
    with tenant_session(db_engine, org_id=org_a_id) as session:
        repo = OrganizationRepository(session)
        # Raw query selecting all rows
        rows = session.query(Organization).all()
        assert len(rows) == 1
        assert rows[0].id == org_a_id
        assert rows[0].name == "Tenant A Enterprises"

        # Direct get of own org
        own_org = repo.get(org_a_id)
        assert own_org.id == org_a_id

        # Direct get of Tenant B org should raise NotFoundError
        with pytest.raises(NotFoundError):
            repo.get(org_b_id)

    # 2. Tenant B session queries all rows without filter
    with tenant_session(db_engine, org_id=org_b_id) as session:
        repo = OrganizationRepository(session)
        rows = session.query(Organization).all()
        assert len(rows) == 1
        assert rows[0].id == org_b_id
        assert rows[0].name == "Tenant B Logistics"

        with pytest.raises(NotFoundError):
            repo.get(org_a_id)

    # 3. System session can see both organizations
    with system_session(db_engine) as session:
        rows = session.query(Organization).all()
        assert len(rows) == 2
        ids = {r.id for r in rows}
        assert org_a_id in ids
        assert org_b_id in ids


def test_cross_tenant_update_blocked_by_rls(db_engine: Engine):
    """Ensure Tenant A cannot update Tenant B's records even if knowing the UUID."""
    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()

    with system_session(db_engine) as session:
        org_a = Organization(id=org_a_id, name="Original Org A", gstin="27AABCA1111A1Z1")
        org_b = Organization(id=org_b_id, name="Original Org B", gstin="29AABCB2222B1Z2")
        session.add_all([org_a, org_b])

    # Tenant A attempts to update Org B by raw SQL
    with tenant_session(db_engine, org_id=org_a_id) as session:
        result = session.execute(
            text("UPDATE app.organizations SET name = 'Hacked Name' WHERE id = :id"),
            {"id": str(org_b_id)},
        )
        # RLS makes Org B invisible, so 0 rows are matched and updated
        assert result.rowcount == 0

    # Verify Org B remains unchanged in system session
    with system_session(db_engine) as session:
        org_b_check = session.get(Organization, org_b_id)
        assert org_b_check.name == "Original Org B"
